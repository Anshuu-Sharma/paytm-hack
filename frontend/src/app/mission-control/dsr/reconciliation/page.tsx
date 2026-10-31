"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { container, item } from "@/lib/dashboard/motion";
import { Chip } from "@/components/dashboard/Card";
import PageHeader from "@/components/dashboard/PageHeader";
import { shortDate } from "@/lib/dashboard/format";
import { RECON_ROWS, DSR_MONTH_LABEL, formatINR, type ReconDayRow, type ReconStatus, type AlertLevel } from "@/lib/dashboard/dsr";

const STATUS_TONE: Record<ReconStatus, { fg: string; soft: string; label: string }> = {
  MATCHED: { fg: "var(--d-ok)", soft: "var(--d-ok-soft)", label: "Matched" },
  DISCREPANCY: { fg: "var(--d-warn)", soft: "var(--d-warn-soft)", label: "Discrepancy" },
  MISSING_DSR: { fg: "var(--d-info)", soft: "var(--d-info-soft)", label: "Missing DSR" },
  MISSING_BANK: { fg: "var(--d-bad)", soft: "var(--d-bad-soft)", label: "Missing Bank" },
};

const ALERT_TONE: Record<AlertLevel, { fg: string; icon: string }> = {
  GREEN: { fg: "var(--d-ok)", icon: "✓" },
  YELLOW: { fg: "var(--d-warn)", icon: "!" },
  RED: { fg: "var(--d-bad)", icon: "✕" },
};

function StatusChip({ status }: { status: ReconStatus }) {
  const t = STATUS_TONE[status];
  return <Chip tone={t}>{t.label}</Chip>;
}

function KpiTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <section className="flex min-h-[94px] flex-col justify-between rounded-[18px] p-3.5" style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)" }}>
      <span className="text-[10px] font-medium uppercase tracking-wider leading-tight" style={{ color: "var(--d-muted)" }}>{label}</span>
      <span className="text-[20px] font-semibold leading-none tracking-[-0.02em]" style={{ color }}>{value}</span>
    </section>
  );
}

export default function ReconciliationPage() {
  const [statusFilter, setStatusFilter] = useState<ReconStatus | "all">("all");
  const [selected, setSelected] = useState<ReconDayRow | null>(null);

  const rows = RECON_ROWS;
  const filtered = useMemo(
    () => (statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter)),
    [rows, statusFilter],
  );

  const summary = useMemo(() => {
    const matched = rows.filter((r) => r.status === "MATCHED").length;
    const discrepancies = rows.filter((r) => r.status === "DISCREPANCY").length;
    const missingDsr = rows.filter((r) => r.status === "MISSING_DSR").length;
    const missingBank = rows.filter((r) => r.status === "MISSING_BANK").length;
    const totalDiscrepancy = rows.reduce((s, r) => s + Math.abs(r.discrepancy), 0);
    return { total: rows.length, matched, discrepancies, missingDsr, missingBank, totalDiscrepancy };
  }, [rows]);

  const statusFilters: Array<{ key: ReconStatus | "all"; label: string }> = [
    { key: "all", label: "All" },
    { key: "MATCHED", label: "Matched" },
    { key: "DISCREPANCY", label: "Discrepancy" },
    { key: "MISSING_DSR", label: "Missing DSR" },
    { key: "MISSING_BANK", label: "Missing Bank" },
  ];

  return (
    <motion.div className="mx-auto max-w-[1100px] space-y-4 p-4 md:p-5" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader
          title="Reconciliation"
          subtitle={`DSR vs Bank Statement — ${DSR_MONTH_LABEL} · Sports Planet`}
          accent="var(--d-warn)"
        />
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiTile label="Total Days" value={String(summary.total)} color="var(--d-ink)" />
        <KpiTile label="Matched" value={String(summary.matched)} color="var(--d-ok)" />
        <KpiTile label="Discrepancies" value={String(summary.discrepancies)} color="var(--d-warn)" />
        <KpiTile label="Missing DSR" value={String(summary.missingDsr)} color="var(--d-info)" />
        <KpiTile label="Total Discrepancy" value={formatINR(summary.totalDiscrepancy)} color="var(--d-bad)" />
      </motion.div>

      <motion.div variants={item} className="overflow-hidden rounded-[20px]" style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)" }}>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--d-border)" }}>
          <span className="text-[11px] font-medium" style={{ color: "var(--d-muted)" }}>Status:</span>
          <div className="flex flex-wrap gap-1">
            {statusFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
                style={{
                  background: statusFilter === f.key ? "var(--d-accent)" : "var(--d-surface-2)",
                  color: statusFilter === f.key ? "#fff" : "var(--d-muted)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[560px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--d-border)", background: "var(--d-surface-2)" }}>
                {["Date", "Day", "DSR (Software) Total", "Bank Total", "Discrepancy", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--d-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[12px]" style={{ color: "var(--d-faint)" }}>No results for this filter.</td></tr>
              ) : filtered.map((r) => {
                const softwareTotal = r.software.card + r.software.cash + r.software.upi;
                const bankTotal = r.bank.card + r.bank.cash + r.bank.upi;
                return (
                  <tr
                    key={r.date}
                    onClick={() => setSelected(r)}
                    className="cursor-pointer transition-colors"
                    style={{ borderBottom: "1px solid var(--d-border)", background: selected?.date === r.date ? "var(--d-accent-soft)" : undefined }}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--d-ink)" }}>{shortDate(r.date)}</td>
                    <td className="px-4 py-3" style={{ color: "var(--d-muted)" }}>{r.day}</td>
                    <td className="px-4 py-3 font-mono" style={{ color: "var(--d-ink)" }}>{formatINR(softwareTotal)}</td>
                    <td className="px-4 py-3 font-mono" style={{ color: "var(--d-muted)" }}>{formatINR(bankTotal)}</td>
                    <td className="px-4 py-3 font-mono font-semibold" style={{ color: Math.abs(r.discrepancy) > 1000 ? "var(--d-bad)" : "var(--d-muted)" }}>
                      {formatINR(r.discrepancy)}
                    </td>
                    <td className="px-4 py-3"><StatusChip status={r.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Legend */}
      <motion.div variants={item} className="flex flex-wrap items-center justify-center gap-6 rounded-[18px] px-4 py-3 text-[11.5px]" style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)", color: "var(--d-muted)" }}>
        <span className="flex items-center gap-1.5"><span style={{ color: "var(--d-ok)" }}>✓</span> Matched (&lt; ₹500)</span>
        <span className="flex items-center gap-1.5"><span style={{ color: "var(--d-warn)" }}>!</span> Minor (₹500–1000)</span>
        <span className="flex items-center gap-1.5"><span style={{ color: "var(--d-bad)" }}>✕</span> Major (&gt; ₹1000)</span>
      </motion.div>

      {/* Drawer — 3-way comparison for the selected day */}
      <AnimatePresence>
        {selected && (
          <motion.div className="fixed inset-0 z-[300] flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0" style={{ background: "rgba(28,25,23,0.35)" }} onClick={() => setSelected(null)} />
            <motion.aside
              key={selected.date}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative h-full w-full max-w-md overflow-y-auto"
              style={{ background: "var(--d-surface)", borderLeft: "1px solid var(--d-border)", scrollbarWidth: "thin" }}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--d-border)", background: "var(--d-surface)" }}>
                <div>
                  <span className="d-label">Reconciliation Detail</span>
                  <div className="mt-0.5 text-[13px] font-semibold" style={{ color: "var(--d-ink)" }}>{shortDate(selected.date)} · {selected.day}</div>
                </div>
                <button onClick={() => setSelected(null)} className="grid h-7 w-7 place-items-center rounded-md text-[15px] transition-colors hover:bg-[var(--d-surface-2)]" style={{ color: "var(--d-muted)" }} aria-label="Close">✕</button>
              </div>

              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between rounded-xl p-3" style={{ background: STATUS_TONE[selected.status].soft }}>
                  <span className="text-[12.5px] font-semibold" style={{ color: STATUS_TONE[selected.status].fg }}>{STATUS_TONE[selected.status].label}</span>
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: ALERT_TONE[selected.alertLevel].fg }}>
                    {ALERT_TONE[selected.alertLevel].icon} {formatINR(selected.discrepancy)}
                  </span>
                </div>

                {/* Software */}
                <div className="rounded-xl p-3" style={{ background: "var(--d-surface-2)", border: "1px solid var(--d-border)" }}>
                  <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--d-muted)" }}>Software (Logic / POS)</div>
                  {[
                    ["Card Sales", selected.software.card],
                    ["Cash Sales", selected.software.cash],
                    ["UPI Sales", selected.software.upi],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex justify-between py-0.5 text-[12px]">
                      <span style={{ color: "var(--d-muted)" }}>{label}</span>
                      <span className="font-mono" style={{ color: "var(--d-ink)" }}>{formatINR(val as number)}</span>
                    </div>
                  ))}
                  <div className="mt-1.5 flex justify-between border-t pt-1.5 text-[12px] font-semibold" style={{ borderColor: "var(--d-border)" }}>
                    <span>Total</span>
                    <span className="font-mono" style={{ color: "var(--d-accent)" }}>{formatINR(selected.software.card + selected.software.cash + selected.software.upi)}</span>
                  </div>
                </div>

                {/* Card machine */}
                <div className="rounded-xl p-3" style={{ background: "var(--d-surface-2)", border: "1px solid var(--d-border)" }}>
                  <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--d-muted)" }}>Card Machine (Batch Settlement)</div>
                  <div className="flex justify-between py-0.5 text-[12px]">
                    <span style={{ color: "var(--d-muted)" }}>Batch Total</span>
                    <span className="font-mono" style={{ color: "var(--d-ink)" }}>{formatINR(selected.cardMachineTotal)}</span>
                  </div>
                  <div className="flex justify-between py-0.5 text-[12px]">
                    <span style={{ color: "var(--d-muted)" }}>vs Software Card</span>
                    <span className="font-mono font-medium" style={{ color: selected.cardMachineTotal === selected.software.card ? "var(--d-ok)" : "var(--d-warn)" }}>
                      {formatINR(selected.software.card - selected.cardMachineTotal)}
                    </span>
                  </div>
                </div>

                {/* Bank */}
                <div className="rounded-xl p-3" style={{ background: "var(--d-surface-2)", border: "1px solid var(--d-border)" }}>
                  <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--d-muted)" }}>Bank Statement (Deposits Received)</div>
                  {[
                    ["Card Deposits", selected.bank.card],
                    ["Cash Deposits", selected.bank.cash],
                    ["UPI Deposits", selected.bank.upi],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex justify-between py-0.5 text-[12px]">
                      <span style={{ color: "var(--d-muted)" }}>{label}</span>
                      <span className="font-mono" style={{ color: "var(--d-ink)" }}>{formatINR(val as number)}</span>
                    </div>
                  ))}
                  <div className="mt-1.5 flex justify-between border-t pt-1.5 text-[12px] font-semibold" style={{ borderColor: "var(--d-border)" }}>
                    <span>Total</span>
                    <span className="font-mono" style={{ color: "var(--d-ok)" }}>{formatINR(selected.bank.card + selected.bank.cash + selected.bank.upi)}</span>
                  </div>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

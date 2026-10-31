"use client";

import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useDash } from "@/lib/dashboard/i18n";
import { inr } from "@/lib/dashboard/format";
import WinbackPopup, { type WinbackCustomer } from "./WinbackPopup";

/* ── Mock customer data ───────────────────────────────────────────────────── */
const MERCHANT = "Sharma Supermarket";
const TODAY = new Date("2026-10-31");

function daysAgo(n: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

type DormancyStatus = "active" | "at-risk" | "dormant" | "lost";

function dormancyStatus(days: number): DormancyStatus {
  if (days <= 14) return "active";
  if (days <= 28) return "at-risk";
  if (days <= 60) return "dormant";
  return "lost";
}

function buildMessage(name: string, dormantDays: number, spend: number): string {
  const firstName = name.split(" ")[0];
  const cashback = spend > 5000 ? 100 : 50;
  const minSpend = cashback === 100 ? 600 : 400;
  const expiry = new Date(TODAY);
  expiry.setDate(expiry.getDate() + 7);
  const expiryStr = expiry.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `Namaste ${firstName} ji! 🙏\n\nAap kaafi dino se ${MERCHANT} nahi aaye — humein aap ki yaad aayi!\n\nIs hafte aane par payein flat ₹${cashback} Paytm Cashback on ₹${minSpend}+ purchases. Offer valid till ${expiryStr} only.\n\n— ${MERCHANT}`;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  lastVisitDays: number; // days ago
  avgVisitsPerWeek: number;
  totalSpend: number;
  status: DormancyStatus;
  message: string;
}

const RAW: Omit<Customer, "status" | "message">[] = [
  { id: "c01", name: "Priya Sharma",     phone: "+91 98765 43210", lastVisitDays: 6,  avgVisitsPerWeek: 3.2, totalSpend: 12400 },
  { id: "c02", name: "Rajesh Kumar",     phone: "+91 99001 12345", lastVisitDays: 21, avgVisitsPerWeek: 2.1, totalSpend: 8750 },
  { id: "c03", name: "Anita Singh",      phone: "+91 87654 32109", lastVisitDays: 35, avgVisitsPerWeek: 1.8, totalSpend: 6200 },
  { id: "c04", name: "Mohan Verma",      phone: "+91 91234 56789", lastVisitDays: 3,  avgVisitsPerWeek: 4.0, totalSpend: 22100 },
  { id: "c05", name: "Sunita Patel",     phone: "+91 93456 78901", lastVisitDays: 19, avgVisitsPerWeek: 2.5, totalSpend: 9300 },
  { id: "c06", name: "Amit Gupta",       phone: "+91 95678 90123", lastVisitDays: 72, avgVisitsPerWeek: 1.2, totalSpend: 4100 },
  { id: "c07", name: "Kavita Nair",      phone: "+91 96789 01234", lastVisitDays: 10, avgVisitsPerWeek: 3.8, totalSpend: 17800 },
  { id: "c08", name: "Vikram Rao",       phone: "+91 97890 12345", lastVisitDays: 28, avgVisitsPerWeek: 1.5, totalSpend: 5500 },
  { id: "c09", name: "Deepa Joshi",      phone: "+91 98901 23456", lastVisitDays: 48, avgVisitsPerWeek: 1.9, totalSpend: 7900 },
  { id: "c10", name: "Suresh Mehta",     phone: "+91 99012 34567", lastVisitDays: 5,  avgVisitsPerWeek: 2.8, totalSpend: 14200 },
  { id: "c11", name: "Pooja Agarwal",    phone: "+91 90123 45678", lastVisitDays: 24, avgVisitsPerWeek: 2.2, totalSpend: 8100 },
  { id: "c12", name: "Ravi Chopra",      phone: "+91 91234 67890", lastVisitDays: 90, avgVisitsPerWeek: 0.8, totalSpend: 2300 },
  { id: "c13", name: "Geeta Mishra",     phone: "+91 92345 78901", lastVisitDays: 15, avgVisitsPerWeek: 3.5, totalSpend: 11600 },
  { id: "c14", name: "Ashok Tiwari",     phone: "+91 93456 89012", lastVisitDays: 31, avgVisitsPerWeek: 1.6, totalSpend: 6800 },
  { id: "c15", name: "Nirmala Yadav",    phone: "+91 94567 90123", lastVisitDays: 8,  avgVisitsPerWeek: 2.9, totalSpend: 13100 },
];

const CUSTOMERS: Customer[] = RAW.map((r) => ({
  ...r,
  status: dormancyStatus(r.lastVisitDays),
  message: buildMessage(r.name, r.lastVisitDays, r.totalSpend),
}));

/* ── Status chip ──────────────────────────────────────────────────────────── */
const STATUS_STYLE: Record<DormancyStatus, { bg: string; text: string; label: (d: ReturnType<typeof useDash>["d"]) => string }> = {
  active:   { bg: "var(--d-ok-soft)",     text: "var(--d-ok)",    label: (d) => d.winback.statusActive },
  "at-risk":{ bg: "var(--d-warn-soft)",   text: "var(--d-warn)",  label: (d) => d.winback.statusAtRisk },
  dormant:  { bg: "var(--d-bad-soft)",    text: "var(--d-bad)",   label: (d) => d.winback.statusDormant },
  lost:     { bg: "var(--d-slate-soft)",  text: "var(--d-slate)", label: (d) => d.winback.statusLost },
};

function StatusChip({ status, d }: { status: DormancyStatus; d: ReturnType<typeof useDash>["d"] }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
      style={{ background: s.bg, color: s.text }}
    >
      {s.label(d)}
    </span>
  );
}

/* ── Risk bar ─────────────────────────────────────────────────────────────── */
function RiskBar({ days }: { days: number }) {
  const pct = Math.min(100, (days / 90) * 100);
  const color = days <= 14 ? "var(--d-ok)" : days <= 28 ? "var(--d-warn)" : days <= 60 ? "var(--d-bad)" : "var(--d-slate)";
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--d-border)" }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", damping: 24, stiffness: 200 }}
      />
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */
export default function WinbackExplorer() {
  const { d } = useDash();
  const wb = d.winback;

  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<DormancyStatus | "all">("all");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [msgGenerated, setMsgGenerated] = useState(false);
  const [msgGenerating, setMsgGenerating] = useState(false);
  const [popupCustomer, setPopupCustomer] = useState<WinbackCustomer | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = CUSTOMERS;
    if (filterStatus !== "all") list = list.filter((c) => c.status === filterStatus);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }
    return list;
  }, [query, filterStatus]);

  function handleSelect(c: Customer) {
    setSelected(c);
    setMsgGenerated(false);
    setMsgGenerating(false);
  }

  function handleGenerate() {
    setMsgGenerating(true);
    setTimeout(() => { setMsgGenerated(true); setMsgGenerating(false); }, 1400);
  }

  function handleSend() {
    if (!selected) return;
    setPopupCustomer({
      id: selected.id,
      name: selected.name,
      phone: selected.phone,
      dormantDays: selected.lastVisitDays,
      totalSpend: selected.totalSpend,
      message: selected.message,
    });
    setPopupOpen(true);
  }

  const statusFilters: Array<{ key: DormancyStatus | "all"; label: string }> = [
    { key: "all",      label: wb.allStatuses },
    { key: "at-risk",  label: wb.statusAtRisk },
    { key: "dormant",  label: wb.statusDormant },
    { key: "active",   label: wb.statusActive },
    { key: "lost",     label: wb.statusLost },
  ];

  // Summary KPIs
  const atRisk  = CUSTOMERS.filter((c) => c.status === "at-risk").length;
  const dormant = CUSTOMERS.filter((c) => c.status === "dormant").length;
  const lostAt  = CUSTOMERS.filter((c) => c.status === "lost").reduce((s, c) => s + c.totalSpend, 0);

  return (
    <>
      {/* KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Customers", value: String(CUSTOMERS.length), color: "var(--d-ink)" },
          { label: "At-Risk (18–28d)", value: String(atRisk), color: "var(--d-warn)" },
          { label: "Dormant (28–60d)", value: String(dormant), color: "var(--d-bad)" },
          { label: "Revenue at Risk", value: inr(lostAt, { compact: true }), color: "var(--d-slate)" },
        ].map((k) => (
          <div
            key={k.label}
            className="flex flex-col justify-between rounded-[18px] p-4"
            style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)" }}
          >
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--d-muted)" }}>
              {k.label}
            </span>
            <span className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em]" style={{ color: k.color }}>
              {k.value}
            </span>
          </div>
        ))}
      </div>

      {/* Main surface: table only */}
      <div
        className="min-h-[520px] overflow-hidden rounded-[20px]"
        style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)" }}
      >
        {/* Toolbar */}
        <div
          className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid var(--d-border)" }}
        >
          <input
            type="search"
            placeholder={wb.searchPh}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 rounded-lg px-3 py-1.5 text-[12.5px] outline-none"
            style={{
              background: "var(--d-surface-2)",
              border: "1px solid var(--d-border)",
              color: "var(--d-ink)",
            }}
          />
          <div className="flex gap-1">
            {statusFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
                style={{
                  background: filterStatus === f.key ? "var(--d-accent)" : "var(--d-surface-2)",
                  color: filterStatus === f.key ? "#fff" : "var(--d-muted)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--d-border)", background: "var(--d-surface-2)" }}>
                {[wb.col.customer, wb.col.lastVisit, wb.col.dormantDays, wb.col.avgVisits, wb.col.totalSpend, wb.col.status].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--d-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[12px]" style={{ color: "var(--d-faint)" }}>
                    {wb.noMatch}
                  </td>
                </tr>
              ) : filtered.map((c) => {
                const isSelected = selected?.id === c.id;
                return (
                  <tr
                    key={c.id}
                    onClick={() => handleSelect(c)}
                    className="cursor-pointer transition-colors"
                    style={{
                      borderBottom: "1px solid var(--d-border)",
                      background: isSelected ? "var(--d-accent-soft)" : undefined,
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: "var(--d-ink)" }}>{c.name}</div>
                      <div className="text-[10.5px]" style={{ color: "var(--d-faint)" }}>{c.phone}</div>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--d-muted)" }}>
                      {daysAgo(c.lastVisitDays)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="font-semibold"
                        style={{
                          color: c.lastVisitDays <= 14 ? "var(--d-ok)"
                            : c.lastVisitDays <= 28 ? "var(--d-warn)"
                            : c.lastVisitDays <= 60 ? "var(--d-bad)"
                            : "var(--d-slate)",
                        }}
                      >
                        {c.lastVisitDays}d
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--d-muted)" }}>
                      {c.avgVisitsPerWeek.toFixed(1)}×/wk
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--d-ink)" }}>
                      {inr(c.totalSpend)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={c.status} d={d} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right-side drawer — same pattern as TransactionDrawer */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-[300] flex justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0"
              style={{ background: "rgba(28,25,23,0.35)" }}
              onClick={() => setSelected(null)}
            />
            <motion.aside
              key={selected.id}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative h-full w-full max-w-md overflow-y-auto"
              style={{ background: "var(--d-surface)", borderLeft: "1px solid var(--d-border)", scrollbarWidth: "thin" }}
            >
              {/* Drawer header */}
              <div
                className="sticky top-0 z-10 flex items-center justify-between px-5 py-3"
                style={{ borderBottom: "1px solid var(--d-border)", background: "var(--d-surface)" }}
              >
                <span className="d-label">{wb.drawerTitle}</span>
                <button
                  onClick={() => setSelected(null)}
                  className="grid h-7 w-7 place-items-center rounded-md text-[15px] transition-colors hover:bg-[var(--d-surface-2)]"
                  style={{ color: "var(--d-muted)" }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 p-5">
                {/* Identity */}
                <div
                  className="flex items-center gap-3 rounded-xl p-3"
                  style={{ background: "var(--d-accent-soft)" }}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[16px] font-bold text-white"
                    style={{ background: "var(--d-accent)" }}
                  >
                    {selected.name[0]}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold" style={{ color: "var(--d-ink)" }}>
                      {selected.name}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--d-muted)" }}>
                      {selected.phone}
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: wb.drawerLastVisit, value: daysAgo(selected.lastVisitDays) },
                    { label: wb.drawerAvgFreq,   value: `${selected.avgVisitsPerWeek.toFixed(1)}×/wk` },
                    { label: wb.drawerSpend,      value: inr(selected.totalSpend) },
                    { label: wb.drawerDormant,    value: `${selected.lastVisitDays} days` },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-lg p-2.5"
                      style={{ background: "var(--d-surface-2)", border: "1px solid var(--d-border)" }}
                    >
                      <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--d-faint)" }}>
                        {s.label}
                      </div>
                      <div className="mt-1 text-[13px] font-semibold" style={{ color: "var(--d-ink)" }}>
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Status + risk bar */}
                <div
                  className="rounded-xl p-3"
                  style={{ background: "var(--d-surface-2)", border: "1px solid var(--d-border)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium" style={{ color: "var(--d-muted)" }}>
                      {wb.drawerRisk}
                    </span>
                    <StatusChip status={selected.status} d={d} />
                  </div>
                  <RiskBar days={selected.lastVisitDays} />
                  <div className="mt-1.5 flex justify-between text-[9.5px]" style={{ color: "var(--d-faint)" }}>
                    <span>Active</span>
                    <span>At-Risk</span>
                    <span>Dormant</span>
                    <span>Lost</span>
                  </div>
                </div>

                {/* AI message section */}
                <div>
                  <div
                    className="mb-2 text-[11.5px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--d-muted)" }}
                  >
                    {wb.msgTitle}
                  </div>

                  {!msgGenerated ? (
                    <button
                      onClick={handleGenerate}
                      disabled={msgGenerating}
                      className="w-full rounded-xl py-2.5 text-[12.5px] font-semibold transition-opacity disabled:opacity-60"
                      style={{ background: "var(--d-accent-soft)", color: "var(--d-accent)" }}
                    >
                      {msgGenerating ? wb.msgGenerating : wb.msgGenerate}
                    </button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", damping: 22, stiffness: 280 }}
                    >
                      <div
                        className="mb-2 rounded-xl p-3 text-[12px] leading-relaxed"
                        style={{
                          background: "var(--d-surface-2)",
                          border: "1px solid var(--d-border)",
                          color: "var(--d-ink)",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {selected.message}
                      </div>
                      <button
                        onClick={handleSend}
                        className="w-full rounded-xl py-2.5 text-[12.5px] font-semibold text-white transition-opacity"
                        style={{ background: "var(--d-ok)" }}
                      >
                        {wb.msgSend}
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Broadcast popup */}
      <WinbackPopup
        open={popupOpen}
        customer={popupCustomer}
        onClose={() => { setPopupOpen(false); setMsgGenerated(false); setSelected(null); }}
      />
    </>
  );
}

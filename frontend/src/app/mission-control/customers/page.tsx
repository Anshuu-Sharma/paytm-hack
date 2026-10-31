"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { container, item } from "@/lib/dashboard/motion";
import PageHeader from "@/components/dashboard/PageHeader";
import { useDash } from "@/lib/dashboard/i18n";
import { inr, shortDate } from "@/lib/dashboard/format";
import { CUSTOMERS, type CustomerProfile, type Payment, type Segment } from "@/lib/dashboard/customers";

const SEGMENT_TONE: Record<Segment, { fg: string; soft: string }> = {
  vip: { fg: "var(--d-accent)", soft: "var(--d-accent-soft)" },
  dormant: { fg: "var(--d-bad)", soft: "var(--d-bad-soft)" },
  regular: { fg: "var(--d-info)", soft: "var(--d-info-soft)" },
};

const PAYMENT_TONE: Record<Payment["status"], { fg: string; soft: string }> = {
  SUCCESS: { fg: "var(--d-ok)", soft: "var(--d-ok-soft)" },
  FAILED: { fg: "var(--d-bad)", soft: "var(--d-bad-soft)" },
  REFUNDED: { fg: "var(--d-warn)", soft: "var(--d-warn-soft)" },
};

function SegmentChip({ segment, d }: { segment: Segment; d: ReturnType<typeof useDash>["d"] }) {
  const tone = SEGMENT_TONE[segment];
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: tone.soft, color: tone.fg }}>
      {d.cust.segment[segment === "regular" ? "regular" : segment]}
    </span>
  );
}

function KpiTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <section className="flex min-h-[100px] flex-col justify-between rounded-[18px] p-4" style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)" }}>
      <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--d-muted)" }}>{label}</span>
      <span className="text-[24px] font-semibold leading-none tracking-[-0.03em]" style={{ color }}>{value}</span>
    </section>
  );
}

export default function CustomersPage() {
  const { d } = useDash();
  const c = d.cust;

  const [query, setQuery] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<Segment | "all">("all");
  const [selected, setSelected] = useState<CustomerProfile | null>(null);

  const filtered = useMemo(() => {
    let list = CUSTOMERS;
    if (segmentFilter !== "all") list = list.filter((cu) => cu.segment === segmentFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((cu) => cu.name.toLowerCase().includes(q) || cu.phone.includes(q));
    }
    return list;
  }, [query, segmentFilter]);

  const vipCount = CUSTOMERS.filter((cu) => cu.segment === "vip").length;
  const dormantCount = CUSTOMERS.filter((cu) => cu.segment === "dormant").length;
  const regularCount = CUSTOMERS.filter((cu) => cu.segment === "regular").length;

  const segmentFilters: Array<{ key: Segment | "all"; label: string }> = [
    { key: "all", label: c.segment.all },
    { key: "vip", label: c.segment.vip },
    { key: "dormant", label: c.segment.dormant },
    { key: "regular", label: c.segment.regular },
  ];

  return (
    <motion.div className="mx-auto max-w-[1100px] space-y-4 p-5 md:p-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title={c.title} subtitle={c.desc} accent="var(--d-info)" />
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label={c.kpi.total} value={String(CUSTOMERS.length)} color="var(--d-ink)" />
        <KpiTile label={c.kpi.vip} value={String(vipCount)} color="var(--d-accent)" />
        <KpiTile label={c.kpi.dormant} value={String(dormantCount)} color="var(--d-bad)" />
        <KpiTile label={c.kpi.regular} value={String(regularCount)} color="var(--d-info)" />
      </motion.div>

      <motion.div variants={item} className="overflow-hidden rounded-[20px]" style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)" }}>
        {/* Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--d-border)" }}>
          <input
            type="search"
            placeholder={c.searchPh}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 rounded-lg px-3 py-1.5 text-[12.5px] outline-none"
            style={{ background: "var(--d-surface-2)", border: "1px solid var(--d-border)", color: "var(--d-ink)" }}
          />
          <div className="flex gap-1">
            {segmentFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setSegmentFilter(f.key)}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
                style={{
                  background: segmentFilter === f.key ? "var(--d-accent)" : "var(--d-surface-2)",
                  color: segmentFilter === f.key ? "#fff" : "var(--d-muted)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="max-h-[560px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--d-border)", background: "var(--d-surface-2)" }}>
                {[c.col.customer, c.col.segment, c.col.spend, c.col.orders, c.col.lastVisit].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--d-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[12px]" style={{ color: "var(--d-faint)" }}>
                    {c.noMatch}
                  </td>
                </tr>
              ) : filtered.map((cu) => (
                <tr
                  key={cu.id}
                  onClick={() => setSelected(cu)}
                  className="cursor-pointer transition-colors"
                  style={{ borderBottom: "1px solid var(--d-border)", background: selected?.id === cu.id ? "var(--d-accent-soft)" : undefined }}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: "var(--d-ink)" }}>{cu.name}</div>
                    <div className="text-[10.5px]" style={{ color: "var(--d-faint)" }}>{cu.phone}</div>
                  </td>
                  <td className="px-4 py-3"><SegmentChip segment={cu.segment} d={d} /></td>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--d-ink)" }}>{inr(cu.totalSpend)}</td>
                  <td className="px-4 py-3" style={{ color: "var(--d-muted)" }}>{cu.orderCount}</td>
                  <td className="px-4 py-3" style={{ color: "var(--d-muted)" }}>{shortDate(cu.lastVisit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div className="fixed inset-0 z-[300] flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0" style={{ background: "rgba(28,25,23,0.35)" }} onClick={() => setSelected(null)} />
            <motion.aside
              key={selected.id}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative h-full w-full max-w-md overflow-y-auto"
              style={{ background: "var(--d-surface)", borderLeft: "1px solid var(--d-border)", scrollbarWidth: "thin" }}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--d-border)", background: "var(--d-surface)" }}>
                <span className="d-label">{c.drawerTitle}</span>
                <button onClick={() => setSelected(null)} className="grid h-7 w-7 place-items-center rounded-md text-[15px] transition-colors hover:bg-[var(--d-surface-2)]" style={{ color: "var(--d-muted)" }} aria-label="Close">
                  ✕
                </button>
              </div>

              <div className="space-y-4 p-5">
                <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--d-accent-soft)" }}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[16px] font-bold text-white" style={{ background: "var(--d-accent)" }}>
                    {selected.name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold" style={{ color: "var(--d-ink)" }}>{selected.name}</div>
                    <div className="text-[11px]" style={{ color: "var(--d-muted)" }}>{selected.phone}</div>
                  </div>
                  <div className="ml-auto"><SegmentChip segment={selected.segment} d={d} /></div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: c.stat.spend, value: inr(selected.totalSpend) },
                    { label: c.stat.orders, value: String(selected.orderCount) },
                    { label: c.stat.avgOrder, value: inr(selected.avgOrderValue) },
                    { label: c.stat.lastVisit, value: shortDate(selected.lastVisit) },
                    { label: c.stat.joined, value: shortDate(selected.joinedDate) },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg p-2.5" style={{ background: "var(--d-surface-2)", border: "1px solid var(--d-border)" }}>
                      <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--d-faint)" }}>{s.label}</div>
                      <div className="mt-1 text-[13px] font-semibold" style={{ color: "var(--d-ink)" }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--d-muted)" }}>
                    {c.paymentsTitle}
                  </div>
                  <div className="space-y-1.5">
                    {selected.payments.map((p) => {
                      const tone = PAYMENT_TONE[p.status];
                      return (
                        <div key={p.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "var(--d-surface-2)", border: "1px solid var(--d-border)" }}>
                          <div>
                            <div className="text-[12px] font-medium" style={{ color: "var(--d-ink)" }}>{inr(p.amount)}</div>
                            <div className="text-[10px]" style={{ color: "var(--d-faint)" }}>{shortDate(p.date)} · {p.method}</div>
                          </div>
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: tone.soft, color: tone.fg }}>
                            {c.paymentStatus[p.status]}
                          </span>
                        </div>
                      );
                    })}
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

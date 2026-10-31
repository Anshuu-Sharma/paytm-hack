"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { container, item } from "@/lib/dashboard/motion";
import PageHeader from "@/components/dashboard/PageHeader";
import { useDash } from "@/lib/dashboard/i18n";
import { shortDate } from "@/lib/dashboard/format";
import { CUSTOMERS, type CustomerProfile, type Segment } from "@/lib/dashboard/customers";
import { CALL_REASONS, type CallReasonKey } from "@/lib/dashboard/callReasons";

const SEGMENT_TONE: Record<Segment, { fg: string; soft: string }> = {
  vip: { fg: "var(--d-accent)", soft: "var(--d-accent-soft)" },
  dormant: { fg: "var(--d-bad)", soft: "var(--d-bad-soft)" },
  regular: { fg: "var(--d-info)", soft: "var(--d-info-soft)" },
};

function SegmentChip({ segment, d }: { segment: Segment; d: ReturnType<typeof useDash>["d"] }) {
  const tone = SEGMENT_TONE[segment];
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: tone.soft, color: tone.fg }}>
      {d.cust.segment[segment]}
    </span>
  );
}

function CallModal({
  customer,
  onClose,
  onStart,
  d,
}: {
  customer: CustomerProfile | null;
  onClose: () => void;
  onStart: (reason: CallReasonKey, customText: string) => void;
  d: ReturnType<typeof useDash>["d"];
}) {
  const [reason, setReason] = useState<CallReasonKey>("late_payment");
  const [customText, setCustomText] = useState("");

  if (!customer) return null;

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      style={{ background: "rgba(12,12,15,0.72)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] rounded-[22px] p-5"
        style={{ background: "var(--d-surface)", border: "1px solid var(--d-border-strong)", boxShadow: "0 32px 80px rgba(0,0,0,0.55)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[16px] font-bold text-white" style={{ background: "var(--d-accent)" }}>
            {customer.name[0]}
          </div>
          <div>
            <h3 className="text-[14px] font-semibold" style={{ color: "var(--d-ink)" }}>{d.call.modal.title}: {customer.name}</h3>
            <div className="text-[11px]" style={{ color: "var(--d-muted)" }}>{customer.phone}</div>
          </div>
        </div>

        <label className="mt-4 block text-[11px] font-medium" style={{ color: "var(--d-muted)" }}>{d.call.modal.reason}</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {CALL_REASONS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setReason(r.key)}
              className="rounded-full px-2.5 py-1.5 text-[11.5px] font-medium transition-colors"
              style={{
                background: reason === r.key ? "var(--d-accent)" : "var(--d-surface-2)",
                color: reason === r.key ? "#fff" : "var(--d-muted)",
                border: "1px solid var(--d-border)",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {reason === "custom" && (
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder={d.call.modal.customPh}
            rows={2}
            className="mt-3 w-full resize-none rounded-lg px-3 py-2 text-[13px] outline-none"
            style={{ background: "var(--d-surface-2)", border: "1px solid var(--d-border)", color: "var(--d-ink)" }}
          />
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-[12.5px] font-medium" style={{ color: "var(--d-muted)" }}>
            {d.call.modal.cancel}
          </button>
          <button
            type="button"
            onClick={() => onStart(reason, customText)}
            disabled={reason === "custom" && !customText.trim()}
            className="rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(160deg, #48c88e, #2a9d6f)" }}
          >
            📞 {d.call.modal.start}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CallCustomerPage() {
  const { d } = useDash();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<Segment | "all">("all");
  const [calling, setCalling] = useState<CustomerProfile | null>(null);

  const filtered = useMemo(() => {
    let list = CUSTOMERS;
    if (segmentFilter !== "all") list = list.filter((cu) => cu.segment === segmentFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((cu) => cu.name.toLowerCase().includes(q) || cu.phone.includes(q));
    }
    return list;
  }, [query, segmentFilter]);

  const segmentFilters: Array<{ key: Segment | "all"; label: string }> = [
    { key: "all", label: d.cust.segment.all },
    { key: "vip", label: d.cust.segment.vip },
    { key: "dormant", label: d.cust.segment.dormant },
    { key: "regular", label: d.cust.segment.regular },
  ];

  const startCall = (reason: CallReasonKey, customText: string) => {
    if (!calling) return;
    const params = new URLSearchParams({ customer: calling.id, reason });
    if (reason === "custom" && customText.trim()) params.set("custom", customText.trim());
    setCalling(null);
    router.push(`/mission-control/call-customer/call?${params.toString()}`);
  };

  return (
    <motion.div className="mx-auto max-w-[1100px] space-y-4 p-5 md:p-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title={d.call.title} subtitle={d.call.desc} accent="#48c88e" />
      </motion.div>

      <motion.div variants={item} className="overflow-hidden rounded-[20px]" style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)" }}>
        <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--d-border)" }}>
          <input
            type="search"
            placeholder={d.call.searchPh}
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

        <div className="max-h-[560px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--d-border)", background: "var(--d-surface-2)" }}>
                {[d.call.col.customer, d.call.col.segment, d.call.col.lastVisit, d.call.col.action].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--d-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[12px]" style={{ color: "var(--d-faint)" }}>
                    {d.call.noMatch}
                  </td>
                </tr>
              ) : filtered.map((cu) => (
                <tr key={cu.id} style={{ borderBottom: "1px solid var(--d-border)" }}>
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: "var(--d-ink)" }}>{cu.name}</div>
                    <div className="text-[10.5px]" style={{ color: "var(--d-faint)" }}>{cu.phone}</div>
                  </td>
                  <td className="px-4 py-3"><SegmentChip segment={cu.segment} d={d} /></td>
                  <td className="px-4 py-3" style={{ color: "var(--d-muted)" }}>{shortDate(cu.lastVisit)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setCalling(cu)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold text-white"
                      style={{ background: "linear-gradient(160deg, #48c88e, #2a9d6f)" }}
                    >
                      📞 {d.call.callBtn}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <CallModal customer={calling} onClose={() => setCalling(null)} onStart={startCall} d={d} />
    </motion.div>
  );
}

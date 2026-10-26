"use client";

import { useCallback, useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { addInvoice, fetchInvoices } from "@/lib/dashboard/api";
import type { InvoiceItem } from "@/lib/dashboard/api";
import { inr } from "@/lib/dashboard/format";
import { useDash } from "@/lib/dashboard/i18n";
import { useDashboardRefresh } from "@/lib/dashboard/refresh";
import { Card } from "./Card";
import CalendarGrid, { type CalEvent, type EventCategory } from "./CalendarGrid";
import TransactionDrawer from "./TransactionDrawer";

const BUCKETS = ["current", "0-30", "30-60", "60-90", "90+"] as const;
const BUCKET_COLOR: Record<string, string> = {
  current: "var(--d-ok)",
  "0-30": "var(--d-warn)",
  "30-60": "#d98324",
  "60-90": "#c05a2b",
  "90+": "var(--d-bad)",
};

function category(i: InvoiceItem): EventCategory {
  if (i.status === "RECOVERED") return "paid";
  if (i.p2p_date || ["INTERVENING", "WAITING"].includes(i.status)) return "sent";
  return "pending";
}

export default function ReceivablesBoard() {
  const { d } = useDash();
  const t = d.inv;
  const { bump, refresh } = useDashboardRefresh();
  const load = useCallback((s: AbortSignal) => fetchInvoices(s), []);
  const { data } = useApi(load, [bump]);

  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ buyer: "", amount: "", issue: "", due: "" });

  const rows: InvoiceItem[] = useMemo(() => data ?? [], [data]);

  const byBucket = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const b of BUCKETS) map[b] = { total: 0, count: 0 };
    for (const i of rows) {
      if (i.status === "RECOVERED") continue; // paid → not at risk
      const b = map[i.aging_bucket];
      if (b) { b.total += i.amount_inr; b.count += 1; }
    }
    return map;
  }, [rows]);

  const events: CalEvent[] = useMemo(
    () => rows.map((i) => ({
      id: i.transaction_id,
      date: i.due_date,
      label: i.buyer_name,
      amount: i.amount_inr,
      category: category(i),
    })),
    [rows],
  );

  const save = async () => {
    if (!form.buyer.trim() || !form.amount || !form.issue || !form.due) return;
    setBusy(true);
    try {
      await addInvoice({
        buyer_name: form.buyer.trim(),
        amount_inr: Number(form.amount),
        issue_date: form.issue,
        due_date: form.due,
      });
      setForm({ buyer: "", amount: "", issue: "", due: "" });
      setAdding(false);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const input = { borderColor: "var(--d-border)", background: "var(--d-bg)", color: "var(--d-ink)" };

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold tracking-tight">{t.title}</h3>
          <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--d-muted)" }}>{t.desc}</p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="ml-auto shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-semibold"
          style={{ borderColor: "var(--d-border)", color: "var(--d-ink)" }}
        >
          {t.add}
        </button>
      </div>

      {adding ? (
        <div className="mt-3 grid gap-2 rounded-xl border p-3 sm:grid-cols-5" style={{ borderColor: "var(--d-border)" }}>
          <input placeholder={t.buyer} value={form.buyer} onChange={(e) => setForm({ ...form, buyer: e.target.value })}
            className="rounded-lg border px-2.5 py-1.5 text-[12.5px] outline-none sm:col-span-2" style={input} />
          <input type="number" placeholder={t.amount} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="d-num rounded-lg border px-2.5 py-1.5 text-[12.5px] outline-none" style={input} />
          <input type="date" aria-label={t.issue} value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })}
            className="d-num rounded-lg border px-2 py-1.5 text-[12px] outline-none" style={input} />
          <input type="date" aria-label={t.due} value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })}
            className="d-num rounded-lg border px-2 py-1.5 text-[12px] outline-none" style={input} />
          <div className="flex gap-2 sm:col-span-5">
            <button onClick={save} disabled={busy} className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50" style={{ background: "var(--d-ink)" }}>
              {busy ? t.saving : t.save}
            </button>
            <button onClick={() => setAdding(false)} className="rounded-lg px-3 py-1.5 text-[12px] font-medium" style={{ border: "1px solid var(--d-border)", color: "var(--d-muted)" }}>
              {t.cancel}
            </button>
          </div>
        </div>
      ) : null}

      {/* Aging buckets */}
      <div className="my-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {BUCKETS.map((b) => (
          <div key={b} className="rounded-xl border p-3" style={{ borderColor: "var(--d-border)" }}>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: BUCKET_COLOR[b] }} />
              <span className="text-[11px] font-medium" style={{ color: "var(--d-muted)" }}>{t.buckets[b]}</span>
            </div>
            <div className="d-num mt-1 text-[15px] font-semibold">{inr(byBucket[b].total, { compact: true })}</div>
            <div className="text-[10.5px]" style={{ color: "var(--d-faint)" }}>{byBucket[b].count} · {t.atRisk}</div>
          </div>
        ))}
      </div>

      <CalendarGrid events={events} onEventClick={setSelected} />
      <TransactionDrawer id={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { addSubscription, fetchSubscriptions } from "@/lib/dashboard/api";
import type { SubscriptionItem } from "@/lib/dashboard/api";
import { useDash } from "@/lib/dashboard/i18n";
import { useDashboardRefresh } from "@/lib/dashboard/refresh";
import { Card } from "./Card";
import CalendarGrid, { type CalEvent, type EventCategory } from "./CalendarGrid";
import TransactionDrawer from "./TransactionDrawer";

function category(status: string): EventCategory {
  if (status === "recovered") return "paid";
  if (["retrying", "deferred", "intervening", "escalated"].includes(status)) return "sent";
  return "pending";
}

export default function MandateCalendar() {
  const { d } = useDash();
  const t = d.sub;
  const { bump, refresh } = useDashboardRefresh();
  const load = useCallback((s: AbortSignal) => fetchSubscriptions(s), []);
  const { data } = useApi(load, [bump]);

  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ customer: "", plan: "", amount: "", next: "", salary: "1" });

  const events: CalEvent[] = useMemo(
    () =>
      (data ?? []).map((s: SubscriptionItem) => ({
        id: s.transaction_id,
        date: s.next_debit_date,
        label: s.customer_name,
        amount: s.amount_inr,
        category: category(s.mandate_status),
      })),
    [data],
  );

  const save = async () => {
    if (!form.customer.trim() || !form.plan.trim() || !form.amount || !form.next) return;
    setBusy(true);
    try {
      await addSubscription({
        customer_name: form.customer.trim(),
        plan: form.plan.trim(),
        amount_inr: Number(form.amount),
        next_debit_date: form.next,
        salary_day: Number(form.salary) || 1,
      });
      setForm({ customer: "", plan: "", amount: "", next: "", salary: "1" });
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
        <div className="mb-4 mt-3 grid gap-2 rounded-xl border p-3 sm:grid-cols-6" style={{ borderColor: "var(--d-border)" }}>
          <input placeholder={t.customer} value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })}
            className="rounded-lg border px-2.5 py-1.5 text-[12.5px] outline-none sm:col-span-2" style={input} />
          <input placeholder={t.plan} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}
            className="rounded-lg border px-2.5 py-1.5 text-[12.5px] outline-none" style={input} />
          <input type="number" placeholder={t.amount} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="d-num rounded-lg border px-2.5 py-1.5 text-[12.5px] outline-none" style={input} />
          <input type="date" aria-label={t.nextDebit} value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })}
            className="d-num rounded-lg border px-2 py-1.5 text-[12px] outline-none" style={input} />
          <input type="number" min={1} max={31} aria-label={t.salaryDay} value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })}
            className="d-num rounded-lg border px-2.5 py-1.5 text-[12.5px] outline-none" style={input} />
          <div className="flex gap-2 sm:col-span-6">
            <button onClick={save} disabled={busy} className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50" style={{ background: "var(--d-ink)" }}>
              {busy ? t.saving : t.save}
            </button>
            <button onClick={() => setAdding(false)} className="rounded-lg px-3 py-1.5 text-[12px] font-medium" style={{ border: "1px solid var(--d-border)", color: "var(--d-muted)" }}>
              {t.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="h-2" />
      )}

      <CalendarGrid events={events} onEventClick={setSelected} />
      <TransactionDrawer id={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}

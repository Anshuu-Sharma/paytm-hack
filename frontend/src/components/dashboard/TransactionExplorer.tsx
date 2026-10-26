"use client";

import { useCallback, useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { fetchTransactions } from "@/lib/dashboard/api";
import { useDash } from "@/lib/dashboard/i18n";
import { useDashboardRefresh } from "@/lib/dashboard/refresh";
import { useExplorerFilter } from "@/lib/dashboard/explorerFilter";
import type { LifecycleStatus, TransactionRow } from "@/lib/dashboard/types";
import { CLASS_COLOR } from "@/lib/dashboard/status";
import { Card } from "./Card";
import { ErrorState, Loading } from "./PageState";
import TransactionTable, { type OpenConversation } from "./TransactionTable";
import TransactionDrawer from "./TransactionDrawer";
import { ConversationPanelHost } from "./ConversationPanel";

const STATUSES: LifecycleStatus[] = [
  "PENDING",
  "DIAGNOSING",
  "INTERVENING",
  "WAITING",
  "RECOVERED",
  "ESCALATED",
  "CANCELLED",
  "FAILED",
];

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border py-1.5 pl-2.5 pr-7 text-[12.5px] outline-none"
        style={{
          borderColor: "var(--d-border)",
          background: "var(--d-surface)",
          color: "var(--d-ink)",
        }}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
        width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke="var(--d-faint)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full py-1 pl-2.5 pr-1.5 text-[11.5px] font-medium"
      style={{ background: "var(--d-accent-soft)", color: "var(--d-accent)" }}
    >
      {label}
      <button
        onClick={onClear}
        className="grid h-4 w-4 place-items-center rounded-full transition-colors hover:bg-[var(--d-accent)]/15"
        aria-label="clear filter"
        style={{ color: "var(--d-accent)" }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </span>
  );
}

export default function TransactionExplorer({ fixedClass }: { fixedClass?: number }) {
  const { bump } = useDashboardRefresh();
  const { d } = useDash();
  const TYPES: { value: string; label: string }[] = [
    { value: "", label: d.txns.allTypes },
    { value: "RECOVERY_CASE", label: d.txns.tRecovery },
    { value: "HEALTHY", label: d.txns.tHealthy },
    { value: "NON_RECOVERABLE", label: d.txns.tNonRec },
  ];
  const load = useCallback(
    (signal: AbortSignal) => fetchTransactions({ limit: 500 }, signal),
    []
  );
  const { data, error, loading } = useApi(load, [bump]);

  const [type, setType] = useState("");
  // Shared so REX can read the current view and set the status filter itself.
  const { status, setStatus, query: q, setQuery: setQ } = useExplorerFilter();
  const [selected, setSelected] = useState<string | null>(null);
  const [convo, setConvo] = useState<
    { txnId: string; name: string; channel: "whatsapp" | "call" } | null
  >(null);

  const openConversation: OpenConversation = (txnId, channel, name) =>
    setConvo({ txnId, name, channel });

  const rows: TransactionRow[] = useMemo(() => {
    let items = data?.items ?? [];
    if (fixedClass) items = items.filter((r) => r.failure_class === fixedClass);
    if (type) items = items.filter((r) => r.ai_tag === type);
    if (status) items = items.filter((r) => r.status === status);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      items = items.filter(
        (r) =>
          r.transaction_id.toLowerCase().includes(needle) ||
          (r.customer_name ?? "").toLowerCase().includes(needle)
      );
    }
    return items;
  }, [data, fixedClass, type, status, q]);

  if (loading) return <Loading label="Loading transactions…" />;
  if (error || !data) return <ErrorState message={error ?? "no data"} />;

  return (
    <>
      <Card>
        {/* Filter bar */}
        <div
          className="flex flex-wrap items-center gap-2.5 px-4 py-3"
          style={{ borderBottom: "1px solid var(--d-border)" }}
        >
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--d-faint)" strokeWidth="2" strokeLinecap="round" aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={d.txns.searchPh}
              className="w-56 rounded-lg border py-1.5 pl-8 pr-3 text-[12.5px] outline-none"
              style={{
                borderColor: "var(--d-border)",
                background: "var(--d-surface)",
                color: "var(--d-ink)",
              }}
            />
          </div>
          {!fixedClass ? (
            <Select value={type} onChange={setType}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          ) : null}
          <Select value={status} onChange={setStatus}>
            <option value="">{d.txns.allStatuses}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {d.status[s]}
              </option>
            ))}
          </Select>
          <span
            className="ml-auto rounded-full px-2 py-0.5 d-num text-[11.5px]"
            style={{ background: "var(--d-surface-2)", color: "var(--d-muted)" }}
          >
            {rows.length} {d.txns.resultsShown}
          </span>
        </div>

        {/* Active-filter chips */}
        {(type || status || q.trim()) ? (
          <div
            className="flex flex-wrap items-center gap-2 px-4 py-2.5"
            style={{ borderBottom: "1px solid var(--d-border)" }}
          >
            {q.trim() ? <FilterChip label={`“${q.trim()}”`} onClear={() => setQ("")} /> : null}
            {type ? (
              <FilterChip
                label={TYPES.find((t) => t.value === type)?.label ?? type}
                onClear={() => setType("")}
              />
            ) : null}
            {status ? (
              <FilterChip label={d.status[status as LifecycleStatus] ?? status} onClear={() => setStatus("")} />
            ) : null}
            <button
              onClick={() => {
                setType("");
                setStatus("");
                setQ("");
              }}
              className="text-[11.5px] font-medium underline-offset-2 hover:underline"
              style={{ color: "var(--d-muted)" }}
            >
              {d.txns.clear}
            </button>
          </div>
        ) : null}

        <TransactionTable
          rows={rows}
          onSelect={setSelected}
          showClass={!fixedClass}
          onOpenConversation={fixedClass ? openConversation : undefined}
        />
      </Card>

      <TransactionDrawer id={selected} onClose={() => setSelected(null)} />

      <ConversationPanelHost
        open={convo !== null}
        txnId={convo?.txnId ?? ""}
        customerName={convo?.name ?? ""}
        channel={convo?.channel ?? "whatsapp"}
        accent={fixedClass ? CLASS_COLOR[fixedClass] : "var(--d-accent)"}
        onClose={() => setConvo(null)}
      />
    </>
  );
}

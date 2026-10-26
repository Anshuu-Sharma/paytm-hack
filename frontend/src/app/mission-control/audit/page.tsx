"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { container, item } from "@/lib/dashboard/motion";
import { Card } from "@/components/dashboard/Card";
import PageHeader from "@/components/dashboard/PageHeader";
import { ErrorState, Loading } from "@/components/dashboard/PageState";
import { useApi } from "@/hooks/useApi";
import { fetchAudit } from "@/lib/dashboard/api";
import { humanize } from "@/lib/dashboard/format";
import { useDash } from "@/lib/dashboard/i18n";
import { useDashboardRefresh } from "@/lib/dashboard/refresh";
import type { AuditEntry } from "@/lib/dashboard/types";

function outcomeTone(outcome: string): { fg: string; soft: string } {
  if (outcome === "SUCCESS") return { fg: "var(--d-ok)", soft: "var(--d-ok-soft)" };
  if (outcome === "ESCALATED") return { fg: "var(--d-slate)", soft: "var(--d-slate-soft)" };
  return { fg: "var(--d-bad)", soft: "var(--d-bad-soft)" };
}

function NodeChip({
  value,
  label,
  active,
  onSelect,
}: {
  value: string;
  label: string;
  active: boolean;
  onSelect: (v: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(value)}
      className="rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors"
      style={{
        background: active ? "var(--d-accent)" : "var(--d-surface-2)",
        color: active ? "#fff" : "var(--d-muted)",
      }}
    >
      {label}
    </button>
  );
}

function Row({ e }: { e: AuditEntry }) {
  const keys = Object.keys(e.payload ?? {});
  const tone = outcomeTone(e.outcome);
  return (
    <div className="flex gap-3 px-4 py-2.5" style={{ borderBottom: "1px solid var(--d-border)" }}>
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: tone.fg }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[12.5px] font-semibold">{humanize(e.node_name)}</span>
          <span className="text-[11.5px]" style={{ color: "var(--d-muted)" }}>
            {humanize(e.action_type)}
          </span>
          <span
            className="rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide"
            style={{ background: tone.soft, color: tone.fg }}
          >
            {humanize(e.outcome)}
          </span>
          <span className="d-num text-[11px]" style={{ color: "var(--d-faint)" }}>
            {e.transaction_id}
          </span>
          <span className="d-num ml-auto text-[11px]" style={{ color: "var(--d-faint)" }}>
            {new Date(e.timestamp).toLocaleString("en-IN")}
          </span>
        </div>
        {keys.length ? (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
            {keys.map((k) => (
              <span key={k}>
                <span className="d-num" style={{ color: "var(--d-faint)" }}>
                  {k}=
                </span>
                <span className="d-num" style={{ color: "var(--d-muted)" }}>
                  {String((e.payload as Record<string, unknown>)[k])}
                </span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AuditLogPage() {
  const { bump } = useDashboardRefresh();
  const { d } = useDash();
  const load = useCallback((signal: AbortSignal) => fetchAudit({ limit: 500 }, signal), []);
  const { data, error, loading } = useApi(load, [bump]);
  const [q, setQ] = useState("");
  const [node, setNode] = useState("");

  const nodes = useMemo(() => {
    const set = new Set((data?.items ?? []).map((e) => e.node_name));
    return Array.from(set);
  }, [data]);

  const rows = useMemo(() => {
    let items = data?.items ?? [];
    if (node) items = items.filter((e) => e.node_name === node);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      items = items.filter(
        (e) =>
          e.transaction_id.toLowerCase().includes(needle) ||
          e.node_name.toLowerCase().includes(needle) ||
          e.action_type.toLowerCase().includes(needle)
      );
    }
    return items;
  }, [data, q, node]);

  if (loading) return <Loading label={d.state.audit} />;
  if (error || !data) return <ErrorState message={error ?? "no data"} />;

  return (
    <motion.div
      className="mx-auto max-w-[1220px] space-y-4 p-5 md:p-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <PageHeader title={d.audit.title} subtitle={d.audit.desc} />
      </motion.div>

      <motion.div variants={item}>
        <Card>
          <div
            className="sticky top-0 z-10 flex flex-wrap items-center gap-2.5 px-4 py-3"
            style={{ borderBottom: "1px solid var(--d-border)", background: "var(--d-surface)" }}
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
                placeholder={d.audit.searchPh}
                className="w-64 rounded-lg border py-1.5 pl-8 pr-3 text-[12.5px] outline-none"
                style={{ borderColor: "var(--d-border)", background: "var(--d-surface)", color: "var(--d-ink)" }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <NodeChip value="" label={d.audit.allNodes} active={node === ""} onSelect={setNode} />
              {nodes.map((n) => (
                <NodeChip key={n} value={n} label={humanize(n)} active={node === n} onSelect={setNode} />
              ))}
            </div>
            <span className="ml-auto d-num text-[12px]" style={{ color: "var(--d-faint)" }}>
              {d.audit.entries(rows.length, data.total)}
            </span>
          </div>
          <div className="max-h-[68vh] overflow-y-auto">
            {rows.map((e) => (
              <Row key={e.id} e={e} />
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

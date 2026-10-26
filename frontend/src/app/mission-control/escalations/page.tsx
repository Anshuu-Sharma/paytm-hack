"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { container, item } from "@/lib/dashboard/motion";
import { Card } from "@/components/dashboard/Card";
import MiniStat from "@/components/dashboard/MiniStat";
import PageHeader from "@/components/dashboard/PageHeader";
import TransactionDrawer from "@/components/dashboard/TransactionDrawer";
import { ErrorState, Loading } from "@/components/dashboard/PageState";
import { useApi } from "@/hooks/useApi";
import { fetchEscalations, resolveEscalation } from "@/lib/dashboard/api";
import { humanize } from "@/lib/dashboard/format";
import { useDash, relTime } from "@/lib/dashboard/i18n";
import { useDashboardRefresh } from "@/lib/dashboard/refresh";

const TH = "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide";
const TD = "px-3 py-2.5 align-middle";

export default function EscalationsPage() {
  const { bump, refresh } = useDashboardRefresh();
  const { d } = useDash();
  const e = d.esc;
  const [selected, setSelected] = useState<string | null>(null);
  const onResolve = async (id: number) => {
    await resolveEscalation(id);
    refresh();
  };
  const load = useCallback((signal: AbortSignal) => fetchEscalations(signal), []);
  const { data, error, loading } = useApi(load, [bump]);

  if (loading) return <Loading label={d.state.esc} />;
  if (error || !data) return <ErrorState message={error ?? "no data"} />;

  const open = data.filter((t) => t.status === "OPEN").length;
  const resolved = data.length - open;

  return (
    <motion.div
      className="mx-auto max-w-[1220px] space-y-4 p-5 md:p-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <PageHeader
          title={e.title}
          subtitle={e.desc}
          accent={open ? "var(--d-warn)" : "var(--d-ok)"}
          right={
            <span
              className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
              style={{
                background: open ? "var(--d-warn-soft)" : "var(--d-ok-soft)",
                color: open ? "var(--d-warn)" : "var(--d-ok)",
              }}
            >
              {open} {e.open.toLowerCase()}
            </span>
          }
        />
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-3 gap-3">
        <MiniStat label={e.total} value={String(data.length)} countTo={data.length} countFormat={fmtInt} />
        <MiniStat label={e.open} value={String(open)} countTo={open} countFormat={fmtInt} accent="var(--d-warn)" emphasis={open > 0} />
        <MiniStat label={e.resolved} value={String(resolved)} countTo={resolved} countFormat={fmtInt} accent="var(--d-ok)" />
      </motion.div>

      <motion.div variants={item}>
      <Card>
        {data.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr style={{ color: "var(--d-muted)", borderBottom: "1px solid var(--d-border)" }}>
                  <th className={TH}>{e.colTxn}</th>
                  <th className={TH}>{e.colReason}</th>
                  <th className={TH}>{e.colRule}</th>
                  <th className={TH}>{e.colStatus}</th>
                  <th className={`${TH} text-right`}>{e.colWhen}</th>
                  <th className={`${TH} text-right`} />
                </tr>
              </thead>
              <tbody>
                {data.map((t) => {
                  const isOpen = t.status === "OPEN";
                  return (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: "1px solid var(--d-border)",
                      boxShadow: isOpen ? "inset 3px 0 0 var(--d-warn)" : undefined,
                    }}
                  >
                    <td className={`${TD} d-num text-[12px]`}>{t.transaction_id}</td>
                    <td className={`${TD}`} style={{ color: "var(--d-ink)" }}>
                      {t.reason}
                    </td>
                    <td className={`${TD} text-[12px]`}>
                      {t.rule ? (
                        <span
                          className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium"
                          style={{ background: "var(--d-slate-soft)", color: "var(--d-slate)" }}
                        >
                          {humanize(t.rule)}
                        </span>
                      ) : (
                        <span style={{ color: "var(--d-faint)" }}>—</span>
                      )}
                    </td>
                    <td className={TD}>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          background: t.status === "OPEN" ? "var(--d-slate-soft)" : "var(--d-ok-soft)",
                          color: t.status === "OPEN" ? "var(--d-slate)" : "var(--d-ok)",
                        }}
                      >
                        {t.status === "OPEN" ? e.open : e.resolved}
                      </span>
                    </td>
                    <td className={`${TD} text-right text-[12px]`} style={{ color: "var(--d-faint)" }}>
                      {relTime(t.created_at, d)}
                    </td>
                    <td className={`${TD} text-right`}>
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => setSelected(t.transaction_id)}
                          className="rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors hover:bg-[var(--d-surface-2)]"
                          style={{ border: "1px solid var(--d-border)", color: "var(--d-muted)" }}
                          title={e.colReason}
                        >
                          {e.why}
                        </button>
                        {t.status === "OPEN" ? (
                          <button
                            onClick={() => onResolve(t.id)}
                            className="rounded-lg px-2.5 py-1 text-[11.5px] font-semibold text-white"
                            style={{ background: "var(--d-ok)" }}
                          >
                            {d.ops.resolve}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-16 text-center text-[13px]" style={{ color: "var(--d-faint)" }}>
            {e.empty}
          </div>
        )}
      </Card>
      </motion.div>

      {/* Why → the case's activity timeline, where the causing audit entry sits. */}
      <TransactionDrawer id={selected} onClose={() => setSelected(null)} />
    </motion.div>
  );
}

const fmtInt = (v: number) => String(Math.round(v));

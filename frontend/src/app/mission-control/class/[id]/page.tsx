"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { container, item } from "@/lib/dashboard/motion";
import MiniStat from "@/components/dashboard/MiniStat";
import ClassInfoButton from "@/components/dashboard/ClassInfoButton";
import SimulateButton from "@/components/dashboard/SimulateButton";
import TransactionExplorer from "@/components/dashboard/TransactionExplorer";
import MandateCalendar from "@/components/dashboard/MandateCalendar";
import ReceivablesBoard from "@/components/dashboard/ReceivablesBoard";
import { ErrorState, Loading } from "@/components/dashboard/PageState";
import { useApi } from "@/hooks/useApi";
import { useIsClient } from "@/hooks/useIsClient";
import { fetchMetrics } from "@/lib/dashboard/api";
import { humanize, inr, pct } from "@/lib/dashboard/format";
import { useDash, durTime } from "@/lib/dashboard/i18n";
import { CLASS_COLOR } from "@/lib/dashboard/status";
import { useDashboardRefresh } from "@/lib/dashboard/refresh";

export default function ClassPage() {
  const params = useParams();
  const isClient = useIsClient();
  const { d } = useDash();
  const raw = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const id = raw >= 1 && raw <= 4 ? raw : 1;

  const { bump } = useDashboardRefresh();
  const load = useCallback((signal: AbortSignal) => fetchMetrics(signal), []);
  const { data: m, error, loading } = useApi(load, [bump]);

  const color = CLASS_COLOR[id];
  const solve = d.solve[id];
  const cp = d.classpg;

  // The id comes from useParams (empty during SSR) — render nothing class-
  // specific until hydration so the header/metrics never hydrate-mismatch.
  if (!isClient) return <Loading label={d.state.classpg} />;

  return (
    <motion.div
      className="mx-auto max-w-[1220px] space-y-5 p-5 md:p-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Class-tinted header banner */}
      <motion.div
        variants={item}
        className="flex items-start gap-3 rounded-2xl p-5"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${color} 13%, var(--d-surface)), var(--d-surface) 70%)`,
          border: "1px solid var(--d-border)",
          borderLeft: `4px solid ${color}`,
        }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{d.classLabel[id]}</h1>
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
              style={{ background: color }}
            >
              {cp.classTag} {id}
            </span>
          </div>
          <p className="mt-1 text-[13px]" style={{ color: "var(--d-muted)" }}>
            {solve.trigger}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <SimulateButton failureClass={id} accent={color} />
          <ClassInfoButton classId={id} color={color} />
        </div>
      </motion.div>

      {loading ? (
        <Loading label={d.state.classMetrics} />
      ) : error || !m ? (
        <ErrorState message={error ?? "no data"} />
      ) : (
        <>
          {/* Mini metrics */}
          {(() => {
            const c = m.by_class[String(id)];
            if (!c) return null;
            return (
              <motion.div variants={item} className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                <MiniStat
                  label={cp.mRecovered}
                  value={inr(c.recovered_inr, { compact: true })}
                  countTo={c.recovered_inr}
                  countFormat={fmtInrCompact}
                  accent="var(--d-ok)"
                  emphasis
                />
                <MiniStat label={cp.mAtRisk} value={inr(c.at_risk_inr, { compact: true })} countTo={c.at_risk_inr} countFormat={fmtInrCompact} />
                <MiniStat label={cp.mRate} value={pct(c.recovery_rate)} accent={color} emphasis />
                <MiniStat label={cp.mCases} value={`${c.recovered_count}/${c.count}`} />
                <MiniStat label={cp.mAvgTtr} value={durTime(c.avg_time_to_recovery_seconds, d)} />
                <MiniStat label={cp.mTopPlaybook} value={humanize(c.top_playbook)} />
              </motion.div>
            );
          })()}

          {/* Per-class operational tracker, above the ledger */}
          {id === 3 ? (
            <motion.div variants={item}>
              <MandateCalendar />
            </motion.div>
          ) : null}
          {id === 4 ? (
            <motion.div variants={item}>
              <ReceivablesBoard />
            </motion.div>
          ) : null}

          {/* Class-filtered ledger */}
          <motion.div variants={item}>
            <TransactionExplorer fixedClass={id} />
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

const fmtInrCompact = (v: number) => inr(Math.round(v), { compact: true });

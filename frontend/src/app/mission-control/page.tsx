"use client";

import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { container, item } from "@/lib/dashboard/motion";
import { Card, CardHeader, Chip } from "@/components/dashboard/Card";
import KpiCard from "@/components/dashboard/KpiCard";
import { AreaChart, CountUp, FunnelBars, HBarList, SegmentBar } from "@/components/dashboard/charts";
import { ErrorState, Loading } from "@/components/dashboard/PageState";
import { useApi } from "@/hooks/useApi";
import { fetchMetrics } from "@/lib/dashboard/api";
import { humanize, inr, pct, shortDate } from "@/lib/dashboard/format";
import { useDash, durTime } from "@/lib/dashboard/i18n";
import { CLASS_COLOR } from "@/lib/dashboard/status";
import { useDashboardRefresh } from "@/lib/dashboard/refresh";
import { useRexRun } from "@/lib/dashboard/rexrun";

/* Lazy-load the Transactions tab — its chunk only downloads when first clicked */
const TransactionsTab = lazy(() => import("@/components/dashboard/TransactionsTab"));

const fmtPct = (v: number) => `${Math.round(v)}%`;
const fmtInrCompact = (v: number) => inr(Math.round(v), { compact: true });

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════════════ */
export default function AnalyticsPage() {
  const [tab, setTab] = useState<"recovery" | "transactions">("recovery");
  const { bump, refresh } = useDashboardRefresh();
  const { running } = useRexRun();
  const { d } = useDash();
  const o = d.overview;
  const load = useCallback((signal: AbortSignal) => fetchMetrics(signal), []);
  const { data: m, error, loading } = useApi(load, [bump]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => refresh(), 2500);
    return () => clearInterval(id);
  }, [running, refresh]);

  const tabs = [
    { id: "recovery",     label: "Recovery"     },
    { id: "transactions", label: "Transactions" },
  ] as const;

  return (
    <motion.div
      className="mx-auto max-w-[1280px] p-4 md:p-5"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Tab bar */}
      <motion.div variants={item} className="mb-4 flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="rounded-[10px] px-4 py-1.5 text-[13px] font-semibold transition-colors"
            style={{
              background: tab === t.id ? "var(--d-surface)" : "transparent",
              color: tab === t.id ? "var(--d-ink)" : "var(--d-muted)",
              border: tab === t.id ? "1px solid var(--d-border)" : "1px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {tab === "recovery" ? (
          <motion.div key="recovery"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}>
            {loading ? (
              <Loading label={d.state.metrics} />
            ) : error || !m ? (
              <ErrorState message={error ?? "no data"} />
            ) : (
              <RecoveryTab m={m} o={o} d={d} />
            )}
          </motion.div>
        ) : (
          <motion.div key="transactions"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}>
            <Suspense fallback={<Loading label="Loading transactions…" />}>
              <TransactionsTab />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Recovery tab ── */
function RecoveryTab({
  m,
  o,
  d,
}: {
  m: Awaited<ReturnType<typeof fetchMetrics>>;
  o: ReturnType<typeof useDash>["d"]["overview"];
  d: ReturnType<typeof useDash>["d"];
}) {
  const series = m.time_series.map((p) => ({ label: shortDate(p.date), value: p.cumulative_inr }));
  const sparkValues = m.time_series.map((p) => p.cumulative_inr);

  const classSegments = [1, 2, 3, 4]
    .map((n) => ({ label: d.classLabel[n], value: m.by_class[String(n)]?.recovered_inr ?? 0, color: CLASS_COLOR[n] }))
    .filter((s) => s.value > 0);

  const cr = (v: number) => inr(v, { compact: true });
  const funnelStages = [
    { label: o.ft.atRisk,     value: m.funnel.at_risk,    color: "var(--d-slate)", amount: cr(m.at_risk_inr) },
    { label: o.ft.intervened, value: m.funnel.intervened, color: CLASS_COLOR[2],   amount: cr(m.in_flight_inr) },
    { label: o.ft.recovered,  value: m.funnel.recovered,  color: "var(--d-ok)",    amount: cr(m.recovered_inr) },
    { label: o.ft.escalated,  value: m.funnel.escalated,  color: "var(--d-info)"  },
    { label: o.ft.stopped,    value: m.funnel.cancelled,  color: "var(--d-muted)" },
    { label: o.ft.lost,       value: m.funnel.failed,     color: "var(--d-bad)",   amount: cr(m.lost_inr) },
  ];

  const channelRows = Object.entries(m.channel_breakdown).map(([ch, s]) => ({
    label: humanize(ch),
    value: s.dispatched,
    display: `${s.recovered}/${s.dispatched}`,
    sub: `${pct(s.dispatched ? s.recovered / s.dispatched : 0)}`,
    color: "var(--d-accent)",
  }));

  const ruleRows = Object.entries(m.stopping_rules_by_name)
    .sort((a, b) => b[1] - a[1])
    .map(([rule, count]) => ({ label: humanize(rule), value: count, color: "var(--d-slate)" }));

  const grrrPct = m.grrr * 100;
  const daily = series.slice(1).map((pt, i) => pt.value - series[i].value);
  const maxDailyAbs = Math.max(...daily.map(Math.abs), 1);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

      {/* Hero: GRRR */}
      <motion.div variants={item} className="d-hero relative overflow-hidden rounded-[26px] p-6 sm:col-span-2 lg:col-span-2 lg:row-span-1">
        <div className="d-hero-mesh" aria-hidden />
        <div className="relative flex h-full flex-col justify-between gap-6">
          <div>
            <span className="d-label" style={{ color: "rgba(255,255,255,0.65)" }}>{o.gaugeTitle}</span>
            <div className="d-num mt-2 font-semibold leading-none tracking-[-0.04em] text-white"
              style={{ fontSize: "clamp(3.5rem, 8vw, 5.5rem)" }}>
              <CountUp value={grrrPct} format={fmtPct} />
            </div>
            <p className="mt-3 text-[13px]" style={{ color: "rgba(255,255,255,0.8)" }}>
              {o.kRecoveredSub(inr(m.at_risk_inr, { compact: true }), m.counts.recovered)}
            </p>
            {daily.length > 1 && (
              <div className="mt-5">
                <div className="flex items-end gap-[3px]" style={{ height: 44 }}>
                  {daily.slice(-28).map((dv, i, arr) => (
                    <div key={i} className="flex-1 rounded-[3px]"
                      style={{
                        height: `${18 + (Math.abs(dv) / maxDailyAbs) * 82}%`,
                        background: "rgba(255,255,255,0.9)",
                        opacity: 0.18 + (i / arr.length) * 0.65,
                      }} />
                  ))}
                </div>
                <div className="mt-1.5 flex justify-between font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.42)" }}>
                  <span>28d ago</span><span>Daily recovered</span><span>Today</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-8 border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
            <div>
              <span className="d-label text-[10px]" style={{ color: "rgba(255,255,255,0.6)" }}>{o.kRecovered}</span>
              <div className="d-num mt-1 text-[20px] font-semibold text-white">{inr(m.recovered_inr, { compact: true })}</div>
            </div>
            <div>
              <span className="d-label text-[10px]" style={{ color: "rgba(255,255,255,0.6)" }}>{o.avgTtr}</span>
              <div className="d-num mt-1 text-[20px] font-semibold text-white">{durTime(m.avg_time_to_recovery_seconds, d)}</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Recovered INR */}
      <motion.div variants={item}>
        <KpiCard
          label={o.kRecovered} value={inr(m.recovered_inr, { compact: true })}
          countTo={m.recovered_inr} countFormat={fmtInrCompact}
          accent="var(--d-ok)" emphasis spark={sparkValues}
          sub={o.kRecoveredSub(inr(m.at_risk_inr, { compact: true }), m.counts.recovered)}
        />
      </motion.div>

      {/* At-Risk solid */}
      <motion.div variants={item}>
        <section className="relative flex min-h-[130px] flex-col justify-between overflow-hidden rounded-[26px] p-5"
          style={{ background: "var(--d-warn)", color: "oklch(0.22 0.06 88)" }}>
          <header className="flex items-center justify-between">
            <span className="text-[12px] font-semibold" style={{ opacity: 0.75 }}>{o.kAtRisk}</span>
            <span className="flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold"
              style={{ background: "oklch(0.22 0.06 88 / 0.12)" }}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "oklch(0.22 0.06 88)" }} />
              {o.kAtRiskSub(m.funnel.at_risk)}
            </span>
          </header>
          <div>
            <div className="d-num text-[28px] font-semibold leading-none tracking-[-0.03em]">
              <CountUp value={m.at_risk_inr} format={fmtInrCompact} />
            </div>
          </div>
        </section>
      </motion.div>

      {/* Recovery over time (2 cols, 2 rows) */}
      <motion.div variants={item} className="sm:col-span-2 lg:col-span-2 lg:row-span-2">
        <Card className="h-full">
          <CardHeader title={o.timeTitle} subtitle={o.timeSub}
            right={<span className="d-num text-[13px] font-semibold" style={{ color: "var(--d-ok)" }}>{inr(m.recovered_inr)}</span>}
          />
          <div className="px-3 pb-3"><AreaChart data={series} color="var(--d-ok)" /></div>
        </Card>
      </motion.div>

      {/* Class breakdown */}
      <motion.div variants={item}>
        <Card>
          <CardHeader title={o.byClassTitle} subtitle={o.byClassSub} />
          <div className="px-5 pb-5">
            <p className="d-num mb-4 text-[22px] font-semibold leading-none tracking-[-0.03em]" style={{ color: "var(--d-ok)" }}>
              {inr(m.recovered_inr, { compact: true })}
            </p>
            <SegmentBar
              segments={classSegments.map((s) => ({ label: s.label, value: s.value }))}
              colors={classSegments.map((s) => s.color)}
            />
          </div>
        </Card>
      </motion.div>

      {/* In-flight solid */}
      <motion.div variants={item}>
        <Card className="flex min-h-[130px] flex-col justify-between p-5">
          <span className="d-label">{o.kInFlight}</span>
          <div>
            <div className="d-num text-[28px] font-semibold leading-none tracking-[-0.03em]" style={{ color: "var(--d-warn)" }}>
              <CountUp value={m.in_flight_inr} format={fmtInrCompact} />
            </div>
            <div className="mt-2 text-[11px]" style={{ color: "var(--d-muted)" }}>{o.kInFlightSub}</div>
          </div>
        </Card>
      </motion.div>

      {/* Channels */}
      <motion.div variants={item}>
        <Card>
          <CardHeader title={o.channelsTitle} subtitle={o.channelsSub} />
          <div className="px-5 pb-5">
            {channelRows.length
              ? <HBarList rows={channelRows} />
              : <p className="text-[12px]" style={{ color: "var(--d-faint)" }}>{o.noDispatch}</p>}
          </div>
        </Card>
      </motion.div>

      {/* Lost INR solid */}
      <motion.div variants={item}>
        <Card className="flex min-h-[130px] flex-col justify-between p-5">
          <span className="d-label">{o.kLost}</span>
          <div>
            <div className="d-num text-[28px] font-semibold leading-none tracking-[-0.03em]" style={{ color: "var(--d-bad)" }}>
              <CountUp value={m.lost_inr} format={fmtInrCompact} />
            </div>
            <div className="mt-2 text-[11px]" style={{ color: "var(--d-muted)" }}>{o.kLostSub(m.counts.failed)}</div>
          </div>
        </Card>
      </motion.div>

      {/* Funnel (2 cols) */}
      <motion.div variants={item} className="sm:col-span-2 lg:col-span-2">
        <Card>
          <CardHeader title={o.funnelTitle} subtitle={o.funnelSub}
            right={
              <Chip tone={{ fg: "var(--d-ok)", soft: "var(--d-ok-soft)" }}>
                {o.recoveredChip(pct(m.funnel.at_risk ? m.funnel.recovered / m.funnel.at_risk : 0))}
              </Chip>
            }
          />
          <div className="px-5 pb-5"><FunnelBars stages={funnelStages} /></div>
        </Card>
      </motion.div>

      {/* Compliance (2 cols) */}
      <motion.div variants={item} className="sm:col-span-2 lg:col-span-2">
        <Card>
          <CardHeader title={o.complianceTitle} subtitle={o.complianceSub}
            right={
              <Chip tone={{ fg: "var(--d-slate)", soft: "var(--d-slate-soft)" }}>
                {o.escalatedChip(m.counts.escalations)}
              </Chip>
            }
          />
          <div className="px-5 pb-5">
            {ruleRows.length
              ? <HBarList rows={ruleRows} />
              : <p className="text-[12px]" style={{ color: "var(--d-faint)" }}>{o.noRules}</p>}
          </div>
        </Card>
      </motion.div>

    </div>
  );
}

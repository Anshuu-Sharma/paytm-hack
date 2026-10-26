"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import { container, item } from "@/lib/dashboard/motion";
import { Card, CardHeader, Chip } from "@/components/dashboard/Card";
import KpiCard from "@/components/dashboard/KpiCard";
import { AreaChart, CountUp, Donut, FunnelBars, HBarList } from "@/components/dashboard/charts";
import { ErrorState, Loading } from "@/components/dashboard/PageState";
import { useApi } from "@/hooks/useApi";
import { fetchMetrics } from "@/lib/dashboard/api";
import { humanize, inr, pct, shortDate } from "@/lib/dashboard/format";
import { useDash, durTime } from "@/lib/dashboard/i18n";
import { CLASS_COLOR } from "@/lib/dashboard/status";
import { useDashboardRefresh } from "@/lib/dashboard/refresh";

// Stable formatters (module scope) so CountUp's effect doesn't re-run per render.
const fmtPct = (v: number) => `${Math.round(v)}%`;
const fmtInrCompact = (v: number) => inr(Math.round(v), { compact: true });

export default function OverviewPage() {
  const { bump } = useDashboardRefresh();
  const { d } = useDash();
  const o = d.overview;
  const load = useCallback((signal: AbortSignal) => fetchMetrics(signal), []);
  const { data: m, error, loading } = useApi(load, [bump]);

  if (loading) return <Loading label={d.state.metrics} />;
  if (error || !m) return <ErrorState message={error ?? "no data"} />;

  const series = m.time_series.map((p) => ({
    label: shortDate(p.date),
    value: p.cumulative_inr,
  }));
  const sparkValues = m.time_series.map((p) => p.cumulative_inr);

  const totalWon =
    [1, 2, 3, 4].reduce((s, n) => s + (m.by_class[String(n)]?.recovered_inr ?? 0), 0) || 1;
  const classSegments = [1, 2, 3, 4]
    .map((n) => ({
      label: d.classLabel[n],
      value: m.by_class[String(n)]?.recovered_inr ?? 0,
      color: CLASS_COLOR[n],
    }))
    .filter((s) => s.value > 0);

  const cr = (v: number) => inr(v, { compact: true });
  const funnelStages = [
    { label: o.ft.atRisk, value: m.funnel.at_risk, color: "var(--d-slate)", amount: cr(m.at_risk_inr) },
    { label: o.ft.intervened, value: m.funnel.intervened, color: CLASS_COLOR[2], amount: cr(m.in_flight_inr) },
    { label: o.ft.recovered, value: m.funnel.recovered, color: "var(--d-ok)", amount: cr(m.recovered_inr) },
    { label: o.ft.escalated, value: m.funnel.escalated, color: "var(--d-info)" },
    { label: o.ft.stopped, value: m.funnel.cancelled, color: "var(--d-muted)" },
    { label: o.ft.lost, value: m.funnel.failed, color: "var(--d-bad)", amount: cr(m.lost_inr) },
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
    .map(([rule, count]) => ({
      label: humanize(rule),
      value: count,
      color: "var(--d-slate)",
    }));

  return (
    <motion.div
      className="mx-auto max-w-[1220px] space-y-5 p-5 md:p-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Hero — the GRRR banner */}
      <motion.div variants={item} className="d-hero relative overflow-hidden rounded-2xl p-6 md:p-7">
        <div className="d-hero-mesh" aria-hidden />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="d-label" style={{ color: "rgba(255,255,255,0.72)" }}>
              {o.gaugeTitle}
            </span>
            <div
              className="d-num mt-2 font-semibold leading-none text-white"
              style={{ fontSize: "clamp(3rem, 7vw, 4.75rem)" }}
            >
              <CountUp value={m.grrr * 100} format={fmtPct} />
            </div>
            <p className="mt-3 max-w-md text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>
              {o.kRecoveredSub(inr(m.at_risk_inr, { compact: true }), m.counts.recovered)}
            </p>
          </div>
          <div className="flex gap-8">
            <div>
              <span className="d-label" style={{ color: "rgba(255,255,255,0.72)" }}>
                {o.kRecovered}
              </span>
              <div className="d-num mt-1.5 text-[22px] font-semibold text-white">
                {inr(m.recovered_inr, { compact: true })}
              </div>
            </div>
            <div>
              <span className="d-label" style={{ color: "rgba(255,255,255,0.72)" }}>
                {o.avgTtr}
              </span>
              <div className="d-num mt-1.5 text-[22px] font-semibold text-white">
                {durTime(m.avg_time_to_recovery_seconds, d)}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* KPI row */}
      <motion.div variants={item} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label={o.kRecovered}
          value={inr(m.recovered_inr, { compact: true })}
          countTo={m.recovered_inr}
          countFormat={fmtInrCompact}
          accent="var(--d-ok)"
          emphasis
          spark={sparkValues}
          sub={o.kRecoveredSub(inr(m.at_risk_inr, { compact: true }), m.counts.recovered)}
        />
        <KpiCard
          label={o.kAtRisk}
          value={inr(m.at_risk_inr, { compact: true })}
          countTo={m.at_risk_inr}
          countFormat={fmtInrCompact}
          sub={o.kAtRiskSub(m.funnel.at_risk)}
        />
        <KpiCard
          label={o.kInFlight}
          value={inr(m.in_flight_inr, { compact: true })}
          countTo={m.in_flight_inr}
          countFormat={fmtInrCompact}
          accent="var(--d-warn)"
          sub={o.kInFlightSub}
        />
        <KpiCard
          label={o.kLost}
          value={inr(m.lost_inr, { compact: true })}
          countTo={m.lost_inr}
          countFormat={fmtInrCompact}
          accent="var(--d-bad)"
          sub={o.kLostSub(m.counts.failed)}
        />
      </motion.div>

      {/* Funnel — the centrepiece */}
      <motion.div variants={item}>
        <Card>
          <CardHeader
            title={o.funnelTitle}
            subtitle={o.funnelSub}
            right={
              <Chip tone={{ fg: "var(--d-ok)", soft: "var(--d-ok-soft)" }}>
                {o.recoveredChip(pct(m.funnel.at_risk ? m.funnel.recovered / m.funnel.at_risk : 0))}
              </Chip>
            }
          />
          <div className="px-5 pb-5">
            <FunnelBars stages={funnelStages} />
          </div>
        </Card>
      </motion.div>

      {/* Recovery over time */}
      <motion.div variants={item}>
        <Card>
          <CardHeader
            title={o.timeTitle}
            subtitle={o.timeSub}
            right={
              <span className="d-num text-[13px] font-semibold" style={{ color: "var(--d-ok)" }}>
                {inr(m.recovered_inr)}
              </span>
            }
          />
          <div className="px-3 pb-2">
            <AreaChart data={series} color="var(--d-ok)" />
          </div>
        </Card>
      </motion.div>

      {/* By class · Channels · Compliance */}
      <motion.div variants={item} className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title={o.byClassTitle} subtitle={o.byClassSub} />
          <div className="flex items-center gap-5 px-5 pb-5">
            <Donut
              segments={classSegments}
              centerValue={inr(m.recovered_inr, { compact: true })}
              centerLabel={o.won}
            />
            <ul className="flex-1 space-y-1.5">
              {[1, 2, 3, 4].map((n) => {
                const c = m.by_class[String(n)];
                if (!c) return null;
                return (
                  <li key={n} className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-[3px]"
                        style={{ background: CLASS_COLOR[n] }}
                      />
                      <span style={{ color: "var(--d-muted)" }}>{d.classShort[n]}</span>
                    </span>
                    <span className="d-num">
                      <span style={{ color: "var(--d-faint)" }}>{inr(c.recovered_inr, { compact: true })} · </span>
                      {pct(c.recovered_inr / totalWon)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>

        <Card>
          <CardHeader title={o.channelsTitle} subtitle={o.channelsSub} />
          <div className="px-5 pb-5">
            {channelRows.length ? (
              <HBarList rows={channelRows} />
            ) : (
              <p className="text-[12px]" style={{ color: "var(--d-faint)" }}>
                {o.noDispatch}
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={o.complianceTitle}
            subtitle={o.complianceSub}
            right={
              <Chip tone={{ fg: "var(--d-slate)", soft: "var(--d-slate-soft)" }}>
                {o.escalatedChip(m.counts.escalations)}
              </Chip>
            }
          />
          <div className="px-5 pb-5">
            {ruleRows.length ? (
              <HBarList rows={ruleRows} />
            ) : (
              <p className="text-[12px]" style={{ color: "var(--d-faint)" }}>
                {o.noRules}
              </p>
            )}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

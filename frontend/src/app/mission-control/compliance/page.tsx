"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import { container, item } from "@/lib/dashboard/motion";
import { Card } from "@/components/dashboard/Card";
import MiniStat from "@/components/dashboard/MiniStat";
import PageHeader from "@/components/dashboard/PageHeader";
import { ErrorState, Loading } from "@/components/dashboard/PageState";
import { useApi } from "@/hooks/useApi";
import { fetchMetrics, fetchPolicy } from "@/lib/dashboard/api";
import { humanize } from "@/lib/dashboard/format";
import { useDash } from "@/lib/dashboard/i18n";
import { useDashboardRefresh } from "@/lib/dashboard/refresh";

// Regulation each stopping rule maps back to — the "why it exists".
const RULE_META: Record<string, { reg: string; icon: string }> = {
  RBI_MAX_RETRIES: { reg: "RBI", icon: "🏦" },
  TRAI_QUIET_HOURS: { reg: "TRAI", icon: "🌙" },
  VOICE_ATTEMPT_CAP: { reg: "TRAI", icon: "📵" },
  OPT_OUT: { reg: "Consent", icon: "✋" },
  EXPLICIT_CANCEL: { reg: "Consent", icon: "🚫" },
  DISPUTE_FREEZE: { reg: "Consumer", icon: "⚖️" },
  NO_DOUBLE_CHARGE: { reg: "Integrity", icon: "🔁" },
  CROSS_DEVICE_COMPLETION: { reg: "Integrity", icon: "📱" },
};

function RuleCard({
  name,
  desc,
  count,
}: {
  name: string;
  desc: string;
  count: number;
}) {
  const meta = RULE_META[name] ?? { reg: "Policy", icon: "🛡" };
  const fired = count > 0;
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "var(--d-surface)",
        border: "1px solid var(--d-border)",
        borderLeft: `3px solid ${fired ? "var(--d-slate)" : "var(--d-border-strong)"}`,
      }}
    >
      <div className="flex items-start gap-2.5">
        <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[12.5px] font-semibold">{humanize(name)}</p>
            <span
              className="rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide"
              style={{ background: "var(--d-surface-2)", color: "var(--d-faint)" }}
            >
              {meta.reg}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] leading-snug" style={{ color: "var(--d-muted)" }}>
            {desc}
          </p>
        </div>
        <span
          className="d-num h-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{
            background: fired ? "var(--d-slate-soft)" : "var(--d-surface-2)",
            color: fired ? "var(--d-slate)" : "var(--d-faint)",
          }}
        >
          {fired ? `${count}×` : "0"}
        </span>
      </div>
    </div>
  );
}

export default function CompliancePage() {
  const { bump } = useDashboardRefresh();
  const { d } = useDash();
  const cc = d.comp;
  const loadM = useCallback((signal: AbortSignal) => fetchMetrics(signal), []);
  const loadP = useCallback((signal: AbortSignal) => fetchPolicy(signal), []);
  const metrics = useApi(loadM, [bump]);
  const policy = useApi(loadP, [bump]);

  if (metrics.loading || policy.loading) return <Loading label={d.state.compliance} />;
  if (metrics.error || !metrics.data) return <ErrorState message={metrics.error ?? "no data"} />;
  if (policy.error || !policy.data) return <ErrorState message={policy.error ?? "no data"} />;

  const fired = metrics.data.stopping_rules_by_name;
  const totalFired = Object.values(fired).reduce((a, b) => a + b, 0);

  const rules = policy.data.stopping_rules.map((r) => ({
    name: r.name,
    desc: d.ruleDesc[r.name] ?? r.description,
    count: fired[r.name] ?? 0,
  }));
  const firedRules = rules.filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
  const armedRules = rules.filter((r) => r.count === 0);

  return (
    <motion.div
      className="mx-auto max-w-[1220px] space-y-5 p-5 md:p-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <PageHeader
          title={cc.title}
          subtitle={
            <>
              {cc.descA}
              <em>{cc.descEm}</em>
              {cc.descB}
            </>
          }
        />
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-3 gap-3">
        <MiniStat label={cc.fired} value={String(totalFired)} countTo={totalFired} countFormat={fmtInt} accent="var(--d-slate)" emphasis={totalFired > 0} />
        <MiniStat label={cc.escalated} value={String(metrics.data.counts.escalations)} countTo={metrics.data.counts.escalations} countFormat={fmtInt} accent="var(--d-info)" />
        <MiniStat label={cc.stopped} value={String(metrics.data.counts.cancelled)} countTo={metrics.data.counts.cancelled} countFormat={fmtInt} accent="var(--d-muted)" />
      </motion.div>

      {firedRules.length ? (
        <motion.div variants={item}>
          <p className="d-label mb-2">{cc.firedGroup}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {firedRules.map((r) => (
              <RuleCard key={r.name} {...r} />
            ))}
          </div>
        </motion.div>
      ) : null}

      <motion.div variants={item}>
        <p className="d-label mb-2">{cc.armed}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {armedRules.map((r) => (
            <RuleCard key={r.name} {...r} />
          ))}
        </div>
      </motion.div>

      <motion.div variants={item}>
        <Card className="px-4 py-3">
          <p className="text-[11.5px]" style={{ color: "var(--d-faint)" }}>
            {cc.rexNote}
          </p>
        </Card>
      </motion.div>
    </motion.div>
  );
}

const fmtInt = (v: number) => String(Math.round(v));

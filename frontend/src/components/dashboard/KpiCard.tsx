import type { ReactNode } from "react";
import { Card } from "./Card";
import { CountUp, Sparkline } from "./charts";

export default function KpiCard({
  label,
  value,
  sub,
  accent = "var(--d-ink)",
  spark,
  emphasis = false,
  countTo,
  countFormat,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  accent?: string;
  spark?: number[];
  emphasis?: boolean;
  /** When set, the figure counts up to this number on load using countFormat. */
  countTo?: number;
  countFormat?: (n: number) => string;
}) {
  return (
    <Card
      className="flex flex-col justify-between p-4"
      style={emphasis ? { boxShadow: `inset 3px 0 0 ${accent}, var(--d-shadow)` } : undefined}
    >
      <div className="flex items-start justify-between">
        <span className="d-label">{label}</span>
        {spark && spark.length > 1 ? <Sparkline values={spark} color={accent} /> : null}
      </div>
      <div className="mt-3">
        <div
          className="d-num text-[26px] font-semibold leading-none tracking-tight"
          style={{ color: emphasis ? accent : "var(--d-ink)" }}
        >
          {countTo != null && countFormat ? (
            <CountUp value={countTo} format={countFormat} />
          ) : (
            value
          )}
        </div>
        {sub ? (
          <div className="mt-1.5 text-[12px]" style={{ color: "var(--d-muted)" }}>
            {sub}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

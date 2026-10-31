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
    <Card className="flex min-h-[130px] flex-col justify-between p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="d-label">{label}</span>
        {spark && spark.length > 1 ? <Sparkline values={spark} color={accent} /> : null}
      </div>
      <div>
        <div
          className="d-num text-[28px] font-semibold leading-none tracking-[-0.03em]"
          style={{ color: emphasis ? accent : "var(--d-ink)" }}
        >
          {countTo != null && countFormat ? (
            <CountUp value={countTo} format={countFormat} />
          ) : (
            value
          )}
        </div>
        {sub ? (
          <div className="mt-2 text-[11px] leading-snug" style={{ color: "var(--d-muted)" }}>
            {sub}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

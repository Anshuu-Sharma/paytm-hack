import type { ReactNode } from "react";
import { Card } from "./Card";
import { CountUp } from "./charts";

export default function MiniStat({
  label,
  value,
  accent = "var(--d-ink)",
  emphasis = false,
  countTo,
  countFormat,
  sub,
}: {
  label: string;
  value: string;
  accent?: string;
  emphasis?: boolean;
  /** When set, the figure counts up to this number using countFormat. */
  countTo?: number;
  countFormat?: (n: number) => string;
  sub?: ReactNode;
}) {
  return (
    <Card
      className="px-4 py-3"
      style={emphasis ? { boxShadow: `inset 3px 0 0 ${accent}, var(--d-shadow)` } : undefined}
    >
      <p className="d-label">{label}</p>
      <p
        className="d-num mt-1 text-lg font-semibold leading-none"
        style={{ color: emphasis ? accent : accent }}
      >
        {countTo != null && countFormat ? (
          <CountUp value={countTo} format={countFormat} />
        ) : (
          value
        )}
      </p>
      {sub ? (
        <p className="mt-1 text-[11px]" style={{ color: "var(--d-faint)" }}>
          {sub}
        </p>
      ) : null}
    </Card>
  );
}

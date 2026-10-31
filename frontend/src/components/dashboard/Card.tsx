import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`d-card ${className}`} style={style}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 px-5 pt-5">
      <div>
        <h3 className="text-[13px] font-medium" style={{ color: "var(--d-muted)" }}>
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--d-faint)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {right}
    </div>
  );
}

export function Chip({
  tone,
  children,
}: {
  tone: { fg: string; soft: string };
  children: ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold"
      style={{ background: tone.soft, color: tone.fg }}
    >
      {children}
    </span>
  );
}

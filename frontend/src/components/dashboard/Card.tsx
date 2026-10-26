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
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div>
        <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--d-muted)" }}>
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
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: tone.soft, color: tone.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.fg }} />
      {children}
    </span>
  );
}

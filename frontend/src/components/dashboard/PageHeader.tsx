import type { ReactNode } from "react";

/** Consistent page header across every Mission Control sub-page: a small accent
 * eyebrow tick, the title, a muted subtitle, and an optional right-side action. */
export default function PageHeader({
  title,
  subtitle,
  right,
  accent = "var(--d-accent)",
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 h-7 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--d-muted)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {right ? <div className="ml-auto flex shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  );
}

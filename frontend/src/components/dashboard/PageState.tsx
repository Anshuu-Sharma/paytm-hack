"use client";

import { useDashboardRefresh } from "@/lib/dashboard/refresh";
import { useDash } from "@/lib/dashboard/i18n";

export function Loading({ label }: { label?: string }) {
  const { d } = useDash();
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex items-center gap-3 text-[13px]" style={{ color: "var(--d-muted)" }}>
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          style={{ color: "var(--d-accent)" }}
        />
        {label ?? d.state.loadingGeneric}
      </div>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  const { reseed, reseeding } = useDashboardRefresh();
  const { d } = useDash();
  const looksEmpty = /404|not found|empty|no data/i.test(message);
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-semibold">{d.state.errTitle}</p>
      <p className="max-w-md text-[12.5px]" style={{ color: "var(--d-muted)" }}>
        {looksEmpty ? d.state.errEmpty : d.state.errApi(message)}
      </p>
      <button
        onClick={reseed}
        disabled={reseeding}
        className="mt-1 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--d-ink)" }}
      >
        {reseeding ? d.state.seeding : d.state.seed}
      </button>
    </div>
  );
}

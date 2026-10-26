"use client";

import { usePathname } from "next/navigation";
import LocaleToggle from "@/components/LocaleToggle";
import { activeNav, navLabel } from "@/lib/dashboard/nav";
import { useDash } from "@/lib/dashboard/i18n";
import { useDashboardRefresh } from "@/lib/dashboard/refresh";

export default function Topbar() {
  const pathname = usePathname() ?? "/mission-control";
  const { refresh, reseed, reseeding } = useDashboardRefresh();
  const { d } = useDash();
  const item = activeNav(pathname);
  const section = item ? navLabel(item, d) : d.nav.overview;

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center justify-between px-5"
      style={{
        borderBottom: "1px solid var(--d-border)",
        background: "color-mix(in srgb, var(--d-bg) 82%, transparent)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-sm font-semibold tracking-tight">{section}</span>
        <span
          className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ background: "var(--d-ok-soft)", color: "var(--d-ok)" }}
        >
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full"
            style={{ background: "var(--d-ok)" }}
          />
          {d.topbar.live}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={refresh}
          className="rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors"
          style={{ borderColor: "var(--d-border)", color: "var(--d-muted)" }}
          title="Refresh data"
        >
          {d.topbar.refresh}
        </button>
        <button
          onClick={reseed}
          disabled={reseeding}
          className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ background: "var(--d-ink)" }}
          title="Rebuild the demo dataset"
        >
          {reseeding ? d.topbar.reseeding : d.topbar.reset}
        </button>
        <div className="ml-1">
          <LocaleToggle />
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, navLabel } from "@/lib/dashboard/nav";
import { useDash } from "@/lib/dashboard/i18n";

function isActive(pathname: string, href: string): boolean {
  if (href === "/mission-control") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar() {
  const pathname = usePathname() ?? "";
  const { d } = useDash();

  return (
    <aside
      className="hidden w-[248px] shrink-0 flex-col border-r md:flex"
      style={{ borderColor: "var(--d-border)", background: "var(--d-surface)" }}
    >
      {/* Brand */}
      <Link
        href="/mission-control"
        className="flex items-center gap-2.5 px-5 py-[18px]"
        style={{ borderBottom: "1px solid var(--d-border)" }}
      >
        <span
          className="grid h-7 w-7 place-items-center rounded-lg text-[13px] font-bold text-white"
          style={{ background: "var(--d-accent)" }}
        >
          R
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight">REX</span>
          <span className="d-label" style={{ letterSpacing: "0.08em" }}>
            {d.brandSub}
          </span>
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-6" : ""}>
            {group.groupKey ? (
              <p className="d-label px-3 pb-2" style={{ color: "var(--d-faint)" }}>
                {d.groups[group.groupKey]}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const label = navLabel(item, d);
                const base =
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors";
                if (!item.ready) {
                  return (
                    <li key={item.href}>
                      <span
                        className={`${base} cursor-not-allowed select-none`}
                        style={{ color: "var(--d-faint)" }}
                        title="Coming up next"
                      >
                        <span className="grid h-[18px] w-[18px] place-items-center opacity-60">
                          {item.icon}
                        </span>
                        <span className="flex-1">{label}</span>
                        <span
                          className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                          style={{ background: "var(--d-surface-2)", color: "var(--d-faint)" }}
                        >
                          {d.soon}
                        </span>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={base}
                      style={
                        active
                          ? { background: "var(--d-accent-soft)", color: "var(--d-accent)" }
                          : { color: "var(--d-muted)" }
                      }
                    >
                      <span className="grid h-[18px] w-[18px] place-items-center">
                        {item.icon}
                      </span>
                      <span className="flex-1">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div
        className="px-4 py-3 text-[11px]"
        style={{ borderTop: "1px solid var(--d-border)", color: "var(--d-faint)" }}
      >
        <Link
          href="/"
          className="transition-colors hover:underline"
          style={{ color: "var(--d-muted)" }}
        >
          {d.exit}
        </Link>
      </div>
    </aside>
  );
}

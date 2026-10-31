"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV, navLabel } from "@/lib/dashboard/nav";
import { useDash } from "@/lib/dashboard/i18n";
import { useChatHistory } from "@/lib/dashboard/ChatHistoryContext";
import { relativeDate } from "@/lib/dashboard/chatHistory";

function isActive(pathname: string, href: string): boolean {
  // These two hrefs are prefixes of other nav items' own hrefs
  // ("/mission-control/ask?id=" sessions, "/mission-control/dsr/reconciliation"),
  // so they only count as active on an exact match — otherwise both would
  // light up together.
  if (href === "/mission-control" || href === "/mission-control/ask" || href === "/mission-control/dsr") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(href + "/");
}

/* ── Chat session sub-list rendered below the Ask REX nav item ──────── */
function ChatSessionsList({ pathname }: { pathname: string }) {
  const { sessions, currentId, remove } = useChatHistory();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const onAsk = pathname === "/mission-control/ask";
  const recent = sessions.slice(0, 5);
  const older = sessions.slice(5);

  if (!onAsk && sessions.length === 0) return null;

  return (
    <div className="ml-5 mt-0.5 border-l pl-2" style={{ borderColor: "var(--d-border)" }}>
      {/* New chat link */}
      <Link
        href="/mission-control/ask"
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors"
        style={
          onAsk && !currentId
            ? { color: "var(--d-accent)", background: "var(--d-accent-soft)" }
            : { color: "var(--d-muted)" }
        }
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <line x1="6" y1="1" x2="6" y2="11" />
          <line x1="1" y1="6" x2="11" y2="6" />
        </svg>
        New chat
      </Link>

      {/* Recent 5 sessions */}
      {recent.map((s) => {
        const active = currentId === s.id;
        const hovered = hoveredId === s.id;
        return (
          <div
            key={s.id}
            className="group relative flex items-center rounded-md"
            onMouseEnter={() => setHoveredId(s.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={active ? { background: "var(--d-accent-soft)" } : hovered ? { background: "var(--d-surface-2)" } : {}}
          >
            <Link
              href={`/mission-control/ask?id=${s.id}`}
              className="flex min-w-0 flex-1 flex-col px-2 py-1.5"
            >
              <span
                className="truncate text-[12px] font-medium leading-tight"
                style={{ color: active ? "var(--d-accent)" : "var(--d-muted)" }}
              >
                {s.title}
              </span>
              <span className="mt-0.5 text-[10px]" style={{ color: "var(--d-faint)" }}>
                {relativeDate(s.updatedAt)}
              </span>
            </Link>
            {/* Delete button — visible on hover */}
            {hovered && (
              <button
                onClick={(e) => { e.preventDefault(); remove(s.id); }}
                className="mr-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded"
                style={{ color: "var(--d-faint)", background: "transparent" }}
                aria-label="Delete chat"
                title="Delete"
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <line x1="2" y1="2" x2="10" y2="10" />
                  <line x1="10" y1="2" x2="2" y2="10" />
                </svg>
              </button>
            )}
          </div>
        );
      })}

      {/* Older sessions — scrollable overflow */}
      {older.length > 0 && (
        <div className="max-h-[140px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          <div
            className="mb-1 mt-1 px-2 text-[10px] uppercase tracking-widest"
            style={{ color: "var(--d-faint)" }}
          >
            Older
          </div>
          {older.map((s) => {
            const active = currentId === s.id;
            const hovered = hoveredId === s.id;
            return (
              <div
                key={s.id}
                className="group relative flex items-center rounded-md"
                onMouseEnter={() => setHoveredId(s.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={active ? { background: "var(--d-accent-soft)" } : hovered ? { background: "var(--d-surface-2)" } : {}}
              >
                <Link
                  href={`/mission-control/ask?id=${s.id}`}
                  className="flex min-w-0 flex-1 flex-col px-2 py-1.5"
                >
                  <span
                    className="truncate text-[12px] font-medium leading-tight"
                    style={{ color: active ? "var(--d-accent)" : "var(--d-muted)" }}
                  >
                    {s.title}
                  </span>
                  <span className="mt-0.5 text-[10px]" style={{ color: "var(--d-faint)" }}>
                    {relativeDate(s.updatedAt)}
                  </span>
                </Link>
                {hovered && (
                  <button
                    onClick={(e) => { e.preventDefault(); remove(s.id); }}
                    className="mr-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded"
                    style={{ color: "var(--d-faint)" }}
                    aria-label="Delete chat"
                    title="Delete"
                  >
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                      <line x1="2" y1="2" x2="10" y2="10" />
                      <line x1="10" y1="2" x2="2" y2="10" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
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
        href="/mission-control/ask"
        className="flex items-center gap-2.5 px-5 py-[18px]"
        style={{ borderBottom: "1px solid var(--d-border)" }}
      >
        <span
          className="text-[22px]"
          style={{ color: "var(--d-ink)", fontFamily: '"Tiny5Duo", monospace', fontWeight: 700 }}
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
                    {/* Inject chat history sub-list under Ask REX */}
                    {item.navKey === "ask" && (
                      <ChatSessionsList pathname={pathname} />
                    )}
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

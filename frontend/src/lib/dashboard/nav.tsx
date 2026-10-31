import type { ReactNode } from "react";
import { CLASS_COLOR } from "./status";
import type { DashStrings } from "./i18n";

/** A stroked 18px icon. `d` may be one or more path segments. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const icons = {
  ask: (
    <Icon>
      <path d="M12 2a9 9 0 0 1 9 9c0 3.9-2.5 7.3-6 8.5V22l-4-4H6a9 9 0 0 1-6-8.5A9 9 0 0 1 12 2Z" />
      <path d="M9.5 9.5c.3-.8 1-1.5 2.5-1.5s2.5.9 2.5 2c0 1.5-2.5 2-2.5 3.5" />
      <circle cx="12" cy="17" r=".5" fill="currentColor" />
    </Icon>
  ),
  overview: (
    <Icon>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Icon>
  ),
  transactions: (
    <Icon>
      <path d="M4 7h16M4 12h16M4 17h10" />
    </Icon>
  ),
  escalations: (
    <Icon>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 10v4M12 17.5v.5" />
    </Icon>
  ),
  audit: (
    <Icon>
      <path d="M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </Icon>
  ),
  compliance: (
    <Icon>
      <path d="M12 3 5 6v5c0 4.4 3 8.4 7 9.7 4-1.3 7-5.3 7-9.7V6l-7-3Z" />
      <path d="m9.5 11.5 2 2 3.5-4" />
    </Icon>
  ),
  policy: (
    <Icon>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="9" cy="6" r="2" fill="var(--d-surface)" />
      <circle cx="15" cy="12" r="2" fill="var(--d-surface)" />
      <circle cx="8" cy="18" r="2" fill="var(--d-surface)" />
    </Icon>
  ),
  winback: (
    <Icon>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      <path d="M9 12l2 2 4-4" strokeWidth="1.8" />
    </Icon>
  ),
  analytics: (
    <Icon>
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </Icon>
  ),
  whatsapp: (
    <Icon>
      <path d="M12 2a9 9 0 0 0-9 9c0 1.9.56 3.65 1.52 5.13L3 21l4.98-1.47A9 9 0 1 0 12 2Z" />
      <path d="M8.5 9.5c.3 2.9 2.1 4.7 5 5l1-1.4c.3-.4.85-.5 1.3-.25l1.6.9c.3.17.45.5.35.84-.4 1.3-1.95 2.1-3.3 1.9-3.2-.45-5.7-2.95-6.15-6.15-.2-1.35.6-2.9 1.9-3.3.34-.1.67.05.84.35l.9 1.6c.25.45.15 1-.25 1.3L8.5 9.5Z" strokeWidth="1.3" />
    </Icon>
  ),
  customers: (
    <Icon>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <circle cx="17" cy="7.5" r="2.4" />
      <path d="M15.2 14.8c2.6.2 4.3 2.1 4.3 5.2" />
    </Icon>
  ),
  callCustomer: (
    <Icon>
      <path d="M4.5 4h3.2l1.3 4.2-2 1.6a12 12 0 0 0 5.2 5.2l1.6-2 4.2 1.3v3.2c0 1-.9 1.7-1.9 1.5a17 17 0 0 1-13-13C2.8 4.9 3.5 4 4.5 4Z" />
    </Icon>
  ),
  dsrSheet: (
    <Icon>
      <path d="M5 3h14v18H5z" />
      <path d="M5 8h14M9 8v13M13 8v13M5 13h14M5 18h14" />
    </Icon>
  ),
  dsrReconciliation: (
    <Icon>
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h11a4 4 0 0 1 4 4v1" />
      <path d="M16 21l4-4-4-4" />
      <path d="M20 17H9a4 4 0 0 1-4-4v-1" />
    </Icon>
  ),
};

type NavKey = keyof DashStrings["nav"];

export interface NavItem {
  navKey: NavKey;
  href: string;
  icon: ReactNode;
  ready: boolean;
  classId?: number; // present for the four class tabs
}

export interface NavGroup {
  groupKey?: keyof DashStrings["groups"];
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    items: [
      { navKey: "ask", href: "/mission-control/ask", icon: icons.ask, ready: true },
      { navKey: "overview", href: "/mission-control", icon: icons.overview, ready: true },
      {
        navKey: "transactions",
        href: "/mission-control/transactions",
        icon: icons.transactions,
        ready: true,
      },
      {
        navKey: "winback",
        href: "/mission-control/winback",
        icon: icons.winback,
        ready: true,
      },
      {
        navKey: "whatsapp",
        href: "/mission-control/whatsapp",
        icon: icons.whatsapp,
        ready: true,
      },
      {
        navKey: "callCustomer",
        href: "/mission-control/call-customer",
        icon: icons.callCustomer,
        ready: true,
      },
      {
        navKey: "customers",
        href: "/mission-control/customers",
        icon: icons.customers,
        ready: true,
      },
      // The conversation panels + audit timeline are the "watch it happen"
      // surfaces now; the old live-run route has been removed entirely.
    ],
  },
  {
    groupKey: "classes",
    items: [1, 2, 3, 4].map((n) => ({
      navKey: "overview" as NavKey, // unused for class items; label comes from classId
      href: `/mission-control/class/${n}`,
      icon: (
        <span
          className="inline-block h-2.5 w-2.5 rounded-[3px]"
          style={{ background: CLASS_COLOR[n] }}
        />
      ),
      ready: true,
      classId: n,
    })),
  },
  {
    groupKey: "dsr",
    items: [
      {
        navKey: "dsrSheet",
        href: "/mission-control/dsr",
        icon: icons.dsrSheet,
        ready: true,
      },
      {
        navKey: "dsrReconciliation",
        href: "/mission-control/dsr/reconciliation",
        icon: icons.dsrReconciliation,
        ready: true,
      },
    ],
  },
  {
    groupKey: "compliance",
    items: [
      {
        navKey: "escalations",
        href: "/mission-control/escalations",
        icon: icons.escalations,
        ready: true,
      },
      { navKey: "audit", href: "/mission-control/audit", icon: icons.audit, ready: true },
      {
        navKey: "compliance",
        href: "/mission-control/compliance",
        icon: icons.compliance,
        ready: true,
      },
      {
        navKey: "policy",
        href: "/mission-control/policy",
        icon: icons.policy,
        ready: true,
      },
    ],
  },
];

/** Localized label for a nav item. Class tabs read as plain problem names
 * (e.g. "Overdue Invoices") — the internal "Class N" number is not shown here. */
export function navLabel(item: NavItem, d: DashStrings): string {
  if (item.classId) return d.classShort[item.classId];
  return d.nav[item.navKey];
}

/** The active nav item for a pathname (longest matching href wins). */
export function activeNav(pathname: string): NavItem | undefined {
  return NAV.flatMap((g) => g.items)
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

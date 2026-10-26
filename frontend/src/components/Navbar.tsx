"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useIntroPhase } from "@/lib/intro";
import LocaleToggle from "./LocaleToggle";

export default function Navbar() {
  const { t } = useLocale();
  const pathname = usePathname();
  const phase = useIntroPhase();

  // Mission Control carries its own chrome (sidebar + topbar) — the marketing
  // header would clash, so it never renders there.
  if (pathname?.startsWith("/mission-control")) return null;

  const isLanding = pathname === "/";
  const isStory = pathname === "/story";

  // The landing's header only appears once the intro is entered. Every other
  // route (e.g. /story) always shows it — the intro gate doesn't apply there.
  if (isLanding && phase !== "entered") return null;

  // On /story the CTA leads INTO the product; on the landing it leads to the story.
  const ctaHref = isStory ? "/mission-control" : "/story";

  return (
    <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between bg-transparent px-6 py-4 md:px-10">
      {/* Left: wordmark */}
      <Link href="/" className="group flex items-center gap-2.5" aria-label="Home">
        <span className="font-mono text-sm uppercase tracking-[0.28em] text-fg/90 transition-colors group-hover:text-fg">
          REX
        </span>
      </Link>

      {/* Right: locale + CTA */}
      <div className="flex items-center gap-5">
        <LocaleToggle />
        <Link
          href={ctaHref}
          className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-colors ${
            isStory ? "text-white hover:brightness-95" : "bg-white/10 text-fg hover:bg-white/[0.16]"
          }`}
          style={isStory ? { background: "var(--color-clay)" } : undefined}
        >
          {isStory ? t.nav.enterConsole : t.nav.getStarted}
        </Link>
      </div>
    </nav>
  );
}

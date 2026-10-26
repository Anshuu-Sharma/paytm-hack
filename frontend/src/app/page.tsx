"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { FAILURE_CLASSES } from "@/lib/failure-classes";
import WorldScene from "@/components/three/WorldScene";
import IntroOverlay from "@/components/IntroOverlay";
import ScrollRail from "@/components/landing/ScrollRail";
import Reveal from "@/components/landing/Reveal";
import { useIntroPhase } from "@/lib/intro";

function Section({
  children,
  className = "",
  top = false,
}: {
  children: React.ReactNode;
  className?: string;
  top?: boolean;
}) {
  return (
    <section
      className={`relative flex min-h-screen flex-col items-center px-6 text-center ${
        top ? "justify-start pt-28 md:pt-32" : "justify-center"
      } ${className}`}
    >
      {children}
    </section>
  );
}

export default function Landing() {
  const { t, locale } = useLocale();
  const L = t.landing;
  const entered = useIntroPhase() === "entered";

  return (
    <>
      <WorldScene />
      <IntroOverlay />
      {entered && <ScrollRail />}

      <main
        className={`relative z-10 transition-opacity duration-700 ${
          entered ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {/* Beat 1 — Enter (the click-to-enter gate is handled by IntroOverlay) */}
        <Section>
          <Reveal delay={0.1}>
            <h1 className="display mx-auto max-w-4xl text-[clamp(2.75rem,6vw,5.5rem)]">
              {L.enterTitle}
            </h1>
          </Reveal>

          {/* scroll hint */}
          <motion.div
            className="absolute bottom-10 left-1/2 -translate-x-1/2"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0.3], y: [0, 6, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="kicker text-[0.7rem]">{L.scrollHint} ↓</span>
          </motion.div>
        </Section>

        {/* Beat 2 — The surface & its scale */}
        <Section>
          <Reveal>
            <h2 className="display mx-auto max-w-3xl text-[clamp(1.75rem,3.4vw,3rem)]">
              {L.surfaceTitle}
            </h2>
          </Reveal>
        </Section>

        {/* Beat 3 — The leak */}
        <Section>
          <Reveal>
            <h2 className="display mx-auto max-w-3xl text-[clamp(1.75rem,3.4vw,3rem)]">
              {L.leakTitleA}
            </h2>
          </Reveal>
          <Reveal delay={0.25}>
            <p className="mx-auto mt-8 max-w-xl font-sans text-lg text-muted">
              {L.leakTitleB}
            </p>
          </Reveal>
        </Section>

        {/* Beat 4 — Four kinds of falling */}
        <Section>
          <Reveal>
            <h2 className="display mx-auto max-w-3xl text-[clamp(1.75rem,3.4vw,3rem)]">
              {L.fourTitle}
            </h2>
          </Reveal>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {FAILURE_CLASSES.map((fc, i) => (
              <Reveal key={fc.id} delay={0.1 + i * 0.08}>
                <span className="wire-label flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: `var(--color-${fc.accent})` }}
                  />
                  {fc.copy[locale].title}
                </span>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* Beat 5 — The engine awakens */}
        <Section>
          <Reveal className="mb-5">
            <span className="kicker">{L.engineKicker}</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="display mx-auto max-w-4xl text-[clamp(2rem,4vw,3.75rem)] italic">
              {L.engineTitle}
            </h2>
          </Reveal>
        </Section>

        {/* Beat 6 — The reveal / ascent */}
        <Section>
          <Reveal className="mb-5">
            <span className="kicker text-blue">{L.revealKicker}</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="display mx-auto max-w-4xl text-[clamp(2.5rem,5.5vw,5rem)]">
              {L.revealTitle}
            </h2>
          </Reveal>
        </Section>

        {/* Beat 7 — Proof */}
        <Section>
          <Reveal className="mb-12">
            <p className="display text-[clamp(1.25rem,2vw,1.75rem)] text-muted">
              {L.proofOverline}
            </p>
          </Reveal>
          <div className="grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
            <StatPanel
              rate={L.proofStatARate}
              value={L.proofStatAValue}
              caption={L.proofStatACaption}
            />
            <StatPanel
              rate={L.proofStatBRate}
              value={L.proofStatBValue}
              caption={L.proofStatBCaption}
            />
          </div>
        </Section>

        {/* Beat 8 — Rest & CTA (headline pinned to top, disc fills below) */}
        <Section top>
          <Reveal className="mb-5">
            <span className="kicker">{L.ctaKicker}</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="display mx-auto max-w-3xl text-[clamp(2.5rem,5.5vw,4.5rem)]">
              {L.ctaTitle}
            </h2>
          </Reveal>
          <Reveal delay={0.25}>
            <Link
              href="/story"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white/10 px-6 py-3 text-base font-medium text-fg transition-colors hover:bg-white/[0.16]"
            >
              {L.cta}
              <span aria-hidden>→</span>
            </Link>
          </Reveal>
        </Section>
      </main>
    </>
  );
}

function StatPanel({
  rate,
  value,
  caption,
}: {
  rate: string;
  value: string;
  caption: string;
}) {
  return (
    <Reveal>
      <div
        className="rounded-2xl border p-8 text-left backdrop-blur-md"
        style={{
          background: "var(--glass-fill)",
          borderColor: "var(--glass-border)",
        }}
      >
        <span className="wire-label">{rate}</span>
        <div className="mt-3 font-mono text-5xl text-fg">{value}</div>
        <p className="mt-2 font-sans text-sm text-muted">{caption}</p>
      </div>
    </Reveal>
  );
}

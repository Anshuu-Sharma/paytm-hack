"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { FAILURE_CLASSES } from "@/lib/failure-classes";
import ClassMicroViz from "@/components/demo/ClassMicroViz";

export default function DemoHub() {
  const { t, locale } = useLocale();

  return (
    <main className="relative min-h-screen px-6 pb-20 pt-32 md:px-10">
      {/* Ambient calm world behind the scrim */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-void">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 25% 20%, rgba(255,255,255,0.4), transparent), radial-gradient(1px 1px at 70% 60%, rgba(0,229,255,0.35), transparent), radial-gradient(1px 1px at 45% 85%, rgba(255,255,255,0.3), transparent)",
            backgroundSize: "260px 260px",
          }}
        />
        <div
          className="absolute left-1/2 top-1/3 h-[60vh] w-[60vh] -translate-x-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(2,94,232,0.1) 0%, transparent 65%)",
          }}
        />
      </div>

      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-14 text-center">
          <motion.span
            className="kicker"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {t.demo.kicker}
          </motion.span>
          <motion.h1
            className="display mt-4 text-[clamp(2rem,4vw,3.25rem)]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          >
            {t.demo.title}
          </motion.h1>
          <motion.p
            className="mx-auto mt-4 max-w-xl font-sans text-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {t.demo.subtitle}
          </motion.p>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {FAILURE_CLASSES.map((fc, i) => {
            const c = fc.copy[locale];
            return (
              <motion.div
                key={fc.id}
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.7,
                  delay: 0.25 + i * 0.09,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <Link
                  href={`/mission-control/class/${fc.id}`}
                  className="block h-full"
                >
                  <article
                    className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border p-7 backdrop-blur-md transition-all duration-300 hover:-translate-y-1"
                    style={{
                      background: "var(--glass-fill)",
                      borderColor: "var(--glass-border)",
                    }}
                  >
                    {/* hover border + glow */}
                    <div
                      className="pointer-events-none absolute -inset-px rounded-2xl border opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      style={{
                        borderColor: "var(--glass-border-hover)",
                        boxShadow: "0 0 30px rgba(2,94,232,0.18)",
                      }}
                    />

                    <div className="relative flex items-start justify-between gap-4">
                      <div>
                        <span
                          className="wire-label"
                          style={{ color: `var(--color-${fc.accent})` }}
                        >
                          {c.tag}
                        </span>
                        <h2 className="display mt-2 text-2xl transition-colors group-hover:text-blue-bright">
                          {c.title}
                        </h2>
                      </div>
                      <ClassMicroViz type={fc.microViz} />
                    </div>

                    <div className="relative mt-8 space-y-5">
                      <div>
                        <p className="wire-label mb-1.5">{t.demo.problemLabel}</p>
                        <p className="font-sans text-sm text-muted">{c.problem}</p>
                      </div>
                      <div>
                        <p className="wire-label mb-1.5 flex items-center gap-2 text-blue">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue" />
                          {t.demo.rescueLabel}
                        </p>
                        <p className="font-sans text-sm text-fg/90">{c.rescue}</p>
                      </div>
                    </div>

                    {/* run affordance */}
                    <div className="relative mt-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-faint transition-colors group-hover:text-blue">
                      {t.demo.run} <span aria-hidden>→</span>
                    </div>
                  </article>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

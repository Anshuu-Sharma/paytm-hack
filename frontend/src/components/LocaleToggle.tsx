"use client";

import { motion } from "framer-motion";
import { LOCALES } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/** Sliding-highlight [ EN | HI ] pill. */
export default function LocaleToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div
      role="group"
      aria-label="Language"
      className="relative flex items-center rounded-full border p-0.5 font-mono text-[11px] uppercase tracking-[0.2em]"
      style={{
        borderColor: "color-mix(in srgb, currentColor 18%, transparent)",
        background: "color-mix(in srgb, currentColor 4%, transparent)",
      }}
    >
      {LOCALES.map((l) => {
        const active = locale === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            aria-pressed={active}
            className={`relative z-10 rounded-full px-2.5 py-1 transition-colors duration-300 ${
              active ? "text-fg" : "text-muted hover:text-fg/80"
            }`}
          >
            {active && (
              <motion.span
                layoutId="locale-pill"
                className="absolute inset-0 -z-10 rounded-full bg-[rgba(128,128,128,0.42)]"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            {l}
          </button>
        );
      })}
    </div>
  );
}

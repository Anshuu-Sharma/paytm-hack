"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { enterRex, useIntroPhase } from "@/lib/intro";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * Full-screen click-to-enter gate shown over the particle "REX" wordmark.
 * Locks page scroll until the intro transition completes, then removes itself.
 */
export default function IntroOverlay() {
  const phase = useIntroPhase();
  const { t } = useLocale();

  // Lock scroll (and pin to top) until the user has entered.
  useEffect(() => {
    if (phase !== "entered") {
      document.body.style.overflow = "hidden";
      window.scrollTo(0, 0);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [phase]);

  return (
    <AnimatePresence>
      {phase !== "entered" && (
        <motion.button
          type="button"
          onClick={enterRex}
          aria-label={t.landing.enterKicker}
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === "entering" ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-end gap-5 pb-24"
        >
          <span className="kicker">{t.landing.ctaKicker}</span>
          <span className="btn-ghost animate-pulse text-sm">
            <span aria-hidden>▶</span> {t.landing.enterKicker}
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

"use client";

import { motion } from "framer-motion";
import { getFailureClass } from "@/lib/failure-classes";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// Muted, warm-friendly accent per class for the light theme.
const ACCENT: Record<number, string> = {
  1: "#2b8fb3",
  2: "#3f6fd6",
  3: "#c98a2b",
  4: "#8a5bc0",
};

/**
 * The solution card that slides in when Nayantara finishes a class's problem.
 * Reuses the shared failure-class copy and links into the live REX console.
 */
export default function StoryClassCard({ classId }: { classId: 1 | 2 | 3 | 4 }) {
  const { locale } = useLocale();
  const fc = getFailureClass(classId);
  const copy = fc.copy[locale];
  const accent = ACCENT[classId];
  // On the story page these read as "Problem N", not "Class N".
  const tag = copy.tag.replace(/^Class/i, "Problem").replace(/^श्रेणी/, "समस्या");

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-15% 0px -15% 0px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mt-8 max-w-md rounded-2xl border border-black/10 bg-white/70 p-6 shadow-[0_20px_50px_-24px_rgba(60,50,40,0.4)] backdrop-blur"
    >
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
        <span className="font-mono text-[11px] uppercase tracking-[0.22em]" style={{ color: accent }}>
          {tag}
        </span>
      </div>

      <h3 className="story-display mt-3 text-2xl">{copy.title}</h3>

      <p className="mt-3 text-sm leading-relaxed text-muted">{copy.problem}</p>
      <div className="mt-4 rounded-xl p-4" style={{ background: "rgba(233,217,207,0.4)" }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--color-clay)" }}>
          REX Recovery
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-fg">{copy.rescue}</p>
      </div>
    </motion.div>
  );
}

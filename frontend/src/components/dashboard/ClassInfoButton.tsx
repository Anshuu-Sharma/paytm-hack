"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useDash } from "@/lib/dashboard/i18n";

/**
 * A "?" info button (top-right of a category page) whose popover explains, in
 * plain language, the problem this category represents and how REX recovers it.
 */
export default function ClassInfoButton({ classId, color }: { classId: number; color: string }) {
  const { d } = useDash();
  const cp = d.classpg;
  const solve = d.solve[classId];
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={cp.infoAria}
        className="grid h-8 w-8 place-items-center rounded-full border text-[14px] font-semibold transition-colors"
        style={{
          borderColor: open ? color : "var(--d-border)",
          color: open ? "#fff" : "var(--d-muted)",
          background: open ? color : "var(--d-surface)",
        }}
      >
        ?
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="absolute right-0 z-50 mt-2 w-[340px] rounded-xl p-4"
              style={{
                background: "var(--d-surface)",
                border: "1px solid var(--d-border)",
                boxShadow: "0 12px 32px rgba(28,25,23,0.16)",
                borderTop: `3px solid ${color}`,
              }}
            >
              <h4 className="text-[14px] font-semibold tracking-tight">{d.classLabel[classId]}</h4>

              <div className="mt-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--d-bad)" }}>
                  {cp.infoProblem}
                </p>
                <p className="mt-1 text-[12.5px] leading-snug" style={{ color: "var(--d-ink)" }}>
                  {solve.problem}
                </p>
              </div>

              <div className="mt-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color }}>
                  {cp.infoSolution}
                </p>
                <p className="mt-1 text-[12.5px] leading-snug" style={{ color: "var(--d-muted)" }}>
                  {solve.mechanism}
                </p>
                <span
                  className="mt-2 inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium"
                  style={{ background: "var(--d-surface-2)", color: "var(--d-ink)" }}
                >
                  {cp.playbook}: {solve.playbook}
                </span>
              </div>

              <div className="mt-3 rounded-lg px-2.5 py-1.5 text-[11.5px]" style={{ background: "var(--d-surface-2)" }}>
                <span className="font-semibold">{cp.stop} </span>
                <span style={{ color: "var(--d-muted)" }}>{solve.stop}</span>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

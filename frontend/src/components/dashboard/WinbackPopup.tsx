"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useDash } from "@/lib/dashboard/i18n";
import { inr } from "@/lib/dashboard/format";

export interface WinbackCustomer {
  id: string;
  name: string;
  phone: string;
  dormantDays: number;
  totalSpend: number;
  message: string;
}

interface Step {
  id: string;
  icon: string;
  text: string;
  color: string;
  soft: string;
}

interface Props {
  open: boolean;
  customer: WinbackCustomer | null;
  onClose: () => void;
}

export default function WinbackPopup({ open, customer, onClose }: Props) {
  const { d } = useDash();
  const wb = d.winback;
  const [stepIdx, setStepIdx] = useState(-1);
  const [done, setDone] = useState(false);

  // Advance through steps automatically
  useEffect(() => {
    if (!open || !customer) { setStepIdx(-1); setDone(false); return; }
    setStepIdx(0);
    setDone(false);
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStepIdx(1), 1200));
    timers.push(setTimeout(() => setStepIdx(2), 2600));
    timers.push(setTimeout(() => setStepIdx(3), 4000));
    timers.push(setTimeout(() => { setStepIdx(4); setDone(true); }, 5200));
    return () => timers.forEach(clearTimeout);
  }, [open, customer]);

  if (!customer) return null;

  const STEPS: Step[] = [
    { id: "profile",   icon: "👤", text: `Loading profile — ${customer.name}`, color: "var(--d-info)",   soft: "var(--d-info-soft)" },
    { id: "generate",  icon: "✨", text: wb.popupGenerating,                    color: "var(--d-accent)", soft: "var(--d-accent-soft)" },
    { id: "preview",   icon: "💬", text: "Message ready — preview below",        color: "var(--d-ok)",    soft: "var(--d-ok-soft)" },
    { id: "send",      icon: "📤", text: wb.popupSending,                        color: "var(--d-warn)",  soft: "var(--d-warn-soft)" },
    { id: "complete",  icon: "✓",  text: wb.popupDone,                           color: "var(--d-ok)",    soft: "var(--d-ok-soft)" },
  ];

  const visibleSteps = STEPS.slice(0, stepIdx + 1);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[400] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(12,12,15,0.72)", backdropFilter: "blur(6px)" }}
            onClick={done ? onClose : undefined}
          />

          {/* Card */}
          <motion.div
            className="relative flex w-full max-w-[480px] flex-col overflow-hidden rounded-[22px]"
            style={{
              background: "var(--d-surface)",
              border: "1px solid var(--d-border-strong)",
              boxShadow: "0 32px 80px rgba(0,0,0,0.55)",
              maxHeight: "min(84vh, 580px)",
            }}
            initial={{ scale: 0.93, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.93, y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--d-border)" }}
            >
              <div className="flex items-center gap-3">
                {!done ? (
                  <motion.span
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[16px]"
                    style={{ background: "var(--d-accent-soft)" }}
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                  >
                    💌
                  </motion.span>
                ) : (
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[14px] font-bold text-white"
                    style={{ background: "var(--d-ok)" }}
                  >
                    ✓
                  </span>
                )}
                <div>
                  <div className="text-[13.5px] font-semibold" style={{ color: "var(--d-ink)" }}>
                    {wb.popupTitle}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--d-muted)" }}>
                    {customer.name} · {customer.dormantDays}{wb.daysUnit} silent
                  </div>
                </div>
              </div>
              {done && (
                <button
                  onClick={onClose}
                  className="grid h-7 w-7 place-items-center rounded-md text-[14px] transition-colors hover:bg-[var(--d-surface-2)]"
                  style={{ color: "var(--d-muted)" }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Steps feed */}
            <div className="flex-1 space-y-2 overflow-y-auto p-4" style={{ scrollbarWidth: "none" }}>
              <AnimatePresence initial={false}>
                {visibleSteps.map((step) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", damping: 22, stiffness: 300 }}
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                    style={{ background: step.soft }}
                  >
                    <span className="mt-px shrink-0 text-[15px] leading-none" role="img" aria-hidden>
                      {step.icon}
                    </span>
                    <p className="text-[12.5px] font-semibold leading-snug" style={{ color: step.color }}>
                      {step.text}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Message preview card — shown once "preview" step is reached */}
              {stepIdx >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", damping: 22, stiffness: 280 }}
                  className="rounded-2xl p-3"
                  style={{
                    background: "var(--d-surface-2)",
                    border: "1px solid var(--d-border)",
                  }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-[13px]">📱</span>
                    <span className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--d-accent)" }}>
                      WhatsApp Preview
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: "var(--d-ink)", whiteSpace: "pre-wrap" }}>
                    {customer.message}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[10px]" style={{ color: "var(--d-muted)" }}>
                      To: {customer.phone}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--d-faint)" }}>·</span>
                    <span className="text-[10px]" style={{ color: "var(--d-muted)" }}>
                      {inr(customer.totalSpend, { compact: true })} lifetime spend
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Empty connecting state */}
              {stepIdx < 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <motion.div
                    className="mb-3 flex h-10 w-10 items-center justify-center rounded-full text-[18px]"
                    style={{ background: "var(--d-accent-soft)" }}
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  >
                    ✨
                  </motion.div>
                  <p className="text-[12px]" style={{ color: "var(--d-muted)" }}>
                    Preparing win-back…
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="flex shrink-0 items-center justify-between px-5 py-3"
              style={{ borderTop: "1px solid var(--d-border)", background: "var(--d-surface-2)" }}
            >
              {!done ? (
                <div className="flex items-center gap-2">
                  <motion.span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--d-accent)" }}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  <span className="text-[11px] font-medium" style={{ color: "var(--d-accent)" }}>
                    REX is generating your offer…
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold"
                    style={{ background: "var(--d-ok-soft)", color: "var(--d-ok)" }}
                  >
                    Sent
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--d-muted)" }}>
                    Click backdrop to dismiss
                  </span>
                </div>
              )}
              <span className="font-mono text-[10px]" style={{ color: "var(--d-faint)" }}>
                {visibleSteps.length} {wb.popupEvents}
              </span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

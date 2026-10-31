"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useDash, tVocab } from "@/lib/dashboard/i18n";
import { humanize, inr } from "@/lib/dashboard/format";
import type { FeedItem, RunPhase } from "@/hooks/useRecoveryRun";

/* ── Pipeline stages ──────────────────────────────────────────────────────── */
const PIPELINE = [
  { key: "ingest",    label: "Ingest" },
  { key: "diagnose",  label: "Diagnose" },
  { key: "execute",   label: "Execute" },
  { key: "reconcile", label: "Reconcile" },
];

function phaseStage(phase: RunPhase): number {
  if (phase === "flagged")                                      return 0;
  if (phase === "diagnosing")                                   return 1;
  if (phase === "messaging" || phase === "reading" || phase === "calling") return 2;
  if (phase === "waiting" || phase === "done" ||
      phase === "stopped"  || phase === "escalated")            return 3;
  return 0;
}

/* ── Per-kind styling ─────────────────────────────────────────────────────── */
const KIND: Record<FeedItem["kind"], {
  icon: string; color: string; soft: string; textColor?: string;
}> = {
  flagged:   { icon: "⚑",  color: "var(--d-accent)",   soft: "var(--d-accent-soft)" },
  diagnosis: { icon: "🔍", color: "var(--d-info)",      soft: "var(--d-info-soft)" },
  sent:      { icon: "💬", color: "var(--d-ok)",        soft: "var(--d-ok-soft)" },
  reply:     { icon: "📥", color: "var(--d-slate)",     soft: "var(--d-slate-soft)" },
  system:    { icon: "·",  color: "var(--d-faint)",     soft: "var(--d-surface-2)" },
  waiting:   { icon: "⏳", color: "var(--d-warn)",      soft: "var(--d-warn-soft)" },
  stopped:   { icon: "🛑", color: "var(--d-bad)",       soft: "var(--d-bad-soft)" },
  escalated: { icon: "⚠️", color: "var(--d-warn)",      soft: "var(--d-warn-soft)" },
  called:    { icon: "📞", color: "var(--d-accent)",    soft: "var(--d-accent-soft)" },
  complete:  { icon: "✓",  color: "var(--d-ok)",        soft: "var(--d-ok-soft)", textColor: "var(--d-ok)" },
};

/* ── Feed item label builder ──────────────────────────────────────────────── */
function itemLabel(item: FeedItem, d: ReturnType<typeof useDash>["d"]): { title: string; detail?: string } {
  switch (item.kind) {
    case "flagged":
      return {
        title: item.text ?? "Transaction flagged",
        detail: item.amount ? `${inr(item.amount)} at risk` : undefined,
      };
    case "diagnosis":
      return {
        title: `Root cause: ${item.text ? tVocab("rootCause", item.text, d) : item.text}`,
        detail: item.extra ? `Playbook: ${tVocab("playbook", item.extra, d)}` : undefined,
      };
    case "sent":
      return { title: "REX sent WhatsApp", detail: item.text };
    case "reply":
      return { title: "Customer replied", detail: item.text };
    case "system":
      return { title: item.text ?? "System message" };
    case "waiting":
      return { title: "Waiting on P2P", detail: item.extra ? `Expected by ${item.extra}` : undefined };
    case "stopped":
      return { title: "Opt-out honoured — contact stopped", detail: item.extra ? humanize(item.extra) : undefined };
    case "escalated":
      return { title: "Dispute detected — escalated to human", detail: item.extra ? humanize(item.extra) : undefined };
    case "called":
      return { title: "AI voice call placed" };
    case "complete":
      return { title: item.extra === "RECOVERED" ? "Payment recovered ✓" : `Closed: ${item.extra ?? "done"}` };
    default:
      return { title: "…" };
  }
}

/* ── Pulsing "thinking" dots ──────────────────────────────────────────────── */
function ThinkingDots() {
  return (
    <div className="flex items-center gap-[3px] py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--d-accent)" }}
          animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.15, 0.8] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </div>
  );
}

/* ── Main popup ───────────────────────────────────────────────────────────── */
interface Props {
  open: boolean;
  running: boolean;
  phase: RunPhase;
  feed: FeedItem[];
  name: string;
  finalStatus: string | null;
  onClose: () => void;
}

export default function RecoveryLivePopup({
  open, running, phase, feed, name, finalStatus, onClose,
}: Props) {
  const { d } = useDash();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeStage = phaseStage(phase);

  // Auto-scroll feed to latest item
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [feed.length, phase]);

  const showTyping = running && (phase === "messaging" || phase === "reading" || phase === "diagnosing");
  const isDone = !running && phase === "done";

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
            onClick={isDone ? onClose : undefined}
          />

          {/* Card */}
          <motion.div
            className="relative flex w-full max-w-[520px] flex-col overflow-hidden rounded-[22px]"
            style={{
              background: "var(--d-surface)",
              border: "1px solid var(--d-border-strong)",
              boxShadow: "0 32px 80px rgba(0,0,0,0.55), var(--d-shadow)",
              maxHeight: "min(84vh, 640px)",
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
                {running ? (
                  <motion.span
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[13px] font-bold text-white"
                    style={{ background: "var(--d-accent)" }}
                    animate={{ opacity: [1, 0.6, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                  >
                    R
                  </motion.span>
                ) : (
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[13px] font-bold text-white"
                    style={{ background: finalStatus === "RECOVERED" ? "var(--d-ok)" : "var(--d-bad)" }}
                  >
                    {finalStatus === "RECOVERED" ? "✓" : "!"}
                  </span>
                )}
                <div>
                  <div className="text-[13.5px] font-semibold" style={{ color: "var(--d-ink)" }}>
                    REX — Live Recovery
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--d-muted)" }}>
                    {name}
                  </div>
                </div>
              </div>
              {isDone && (
                <button
                  onClick={onClose}
                  className="grid h-7 w-7 place-items-center rounded-md text-[14px] transition-colors hover:bg-[var(--d-surface-2)]"
                  style={{ color: "var(--d-muted)" }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Pipeline strip */}
            <div
              className="flex shrink-0 items-center gap-0 px-5 py-3"
              style={{ borderBottom: "1px solid var(--d-border)", background: "var(--d-surface-2)" }}
            >
              {PIPELINE.map((stage, i) => {
                const done = i < activeStage || (!running && i <= activeStage);
                const active = i === activeStage && (running || i === activeStage);
                return (
                  <div key={stage.key} className="flex min-w-0 flex-1 items-center">
                    {/* Node */}
                    <div className="flex flex-col items-center">
                      <motion.div
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{
                          background: done || active ? "var(--d-accent)" : "var(--d-surface)",
                          border: `1.5px solid ${done || active ? "var(--d-accent)" : "var(--d-border-strong)"}`,
                          color: done || active ? "#fff" : "var(--d-faint)",
                        }}
                        animate={active && running ? { boxShadow: ["0 0 0 0 oklch(0.82 0.18 152 / 0.5)", "0 0 0 6px oklch(0.82 0.18 152 / 0)", "0 0 0 0 oklch(0.82 0.18 152 / 0)"] } : {}}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        {done && !active ? "✓" : i + 1}
                      </motion.div>
                      <span
                        className="mt-1 text-[9px] font-medium uppercase tracking-wider"
                        style={{ color: done || active ? "var(--d-accent)" : "var(--d-faint)" }}
                      >
                        {stage.label}
                      </span>
                    </div>
                    {/* Connector line */}
                    {i < PIPELINE.length - 1 && (
                      <div
                        className="mx-1 h-px flex-1"
                        style={{ background: i < activeStage ? "var(--d-accent)" : "var(--d-border-strong)" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Feed */}
            <div
              ref={scrollRef}
              className="flex-1 space-y-2 overflow-y-auto p-4"
              style={{ scrollbarWidth: "none" }}
            >
              <AnimatePresence initial={false}>
                {feed.map((item) => {
                  const style = KIND[item.kind];
                  const { title, detail } = itemLabel(item, d);
                  const isBig = item.kind === "complete";
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", damping: 22, stiffness: 300 }}
                      className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                      style={{ background: style.soft }}
                    >
                      <span
                        className="mt-px shrink-0 text-[15px] leading-none"
                        role="img"
                        aria-hidden
                      >
                        {style.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-[12.5px] font-semibold leading-snug ${isBig ? "text-[14px]" : ""}`}
                          style={{ color: style.textColor ?? style.color }}
                        >
                          {title}
                        </p>
                        {detail && (
                          <p
                            className="mt-0.5 text-[11.5px] leading-snug"
                            style={{ color: "var(--d-muted)", wordBreak: "break-word" }}
                          >
                            {detail}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Typing indicator */}
              {showTyping && (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: "var(--d-surface-2)" }}
                >
                  <span className="text-[13px]">
                    {phase === "reading" ? "📥" : "⚙️"}
                  </span>
                  <div>
                    <p className="text-[11.5px]" style={{ color: "var(--d-muted)" }}>
                      {phase === "reading" ? "Waiting for customer…" :
                       phase === "diagnosing" ? "REX diagnosing…" : "REX drafting message…"}
                    </p>
                    <ThinkingDots />
                  </div>
                </motion.div>
              )}

              {/* Empty state while connecting */}
              {feed.length === 0 && !showTyping && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <motion.div
                    className="mb-3 flex h-10 w-10 items-center justify-center rounded-full text-[18px]"
                    style={{ background: "var(--d-accent-soft)" }}
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  >
                    ⚙️
                  </motion.div>
                  <p className="text-[12px]" style={{ color: "var(--d-muted)" }}>
                    Connecting to REX…
                  </p>
                </div>
              )}
            </div>

            {/* Footer status bar */}
            <div
              className="flex shrink-0 items-center justify-between px-5 py-3"
              style={{ borderTop: "1px solid var(--d-border)", background: "var(--d-surface-2)" }}
            >
              {running ? (
                <div className="flex items-center gap-2">
                  <motion.span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--d-accent)" }}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  <span className="text-[11px] font-medium" style={{ color: "var(--d-accent)" }}>
                    REX is working this case…
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold"
                    style={{
                      background: finalStatus === "RECOVERED" ? "var(--d-ok-soft)" : "var(--d-bad-soft)",
                      color: finalStatus === "RECOVERED" ? "var(--d-ok)" : "var(--d-bad)",
                    }}
                  >
                    {finalStatus ?? "Done"}
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--d-muted)" }}>
                    Click backdrop to dismiss
                  </span>
                </div>
              )}
              <span className="font-mono text-[10px]" style={{ color: "var(--d-faint)" }}>
                {feed.length} events
              </span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { addNote, recoverBatch, setStatus } from "@/lib/dashboard/api";
import type { AssistantAction } from "@/lib/dashboard/api";
import { inr } from "@/lib/dashboard/format";
import { useDash, tVocab } from "@/lib/dashboard/i18n";
import { useDashboardRefresh } from "@/lib/dashboard/refresh";
import { useExplorerFilter } from "@/lib/dashboard/explorerFilter";
import type { LifecycleStatus } from "@/lib/dashboard/types";
import { useSpeech } from "@/hooks/useSpeech";
import type { FeedItem } from "@/hooks/useRecoveryRun";
import type { useRecoveryRun } from "@/hooks/useRecoveryRun";
import type { useAssistant } from "@/hooks/useAssistant";

const ICON: Record<FeedItem["kind"], string> = {
  flagged: "⚑", diagnosis: "🔍", sent: "💬", reply: "📥", system: "•",
  waiting: "⏳", stopped: "🛑", escalated: "⚠️", called: "📞", complete: "✓",
};

type Run = ReturnType<typeof useRecoveryRun>;
type Chat = ReturnType<typeof useAssistant>;

interface Props {
  run: Run;
  chat: Chat;
  focusedId: string | null;
  open: boolean;
  setOpen: (b: boolean) => void;
}

export default function RexAssistant({ run, chat, focusedId, open, setOpen }: Props) {
  const { d, locale } = useDash();
  const router = useRouter();
  const pathname = usePathname();
  const { refresh } = useDashboardRefresh();
  const { status: explorerStatus, setStatus: setExplorerStatus, query: explorerQuery } =
    useExplorerFilter();
  const [input, setInput] = useState("");
  const { listening, listen, stop, speak, sttSupported } = useSpeech(locale);
  const [voiceOn, setVoiceOn] = useState(true);
  const [pending, setPending] = useState<{ txnId: string; status: string } | null>(null);
  const [pendingRun, setPendingRun] = useState<{ txnId: string } | null>(null);
  const [batch, setBatch] = useState<{ ids: string[] } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the thread pinned to the newest line as it grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages.length, run.feed.length, run.phase, pending, pendingRun, batch, chat.busy]);

  const dispatch = async (action: AssistantAction) => {
    switch (action.type) {
      case "navigate":
        // Carry (or clear) the table's status filter, then open the view.
        setExplorerStatus(action.status ?? "");
        if (action.route) router.push(action.route);
        return;
      case "run_recovery":
        if (action.scope === "batch" && action.transaction_ids?.length) {
          setBatch({ ids: action.transaction_ids }); // ask all-or-one
        } else if (action.transaction_id) {
          setPendingRun({ txnId: action.transaction_id }); // confirm before starting
        }
        return;
      case "set_status":
        if (action.transaction_id && action.status)
          setPending({ txnId: action.transaction_id, status: action.status });
        return;
      case "add_note":
        if (action.transaction_id && action.note) {
          await addNote(action.transaction_id, action.note);
          refresh();
          chat.push("rex", d.assistant.didNote);
        }
        return;
    }
  };

  const classFromPath = (p: string): number | null => {
    const m = p.match(/\/mission-control\/class\/([1-4])/);
    return m ? Number(m[1]) : null;
  };

  const submit = async (spoken?: string) => {
    const text = (spoken ?? input).trim();
    if (!text || chat.busy) return;
    setInput("");
    const res = await chat.send(text, {
      focused_transaction_id: focusedId,
      route: pathname,
      class_filter: classFromPath(pathname),
      status_filter: explorerStatus || null,
      search: explorerQuery || null,
    });
    if (res?.reply && voiceOn) speak(res.reply); // REX speaks its answer
    if (res?.action) await dispatch(res.action);
  };

  const toggleMic = () => {
    if (!open) setOpen(true);
    if (listening) stop();
    else listen((t) => submit(t)); // speech → send as a message
  };

  const runBatchAll = async () => {
    if (!batch) return;
    const ids = batch.ids;
    setBatch(null);
    chat.push("rex", d.assistant.batchRunning);
    const res = await recoverBatch(ids, locale);
    refresh();
    chat.push("rex", d.assistant.didBatch(res.recovered, res.total));
  };

  const runBatchOne = () => {
    if (!batch) return;
    const first = batch.ids[0];
    setBatch(null);
    run.start(first, "");
  };

  const confirmRun = () => {
    if (!pendingRun) return;
    const { txnId } = pendingRun;
    setPendingRun(null);
    run.start(txnId, "");
  };

  const confirmStatus = async () => {
    if (!pending) return;
    const { txnId, status } = pending;
    setPending(null);
    await setStatus(txnId, status);
    refresh();
    const label = d.status[status as LifecycleStatus] ?? status;
    chat.push("rex", d.assistant.didStatus(label));
  };

  const feedLine = (it: FeedItem): { label: string; text?: string } => {
    switch (it.kind) {
      case "flagged":
        return {
          label:
            it.fc != null
              ? `${d.run.ph.flagged}: ${d.classLabel[it.fc]} · ${inr(it.amount ?? 0)}`
              : it.text ?? d.run.ph.flagged,
        };
      case "diagnosis":
        return {
          label: d.run.fDiagnosed,
          text: `${tVocab("rootCause", it.text, d)} · ${tVocab("playbook", it.extra, d)}`,
        };
      case "sent":
        return { label: d.run.fSent, text: it.text };
      case "reply":
        return { label: d.run.fReply, text: it.text };
      case "system":
        return { label: it.text ?? "" };
      case "waiting":
        return { label: `${d.run.fWaiting} ${it.extra}` };
      case "stopped":
        return { label: d.run.fStopped };
      case "escalated":
        return { label: d.run.fEscalated };
      case "called":
        return { label: d.run.fCalled };
      case "complete":
        return {
          label:
            it.extra === "RECOVERED"
              ? d.run.fRecovered
              : d.status[(it.extra as keyof typeof d.status) ?? "RECOVERED"] ?? it.extra ?? "",
        };
    }
  };

  const runActive = run.phase !== "idle";

  return (
    <>
      {/* Launcher */}
      <AnimatePresence>
        {!open ? (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-5 right-5 z-[400] flex items-center gap-2 rounded-full px-4 py-3 text-[13px] font-semibold text-white shadow-lg"
            style={{ background: "var(--d-accent)", boxShadow: "0 12px 32px rgba(28,25,23,0.28)" }}
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white/20 text-[13px] font-bold">
              R
            </span>
            {d.assistant.launcher}
            {run.running ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : null}
          </motion.button>
        ) : null}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="fixed bottom-5 right-5 z-[400] flex h-[540px] max-h-[80vh] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl"
            style={{
              background: "var(--d-surface)",
              border: "1px solid var(--d-border)",
              boxShadow: "0 24px 56px rgba(28,25,23,0.24)",
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: "1px solid var(--d-border)" }}>
              <span
                className="grid h-8 w-8 place-items-center rounded-lg text-[14px] font-bold text-white"
                style={{ background: "var(--d-accent)" }}
              >
                R
              </span>
              <div className="min-w-0 leading-tight">
                <div className="text-[13.5px] font-semibold tracking-tight">{d.assistant.title}</div>
                <div className="truncate text-[11px]" style={{ color: "var(--d-muted)" }}>
                  {d.assistant.subtitle}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => { if (voiceOn) window.speechSynthesis?.cancel(); setVoiceOn((v) => !v); }}
                  className="grid h-7 w-7 place-items-center rounded-md text-[13px] transition-colors hover:bg-[var(--d-surface-2)]"
                  style={{ color: voiceOn ? "var(--d-accent)" : "var(--d-faint)" }}
                  aria-label={voiceOn ? d.assistant.voiceOn : d.assistant.voiceOff}
                  title={voiceOn ? d.assistant.voiceOn : d.assistant.voiceOff}
                >
                  {voiceOn ? "🔊" : "🔇"}
                </button>
                <button
                  onClick={() => { chat.clear(); run.reset(); }}
                  className="rounded-md px-2 py-1 text-[11px] transition-colors hover:bg-[var(--d-surface-2)]"
                  style={{ color: "var(--d-muted)" }}
                >
                  {d.assistant.clear}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="grid h-7 w-7 place-items-center rounded-md text-[15px] transition-colors hover:bg-[var(--d-surface-2)]"
                  style={{ color: "var(--d-muted)" }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Thread */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {/* Greeting */}
              <div className="flex justify-start">
                <div
                  className="max-w-[85%] rounded-2xl rounded-tl-sm px-3 py-2 text-[12.5px] leading-snug"
                  style={{ background: "var(--d-surface-2)", color: "var(--d-ink)" }}
                >
                  {d.assistant.greeting}
                </div>
              </div>

              {chat.messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div
                      className="max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-2 text-[12.5px] leading-snug text-white"
                      style={{ background: "var(--d-accent)" }}
                    >
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex justify-start">
                    <div
                      className="max-w-[85%] rounded-2xl rounded-tl-sm px-3 py-2 text-[12.5px] leading-snug"
                      style={{ background: "var(--d-surface-2)", color: "var(--d-ink)" }}
                    >
                      {m.text}
                    </div>
                  </div>
                ),
              )}

              {/* Live run — REX working the case, in the same thread */}
              {runActive ? (
                <div
                  className="rounded-xl px-3 py-2.5"
                  style={{ background: "var(--d-surface-2)", border: "1px solid var(--d-border)" }}
                >
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold" style={{ color: "var(--d-muted)" }}>
                    {run.running ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <span style={{ color: "var(--d-ok)" }}>✓</span>
                    )}
                    {d.assistant.working}
                  </div>
                  <div className="space-y-1.5">
                    {run.feed.map((it) => {
                      const { label, text } = feedLine(it);
                      return (
                        <div key={it.id} className="flex gap-2 text-[11.5px]">
                          <span className="w-4 shrink-0 text-center">{ICON[it.kind]}</span>
                          <div className="min-w-0">
                            <div style={{ color: it.kind === "complete" ? "var(--d-ok)" : "var(--d-ink)" }}>
                              {label}
                            </div>
                            {text ? (
                              <div className="truncate" style={{ color: "var(--d-muted)" }}>
                                {text}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Pending status confirmation */}
              {pending ? (
                <div
                  className="rounded-xl px-3 py-3"
                  style={{ background: "var(--d-surface-2)", border: "1px solid var(--d-border)" }}
                >
                  <p className="text-[12.5px] font-medium">{d.assistant.confirmBody(d.status[pending.status as LifecycleStatus] ?? pending.status)}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={confirmStatus}
                      className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white"
                      style={{ background: "var(--d-ink)" }}
                    >
                      {d.assistant.confirm}
                    </button>
                    <button
                      onClick={() => { setPending(null); chat.push("rex", d.assistant.declined); }}
                      className="rounded-lg px-3 py-1.5 text-[12px] font-medium"
                      style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)", color: "var(--d-muted)" }}
                    >
                      {d.assistant.cancel}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Single recovery — confirm before REX starts */}
              {pendingRun ? (
                <div
                  className="rounded-xl px-3 py-3"
                  style={{ background: "var(--d-surface-2)", border: "1px solid var(--d-border)" }}
                >
                  <div className="flex gap-2">
                    <button
                      onClick={confirmRun}
                      className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white"
                      style={{ background: "var(--d-accent)" }}
                    >
                      {d.assistant.startRecovery}
                    </button>
                    <button
                      onClick={() => { setPendingRun(null); chat.push("rex", d.assistant.declined); }}
                      className="rounded-lg px-3 py-1.5 text-[12px] font-medium"
                      style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)", color: "var(--d-muted)" }}
                    >
                      {d.assistant.cancel}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Batch recovery — all or one */}
              {batch ? (
                <div
                  className="rounded-xl px-3 py-3"
                  style={{ background: "var(--d-surface-2)", border: "1px solid var(--d-border)" }}
                >
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={runBatchAll}
                      className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white"
                      style={{ background: "var(--d-accent)" }}
                    >
                      {d.assistant.recoverAll(batch.ids.length)}
                    </button>
                    <button
                      onClick={runBatchOne}
                      className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white"
                      style={{ background: "var(--d-ink)" }}
                    >
                      {d.assistant.recoverOne}
                    </button>
                    <button
                      onClick={() => { setBatch(null); chat.push("rex", d.assistant.declined); }}
                      className="rounded-lg px-3 py-1.5 text-[12px] font-medium"
                      style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)", color: "var(--d-muted)" }}
                    >
                      {d.assistant.cancel}
                    </button>
                  </div>
                </div>
              ) : null}

              {chat.busy ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-tl-sm px-3 py-2 text-[12px]" style={{ background: "var(--d-surface-2)", color: "var(--d-muted)" }}>
                    {d.assistant.thinking}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Composer */}
            <div className="flex items-center gap-2 px-3 py-3" style={{ borderTop: "1px solid var(--d-border)" }}>
              {sttSupported ? (
                <button
                  onClick={toggleMic}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors"
                  style={listening
                    ? { background: "var(--d-bad)", color: "#fff" }
                    : { border: "1px solid var(--d-border)", color: "var(--d-muted)" }}
                  aria-label={d.assistant.mic}
                  title={listening ? d.assistant.listening : d.assistant.mic}
                >
                  {listening ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <rect x="6" y="6" width="12" height="12" rx="2.5" />
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="9" y="2" width="6" height="12" rx="3" />
                      <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                  )}
                </button>
              ) : null}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                placeholder={listening ? d.assistant.listening : d.assistant.placeholder}
                className="flex-1 rounded-xl border px-3 py-2 text-[12.5px] outline-none"
                style={{ borderColor: "var(--d-border)", background: "var(--d-bg)", color: "var(--d-ink)" }}
              />
              <button
                onClick={() => submit()}
                disabled={!input.trim() || chat.busy}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white disabled:opacity-40"
                style={{ background: "var(--d-accent)" }}
                aria-label="Send"
              >
                ↑
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApi } from "@/hooks/useApi";
import {
  createPaymentLink,
  draftMessage,
  fetchConversation,
  paymentLinkStatus,
  sendMessage,
} from "@/lib/dashboard/api";
import { useDash } from "@/lib/dashboard/i18n";
import PhoneFrame from "./PhoneFrame";
import WhatsAppThread from "./WhatsAppThread";
import CallView from "./CallView";

type Channel = "whatsapp" | "call";

export default function ConversationPanel({
  txnId,
  customerName,
  channel: initialChannel,
  accent,
  onClose,
}: {
  txnId: string;
  customerName: string;
  channel: Channel;
  accent: string;
  onClose: () => void;
}) {
  const { d } = useDash();
  const c = d.convo;
  const [channel, setChannel] = useState<Channel>(initialChannel);
  const [nonce, setNonce] = useState(0);
  const [text, setText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [linking, setLinking] = useState(false);
  const [awaitingPay, setAwaitingPay] = useState(false);
  const [paid, setPaid] = useState(false);

  const load = useCallback(
    (signal: AbortSignal) => fetchConversation(txnId, signal),
    [txnId]
  );
  const { data, loading } = useApi(load, [txnId, nonce]);

  const onSend = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await sendMessage(txnId, body, false);
      setText("");
      setNonce((n) => n + 1);
    } finally {
      setSending(false);
    }
  };

  const startAwaitingPayment = useCallback(() => {
    setNonce((n) => n + 1); // link (and later the paid beat) show in the thread
    setPaid(false);
    setAwaitingPay(true);
  }, []);

  const onPaymentLink = async () => {
    if (linking) return;
    setLinking(true);
    try {
      await createPaymentLink(txnId);
      startAwaitingPayment();
    } finally {
      setLinking(false);
    }
  };

  // While a link is outstanding, poll for the paid status. Webhooks
  // can't reach localhost, so this is what closes the loop to RECOVERED.
  useEffect(() => {
    if (!awaitingPay) return;
    let alive = true;
    const timer = setInterval(async () => {
      try {
        const r = await paymentLinkStatus(txnId);
        if (!alive) return;
        if (r.paid) {
          setPaid(true);
          setAwaitingPay(false);
          setNonce((n) => n + 1); // pulls in the "payment received" system beat
        }
      } catch {
        /* transient — keep polling */
      }
    }, 4000);
    // Stop chasing after ~3 minutes if nothing happens.
    const stop = setTimeout(() => setAwaitingPay(false), 180000);
    return () => {
      alive = false;
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [awaitingPay, txnId]);

  const onDraft = async () => {
    const p = prompt.trim();
    if (!p || drafting) return;
    setDrafting(true);
    try {
      const { draft } = await draftMessage(txnId, p);
      setText(draft);
    } finally {
      setDrafting(false);
    }
  };

  const Tab = ({ id, label }: { id: Channel; label: string }) => (
    <button
      onClick={() => setChannel(id)}
      className="rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors"
      style={
        channel === id
          ? { background: accent, color: "#fff" }
          : { background: "var(--d-surface-2)", color: "var(--d-muted)" }
      }
    >
      {label}
    </button>
  );

  return (
    <motion.div
      className="fixed inset-0 z-[300] flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0" style={{ background: "rgba(28,25,23,0.35)" }} onClick={onClose} />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative flex h-full w-full max-w-[500px] flex-col overflow-hidden"
        style={{ background: "var(--d-bg)", borderLeft: "1px solid var(--d-border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid var(--d-border)", background: "var(--d-surface)" }}
        >
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold">{customerName}</div>
            <div className="d-label">{c.title}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Tab id="whatsapp" label={c.whatsapp} />
            <Tab id="call" label={c.call} />
            <button
              onClick={onClose}
              className="grid h-7 w-7 place-items-center rounded-md text-[15px] transition-colors hover:bg-[var(--d-surface-2)]"
              style={{ color: "var(--d-muted)" }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Payment status banner */}
        <AnimatePresence>
          {(awaitingPay || paid) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex items-center justify-center gap-2 px-4 py-2 text-[12.5px] font-semibold"
              style={
                paid
                  ? { background: "rgba(37,211,102,0.15)", color: "#0a7d3f" }
                  : { background: "var(--d-surface-2)", color: "var(--d-muted)" }
              }
            >
              {paid ? (
                c.paidBanner
              ) : (
                <>
                  <motion.span
                    style={{ width: 7, height: 7, borderRadius: 999, background: "#f0a020" }}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                  {c.awaitingPay}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-5">
          {/* Row 1 — phone */}
          <div className="flex justify-center">
            <PhoneFrame>
              {loading ? (
                <div
                  className="flex h-full items-center justify-center text-[12px]"
                  style={{ background: channel === "call" ? "#0b141a" : "#e5ddd5", color: "#888" }}
                >
                  …
                </div>
              ) : channel === "whatsapp" ? (
                <WhatsAppThread messages={data?.messages ?? []} customerName={customerName} />
              ) : (
                <CallView
                  txnId={txnId}
                  customerName={customerName}
                  onLinkSent={startAwaitingPayment}
                />
              )}
            </PhoneFrame>
          </div>

          {/* Row 2 — compose (WhatsApp only) */}
          {channel === "whatsapp" ? (
            <div
              className="mx-auto mt-5 max-w-[340px] rounded-xl p-3"
              style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)" }}
            >
              {/* AI assist */}
              <div className="flex gap-2">
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={c.aiPlaceholder}
                  className="flex-1 rounded-lg border px-2.5 py-1.5 text-[12px] outline-none"
                  style={{ borderColor: "var(--d-border)", background: "var(--d-bg)", color: "var(--d-ink)" }}
                />
                <button
                  onClick={onDraft}
                  disabled={drafting || !prompt.trim()}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                  style={{ background: accent }}
                >
                  {drafting ? c.drafting : c.draft}
                </button>
              </div>

              {/* Message + send */}
              <div className="mt-2 flex items-end gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={c.composePlaceholder}
                  rows={2}
                  className="flex-1 resize-none rounded-lg border px-2.5 py-1.5 text-[12.5px] outline-none"
                  style={{ borderColor: "var(--d-border)", background: "var(--d-bg)", color: "var(--d-ink)" }}
                />
                <button
                  onClick={onSend}
                  disabled={sending || !text.trim()}
                  className="shrink-0 rounded-lg px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
                  style={{ background: "var(--d-ink)" }}
                >
                  {sending ? c.sending : c.send}
                </button>
              </div>
              <p className="mt-1.5 text-[10.5px]" style={{ color: "var(--d-faint)" }}>
                {c.hint}
              </p>

              {/* Real (test-mode) Paytm payment link, dropped into the thread */}
              <button
                onClick={onPaymentLink}
                disabled={linking}
                className="mt-2 w-full rounded-lg py-2 text-[12px] font-semibold disabled:opacity-50"
                style={{ background: "#25d366", color: "#0b141a" }}
              >
                {linking ? c.payLinkSending : c.payLink}
              </button>
            </div>
          ) : null}
        </div>
      </motion.aside>
    </motion.div>
  );
}

export function ConversationPanelHost({
  open,
  ...props
}: {
  open: boolean;
  txnId: string;
  customerName: string;
  channel: Channel;
  accent: string;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? <ConversationPanel key={`${props.txnId}:${props.channel}`} {...props} /> : null}
    </AnimatePresence>
  );
}

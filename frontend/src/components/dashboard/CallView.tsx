"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { createPaymentLink } from "@/lib/dashboard/api";
import { useDash } from "@/lib/dashboard/i18n";

// Public agent, so the browser can start the session directly with just the ID
// (no server-side signed URL). Configure in frontend/.env.local.
const AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

type Turn = { speaker: "AGENT" | "USER"; text: string };

function mmss(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function Waveform({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 18 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span
          key={i}
          style={{ width: 3, background: color, borderRadius: 2 }}
          animate={active ? { height: [4, 16, 6, 14, 5][i] } : { height: 4 }}
          transition={active ? { duration: 0.5, repeat: Infinity, repeatType: "reverse", delay: i * 0.08 } : {}}
        />
      ))}
    </div>
  );
}

function LiveCall({
  txnId,
  customerName,
  onLinkSent,
}: {
  txnId: string;
  customerName: string;
  onLinkSent?: () => void;
}) {
  const { d } = useDash();
  const c = d.convo;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [ended, setEnded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const initial = (customerName || "?").charAt(0).toUpperCase();
  const first = (customerName || "").split(" ")[0];

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const conversation = useConversation({
    onConnect: () => {
      setError(null);
      setElapsed(0);
      stopTimer();
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      // Give REX the case context so it can speak to this customer specifically.
      try {
        conversation.sendContextualUpdate(
          `You are on a payment-recovery call with ${customerName}. Address them by name.`
        );
      } catch {
        /* non-fatal */
      }
    },
    onDisconnect: () => {
      stopTimer();
      setEnded(true);
    },
    onMessage: ({ source, message }) => {
      const text = (message || "").trim();
      if (!text) return;
      setTurns((t) => [...t, { speaker: source === "ai" ? "AGENT" : "USER", text }]);
    },
    onError: (msg) => {
      stopTimer();
      setError(typeof msg === "string" ? msg : c.micDenied);
    },
  });

  const status = conversation.status; // disconnected | connecting | connected | error

  // End the session and clear the timer if the panel unmounts mid-call.
  useEffect(() => {
    return () => {
      stopTimer();
      try {
        conversation.endSession();
      } catch {
        /* already closed */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const begin = () => {
    if (!AGENT_ID) return;
    setError(null);
    setTurns([]);
    setEnded(false);
    try {
      conversation.startSession({
        agentId: AGENT_ID,
        connectionType: "webrtc",
        // The agent's prompt/first message reference these placeholders.
        dynamicVariables: {
          customer_name: customerName || "customer",
          company_name: "REX",
        },
        // REX can call this mid-conversation to mint a real Paytm link and
        // drop it into the customer's WhatsApp thread.
        clientTools: {
          send_payment_link: async () => {
            try {
              const r = await createPaymentLink(txnId);
              onLinkSent?.();
              setTurns((t) => [...t, { speaker: "AGENT", text: `🔗 ${c.linkSent}` }]);
              return r.simulated
                ? "Payment link created and sent to the customer's WhatsApp."
                : "Secure Paytm payment link sent to the customer's WhatsApp.";
            } catch {
              return "Could not send the payment link right now.";
            }
          },
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : c.micDenied);
    }
  };

  const hangUp = () => {
    stopTimer();
    try {
      conversation.endSession();
    } catch {
      /* already closed */
    }
    setEnded(true);
  };

  const connecting = status === "connecting";
  const connected = status === "connected";
  const live = connecting || connected;
  const speaking = connected && conversation.isSpeaking;

  const statusLine = connecting
    ? c.connecting
    : connected
      ? speaking
        ? c.speaking
        : c.listening
      : ended
        ? `${c.callEnded} · ${mmss(elapsed)}`
        : c.aiAgent;

  return (
    <div className="flex h-full flex-col" style={{ background: "#0b141a", color: "#e9edef" }}>
      {/* Caller identity */}
      <div className="flex flex-col items-center" style={{ paddingTop: "16%" }}>
        <div className="relative">
          {live && (
            <motion.span
              className="absolute inset-0 rounded-full"
              style={{ border: "2px solid #25d366" }}
              animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
          )}
          <span
            className="grid place-items-center rounded-full"
            style={{ width: 58, height: 58, background: "#25d366", fontSize: 23, fontWeight: 700, color: "#0b141a" }}
          >
            {initial}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <div style={{ fontSize: 14, fontWeight: 600 }}>{customerName}</div>
          {connected && (
            <span
              className="flex items-center gap-1 rounded-full px-1.5 py-0.5"
              style={{ background: "rgba(225,29,72,0.9)", fontSize: 8, fontWeight: 700, letterSpacing: 0.4 }}
            >
              <motion.span
                style={{ width: 5, height: 5, borderRadius: 999, background: "#fff" }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              {c.live}
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>
          {statusLine}
          {connected && elapsed > 0 ? ` · ${mmss(elapsed)}` : ""}
        </div>
        {live && (
          <div className="mt-1.5 flex justify-center">
            <Waveform active={speaking} color="#25d366" />
          </div>
        )}
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="mt-2 flex-1 space-y-1.5 overflow-y-auto px-3" style={{ width: "100%" }}>
        {turns.length === 0 && !live ? (
          <p className="mt-6 text-center" style={{ fontSize: 10.5, opacity: 0.55, lineHeight: 1.5 }}>
            {c.liveHint}
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {turns.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${t.speaker === "AGENT" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className="rounded-lg px-2 py-1"
                  style={{
                    maxWidth: "82%",
                    fontSize: 10.5,
                    background: t.speaker === "AGENT" ? "rgba(37,211,102,0.16)" : "rgba(255,255,255,0.08)",
                  }}
                >
                  <span style={{ opacity: 0.55, fontSize: 8.5 }}>{t.speaker === "AGENT" ? "REX" : first}</span>
                  <div>{t.text}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="px-4 text-center" style={{ fontSize: 9.5, color: "#f87171" }}>
          {error}
        </p>
      )}

      {/* Controls */}
      <div className="w-full px-4 pb-5 pt-2">
        {!AGENT_ID ? (
          <p className="text-center" style={{ fontSize: 10, opacity: 0.6 }}>
            Set NEXT_PUBLIC_ELEVENLABS_AGENT_ID to enable live calling.
          </p>
        ) : live ? (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => conversation.setMuted(!conversation.isMuted)}
              className="grid place-items-center rounded-full"
              style={{
                width: 40,
                height: 40,
                background: conversation.isMuted ? "#e11d48" : "rgba(255,255,255,0.12)",
                color: "#fff",
              }}
              aria-label={conversation.isMuted ? c.unmute : c.mute}
            >
              {conversation.isMuted ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="2" y1="2" x2="22" y2="22" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              )}
            </button>
            <button
              onClick={hangUp}
              className="grid place-items-center rounded-full"
              style={{ width: 46, height: 46, background: "#e11d48", color: "#fff", fontSize: 18 }}
              aria-label={c.callEnd}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={begin}
            className="mx-auto flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[12.5px] font-semibold"
            style={{ background: "#25d366", color: "#0b141a" }}
          >
            📞 {ended ? c.callReplay : c.callStart}
          </button>
        )}
      </div>
    </div>
  );
}

export default function CallView({
  txnId,
  customerName,
  onLinkSent,
}: {
  txnId: string;
  customerName: string;
  onLinkSent?: () => void;
}) {
  return (
    <ConversationProvider>
      <LiveCall txnId={txnId} customerName={customerName} onLinkSent={onLinkSent} />
    </ConversationProvider>
  );
}

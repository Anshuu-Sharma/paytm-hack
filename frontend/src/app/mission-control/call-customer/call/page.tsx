"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import CrystalizedBall from "@/components/CrystalizedBall";
import { API_BASE } from "@/lib/api";
import { useDash } from "@/lib/dashboard/i18n";
import { CUSTOMERS } from "@/lib/dashboard/customers";
import { callReasonLabel, type CallReasonKey } from "@/lib/dashboard/callReasons";

/* ── WAV encode / b64 helpers (same approach as the other voice modes) ── */
function encodeWav(samples: Float32Array, sampleRate = 16000): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true);
  ws(8, "WAVE"); ws(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); ws(36, "data");
  v.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s2 = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s2 < 0 ? s2 * 0x8000 : s2 * 0x7fff, true);
  }
  return buf;
}
function bufToB64(buf: ArrayBuffer): string {
  let b = ""; const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) b += String.fromCharCode(bytes[i]);
  return window.btoa(b);
}
function mmss(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

interface Turn { role: "rex" | "user"; text: string; ts: number }

function CallCustomerContent() {
  const { d } = useDash();
  const router = useRouter();
  const params = useSearchParams();

  const customerId = params.get("customer");
  const reason = (params.get("reason") as CallReasonKey) || "late_payment";
  const customReason = params.get("custom") ?? undefined;
  const customer = CUSTOMERS.find((c) => c.id === customerId) ?? CUSTOMERS[0];

  const [phase, setPhase] = useState<"idle" | "ringing" | "connected" | "ended">("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [rexSpeaking, setRexSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [muted, setMuted] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mutedRef = useRef(false);
  const rexSpeakingRef = useRef(false);
  const processingRef = useRef(false);
  const liveRef = useRef(false);
  mutedRef.current = muted;
  rexSpeakingRef.current = rexSpeaking;
  processingRef.current = processing;

  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns]);

  const addTurn = useCallback((role: "rex" | "user", text: string) => {
    setTurns((prev) => [...prev, { role, text, ts: Date.now() }]);
  }, []);

  const speak = useCallback(async (text: string) => {
    const res = await fetch(`${API_BASE}/api/v1/assistant/tts`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, locale: "hi" }),
    });
    if (!res.ok) return;
    const url = URL.createObjectURL(await res.blob());
    setRexSpeaking(true);
    await new Promise<void>((resolve) => {
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      audio.play().catch(resolve);
    });
    setRexSpeaking(false);
  }, []);

  const hangUp = useCallback(() => {
    liveRef.current = false;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (processorRef.current) { try { processorRef.current.disconnect(); } catch {/**/} processorRef.current = null; }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {/**/} audioCtxRef.current = null; }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach((t) => t.stop()); mediaStreamRef.current = null; }
    setPhase("ended");
    setRexSpeaking(false);
    setUserSpeaking(false);
    setProcessing(false);
  }, []);

  const processSpeech = useCallback(async (wavB64: string) => {
    if (!liveRef.current || processingRef.current) return;
    setProcessing(true);
    try {
      const wavBytes = new Uint8Array(window.atob(wavB64).split("").map((c) => c.charCodeAt(0)));
      const blob = new Blob([wavBytes.buffer], { type: "audio/wav" });
      const fd = new FormData();
      fd.append("file", blob, "recording.wav");
      fd.append("language_code", "hi-IN");
      fd.append("mode", "codemix");
      const sttRes = await fetch(`${API_BASE}/api/v1/assistant/stt`, { method: "POST", body: fd });
      if (!sttRes.ok) { setProcessing(false); return; }
      const { transcript } = await sttRes.json() as { transcript: string };
      if (!transcript?.trim()) { setProcessing(false); return; }

      addTurn("user", transcript);

      const chatRes = await fetch(`${API_BASE}/api/v1/assistant/call-chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: transcript,
          customer_name: customer.name,
          reason,
          custom_reason: customReason ?? null,
          locale: "hi",
          history: turnsRef.current.map((t) => ({ role: t.role === "rex" ? "rex" : "user", text: t.text })),
        }),
      });
      if (!chatRes.ok) { setProcessing(false); return; }
      const data = await chatRes.json() as { reply_text: string; call_ended: boolean };

      addTurn("rex", data.reply_text);
      setProcessing(false);
      await speak(data.reply_text);

      if (data.call_ended) {
        hangUp();
      }
    } catch {
      setProcessing(false);
    }
  }, [addTurn, customer.name, customReason, reason, speak, hangUp]);

  const startListening = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx({ sampleRate: 16000 });
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      let samplesBuffer: Float32Array[] = [];
      let silenceCount = 0;
      let recording = false;

      processor.onaudioprocess = (e) => {
        if (mutedRef.current || rexSpeakingRef.current || processingRef.current || !liveRef.current) return;
        const data = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);

        if (rms > 0.018) {
          recording = true; silenceCount = 0; setUserSpeaking(true);
          samplesBuffer.push(new Float32Array(data));
        } else if (recording) {
          samplesBuffer.push(new Float32Array(data));
          silenceCount++;
          if (silenceCount >= 3) {
            setUserSpeaking(false); recording = false; silenceCount = 0;
            const total = samplesBuffer.reduce((a, b) => a + b.length, 0);
            if (total >= 9600) {
              const merged = new Float32Array(total);
              let off = 0;
              for (const c of samplesBuffer) { merged.set(c, off); off += c.length; }
              processSpeech(bufToB64(encodeWav(merged, 16000)));
            }
            samplesBuffer = [];
          }
        }
      };
      source.connect(processor);
      processor.connect(ctx.destination);
    } catch { /* AudioContext unavailable */ }
  }, [processSpeech]);

  const startCall = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      mediaStreamRef.current = stream;
    } catch {
      return;
    }
    setTurns([]);
    setElapsed(0);
    setMuted(false);
    setPhase("ringing");

    setTimeout(async () => {
      liveRef.current = true;
      setPhase("connected");
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      startListening(stream);

      try {
        const res = await fetch(`${API_BASE}/api/v1/assistant/call-start`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customer_name: customer.name,
            reason,
            custom_reason: customReason ?? null,
            locale: "hi",
          }),
        });
        if (res.ok) {
          const data = await res.json() as { reply_text: string };
          addTurn("rex", data.reply_text);
          await speak(data.reply_text);
        }
      } catch { /* opening line fetch failed — call stays live, customer can still speak */ }
    }, 1300);
  };

  useEffect(() => () => hangUp(), [hangUp]);

  // Auto-dial when REX (or the customer picker) sent us here with a specific
  // customer already chosen — no extra click needed. A bare visit to this
  // route with no `customer` param (e.g. a stray back-navigation) stays
  // on the idle "Call" button instead of dialing unprompted.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (!customerId) return;
    autoStartedRef.current = true;
    startCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    mediaStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
  };

  const reasonLabel = reason === "custom" && customReason ? customReason : callReasonLabel(reason);
  const live = phase === "ringing" || phase === "connected";
  const statusLine = phase === "ringing"
    ? "Ringing…"
    : phase === "connected"
      ? processing
        ? "REX soch raha hai…"
        : rexSpeaking
          ? "REX bol raha hai…"
          : userSpeaking
            ? "Customer bol raha hai…"
            : "Sun raha hoon…"
      : phase === "ended"
        ? `${d.call.callPage.ended} · ${mmss(elapsed)}`
        : d.call.callPage.subtitle;

  return (
    <div className="flex h-full flex-col" style={{ background: "#0b141a", color: "#e9edef" }}>
      <div className="flex shrink-0 items-center gap-3 px-4 pt-4 pb-1">
        <Link href="/mission-control/call-customer" className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "rgba(255,255,255,.08)", color: "#cbd5e1" }}>
          ←
        </Link>
        <div>
          <div className="text-[13.5px] font-semibold">{d.call.title}</div>
          <div className="text-[10.5px]" style={{ opacity: 0.6 }}>{d.call.callPage.subtitle}</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center px-4 py-6">
          <div className="mb-3" style={{ width: 150, height: 150 }}>
            <CrystalizedBall
              preset={rexSpeaking ? "aurora" : userSpeaking ? "frost" : "eclipse"}
              color={rexSpeaking ? "#48c88e" : userSpeaking ? "#38bdf8" : "#9fb3c8"}
              size={0.85}
              speed={rexSpeaking || userSpeaking ? 1.7 : 0.5}
              glow={rexSpeaking ? 1.3 : userSpeaking ? 1.1 : 0.75}
              crackle={rexSpeaking ? 0.9 : userSpeaking ? 0.65 : 0.4}
              flares={rexSpeaking || userSpeaking ? 0.7 : 0.35}
              sparks={rexSpeaking || userSpeaking ? 0.7 : 0.25}
              haze={rexSpeaking || userSpeaking ? 0.9 : 0.7}
              interactive={false}
              paused={false}
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="text-[16px] font-semibold">{customer.name}</div>
            {phase === "connected" && (
              <span className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider" style={{ background: "rgba(225,29,72,.85)", color: "#fff" }}>
                <motion.span style={{ width: 5, height: 5, borderRadius: 999, background: "#fff" }} animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
                LIVE
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11px]" style={{ opacity: 0.65 }}>{customer.phone}</div>
          <div className="mt-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "rgba(255,255,255,.08)" }}>
            {d.call.callPage.reasonLabel}: {reasonLabel}
          </div>

          <div className="mt-2 text-[11px]" style={{ opacity: 0.75 }}>
            {statusLine}
            {phase === "connected" && elapsed > 0 ? ` · ${mmss(elapsed)}` : ""}
          </div>

          {phase === "idle" && turns.length === 0 && (
            <div className="mt-8 max-w-[300px] text-center text-[12px] leading-relaxed" style={{ opacity: 0.65 }}>
              {d.call.callPage.idleHint}
            </div>
          )}

          {turns.length > 0 && (
            <div className="mt-5 w-full max-w-[420px] space-y-2">
              <AnimatePresence initial={false}>
                {turns.map((t) => (
                  <motion.div key={t.ts} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[82%] rounded-xl px-3 py-2 text-[12.5px] leading-snug"
                      style={{ background: t.role === "rex" ? "rgba(72,200,142,0.16)" : "rgba(255,255,255,0.08)" }}
                    >
                      <div className="mb-0.5 text-[9px] opacity-50">{t.role === "rex" ? "REX" : customer.name.split(" ")[0]}</div>
                      {t.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {processing && (
                <div className="flex justify-start">
                  <div className="rounded-xl px-3 py-2 text-[12px]" style={{ background: "rgba(72,200,142,0.16)", opacity: 0.8 }}>
                    <span className="inline-flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#48c88e", display: "inline-block" }} animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
                      ))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 px-4 pb-5 pt-2">
        {live ? (
          <div className="flex items-center justify-center gap-4 py-2">
            <button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className="grid h-12 w-12 place-items-center rounded-full" style={{ background: muted ? "#e11d48" : "rgba(255,255,255,.1)", color: "#fff" }}>
              {muted ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="2" y1="2" x2="22" y2="22" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              )}
            </button>
            <button onClick={hangUp} aria-label="End call" className="grid h-14 w-14 place-items-center rounded-full text-white" style={{ background: "#e11d48", boxShadow: "0 4px 20px rgba(225,29,72,.4)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
              </svg>
            </button>
          </div>
        ) : phase === "ended" ? (
          <div className="flex items-center justify-center gap-3">
            <button onClick={startCall} className="rounded-full px-5 py-2.5 text-[13px] font-semibold text-white" style={{ background: "linear-gradient(160deg, #48c88e, #2a9d6f)" }}>
              📞 {d.call.callPage.callAgain}
            </button>
            <button onClick={() => router.push("/mission-control/call-customer")} className="rounded-full px-5 py-2.5 text-[13px] font-semibold" style={{ background: "rgba(255,255,255,.08)", color: "#cbd5e1" }}>
              {d.call.callPage.backToList}
            </button>
          </div>
        ) : (
          <button onClick={startCall} className="mx-auto flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold" style={{ background: "#48c88e", color: "#06241a" }}>
            📞 {d.call.callBtn}
          </button>
        )}
      </div>
    </div>
  );
}

export default function CallCustomerCallPage() {
  return (
    <Suspense fallback={null}>
      <CallCustomerContent />
    </Suspense>
  );
}

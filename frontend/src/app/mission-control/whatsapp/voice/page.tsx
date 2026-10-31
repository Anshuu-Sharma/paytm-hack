"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import CrystalizedBall from "@/components/CrystalizedBall";
import PhoneFrame from "@/components/dashboard/PhoneFrame";
import WhatsAppThread from "@/components/dashboard/WhatsAppThread";
import { API_BASE } from "@/lib/api";
import type { ConversationMessage } from "@/lib/dashboard/types";
import { finalizeCampaign, type AudienceKey } from "@/lib/dashboard/campaignStore";
import { AUDIENCE_COUNT, AUDIENCE_LABEL, customersInAudience } from "@/lib/dashboard/customers";

/* ── WAV encode / b64 helpers (same approach as the Ask REX voice call) ── */
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

interface Turn { role: "user" | "rex"; text: string; ts: number }
interface Template { headline: string; body: string; discount: string | null }

const CSS = `
.wah-root{
  --wah-fg: var(--d-ink, #f0ede8);
  --wah-mute: var(--d-muted, #8b8b99);
  --wah-a1: #baf3d1;
  --wah-a2: #25d366;
  --wah-a3: #128c7e;
  --wah-glow: rgba(37,211,102,.38);
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
.wah-bubble-user{background:rgba(255,255,255,.08);border-radius:18px 18px 4px 18px}
.wah-bubble-rex{background:linear-gradient(160deg,rgba(18,140,126,.35),rgba(18,100,90,.22));border:1px solid rgba(37,211,102,.22);border-radius:18px 18px 18px 4px}
.wah-template{
  border-radius:18px;
  padding:14px 16px;
  background:var(--d-surface);
  border:1px solid var(--d-border-strong);
  box-shadow:0 18px 50px rgba(0,0,0,.35);
}
`;

export default function CampaignVoicePage() {
  const [messages, setMessages] = useState<Turn[]>([]);
  const [template, setTemplate] = useState<Template | null>(null);
  const [audience, setAudience] = useState<AudienceKey | null>(null);
  const [sentDone, setSentDone] = useState(false);

  const [callActive, setCallActive] = useState(false);
  const [callMuted, setCallMuted] = useState(false);
  const [callElapsed, setCallElapsed] = useState(0);
  const [rexSpeaking, setRexSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [callProcessing, setCallProcessing] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callMutedRef = useRef(false);
  const rexSpeakingRef = useRef(false);
  const callActiveRef = useRef(false);
  const callProcessingRef = useRef(false);
  callMutedRef.current = callMuted;
  rexSpeakingRef.current = rexSpeaking;
  callActiveRef.current = callActive;
  callProcessingRef.current = callProcessing;

  const messagesRef = useRef<Turn[]>([]);
  const templateRef = useRef<Template | null>(null);
  const audienceRef = useRef<AudienceKey | null>(null);
  messagesRef.current = messages;
  templateRef.current = template;
  audienceRef.current = audience;

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const addTurn = useCallback((role: "user" | "rex", text: string) => {
    setMessages((prev) => [...prev, { role, text, ts: Date.now() }]);
  }, []);

  const processSpeech = useCallback(async (wavB64: string) => {
    if (!callActiveRef.current || callProcessingRef.current) return;
    setCallProcessing(true);
    try {
      const wavBytes = new Uint8Array(window.atob(wavB64).split("").map((c) => c.charCodeAt(0)));
      const blob = new Blob([wavBytes.buffer], { type: "audio/wav" });
      const fd = new FormData();
      fd.append("file", blob, "recording.wav");
      fd.append("language_code", "hi-IN");
      fd.append("mode", "codemix");
      const sttRes = await fetch(`${API_BASE}/api/v1/assistant/stt`, { method: "POST", body: fd });
      if (!sttRes.ok) { setCallProcessing(false); return; }
      const { transcript } = await sttRes.json() as { transcript: string };
      if (!transcript?.trim()) { setCallProcessing(false); return; }

      addTurn("user", transcript);

      const chatRes = await fetch(`${API_BASE}/api/v1/assistant/campaign-chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: transcript,
          locale: "hi",
          history: messagesRef.current.map((m) => ({ role: m.role, text: m.text })),
          template: templateRef.current,
          audience: audienceRef.current,
        }),
      });
      if (!chatRes.ok) { setCallProcessing(false); return; }
      const data = await chatRes.json() as {
        reply_text: string;
        template: Template;
        audience: AudienceKey | null;
        ready_to_send: boolean;
      };

      setTemplate(data.template);
      setAudience(data.audience ?? null);
      const ttsPromise = fetch(`${API_BASE}/api/v1/assistant/tts`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: data.reply_text, locale: "hi" }),
      });
      addTurn("rex", data.reply_text);

      const ttsRes = await ttsPromise;
      if (ttsRes.ok) {
        const url = URL.createObjectURL(await ttsRes.blob());
        setRexSpeaking(true);
        await new Promise<void>((resolve) => {
          const audio = new Audio(url);
          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
          audio.play().catch(resolve);
        });
        setRexSpeaking(false);
      }

      if (data.ready_to_send && data.audience) {
        const finalAudience = data.audience;
        setTimeout(() => {
          setSentDone(true);
          finalizeCampaign(data.template, finalAudience, "voice");
        }, 500);
      }
    } catch {
      /* silent — keep call alive */
    } finally {
      setCallProcessing(false);
    }
  }, [addTurn]);

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
    setCallActive(true);
    setCallMuted(false);
    setCallElapsed(0);
    setSentDone(false);
    setAudience(null);
    timerRef.current = setInterval(() => setCallElapsed((e) => e + 1), 1000);

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
        if (callMutedRef.current || rexSpeakingRef.current || callProcessingRef.current) return;
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
  };

  const endCall = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (processorRef.current) { try { processorRef.current.disconnect(); } catch {/**/} processorRef.current = null; }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {/**/} audioCtxRef.current = null; }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach((t) => t.stop()); mediaStreamRef.current = null; }
    setCallActive(false); setRexSpeaking(false); setUserSpeaking(false); setCallProcessing(false);
  }, []);
  useEffect(() => () => endCall(), [endCall]);

  const toggleMute = () => {
    const next = !callMuted;
    setCallMuted(next);
    mediaStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
  };

  const sampleCustomer = audience ? customersInAudience(audience)[0] : null;
  const sampleFirstName = sampleCustomer?.name.split(" ")[0] ?? "Priya";

  const previewMessages: ConversationMessage[] | null = template ? [
    {
      id: 1, seq: 1, channel: "whatsapp", direction: "OUTBOUND", sender: "AGENT",
      status: "READ", meta: null, created_at: new Date().toISOString(),
      body: template.discount
        ? `${template.headline}\n\n${template.body.replace("{name}", sampleFirstName)}\n\n🎁 ${template.discount}`
        : `${template.headline}\n\n${template.body.replace("{name}", sampleFirstName)}`,
    },
  ] : null;

  const statusLine = callProcessing
    ? "REX soch raha hai…"
    : rexSpeaking
      ? "REX bol raha hai…"
      : userSpeaking
        ? "Aap bol rahe hain…"
        : "Sun raha hoon…";

  return (
    <div className="wah-root flex h-full flex-col" style={{ background: "var(--d-bg)" }}>
      <style>{CSS}</style>

      <div className="flex shrink-0 items-center gap-3 px-4 pt-4 pb-1">
        <Link href="/mission-control/whatsapp" className="grid h-8 w-8 place-items-center rounded-lg transition-colors" style={{ background: "var(--d-surface-2)", color: "var(--d-muted)" }}>
          ←
        </Link>
        <div>
          <div className="text-[13.5px] font-semibold" style={{ color: "var(--d-ink)" }}>Campaign Voice Help</div>
          <div className="text-[10.5px]" style={{ color: "var(--d-faint)" }}>Draft, revise and send a WhatsApp campaign by voice</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center px-4 py-6">
          <div className="mb-3" style={{ width: 140, height: 140 }}>
            <CrystalizedBall
              preset={rexSpeaking ? "aurora" : userSpeaking ? "frost" : "eclipse"}
              color={rexSpeaking ? "#25d366" : userSpeaking ? "#38bdf8" : "#9fb3c8"}
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
            <div className="text-[15px] font-semibold" style={{ color: "var(--d-ink)" }}>REX</div>
            {!callActive && (
              <button
                onClick={startCall}
                className="rounded-md px-6 py-3 text-[15px] font-semibold text-white"
                style={{ background: "linear-gradient(160deg, #25d366, #128c7e)", boxShadow: "0 4px 16px rgba(37,211,102,.35)" }}
              >
                Call
              </button>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px]" style={{ color: "var(--d-muted)" }}>
            {callActive && (
              <span className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider" style={{ background: "rgba(225,29,72,.85)", color: "#fff" }}>
                <motion.span style={{ width: 5, height: 5, borderRadius: 999, background: "#fff" }} animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
                Live
              </span>
            )}
            {callActive ? statusLine : "WhatsApp Campaign Help"}
            {callActive && callElapsed > 0 && ` · ${mmss(callElapsed)}`}
          </div>

          {!callActive && messages.length === 0 && (
            <div className="mt-8 max-w-[320px] text-center text-[12px] leading-relaxed" style={{ color: "var(--d-muted)" }}>
              Bolo kya bhejna hai — &ldquo;Diwali greeting bhejo&rdquo; — REX template banayega, discount aur audience pooch kar update karega, aur confirm karne par bhej dega.
            </div>
          )}

          {/* Live template preview */}
          {template && (
            <div className="wah-template mt-5 w-full max-w-[420px]">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[13px]">📱</span>
                <span className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "#25d366" }}>Template Preview</span>
                {sentDone && (
                  <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--d-ok-soft)", color: "var(--d-ok)" }}>
                    Sent ✓
                  </span>
                )}
              </div>
              <div className="text-[13.5px] font-semibold" style={{ color: "var(--d-ink)" }}>{template.headline}</div>
              <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--d-ink)", whiteSpace: "pre-wrap" }}>{template.body}</p>
              {template.discount && (
                <div className="mt-2 inline-flex rounded-md px-2 py-1 text-[11px] font-semibold" style={{ background: "rgba(37,211,102,.14)", color: "#128c7e" }}>
                  🎁 {template.discount}
                </div>
              )}
              <div className="mt-2 flex items-center gap-1.5 text-[10px]" style={{ color: "var(--d-faint)" }}>
                <span>To:</span>
                {audience ? (
                  <span className="rounded-full px-1.5 py-0.5 font-semibold" style={{ background: "var(--d-surface-2)", color: "var(--d-ink)" }}>
                    {AUDIENCE_LABEL[audience]} · {AUDIENCE_COUNT[audience].toLocaleString("en-IN")}
                  </span>
                ) : (
                  <span>not chosen yet — tell REX who to send to</span>
                )}
              </div>
              <div className="mt-1.5 text-[10px]" style={{ color: "var(--d-faint)" }}>
                {sentDone
                  ? `Sent to ${AUDIENCE_LABEL[audience as AudienceKey]}`
                  : "Not sent yet — confirm to broadcast"}
              </div>
            </div>
          )}

          {/* Transcript bubbles */}
          {messages.length > 0 && (
            <div className="mt-4 w-full max-w-[420px] space-y-2">
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div key={m.ts} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[82%] rounded-xl px-3 py-2 text-[12.5px] leading-snug ${m.role === "user" ? "wah-bubble-user" : "wah-bubble-rex"}`}>
                      <div className="mb-0.5 text-[9px] opacity-50">{m.role === "rex" ? "REX" : "Aap"}</div>
                      {m.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {callProcessing && (
                <div className="flex justify-start">
                  <div className="wah-bubble-rex rounded-xl px-3 py-2 text-[12px]" style={{ color: "var(--d-muted)" }}>
                    <span className="inline-flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#25d366", display: "inline-block" }} animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
                      ))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Final WhatsApp preview once sent */}
          {sentDone && previewMessages && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 flex flex-col items-center">
              <PhoneFrame width={220}>
                <WhatsAppThread messages={previewMessages} customerName={sampleCustomer?.name ?? "Priya Sharma"} />
              </PhoneFrame>
            </motion.div>
          )}
        </div>
      </div>

      <div className="shrink-0 px-4 pb-5 pt-2" style={{ background: "var(--d-bg)" }}>
        {callActive && (
          <div className="flex items-center justify-center gap-4 py-2">
            <button onClick={toggleMute} aria-label={callMuted ? "Unmute" : "Mute"} className="grid h-12 w-12 place-items-center rounded-full transition-all" style={{ background: callMuted ? "#e11d48" : "rgba(255,255,255,.1)", color: "#fff" }}>
              {callMuted ? (
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
            <button onClick={endCall} aria-label="End call" className="grid h-14 w-14 place-items-center rounded-full text-white" style={{ background: "#e11d48", boxShadow: "0 4px 20px rgba(225,29,72,.4)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  sendAssistantChat, fetchMetrics, addNote,
  createPaymentLink, draftMessage, sendMessage as sendMessageApi, resolveEscalation, simulateCase,
} from "@/lib/dashboard/api";
import type { AssistantAction } from "@/lib/dashboard/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useApi } from "@/hooks/useApi";
import { inr, pct } from "@/lib/dashboard/format";
import { useChatHistory } from "@/lib/dashboard/ChatHistoryContext";
import { useExplorerFilter } from "@/lib/dashboard/explorerFilter";
import { useRexRun } from "@/lib/dashboard/rexrun";
import { CUSTOMERS } from "@/lib/dashboard/customers";
import { finalizeCampaign } from "@/lib/dashboard/campaignStore";
import {
  generateChatId,
  titleFrom,
  type ChatMessage,
  type ChatSession,
} from "@/lib/dashboard/chatHistory";
import { API_BASE } from "@/lib/api";
import CrystalizedBall from "@/components/CrystalizedBall";

/* -- Pixel-icon renderer ----------------------------------------------- */
const ICONS: Record<string, string> = {
  arrow:  "...#.../..###../.#.#.#./#..#..#/...#.../...#.../...#...",
  mic:    "...###./..#.#../..#.#../..###../..#.#../.#####./...#...",
  stop:   "......./......./..###../.#####./.#####./..###../.......",
  bars:   "......#/....#.#/....#.#/..#.#.#/..#.#.#/#.#.#.#/#######",
  bolt:   "....##./...##../..##.../.######/...##../..##.../.##....",
  check:  "......./......#/.....#./#...#../.#.#.../..#..../.......",
  chat:   "#######/#.....#/#.#.#.#/#.....#/#######/.##..../.#.....",
};

function PixelIcon({ name }: { name: string }) {
  const rows = (ICONS[name] || ICONS.arrow).split("/");
  const cells: number[][] = [];
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (r[x] === "#") cells.push([x, y]);
  });
  return (
    <svg viewBox="0 0 7 7" aria-hidden style={{ fill: "currentColor", display: "block", maxWidth: "none" }}>
      {cells.map(([x, y], i) => (
        <rect key={i} x={x + 0.08} y={y + 0.08} width={0.84} height={0.84} rx={0.12} />
      ))}
    </svg>
  );
}

/* -- Helpers ----------------------------------------------------------- */
const EXAMPLE_PROMPTS = [
  "Is hafte sabse zyada bikne wali cheez kya thi?",
  "Kya mere paas ₹20,000 rent bharne ke liye paisa hai?",
  "Aaj mera recovery rate kya hai?",
  "Kitne transactions abhi at-risk hain?",
  "Pichle mahine ki top earning category?",
  "In-flight cases mein kya ho raha hai?",
];

const BUILD_STEPS = [
  "Aapka sawaal samajh raha hoon…",
  "Transactions check kar raha hoon…",
  "Analytics run kar raha hoon…",
  "Jawab taiyaar kar raha hoon…",
];

const CATEGORIES = [
  { label: "Sales", icon: "bars" },
  { label: "Cash Flow", icon: "bolt" },
  { label: "Recovery", icon: "arrow" },
  { label: "Analytics", icon: "chat" },
];

function mmss(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

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

function playAudioB64(b64: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const bytes = new Uint8Array(window.atob(b64).split("").map(c => c.charCodeAt(0)));
      const url = URL.createObjectURL(new Blob([bytes.buffer], { type: "audio/mpeg" }));
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      audio.play().catch(resolve);
    } catch { resolve(); }
  });
}

type Phase = "idle" | "thinking";

/* -- Inline CSS -------------------------------------------------------- */
const RAX_CSS = `
.rax-root{
  --rax-fg: var(--d-ink, #f0ede8);
  --rax-mute: var(--d-muted, #8b8b99);
  --rax-faint: var(--d-faint, #555562);
  --rax-glass: rgba(18,18,22,.72);
  --rax-line: rgba(255,255,255,.09);
  --rax-a1: #d4f5e4;
  --rax-a2: #48c88e;
  --rax-a3: #2a9d6f;
  --rax-glow: rgba(72,200,142,.38);
  --rax-ink: #061a0f;
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;
  color:var(--rax-fg);
}
.rax-root :where(button){font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.rax-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

.rax-card{
  --mx:50%;--my:50%;
  position:relative;width:100%;
  border-radius:26px;
  padding:18px 16px 14px 20px;
  background:var(--rax-glass);
  backdrop-filter:blur(28px) saturate(160%);
  -webkit-backdrop-filter:blur(28px) saturate(160%);
  box-shadow:inset 0 0 0 1px var(--rax-line),inset 0 1px 0 rgba(255,255,255,.07),0 24px 70px rgba(0,0,0,.55);
  transition:box-shadow .35s ease;
  overflow:hidden;
}
.rax-card:focus-within{
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.18),inset 0 1px 0 rgba(255,255,255,.10),0 0 0 6px rgba(255,255,255,.03),0 24px 70px rgba(0,0,0,.6);
}
.rax-card[data-nudge="true"]{animation:rax-nudge .45s cubic-bezier(.36,.07,.19,.97)}
@keyframes rax-nudge{20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(2px)}}
.rax-sheen{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit;pointer-events:none;background:radial-gradient(440px circle at var(--mx) var(--my),rgba(255,255,255,.08),transparent 55%);opacity:.9}

.rax-field{position:relative}
.rax-input{display:block;width:100%;min-height:50px;max-height:180px;resize:none;border:0;outline:0;background:transparent;color:var(--rax-fg);font:inherit;font-size:15px;line-height:1.55;letter-spacing:.005em;padding:0;field-sizing:content}
.rax-root .rax-input:focus-visible{outline:none}
.rax-ph{position:absolute;left:0;top:0;right:0;font-size:15px;line-height:1.55;color:#686870;pointer-events:none;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.rax-caret{display:inline-block;width:2px;height:1.05em;margin-left:2px;vertical-align:-2px;background:var(--rax-a2);animation:rax-blink 1s steps(1) infinite}
@keyframes rax-blink{50%{opacity:0}}

.rax-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:14px}
.rax-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px 0 8px;border-radius:9px;font-size:11.5px;font-weight:500;color:#9d9da4;background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.04));box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);transition:color .2s,background .2s,box-shadow .2s,transform .15s}
.rax-chip svg{width:11px;height:11px}
.rax-chip:hover{color:#d4d4d8;background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.07))}
.rax-chip[aria-checked="true"]{color:#fff;background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.08));box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}
.rax-chip:active{transform:scale(.96)}

.rax-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px}
.rax-right{display:flex;align-items:center;gap:6px;flex:none}
.rax-lang{display:inline-flex;align-items:center;height:28px;border-radius:8px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.rax-lang-opt{height:100%;padding:0 10px;font-size:11px;font-weight:600;letter-spacing:.03em;color:var(--rax-mute);transition:background .2s,color .2s}
.rax-lang-opt[aria-pressed="true"]{background:rgba(255,255,255,.1);color:#fff}

.rax-send{position:relative;width:36px;height:36px;margin-left:4px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(160deg,var(--rax-a1),var(--rax-a2) 48%,var(--rax-a3));box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 4px 16px var(--rax-glow);transition:transform .3s cubic-bezier(.16,1,.3,1),filter .2s}
.rax-send svg{width:13px;height:13px;fill:var(--rax-ink)}
.rax-send[data-ready="false"]{filter:saturate(.3) brightness(.7)}
.rax-send[data-ready="true"]{animation:rax-breathe 2.4s ease-in-out infinite}
@keyframes rax-breathe{50%{box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 4px 28px var(--rax-glow),0 0 0 7px rgba(72,200,142,.06)}}
.rax-send:hover{transform:scale(1.07)}
.rax-send:active{transform:scale(.94)}
.rax-send:disabled{pointer-events:none}

.rax-thinking{display:flex;flex-direction:column;gap:12px;padding:2px 4px 0 0}
.rax-think-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.rax-think-title{font-size:14.5px;font-weight:600;letter-spacing:-.01em;color:var(--rax-fg)}
.rax-think-pct{font-size:12px;color:var(--rax-a2);font-variant-numeric:tabular-nums}
.rax-progress{height:3px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:2px}
.rax-progress-bar{display:block;width:100%;height:3px;border-radius:3px;background:linear-gradient(90deg,var(--rax-a3),var(--rax-a2),var(--rax-a1));transform-origin:0 50%;transition:transform .65s cubic-bezier(.16,1,.3,1)}
.rax-steps{display:grid;gap:6px;margin-top:2px}
.rax-step{display:flex;align-items:center;gap:10px;font-size:13px;color:#5a5a62;transition:color .35s}
.rax-step[data-state="active"]{color:var(--rax-fg)}
.rax-step[data-state="done"]{color:#888890}
.rax-step-mark{width:14px;height:14px;display:grid;place-items:center;flex:none}
.rax-step-mark svg{width:12px;height:12px;fill:var(--rax-a2)}
.rax-step-mark i{width:5px;height:5px;border-radius:1px;background:currentColor;opacity:.5}
.rax-step[data-active="true"] .rax-step-mark i{opacity:1;background:var(--rax-a2);animation:rax-spin .8s steps(4) infinite}
@keyframes rax-spin{to{transform:rotate(360deg)}}

.rax-bubble-user{background:rgba(255,255,255,.08);border-radius:18px 18px 4px 18px}
.rax-bubble-rex{background:linear-gradient(160deg,rgba(40,100,70,.35),rgba(32,80,58,.22));border:1px solid rgba(72,200,142,.18);border-radius:18px 18px 18px 4px}

.rax-mode-toggle{display:inline-flex;border-radius:9px;padding:2px;background:rgba(255,255,255,.05);box-shadow:inset 0 0 0 1px rgba(255,255,255,.07);gap:1px}
.rax-mode-btn{height:26px;padding:0 10px;border-radius:7px;font-size:11.5px;font-weight:600;letter-spacing:.01em;color:var(--rax-mute);transition:background .2s,color .2s}
.rax-mode-btn[data-active="true"]{background:linear-gradient(160deg,var(--rax-a2),var(--rax-a3));color:#fff;box-shadow:0 2px 8px rgba(72,200,142,.28)}

.rax-hint{font-size:11px;color:var(--rax-faint);letter-spacing:.01em;text-shadow:0 1px 8px rgba(0,0,0,.8);text-align:center;margin-top:7px}
.rax-hint kbd{font:inherit;font-size:10.5px;padding:1px 5px;border-radius:4px;background:rgba(20,20,24,.7);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);color:#e2e2e7}

@media(max-width:640px){
  .rax-card{padding:14px 12px 12px 14px;border-radius:20px}
  .rax-tools{flex-direction:column;align-items:stretch;gap:8px;margin-top:10px}
  .rax-right{justify-content:flex-end}
  .rax-hint{display:none}
}
@media(prefers-reduced-motion:reduce){
  .rax-root *{animation:none!important;transition-duration:.01ms!important}
}
`;

/* ========================================================================
   Inner content — needs useSearchParams → must be inside Suspense
   ======================================================================== */
function AskRexContent() {
  const { locale } = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const sessionIdParam = params.get("id");

  const { sessions, setCurrentId, save } = useChatHistory();
  const { setStatus: setExplorerStatus } = useExplorerFilter();
  const rexRun = useRexRun();

  /* -- Core state ------------------------------------------------- */
  const [mode, setMode] = useState<"chat" | "voice">("chat");
  const [phase, setPhase] = useState<Phase>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [category, setCategory] = useState(0);
  const [hiLang, setHiLang] = useState(true);
  const [nudge, setNudge] = useState(false);
  const [focused, setFocused] = useState(false);
  const [typed, setTyped] = useState("");
  const [step, setStep] = useState(0);

  /* -- Voice-call state ------------------------------------------- */
  const [callActive, setCallActive] = useState(false);
  const [callMuted, setCallMuted] = useState(false);
  const [callElapsed, setCallElapsed] = useState(0);
  const [rexSpeaking, setRexSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [callProcessing, setCallProcessing] = useState(false); // thinking

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

  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  sessionIdRef.current = sessionId;
  messagesRef.current = messages;

  const loadMetrics = useCallback((s: AbortSignal) => fetchMetrics(s), []);
  const { data: metrics } = useApi(loadMetrics, []);

  /* -- Load session from URL param -------------------------------- */
  useEffect(() => {
    if (!sessionIdParam) {
      setMessages([]); setSessionId(null); setCurrentId(null); return;
    }
    const found = sessions.find((s) => s.id === sessionIdParam);
    if (found) { setMessages(found.messages); setSessionId(found.id); setCurrentId(found.id); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdParam, sessions.length]);

  /* -- Auto-scroll ------------------------------------------------ */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, phase]);

  /* -- Animated typing placeholder ------------------------------- */
  useEffect(() => {
    let i = 0, n = 0, back = false;
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      const full = EXAMPLE_PROMPTS[i % EXAMPLE_PROMPTS.length];
      if (!back) {
        n++; setTyped(full.slice(0, n));
        if (n >= full.length) { back = true; id = setTimeout(tick, 2200); return; }
        id = setTimeout(tick, 28 + Math.random() * 38);
      } else {
        n = Math.max(0, n - 3); setTyped(full.slice(0, n));
        if (n === 0) { back = false; i++; id = setTimeout(tick, 360); return; }
        id = setTimeout(tick, 12);
      }
    };
    id = setTimeout(tick, 900);
    return () => clearTimeout(id);
  }, []);

  /* -- Glass sheen ------------------------------------------------ */
  const sheen = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget, r = el.getBoundingClientRect();
    el.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
    el.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
  };

  /* -- Persist session -------------------------------------------- */
  const persistSession = useCallback((msgs: ChatMessage[], sid: string, title: string) => {
    const s: ChatSession = { id: sid, title, messages: msgs, createdAt: msgs[0]?.ts ?? Date.now(), updatedAt: Date.now() };
    save(s);
  }, [save]);

  /* -- Build-steps animation -------------------------------------- */
  const runSteps = () => {
    setStep(0); setPhase("thinking");
    BUILD_STEPS.forEach((_, i) => {
      const t = setTimeout(() => setStep(i + 1), (i + 1) * 680);
      stepTimers.current.push(t);
    });
  };
  const clearSteps = () => { stepTimers.current.forEach(clearTimeout); stepTimers.current = []; };

  /* -- Send message — returns reply text ------------------------- */
  const sendMessage = async (text: string): Promise<string | null> => {
    const trimmed = text.trim();
    if (!trimmed || phase !== "idle") return null;
    setInput("");

    const userMsg: ChatMessage = { role: "user", text: trimmed, ts: Date.now() };
    let sid = sessionIdRef.current;
    const isNew = !sid;
    if (!sid) {
      sid = generateChatId();
      setSessionId(sid);
      setCurrentId(sid);
    }
    const nextMsgs = [...messagesRef.current, userMsg];
    setMessages(nextMsgs);
    runSteps();
    if (isNew) router.replace(`/mission-control/ask?id=${sid}`);

    try {
      const reply = await sendAssistantChat(trimmed, hiLang ? "hi" : "en", {
        route: "/mission-control/ask", focused_transaction_id: null, class_filter: null,
      });
      clearSteps(); setPhase("idle");
      const rexMsg: ChatMessage = { role: "rex", text: reply.reply, ts: Date.now() };
      const finalMsgs = [...nextMsgs, rexMsg];
      setMessages(finalMsgs);
      persistSession(finalMsgs, sid, titleFrom(trimmed));
      void handleAction(reply.action, { userText: trimmed, rexText: reply.reply });
      return reply.reply;
    } catch {
      clearSteps(); setPhase("idle");
      const errMsg: ChatMessage = { role: "rex", text: "Kuch gadbad ho gayi. Dobara try karein.", ts: Date.now() };
      const finalMsgs = [...nextMsgs, errMsg];
      setMessages(finalMsgs);
      persistSession(finalMsgs, sid!, titleFrom(trimmed));
      return null;
    }
  };

  /* -- Voice call: add a message directly (no phase check) ------- */
  const addVoiceMessage = useCallback((role: "user" | "rex", text: string) => {
    setMessages((prev) => {
      const msg: ChatMessage = { role, text, ts: Date.now() };
      const next = [...prev, msg];
      // Persist
      let sid = sessionIdRef.current;
      if (!sid) return next; // session created on first STT result
      persistSession(next, sid, titleFrom(next[0]?.text ?? "Voice chat"));
      return next;
    });
  }, [persistSession]);

  /* -- Act on a structured action from the assistant — the same action
     types RexAssistant's floating widget handles, minus the two that need
     its operator-confirmation UI (run_recovery, set_status); those stay
     silent here rather than acting without confirmation. ------------- */
  const handleAction = useCallback(async (
    action: AssistantAction | null,
    turn?: { userText: string; rexText: string },
  ) => {
    if (!action) return;
    try {
      switch (action.type) {
        case "navigate":
          if (action.route) {
            setExplorerStatus(action.status ?? "");
            router.push(action.route);
          }
          return;
        case "add_note":
          if (action.transaction_id && action.note) {
            await addNote(action.transaction_id, action.note);
            addVoiceMessage("rex", "Noted.");
          }
          return;
        case "resolve_escalation":
          if (action.escalation_id != null) {
            await resolveEscalation(action.escalation_id);
            addVoiceMessage("rex", "Escalation resolved.");
          }
          return;
        case "create_payment_link":
          if (action.transaction_id) {
            const res = await createPaymentLink(action.transaction_id);
            addVoiceMessage("rex", `Payment link ready: ${res.url}`);
          }
          return;
        case "draft_message":
          if (action.transaction_id && action.prompt) {
            const { draft } = await draftMessage(action.transaction_id, action.prompt);
            addVoiceMessage("rex", draft);
          }
          return;
        case "send_message":
          if (action.transaction_id && action.prompt) {
            const { draft } = await draftMessage(action.transaction_id, action.prompt);
            await sendMessageApi(action.transaction_id, draft, true);
            addVoiceMessage("rex", `Sent: ${draft}`);
          }
          return;
        case "simulate_case":
          {
            const row = await simulateCase(action.failure_class ?? undefined);
            addVoiceMessage("rex", `Created a new case for ${row.customer_name ?? "a customer"}.`);
          }
          return;
        case "call_customer":
          if (action.customer_name) {
            const needle = action.customer_name.toLowerCase();
            const match = CUSTOMERS.find((c) => c.name.toLowerCase().includes(needle));
            if (match) {
              const callParams = new URLSearchParams({ customer: match.id, reason: "custom" });
              if (action.call_reason) callParams.set("custom", action.call_reason);
              router.push(`/mission-control/call-customer/call?${callParams.toString()}`);
            } else {
              addVoiceMessage("rex", `I couldn't find a customer named "${action.customer_name}".`);
            }
          }
          return;
        case "start_campaign":
          // Hand off to the floating popup — this page's own chat stays a
          // one-shot thread, but a multi-step campaign draft keeps going in
          // the globally-mounted widget instead of dead-ending here.
          if (action.template) {
            if (turn) {
              rexRun.chat.push("user", turn.userText);
              rexRun.chat.push("rex", turn.rexText);
            }
            if (action.ready_to_send && action.audience) {
              const saved = finalizeCampaign(action.template, action.audience, "chat");
              rexRun.chat.push("rex", `Sent "${saved.name}" to ${saved.audienceCount} customers.`);
            } else {
              rexRun.setCampaign({ template: action.template, audience: action.audience ?? null, history: action.history ?? [] });
            }
            rexRun.openPanel();
            router.push("/mission-control/whatsapp");
          }
          return;
      }
    } catch {
      addVoiceMessage("rex", "Kuch gadbad ho gayi us action mein. Dobara try karein.");
    }
  }, [router, setExplorerStatus, addVoiceMessage, rexRun]);

  /* -- Voice call: process one speech utterance ------------------- */
  const processSpeech = useCallback(async (wavB64: string) => {
    if (!callActiveRef.current || callProcessingRef.current) return;
    setCallProcessing(true);

    try {
      // 1. STT via Sarvam
      const wavBytes = new Uint8Array(window.atob(wavB64).split("").map(c => c.charCodeAt(0)));
      const blob = new Blob([wavBytes.buffer], { type: "audio/wav" });
      const fd = new FormData();
      fd.append("file", blob, "recording.wav");
      fd.append("language_code", "hi-IN");
      fd.append("mode", "codemix");
      const sttRes = await fetch(`${API_BASE}/api/v1/assistant/stt`, { method: "POST", body: fd });
      if (!sttRes.ok) { setCallProcessing(false); return; }
      const { transcript } = await sttRes.json() as { transcript: string };
      if (!transcript?.trim()) { setCallProcessing(false); return; }

      // Ensure session exists
      if (!sessionIdRef.current) {
        const sid = generateChatId();
        setSessionId(sid);
        setCurrentId(sid);
        router.replace(`/mission-control/ask?id=${sid}`);
      }
      addVoiceMessage("user", transcript);

      // 2. Assistant
      const replyData = await sendAssistantChat(transcript, "hi", {
        route: "/mission-control/ask", focused_transaction_id: null, class_filter: null,
      });
      const replyText = replyData.reply;

      // 3. Fire TTS fetch immediately — in parallel with updating the UI
      const ttsPromise = fetch(`${API_BASE}/api/v1/assistant/tts`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: replyText, locale: "hi" }),
      });
      addVoiceMessage("rex", replyText);

      // 4. Play audio — use blob URL directly (no slow btoa conversion)
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

      // Act after REX has finished speaking the confirmation — a navigate
      // here unmounts the page (and so ends the call), same as the floating
      // assistant's immediate dispatch.
      await handleAction(replyData.action, { userText: transcript, rexText: replyText });
    } catch {
      /* silent error — keep call alive */
    } finally {
      setCallProcessing(false);
    }
  }, [addVoiceMessage, router, setCurrentId, handleAction]);

  /* -- Voice call: start ------------------------------------------ */
  const startCall = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      mediaStreamRef.current = stream;
    } catch {
      return; // mic denied — silently no-op
    }

    setCallActive(true);
    setCallMuted(false);
    setCallElapsed(0);
    setRexSpeaking(false);
    setUserSpeaking(false);
    setCallProcessing(false);
    timerRef.current = setInterval(() => setCallElapsed(e => e + 1), 1000);

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
              const b64 = bufToB64(encodeWav(merged, 16000));
              processSpeech(b64);
            }
            samplesBuffer = [];
          }
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
    } catch { /* AudioContext unavailable */ }
  };

  /* -- Voice call: end -------------------------------------------- */
  const endCall = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (processorRef.current) { try { processorRef.current.disconnect(); } catch {/**/} processorRef.current = null; }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {/**/} audioCtxRef.current = null; }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null; }
    setCallActive(false); setRexSpeaking(false); setUserSpeaking(false); setCallProcessing(false);
  }, []);

  useEffect(() => () => endCall(), [endCall]);

  const toggleMute = () => {
    const next = !callMuted;
    setCallMuted(next);
    mediaStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
  };

  /* -- Chat submit ------------------------------------------------ */
  const handleSubmit = () => {
    if (!input.trim()) { setNudge(true); setTimeout(() => setNudge(false), 500); inputRef.current?.focus(); return; }
    sendMessage(input);
  };
  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };
  const usePrompt = (text: string) => { setInput(text); inputRef.current?.focus(); };

  const empty = !input;
  const isEmpty = messages.length === 0 && phase === "idle";

  /* -- Context snapshot ------------------------------------------ */
  function ContextSnap() {
    if (!metrics) return null;
    return (
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-[14px] p-2.5" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}>
        {[
          { label: "Recovered", value: inr(metrics.recovered_inr, { compact: true }), color: "var(--d-ok)" },
          { label: "At-Risk", value: inr(metrics.at_risk_inr, { compact: true }), color: "var(--d-warn)" },
          { label: "GRRR", value: pct(metrics.grrr), color: "var(--d-ink)" },
        ].map((s) => (
          <div key={s.label}>
            <div className="font-mono text-[11.5px] font-semibold" style={{ color: s.color }}>{s.value}</div>
            <div className="mt-0.5 text-[10px]" style={{ color: "var(--d-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>
    );
  }

  /* -- Voice call status label ----------------------------------- */
  const callStatusLine = callProcessing
    ? "REX soch raha hai…"
    : rexSpeaking
      ? "REX bol raha hai…"
      : userSpeaking
        ? "Aap bol rahe hain…"
        : "Sun raha hoon…";

  return (
    <div className="rax-root flex h-full flex-col" style={{ background: "var(--d-bg)" }}>
      <style>{RAX_CSS}</style>

      {/* -- Mode toggle bar -------------------------------------- */}
      <div className="flex shrink-0 items-center gap-3 px-4 pt-4 pb-1">
        <div className="rax-mode-toggle" role="group" aria-label="Interaction mode">
          {(["chat", "voice"] as const).map((m) => (
            <button key={m} type="button" className="rax-mode-btn" data-active={mode === m ? "true" : "false"}
              onClick={() => { if (m !== mode && callActive) endCall(); setMode(m); }}>
              {m === "chat" ? "Chat" : "Voice"}
            </button>
          ))}
        </div>
        <div className="rax-lang" role="group">
          {[{ label: "हि", hi: true }, { label: "EN", hi: false }].map((o) => (
            <button key={o.label} type="button" className="rax-lang-opt" aria-pressed={hiLang === o.hi} onClick={() => setHiLang(o.hi)}>{o.label}</button>
          ))}
        </div>
      </div>

      {/* -- Messages / empty state ------------------------------- */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {mode === "chat" ? (
          isEmpty ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <div className="relative mb-5">
                <div className="grid h-20 w-20 place-items-center text-[52px]"
                  style={{ color: "var(--d-ink)", fontFamily: '"Tiny5Duo", monospace', fontWeight: 700 }}>
                  R
                </div>
              </div>
              <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.025em]" style={{ color: "var(--d-ink)" }}>
                REX ko kuch bhi poochho
              </h1>
              <p className="mt-2 max-w-[340px] text-[12.5px] leading-relaxed" style={{ color: "var(--d-muted)" }}>
                Financial analytics, recovery insights, cash flow questions — Hindi mein, English mein, ya dono mein.
              </p>
              <div className="mt-7 flex max-w-[540px] flex-wrap justify-center gap-2">
                {EXAMPLE_PROMPTS.slice(0, 5).map((p, i) => (
                  <button key={i} onClick={() => usePrompt(p)} className="rax-chip">{p}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2 px-4 py-4">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div key={msg.ts} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "rex" && (
                      <span className="mr-2 mt-1 shrink-0 self-start text-[15px] font-bold"
                        style={{ color: "var(--d-ink)", fontFamily: '"Tiny5Duo", monospace' }}>R</span>
                    )}
                    <div style={{ maxWidth: "70%" }}>
                      <div className={`px-4 py-3 text-[13px] leading-relaxed ${msg.role === "user" ? "rax-bubble-user" : "rax-bubble-rex"}`}>
                        {msg.text}
                        {msg.role === "rex" && messages.indexOf(msg) === 1 && <ContextSnap />}
                      </div>
                      <div className={`mt-0.5 text-[10px] ${msg.role === "user" ? "text-right" : ""}`} style={{ color: "var(--d-faint)" }}>
                        {msg.role === "rex" ? "REX" : "Aap"} · {new Date(msg.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )
        ) : (
          /* -- Voice mode: call transcript --------------------- */
          <div className="flex flex-col items-center px-4 py-6">
            {/* REX avatar */}
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
              <div className="text-[15px] font-semibold" style={{ color: "var(--d-ink)" }}>REX</div>
              {!callActive && (
                <button onClick={startCall}
                  className="rounded-md px-6 py-3 text-[15px] font-semibold text-white"
                  style={{ background: "linear-gradient(160deg, #48c88e, #2a9d6f)", boxShadow: "0 4px 16px rgba(72,200,142,.35)" }}>
                  Call
                </button>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px]" style={{ color: "var(--d-muted)" }}>
              {callActive && (
                <span className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                  style={{ background: "rgba(225,29,72,.85)", color: "#fff" }}>
                  <motion.span style={{ width: 5, height: 5, borderRadius: 999, background: "#fff" }}
                    animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
                  Live
                </span>
              )}
              {callActive ? callStatusLine : "Paytm Business Intelligence"}
              {callActive && callElapsed > 0 && ` · ${mmss(callElapsed)}`}
            </div>

            {/* Transcript bubbles */}
            {messages.length > 0 && (
              <div className="mt-4 w-full max-w-[420px] space-y-2">
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <motion.div key={msg.ts} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[82%] rounded-xl px-3 py-2 text-[12.5px] leading-snug ${msg.role === "user" ? "rax-bubble-user" : "rax-bubble-rex"}`}>
                        <div className="mb-0.5 text-[9px] opacity-50">{msg.role === "rex" ? "REX" : "Aap"}</div>
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {callProcessing && (
                  <div className="flex justify-start">
                    <div className="rax-bubble-rex rounded-xl px-3 py-2 text-[12px]" style={{ color: "var(--d-muted)" }}>
                      <span className="inline-flex gap-1">
                        {[0, 1, 2].map(i => (
                          <motion.span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#48c88e", display: "inline-block" }}
                            animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
                        ))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!callActive && messages.length === 0 && (
              <div className="mt-8 max-w-[300px] text-center text-[12px] leading-relaxed" style={{ color: "var(--d-muted)" }}>
                REX se bolkar poochho — yeh sunेगा, samjhega, aur Hindi mein jawab dega.
              </div>
            )}
          </div>
        )}
      </div>

      {/* -- Bottom controls -------------------------------------- */}
      <div className="shrink-0 px-4 pb-5 pt-2" style={{ background: "var(--d-bg)" }}>
        {mode === "chat" ? (
          <>
            <div ref={cardRef} className="rax-card" data-nudge={nudge ? "true" : "false"} onPointerMove={sheen}>
              <span className="rax-sheen" aria-hidden />
              {phase === "idle" && (
                <>
                  <div className="rax-field">
                    <label htmlFor="rax-input" className="rax-sr">Ask REX anything</label>
                    <textarea ref={inputRef} id="rax-input" className="rax-input" rows={2}
                      value={input} onChange={e => setInput(e.target.value)}
                      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onKeyDown={handleKey} />
                    {empty && (
                      <span className="rax-ph" aria-hidden>
                        {focused ? "REX se kuch bhi poochho…" : typed}
                        {!focused && <i className="rax-caret" />}
                      </span>
                    )}
                  </div>
                  <div className="rax-chips" role="radiogroup">
                    {CATEGORIES.map((c, i) => (
                      <button key={c.label} type="button" role="radio" aria-checked={category === i} className="rax-chip" onClick={() => setCategory(i)}>
                        <PixelIcon name={c.icon} /><span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="rax-tools">
                    <div />
                    <div className="rax-right">
                      <button type="button" className="rax-send" data-ready={empty ? "false" : "true"}
                        disabled={phase !== "idle"} aria-label="Send" onClick={handleSubmit}>
                        <PixelIcon name="arrow" />
                      </button>
                    </div>
                  </div>
                </>
              )}
              {phase === "thinking" && (
                <div className="rax-thinking">
                  <div className="rax-think-head">
                    <span className="rax-think-title">REX soch raha hai…</span>
                    <span className="rax-think-pct">{Math.round((step / BUILD_STEPS.length) * 100)}%</span>
                  </div>
                  <div className="rax-progress">
                    <span className="rax-progress-bar" style={{ transform: `scaleX(${step / BUILD_STEPS.length})` }} />
                  </div>
                  <ol className="rax-steps">
                    {BUILD_STEPS.map((s, i) => (
                      <li key={s} className="rax-step"
                        data-state={i < step ? "done" : i === step - 1 ? "active" : "todo"}
                        data-active={i === step - 1 ? "true" : "false"}>
                        <span className="rax-step-mark" aria-hidden>
                          {i < step ? <PixelIcon name="check" /> : <i />}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
            <p className="rax-hint">
              <kbd>Enter</kbd> to send <span aria-hidden>/</span> <kbd>Shift</kbd>+<kbd>Enter</kbd> for new line
            </p>
          </>
        ) : (
          /* Voice mode controls — only shown when call is active */
          callActive ? (
            <div className="flex items-center justify-center gap-4 py-2">
              <button onClick={toggleMute} aria-label={callMuted ? "Unmute" : "Mute"}
                className="grid h-12 w-12 place-items-center rounded-full transition-all"
                style={{ background: callMuted ? "#e11d48" : "rgba(255,255,255,.1)", color: "#fff" }}>
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
              <button onClick={endCall} aria-label="End call"
                className="grid h-14 w-14 place-items-center rounded-full text-white"
                style={{ background: "#e11d48", boxShadow: "0 4px 20px rgba(225,29,72,.4)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                </svg>
              </button>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

export default function AskRexPage() {
  return (
    <Suspense fallback={null}>
      <AskRexContent />
    </Suspense>
  );
}

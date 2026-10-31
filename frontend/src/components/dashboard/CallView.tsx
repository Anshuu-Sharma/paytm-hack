"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { API_BASE } from "@/lib/api";
import { useDash } from "@/lib/dashboard/i18n";
import CrystalizedBall from "@/components/CrystalizedBall";

type Turn = { speaker: "AGENT" | "USER"; text: string };

function mmss(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// Convert PCM Float32 audio samples to a standard 16kHz mono 16-bit WAV ArrayBuffer
function encodeWav(samples: Float32Array, sampleRate: number = 16000): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 for mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function playAudioBase64(base64Data: string, onPlay: () => void, onEnd: () => void) {
  try {
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes.buffer], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onplay = onPlay;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      onEnd();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      onEnd();
    };
    audio.play().catch(() => onEnd());
  } catch {
    onEnd();
  }
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
  const { d } = useDash();
  const c = d.convo;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [ended, setEnded] = useState(false);
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [speaking, setSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingAudioRef = useRef(false);
  const mutedRef = useRef(false);
  const speakingRef = useRef(false);

  mutedRef.current = muted;
  speakingRef.current = speaking;

  const first = (customerName || "").split(" ")[0];

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const processAudioQueue = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingAudioRef.current = false;
      setSpeaking(false);
      return;
    }
    isPlayingAudioRef.current = true;
    setSpeaking(true);
    const nextChunk = audioQueueRef.current.shift()!;
    playAudioBase64(
      nextChunk,
      () => setSpeaking(true),
      () => {
        processAudioQueue();
      }
    );
  };

  const enqueueAudio = (b64: string) => {
    audioQueueRef.current.push(b64);
    if (!isPlayingAudioRef.current) {
      processAudioQueue();
    }
  };

  const stopAudioCapture = () => {
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        /* ignore */
      }
      processorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close();
      } catch {
        /* ignore */
      }
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  const hangUp = () => {
    stopTimer();
    stopAudioCapture();
    if (wsRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ type: "hangup" }));
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
    setStatus("disconnected");
    setEnded(true);
    setSpeaking(false);
    setUserSpeaking(false);
    audioQueueRef.current = [];
    isPlayingAudioRef.current = false;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      stopAudioCapture();
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const begin = async () => {
    setError(null);
    setTurns([]);
    setEnded(false);
    setStatus("connecting");
    setElapsed(0);
    audioQueueRef.current = [];
    isPlayingAudioRef.current = false;

    // 1. Acquire mic permission
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;
    } catch {
      setError(c.micDenied);
      setStatus("disconnected");
      return;
    }

    // 2. Open WebSocket to backend Sarvam Voice Agent
    const wsBase = API_BASE.replace(/^http/, "ws");
    const wsUrl = `${wsBase}/api/v1/voice-call/${encodeURIComponent(txnId)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      stopTimer();
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

      // 3. Set up AudioContext with VAD & WAV Encoder for clean STT
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx({ sampleRate: 16000 });
        audioContextRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        let samplesBuffer: Float32Array[] = [];
        let silenceCount = 0;
        let isRecordingUtterance = false;

        processor.onaudioprocess = (e) => {
          if (mutedRef.current || wsRef.current?.readyState !== WebSocket.OPEN) {
            return;
          }

          // Do not listen to mic while agent audio is playing to prevent self-echo
          if (speakingRef.current || isPlayingAudioRef.current) {
            return;
          }

          const inputData = e.inputBuffer.getChannelData(0);

          // Calculate RMS volume level
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);

          const SPEECH_THRESHOLD = 0.018;

          if (rms > SPEECH_THRESHOLD) {
            // Speech detected
            isRecordingUtterance = true;
            silenceCount = 0;
            setUserSpeaking(true);
            samplesBuffer.push(new Float32Array(inputData));
          } else if (isRecordingUtterance) {
            // Silence following speech
            samplesBuffer.push(new Float32Array(inputData));
            silenceCount++;

            // ~800ms of silence (each buffer is ~256ms at 16kHz)
            if (silenceCount >= 3) {
              setUserSpeaking(false);
              isRecordingUtterance = false;
              silenceCount = 0;

              // Check if we captured at least 0.6s of speech
              const totalSamples = samplesBuffer.reduce((acc, b) => acc + b.length, 0);
              if (totalSamples >= 9600) {
                const merged = new Float32Array(totalSamples);
                let offset = 0;
                for (const chunk of samplesBuffer) {
                  merged.set(chunk, offset);
                  offset += chunk.length;
                }

                // Encode to standard 16kHz mono WAV
                const wavBuffer = encodeWav(merged, 16000);
                const base64Wav = arrayBufferToBase64(wavBuffer);

                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: "audio", data: base64Wav }));
                }
              }
              samplesBuffer = [];
            }
          }
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
      } catch (err) {
        console.warn("AudioContext setup error", err);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "turn") {
          setTurns((t) => [...t, { speaker: msg.speaker, text: msg.text }]);
        } else if (msg.type === "audio_chunk") {
          if (msg.data) {
            enqueueAudio(msg.data);
          }
        } else if (msg.type === "link_sent") {
          onLinkSent?.();
          setTurns((t) => [...t, { speaker: "AGENT", text: `🔗 ${c.linkSent}` }]);
        } else if (msg.type === "ended") {
          hangUp();
        } else if (msg.type === "error") {
          setError(msg.message || "Call error occurred");
        }
      } catch {
        /* invalid frame */
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection failed");
      hangUp();
    };

    ws.onclose = () => {
      if (status === "connected" || status === "connecting") {
        stopTimer();
        stopAudioCapture();
        setStatus("disconnected");
        setEnded(true);
      }
    };
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
    }
  };

  const connecting = status === "connecting";
  const connected = status === "connected";
  const live = connecting || connected;

  const statusLine = connecting
    ? c.connecting
    : connected
      ? speaking
        ? c.speaking
        : userSpeaking
          ? "Aap bol rahe hain..."
          : c.listening
      : ended
        ? `${c.callEnded} · ${mmss(elapsed)}`
        : c.aiAgent;

  return (
    <div className="flex h-full flex-col" style={{ background: "#0b141a", color: "#e9edef" }}>
      {/* Caller identity */}
      <div className="flex flex-col items-center" style={{ paddingTop: "10%" }}>
        <div style={{ width: 150, height: 150 }}>
          <CrystalizedBall
            preset={speaking ? "aurora" : userSpeaking ? "frost" : "eclipse"}
            color={speaking ? "#25d366" : userSpeaking ? "#38bdf8" : "#9fb3c8"}
            size={0.85}
            speed={speaking || userSpeaking ? 1.7 : 0.5}
            glow={speaking ? 1.3 : userSpeaking ? 1.1 : 0.75}
            crackle={speaking ? 0.9 : userSpeaking ? 0.65 : 0.4}
            flares={speaking || userSpeaking ? 0.7 : 0.35}
            sparks={speaking || userSpeaking ? 0.7 : 0.25}
            haze={speaking || userSpeaking ? 0.9 : 0.7}
            interactive={false}
            paused={false}
          />
        </div>
        <div className="mt-1 flex items-center gap-1.5">
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
        {live ? (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={toggleMute}
              className="grid place-items-center rounded-full"
              style={{
                width: 40,
                height: 40,
                background: muted ? "#e11d48" : "rgba(255,255,255,0.12)",
                color: "#fff",
              }}
              aria-label={muted ? c.unmute : c.mute}
            >
              {muted ? (
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

"use client";

import { useCallback, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";

// Minimal shims for the Web Speech API (fallback)
interface SpeechRecognitionResultLike {
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  results: { 0: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SRCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Speak REX's reply: Sarvam Bulbul TTS from backend, falling back to browser voice.
async function speakText(text: string, locale: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/assistant/tts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, locale }),
    });
    if (res.status === 200) {
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      return;
    }
  } catch {
    /* fall through to browser voice */
  }
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = locale === "hi" ? "hi-IN" : "en-IN";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* no speech synthesis available — silently skip */
  }
}

export function useSpeech(locale: string) {
  const [listening, setListening] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackRecRef = useRef<SpeechRecognitionLike | null>(null);

  const sttSupported =
    typeof window !== "undefined" &&
    (Boolean(typeof navigator !== "undefined" && navigator.mediaDevices && window.MediaRecorder) ||
      getRecognitionCtor() !== null);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (fallbackRecRef.current) {
      try {
        fallbackRecRef.current.stop();
      } catch {
        /* ignore */
      }
      fallbackRecRef.current = null;
    }
    setListening(false);
  }, []);

  const listen = useCallback(
    async (onResult: (text: string) => void) => {
      // Primary: Capture audio via MediaRecorder and transcribe using Sarvam Saaras
      if (typeof window !== "undefined" && navigator.mediaDevices?.getUserMedia && window.MediaRecorder) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          audioChunksRef.current = [];

          // Choose mime type supported by browser
          const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : MediaRecorder.isTypeSupported("audio/webm")
              ? "audio/webm"
              : MediaRecorder.isTypeSupported("audio/mp4")
                ? "audio/mp4"
                : "";

          const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };

          recorder.onstop = async () => {
            const tracks = stream.getTracks();
            tracks.forEach((t) => t.stop());
            streamRef.current = null;

            if (audioChunksRef.current.length === 0) return;
            const audioBlob = new Blob(audioChunksRef.current, {
              type: recorder.mimeType || "audio/webm",
            });
            audioChunksRef.current = [];

            try {
              const formData = new FormData();
              formData.append("file", audioBlob, "recording.webm");
              formData.append("language_code", locale === "hi" ? "hi-IN" : "en-IN");
              formData.append("mode", "codemix");

              const res = await fetch(`${API_BASE}/api/v1/assistant/stt`, {
                method: "POST",
                body: formData,
              });

              if (res.ok) {
                const data = await res.json();
                if (data.transcript) {
                  onResult(data.transcript);
                }
              }
            } catch {
              /* upload failed */
            }
          };

          recorder.start(250);
          setListening(true);
          return;
        } catch {
          /* mic permission denied or MediaRecorder failed — try Web Speech API */
        }
      }

      // Fallback: Web Speech API
      const Ctor = getRecognitionCtor();
      if (!Ctor) {
        setListening(false);
        return;
      }
      const rec = new Ctor();
      rec.lang = locale === "hi" ? "hi-IN" : "en-IN";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const text = e.results[0][0].transcript;
        if (text) onResult(text);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      fallbackRecRef.current = rec;
      setListening(true);
      rec.start();
    },
    [locale],
  );

  const speak = useCallback((text: string) => speakText(text, locale), [locale]);

  return { listening, listen, stop, speak, sttSupported };
}

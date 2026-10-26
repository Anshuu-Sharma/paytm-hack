"use client";

import { useCallback, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";

// Minimal shims for the Web Speech API (not in the DOM lib types).
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

// Speak REX's reply: try the ElevenLabs voice from the backend, else the browser.
async function speakText(text: string, locale: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/assistant/tts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.status === 200) {
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      return;
    }
  } catch {
    /* fall through to the browser voice */
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
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const sttSupported = getRecognitionCtor() !== null;

  const listen = useCallback(
    (onResult: (text: string) => void) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) return;
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
      recRef.current = rec;
      setListening(true);
      rec.start();
    },
    [locale],
  );

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const speak = useCallback((text: string) => speakText(text, locale), [locale]);

  return { listening, listen, stop, speak, sttSupported };
}

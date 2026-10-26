"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sendAssistantChat } from "@/lib/dashboard/api";
import type { AssistantContext, AssistantReply } from "@/lib/dashboard/api";
import { useDash } from "@/lib/dashboard/i18n";

export interface ChatMsg {
  id: number;
  role: "user" | "rex";
  text: string;
}

const STORAGE_KEY = "rex-chat";

// The thread is a per-viewer convenience, so it lives in localStorage and
// survives a reload. Reads/writes are guarded (SSR, private windows, blocked
// storage) so the panel always renders even when it comes back empty.
function loadMessages(): ChatMsg[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ChatMsg[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMessages(messages: ChatMsg[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    /* storage unavailable — the thread simply won't persist this session */
  }
}

/**
 * Holds the REX chat thread and talks to POST /assistant/chat. State is only ever
 * set inside async callbacks (never during render or an effect body), so it stays
 * clear of the strict react-hooks lint rules. Action dispatch lives in the panel;
 * this hook just owns the conversation and returns the model's structured reply.
 */
export function useAssistant() {
  const { d, locale } = useDash();
  const [messages, setMessages] = useState<ChatMsg[]>(loadMessages);
  const [busy, setBusy] = useState(false);
  const idRef = useRef(messages.reduce((max, m) => Math.max(max, m.id + 1), 0));

  // Persist the thread whenever it changes (side effect only — no setState here).
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  const push = useCallback((role: ChatMsg["role"], text: string) => {
    setMessages((m) => [...m, { id: idRef.current++, role, text }]);
  }, []);

  const send = useCallback(
    async (text: string, context: AssistantContext): Promise<AssistantReply | null> => {
      push("user", text);
      setBusy(true);
      try {
        const res = await sendAssistantChat(text, locale, context);
        if (res.reply) push("rex", res.reply);
        return res;
      } catch {
        push("rex", d.assistant.error);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [push, locale, d.assistant.error],
  );

  const clear = useCallback(() => setMessages([]), []);

  return { messages, busy, send, push, clear };
}

"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ChatSession } from "./chatHistory";
import { eraseSession, loadSessions, persistSession } from "./chatHistory";

interface ChatHistoryCtx {
  sessions: ChatSession[];
  currentId: string | null;
  setCurrentId: (id: string | null) => void;
  save: (s: ChatSession) => void;
  remove: (id: string) => void;
  reload: () => void;
}

const Ctx = createContext<ChatHistoryCtx | null>(null);

export function ChatHistoryProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setSessions(loadSessions());
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener("storage", reload);
    return () => window.removeEventListener("storage", reload);
  }, [reload]);

  const save = useCallback(
    (s: ChatSession) => {
      persistSession(s);
      reload();
    },
    [reload],
  );

  const remove = useCallback(
    (id: string) => {
      eraseSession(id);
      reload();
      setCurrentId((prev) => (prev === id ? null : prev));
    },
    [reload],
  );

  return (
    <Ctx.Provider value={{ sessions, currentId, setCurrentId, save, remove, reload }}>
      {children}
    </Ctx.Provider>
  );
}

export function useChatHistory() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useChatHistory must be inside ChatHistoryProvider");
  return ctx;
}

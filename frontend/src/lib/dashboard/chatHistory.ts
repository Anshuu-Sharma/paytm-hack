export interface ChatMessage {
  role: "user" | "rex";
  text: string;
  ts: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "rex_chats_v1";

export function generateChatId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function titleFrom(text: string): string {
  const t = text.trim();
  return t.length > 42 ? t.slice(0, 40) + "…" : t;
}

export function relativeDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as ChatSession[];
  } catch {
    return [];
  }
}

export function persistSession(session: ChatSession): void {
  const rest = loadSessions().filter((s) => s.id !== session.id);
  rest.unshift(session);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest.slice(0, 60)));
  } catch {
    /* storage full — silently skip */
  }
}

export function eraseSession(id: string): void {
  const rest = loadSessions().filter((s) => s.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {
    /* ignore */
  }
}

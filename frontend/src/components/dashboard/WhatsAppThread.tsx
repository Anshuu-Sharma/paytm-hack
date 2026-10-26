"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { ConversationMessage } from "@/lib/dashboard/types";

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function Ticks({ status }: { status: string }) {
  const read = status === "READ";
  return (
    <span style={{ color: read ? "#53bdeb" : "rgba(0,0,0,0.4)", fontSize: 11, lineHeight: 1 }}>
      ✓✓
    </span>
  );
}

function LinkCard({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 block rounded-md px-2 py-1.5 transition-colors hover:brightness-95"
      style={{ background: "rgba(0,0,0,0.05)", borderLeft: "3px solid #25d366", textDecoration: "none" }}
    >
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "#075e54" }}>Secure payment link</div>
      <div style={{ fontSize: 10, color: "#3b6ef0", wordBreak: "break-all" }}>{url}</div>
      <div
        className="mt-1 rounded px-2 py-1 text-center"
        style={{ background: "#25d366", color: "#0b141a", fontSize: 10.5, fontWeight: 700 }}
      >
        Pay now →
      </div>
    </a>
  );
}

export default function WhatsAppThread({
  messages,
  customerName,
  typingWho = null,
}: {
  messages: ConversationMessage[];
  customerName: string;
  typingWho?: "agent" | "customer" | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, typingWho]);

  const initial = (customerName || "?").charAt(0).toUpperCase();

  return (
    <div className="flex h-full flex-col" style={{ background: "#e5ddd5" }}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-2.5 pb-1.5"
        style={{ background: "#075e54", color: "#fff", paddingTop: "14%" }}
      >
        <span style={{ fontSize: 15, opacity: 0.9 }}>‹</span>
        <span
          className="grid place-items-center rounded-full"
          style={{ width: 26, height: 26, background: "#25d366", fontSize: 12, fontWeight: 700 }}
        >
          {initial}
        </span>
        <div className="leading-tight">
          <div style={{ fontSize: 12, fontWeight: 600 }}>{customerName}</div>
          <div style={{ fontSize: 9, opacity: 0.8 }}>online</div>
        </div>
        <div className="ml-auto flex gap-3 pr-1" style={{ fontSize: 12, opacity: 0.9 }}>
          <span>📞</span>
          <span>⋮</span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-1.5 overflow-y-auto px-2.5 py-2"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M0 0h1v1H0z' fill='%23000' opacity='0.02'/%3E%3C/svg%3E\")",
        }}
      >
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            if (m.sender === "SYSTEM") {
              return (
                <motion.div
                  key={m.id ?? m.seq}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex justify-center"
                >
                  <span
                    className="rounded px-2 py-1 text-center"
                    style={{ background: "#ffeecd", color: "#5b5347", fontSize: 9.5, maxWidth: "85%" }}
                  >
                    {m.body}
                  </span>
                </motion.div>
              );
            }
            const outbound = m.direction === "OUTBOUND";
            const link = m.meta?.payment_link as string | undefined;
            return (
              <motion.div
                key={m.id ?? m.seq}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex ${outbound ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="relative px-2 py-1.5"
                  style={{
                    maxWidth: "78%",
                    background: outbound ? "#d9fdd3" : "#fff",
                    borderRadius: 8,
                    borderTopRightRadius: outbound ? 2 : 8,
                    borderTopLeftRadius: outbound ? 8 : 2,
                    boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)",
                  }}
                >
                  <div style={{ fontSize: 11.5, color: "#111b21", lineHeight: 1.35 }}>{m.body}</div>
                  {link ? <LinkCard url={link} /> : null}
                  <div className="mt-0.5 flex items-center justify-end gap-1">
                    <span style={{ fontSize: 9, color: "rgba(0,0,0,0.45)" }}>{hhmm(m.created_at)}</span>
                    {outbound ? <Ticks status={m.status} /> : null}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {typingWho ? (
          <div className={`flex ${typingWho === "agent" ? "justify-end" : "justify-start"}`}>
            <div
              className="flex items-center gap-1 px-2.5 py-2"
              style={{
                background: typingWho === "agent" ? "#d9fdd3" : "#fff",
                borderRadius: 8,
                boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)",
              }}
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(0,0,0,0.35)" }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Faux input bar (compose lives in the panel below) */}
      <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ background: "#f0f0f0" }}>
        <div
          className="flex-1 rounded-full px-2.5 py-1"
          style={{ background: "#fff", fontSize: 10.5, color: "#8696a0" }}
        >
          Message
        </div>
        <span
          className="grid place-items-center rounded-full"
          style={{ width: 24, height: 24, background: "#25d366", color: "#fff", fontSize: 11 }}
        >
          ➤
        </span>
      </div>
    </div>
  );
}

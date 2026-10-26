"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { runUrl } from "@/lib/dashboard/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export type RunPhase =
  | "idle"
  | "flagged"
  | "diagnosing"
  | "messaging"
  | "reading"
  | "waiting"
  | "calling"
  | "escalated"
  | "stopped"
  | "done";

export interface FeedItem {
  id: number;
  kind:
    | "flagged"
    | "diagnosis"
    | "sent"
    | "reply"
    | "system"
    | "waiting"
    | "stopped"
    | "escalated"
    | "called"
    | "complete";
  text?: string; // message body / detail
  extra?: string; // rule name, p2p date, final status, playbook
  fc?: number; // failure class (flagged item → localized class label)
  amount?: number; // amount in INR (flagged item)
}

interface RunState {
  activeId: string | null;
  name: string;
  running: boolean;
  phase: RunPhase;
  finalStatus: string | null;
  feed: FeedItem[];
}

const INITIAL: RunState = {
  activeId: null,
  name: "",
  running: false,
  phase: "idle",
  finalStatus: null,
  feed: [],
};

/**
 * Streams a live "REX works this case" run over SSE and exposes an action feed
 * for the overlay. start() is called from a user gesture, so state is never set
 * synchronously inside an effect (keeps clear of the strict hooks lint rule).
 */
export function useRecoveryRun(onComplete?: () => void) {
  const { locale } = useLocale();
  const [state, setState] = useState<RunState>(INITIAL);
  const esRef = useRef<EventSource | null>(null);
  const fid = useRef(0);
  const meta = useRef<{ fc: number | null; amount: number }>({ fc: null, amount: 0 });
  const onDone = useRef(onComplete);
  onDone.current = onComplete;

  const close = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

  const push = useCallback((item: Omit<FeedItem, "id">) => {
    setState((s) => ({ ...s, feed: [...s.feed, { id: fid.current++, ...item }] }));
  }, []);

  const start = useCallback(
    (txnId: string, name: string) => {
      close();
      fid.current = 0;
      meta.current = { fc: null, amount: 0 };
      setState({ ...INITIAL, activeId: txnId, name, running: true, phase: "flagged" });
      const es = new EventSource(runUrl(txnId, locale));
      esRef.current = es;
      const on = (n: string, fn: (d: Record<string, unknown>) => void) =>
        es.addEventListener(n, (e) => fn(JSON.parse((e as MessageEvent).data)));

      on("start", (d) => {
        meta.current = {
          fc: (d.failure_class as number) ?? null,
          amount: (d.amount_inr as number) ?? 0,
        };
      });
      on("step", (d) => {
        const p = d.phase as RunPhase;
        setState((s) => ({ ...s, phase: p }));
        if (p === "flagged")
          push({
            kind: "flagged",
            text: d.label as string,
            fc: meta.current.fc ?? undefined,
            amount: meta.current.amount,
          });
        else if (p === "waiting") push({ kind: "waiting", extra: d.p2p_date as string });
        else if (p === "stopped") push({ kind: "stopped", extra: d.rule as string });
        else if (p === "escalated") push({ kind: "escalated", extra: d.rule as string });
      });
      on("diagnosis", (d) => {
        setState((s) => ({ ...s, phase: "diagnosing" }));
        push({ kind: "diagnosis", text: d.root_cause as string, extra: d.playbook as string });
      });
      on("typing", (d) =>
        setState((s) => ({ ...s, phase: d.who === "agent" ? "messaging" : "reading" }))
      );
      on("message", (d) => {
        const sender = d.sender as string;
        const body = d.body as string;
        if (sender === "AGENT") push({ kind: "sent", text: body });
        else if (sender === "CUSTOMER") push({ kind: "reply", text: body });
        else push({ kind: "system", text: body });
      });
      on("call", () => push({ kind: "called" }));
      on("status", (d) => setState((s) => ({ ...s, finalStatus: (d.final_state as string) ?? null })));
      on("complete", (d) => {
        const final = (d.final_state as string) ?? null;
        setState((s) => ({ ...s, running: false, phase: "done", finalStatus: final ?? s.finalStatus }));
        push({ kind: "complete", extra: final ?? undefined });
        close();
        onDone.current?.();
      });
      es.onerror = () => {
        setState((s) => (s.phase === "done" ? s : { ...s, running: false }));
        close();
      };
    },
    [close, push, locale]
  );

  const reset = useCallback(() => {
    close();
    setState(INITIAL);
  }, [close]);

  useEffect(() => close, [close]);

  return { ...state, start, reset };
}

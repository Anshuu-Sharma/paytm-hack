"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useRecoveryRun } from "@/hooks/useRecoveryRun";
import { useAssistant } from "@/hooks/useAssistant";
import { useDashboardRefresh } from "./refresh";
import RexAssistant from "@/components/dashboard/RexAssistant";

interface RexRunCtx {
  start: (txnId: string, name: string) => void;
  activeId: string | null;
  running: boolean;
  setFocused: (id: string | null) => void;
  openPanel: () => void;
}

const Ctx = createContext<RexRunCtx | null>(null);

/**
 * Owns the single REX surface: the conversational assistant and the live "REX
 * works this case" run, merged into one bottom-right panel. Any surface (the
 * transaction drawer) can start a run via useRexRun().start(); the run then
 * streams into the same chat thread the operator types into.
 */
export function RexRunProvider({ children }: { children: ReactNode }) {
  const { refresh } = useDashboardRefresh();
  const run = useRecoveryRun(() => refresh());
  const chat = useAssistant();
  const [focusedId, setFocused] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const start = useCallback(
    (txnId: string, name: string) => {
      setOpen(true);
      run.start(txnId, name);
    },
    [run],
  );

  const value = useMemo<RexRunCtx>(
    () => ({
      start,
      activeId: run.activeId,
      running: run.running,
      setFocused,
      openPanel: () => setOpen(true),
    }),
    [start, run.activeId, run.running],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <RexAssistant run={run} chat={chat} focusedId={focusedId} open={open} setOpen={setOpen} />
    </Ctx.Provider>
  );
}

export function useRexRun(): RexRunCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRexRun must be used within RexRunProvider");
  return ctx;
}

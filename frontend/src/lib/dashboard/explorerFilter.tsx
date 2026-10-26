"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface ExplorerFilterCtx {
  status: string; // "" = all, else a LifecycleStatus
  setStatus: (s: string) => void;
  query: string; // free-text search
  setQuery: (q: string) => void;
}

const Ctx = createContext<ExplorerFilterCtx | null>(null);

/**
 * The transactions table's status filter and search box, lifted to a small
 * shared context so REX can read what the operator is looking at (and set the
 * filter itself). One Explorer is mounted at a time, so single values suffice.
 */
export function ExplorerFilterProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const value = useMemo<ExplorerFilterCtx>(
    () => ({ status, setStatus, query, setQuery }),
    [status, query],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useExplorerFilter(): ExplorerFilterCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useExplorerFilter must be used within ExplorerFilterProvider");
  return ctx;
}

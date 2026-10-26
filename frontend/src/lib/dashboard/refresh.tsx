"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { reseedDemo } from "./api";

interface RefreshCtx {
  bump: number; // increment to force dependent queries to refetch
  refresh: () => void;
  reseed: () => void;
  reseeding: boolean;
}

const Ctx = createContext<RefreshCtx | null>(null);

export function DashboardRefreshProvider({ children }: { children: ReactNode }) {
  const [bump, setBump] = useState(0);
  const [reseeding, setReseeding] = useState(false);

  const refresh = useCallback(() => setBump((n) => n + 1), []);

  const reseed = useCallback(() => {
    setReseeding(true);
    reseedDemo()
      .catch(() => {})
      .finally(() => {
        setReseeding(false);
        setBump((n) => n + 1);
      });
  }, []);

  const value = useMemo(
    () => ({ bump, refresh, reseed, reseeding }),
    [bump, refresh, reseed, reseeding]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboardRefresh(): RefreshCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDashboardRefresh must be used within the dashboard");
  return ctx;
}

"use client";

import { useEffect } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";
import { DashboardRefreshProvider } from "@/lib/dashboard/refresh";
import { ExplorerFilterProvider } from "@/lib/dashboard/explorerFilter";
import { RexRunProvider } from "@/lib/dashboard/rexrun";
import { ChatHistoryProvider } from "@/lib/dashboard/ChatHistoryContext";

/**
 * Mission Control shell — the dark cinematic marketing chrome is swapped for a
 * light, dense "operations" surface (its own token scope, `theme-dashboard`).
 * The class is carried on the wrapper for SSR tokens and mirrored onto <html>
 * on mount so the grain/vignette overlays and body background flip too.
 */
export default function MissionControlLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const el = document.documentElement;
    el.classList.add("theme-dashboard");
    return () => el.classList.remove("theme-dashboard");
  }, []);

  return (
    <ChatHistoryProvider>
    <DashboardRefreshProvider>
      <ExplorerFilterProvider>
      <RexRunProvider>
        <div
          className="theme-dashboard relative z-[200] flex h-screen overflow-hidden"
          style={{ background: "var(--d-bg)", color: "var(--d-ink)" }}
        >
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </RexRunProvider>
      </ExplorerFilterProvider>
    </DashboardRefreshProvider>
    </ChatHistoryProvider>
  );
}

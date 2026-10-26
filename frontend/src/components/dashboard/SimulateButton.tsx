"use client";

import { useState } from "react";
import { simulateCase } from "@/lib/dashboard/api";
import { useDash } from "@/lib/dashboard/i18n";
import { useDashboardRefresh } from "@/lib/dashboard/refresh";

/** Injects a fresh, unworked failed transaction for the operator to run REX on. */
export default function SimulateButton({
  failureClass,
  accent = "var(--d-accent)",
}: {
  failureClass?: number;
  accent?: string;
}) {
  const { d } = useDash();
  const { refresh } = useDashboardRefresh();
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await simulateCase(failureClass);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={go}
      disabled={busy}
      className="rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-60"
      style={{ borderColor: accent, color: accent, background: "transparent" }}
    >
      {busy ? d.run.simulating : `+ ${d.run.simulate}`}
    </button>
  );
}

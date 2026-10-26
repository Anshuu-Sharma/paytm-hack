/** Maps domain values to the dashboard's status palette (CSS var tokens). */

import type { LifecycleStatus } from "./types";

export interface Tone {
  fg: string; // text/graphic colour var
  soft: string; // soft fill var
  label: string;
}

export const STATUS_TONE: Record<LifecycleStatus, Tone> = {
  RECOVERED: { fg: "var(--d-ok)", soft: "var(--d-ok-soft)", label: "Recovered" },
  INTERVENING: { fg: "var(--d-warn)", soft: "var(--d-warn-soft)", label: "In-flight" },
  WAITING: { fg: "var(--d-warn)", soft: "var(--d-warn-soft)", label: "Waiting" },
  DIAGNOSING: { fg: "var(--d-info)", soft: "var(--d-info-soft)", label: "Diagnosing" },
  PENDING: { fg: "var(--d-info)", soft: "var(--d-info-soft)", label: "Pending" },
  ESCALATED: { fg: "var(--d-slate)", soft: "var(--d-slate-soft)", label: "Escalated" },
  CANCELLED: { fg: "var(--d-muted)", soft: "var(--d-surface-2)", label: "Stopped" },
  FAILED: { fg: "var(--d-bad)", soft: "var(--d-bad-soft)", label: "Lost" },
};

export function statusTone(status: string): Tone {
  return (
    STATUS_TONE[status as LifecycleStatus] ?? {
      fg: "var(--d-muted)",
      soft: "var(--d-surface-2)",
      label: status,
    }
  );
}

/** The four failure classes' accent colours, distinct from status tones. */
export const CLASS_COLOR: Record<number, string> = {
  1: "#0ea5e9", // sky — real-time degradation
  2: "#6366f1", // indigo — checkout abandonment
  3: "#f59e0b", // amber — subscription/mandate
  4: "#10b981", // emerald — B2B receivables
};

/** AI classification chip tone. */
export function aiTagTone(tag: string | null): Tone {
  switch (tag) {
    case "RECOVERY_CASE":
      return { fg: "var(--d-accent)", soft: "var(--d-accent-soft)", label: "Recovery case" };
    case "HEALTHY":
      return { fg: "var(--d-ok)", soft: "var(--d-ok-soft)", label: "Healthy" };
    case "NON_RECOVERABLE":
      return { fg: "var(--d-bad)", soft: "var(--d-bad-soft)", label: "Non-recoverable" };
    default:
      return { fg: "var(--d-muted)", soft: "var(--d-surface-2)", label: tag ?? "—" };
  }
}

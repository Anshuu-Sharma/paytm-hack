import { humanize } from "./format";
import { tVocab } from "./i18n";
import type { DashStrings } from "./i18n";
import type { AuditEntry } from "./types";

export interface Activity {
  icon: string;
  label: string;
  detail?: string;
  tone?: "ok" | "warn" | "info" | "muted";
}

/**
 * Turns a raw audit entry into a plain-language activity line — the same
 * vocabulary the live run overlay uses, so the transaction timeline reads like a
 * story of what REX did rather than a developer log.
 */
export function describeAudit(e: AuditEntry, d: DashStrings): Activity {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const a = d.activity;
  const str = (k: string) => (p[k] == null ? "" : String(p[k]));

  // A stopping rule can ride on any node — describe it first.
  const rule = str("stopping_rule");
  if (rule) {
    const stopTone: Activity["tone"] =
      rule === "DISPUTE_FREEZE" ? "info" : rule === "NO_DOUBLE_CHARGE" ? "ok" : "muted";
    return { icon: rule === "DISPUTE_FREEZE" ? "⚠️" : "🛑", label: a.rule[rule] ?? humanize(rule), tone: stopTone };
  }

  switch (e.node_name) {
    case "INGEST":
      return { icon: "⚑", label: str("event") === "FLAGGED" ? a.flagged : a.started, tone: "info" };
    case "DIAGNOSE":
      return {
        icon: "🔍",
        label: a.diagnosed,
        detail: `${tVocab("rootCause", str("root_cause"), d)} · ${tVocab("playbook", str("recommended_playbook"), d)}`,
      };
    case "EXECUTE_INTERVENTION": {
      const action = str("action");
      const label =
        action === "GENERATE_PAYMENT_LINK"
          ? a.sentLink
          : action === "VOICE_CALL"
            ? a.voice
            : action === "RETRY_CHARGE"
              ? a.retried
              : action === "SEND_WHATSAPP" || action === "OFFER_FEE_WAIVER"
                ? a.messaged
                : a.intervened;
      return { icon: action === "GENERATE_PAYMENT_LINK" ? "🔗" : action === "VOICE_CALL" ? "📞" : "💬", label };
    }
    case "WAIT":
      return str("reason") === "WAITING_FOR_P2P"
        ? { icon: "⏳", label: `${a.waitP2p} ${str("scheduled_for")}`, tone: "warn" }
        : { icon: "⏳", label: `${a.waitSalary} (${str("scheduled_for")})`, tone: "warn" };
    case "RECONCILE":
      if (str("disposition") === "RECOVERED")
        return { icon: "✓", label: a.recovered, tone: "ok" };
      return { icon: "•", label: a.awaiting, tone: "muted" };
    case "OPERATOR":
      if (str("event") === "OPERATOR_NOTE")
        return { icon: "📝", label: a.opNote, detail: str("note"), tone: "muted" };
      const stat = (k: string) => d.status[str(k) as keyof typeof d.status] ?? humanize(str(k));
      return {
        icon: "👤",
        label: a.opStatus,
        detail: `${stat("from")} → ${stat("to")}${p.note ? ` · ${str("note")}` : ""}`,
        tone: "info",
      };
    default:
      return { icon: "•", label: humanize(e.node_name), tone: "muted" };
  }
}

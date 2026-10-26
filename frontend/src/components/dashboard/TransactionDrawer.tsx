"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApi } from "@/hooks/useApi";
import { addNote, fetchTransaction, setStatus } from "@/lib/dashboard/api";
import { humanize, inr, pct } from "@/lib/dashboard/format";
import { describeAudit } from "@/lib/dashboard/activity";
import { useDash, durTime, tVocab } from "@/lib/dashboard/i18n";
import { useDashboardRefresh } from "@/lib/dashboard/refresh";
import { useRexRun } from "@/lib/dashboard/rexrun";
import { CLASS_COLOR, aiTagTone, statusTone } from "@/lib/dashboard/status";
import type { LifecycleStatus } from "@/lib/dashboard/types";
import type { DashStrings } from "@/lib/dashboard/i18n";

const OPERATOR_STATUSES: LifecycleStatus[] = [
  "RECOVERED",
  "INTERVENING",
  "ESCALATED",
  "CANCELLED",
  "FAILED",
];

function OperatorActions({ id, current }: { id: string; current: string }) {
  const { d } = useDash();
  const { refresh } = useDashboardRefresh();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const doStatus = async (s: string) => {
    if (busy || s === current) return;
    setBusy(true);
    try {
      await setStatus(id, s);
      refresh();
    } finally {
      setBusy(false);
    }
  };
  const doNote = async () => {
    const n = note.trim();
    if (!n || busy) return;
    setBusy(true);
    try {
      await addNote(id, n);
      setNote("");
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--d-border)" }}>
      <p className="d-label mb-2">
        {d.ops.title}
        {busy ? <span style={{ color: "var(--d-faint)" }}> · {d.ops.working}</span> : null}
      </p>
      <p className="mb-1.5 text-[11px]" style={{ color: "var(--d-faint)" }}>
        {d.ops.setOutcome}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {OPERATOR_STATUSES.map((s) => {
          const tone = statusTone(s);
          const active = s === current;
          return (
            <button
              key={s}
              onClick={() => doStatus(s)}
              disabled={busy || active}
              className="rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-opacity disabled:opacity-100"
              style={
                active
                  ? { background: tone.fg, color: "#fff" }
                  : { background: tone.soft, color: tone.fg }
              }
            >
              {d.status[s]}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={d.ops.notePlaceholder}
          className="flex-1 rounded-lg border px-2.5 py-1.5 text-[12px] outline-none"
          style={{ borderColor: "var(--d-border)", background: "var(--d-bg)", color: "var(--d-ink)" }}
        />
        <button
          onClick={doNote}
          disabled={busy || !note.trim()}
          className="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--d-ink)" }}
        >
          {d.ops.addNote}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="d-label">{label}</p>
      <p className="mt-0.5 text-[13px] font-medium" style={{ color: "var(--d-ink)" }}>
        {value}
      </p>
    </div>
  );
}

const RUNNABLE = new Set(["PENDING", "DIAGNOSING", "INTERVENING", "WAITING"]);

function Body({ id, d, onClose }: { id: string; d: DashStrings; onClose: () => void }) {
  const { bump } = useDashboardRefresh();
  const rex = useRexRun();
  const load = useCallback((signal: AbortSignal) => fetchTransaction(id, signal), [id]);
  const { data: t, error, loading } = useApi(load, [id, bump]);

  if (loading)
    return (
      <div className="flex h-40 items-center justify-center text-[13px]" style={{ color: "var(--d-muted)" }}>
        {d.drawer.loading}
      </div>
    );
  if (error || !t)
    return (
      <div className="p-6 text-[13px]" style={{ color: "var(--d-bad)" }}>
        {error ?? d.drawer.notFound}
      </div>
    );

  const status = statusTone(t.status);
  const ai = aiTagTone(t.ai_tag);
  const aiLabel =
    t.ai_tag && t.ai_tag in d.aitag ? d.aitag[t.ai_tag as keyof typeof d.aitag] : ai.label;

  return (
    <div className="space-y-5 p-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-[3px]"
            style={{ background: CLASS_COLOR[t.failure_class] }}
          />
          <span className="text-[12px] font-medium" style={{ color: "var(--d-muted)" }}>
            {d.classLabel[t.failure_class]}
          </span>
          <span
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: status.soft, color: status.fg }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.fg }} />
            {d.status[t.status as LifecycleStatus] ?? t.status}
          </span>
        </div>
        <h2 className="mt-2 text-lg font-semibold tracking-tight">{t.customer_name}</h2>
        <p className="d-num text-[11.5px]" style={{ color: "var(--d-faint)" }}>
          #{t.serial} · {t.transaction_id} · {t.customer_contact_masked}
        </p>
      </div>

      {/* Let REX work the case, live (unresolved cases) */}
      {RUNNABLE.has(t.status) ? (
        <button
          onClick={() => {
            rex.start(t.transaction_id, t.customer_name ?? "Customer");
            onClose();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13.5px] font-semibold text-white"
          style={{ background: CLASS_COLOR[t.failure_class] }}
        >
          ▶ {d.run.cta}
        </button>
      ) : null}

      {/* Operator actions */}
      <OperatorActions id={t.transaction_id} current={t.status} />

      {/* Facts grid */}
      <div className="grid grid-cols-2 gap-4 rounded-xl p-4" style={{ background: "var(--d-surface-2)" }}>
        <Field label={d.drawer.amount} value={<span className="d-num">{inr(t.amount_inr)}</span>} />
        <Field
          label={d.drawer.aiTag}
          value={
            <span
              className="inline-flex rounded px-1.5 py-0.5 text-[11px]"
              style={{ background: ai.soft, color: ai.fg }}
            >
              {aiLabel}
            </span>
          }
        />
        <Field label={d.drawer.playbook} value={tVocab("playbook", t.playbook, d)} />
        <Field label={d.drawer.channel} value={tVocab("channel", t.channel, d)} />
        <Field
          label={d.drawer.confidence}
          value={<span className="d-num">{t.confidence != null ? pct(t.confidence) : "—"}</span>}
        />
        <Field label={d.drawer.ttr} value={<span className="d-num">{durTime(t.time_to_recovery_seconds, d)}</span>} />
        {t.stopping_rule ? (
          <Field
            label={d.drawer.stoppingRule}
            value={d.activity.rule[t.stopping_rule] ?? humanize(t.stopping_rule)}
          />
        ) : null}
        {t.error_code ? <Field label={d.drawer.errorCode} value={<span className="d-num">{t.error_code}</span>} /> : null}
      </div>

      {/* Diagnosis */}
      {t.diagnosis?.root_cause ? (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--d-border)" }}>
          <p className="d-label" style={{ color: "var(--d-accent)" }}>
            {d.drawer.diagnosis}
          </p>
          <p className="mt-1.5 text-[13px]">
            <span style={{ color: "var(--d-muted)" }}>{d.drawer.rootCause}</span>{" "}
            <span className="font-medium">{tVocab("rootCause", t.diagnosis.root_cause, d)}</span>
          </p>
          <p className="mt-1 text-[13px]">
            <span style={{ color: "var(--d-muted)" }}>{d.drawer.recommended}</span>{" "}
            <span className="font-medium">{tVocab("playbook", t.diagnosis.recommended_playbook, d)}</span>
            {t.diagnosis.confidence != null ? (
              <span className="d-num" style={{ color: "var(--d-faint)" }}>
                {" "}
                · {pct(t.diagnosis.confidence)}
              </span>
            ) : null}
          </p>
        </div>
      ) : null}

      {/* Activity — the human-readable story of what REX did */}
      <div>
        <p className="d-label mb-2">
          {d.activity.title} · {t.audit_trail.length}
        </p>
        <ol className="space-y-3">
          {t.audit_trail.map((e, i) => {
            const act = describeAudit(e, d);
            const dot =
              act.tone === "ok"
                ? "var(--d-ok)"
                : act.tone === "warn"
                  ? "var(--d-warn)"
                  : act.tone === "info"
                    ? "var(--d-info)"
                    : "var(--d-slate)";
            return (
              <li key={e.id} className="relative pl-6">
                <span className="absolute left-0 top-0 text-[13px]">{act.icon}</span>
                {i < t.audit_trail.length - 1 ? (
                  <span
                    className="absolute left-[7px] top-5 h-[calc(100%+2px)] w-px"
                    style={{ background: "var(--d-border)" }}
                  />
                ) : null}
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-semibold" style={{ color: dot }}>
                    {act.label}
                  </span>
                  <span className="d-num shrink-0 text-[10.5px]" style={{ color: "var(--d-faint)" }}>
                    {new Date(e.timestamp).toLocaleTimeString("en-IN")}
                  </span>
                </div>
                {act.detail ? (
                  <p className="mt-0.5 text-[11.5px] leading-snug" style={{ color: "var(--d-muted)" }}>
                    {act.detail}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export default function TransactionDrawer({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const { d } = useDash();
  const { setFocused } = useRexRun();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Publish the open transaction so REX resolves "this one" / "the current one".
  useEffect(() => {
    setFocused(id);
    return () => setFocused(null);
  }, [id, setFocused]);

  return (
    <AnimatePresence>
      {id ? (
        <motion.div
          className="fixed inset-0 z-[300] flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0"
            style={{ background: "rgba(28,25,23,0.35)" }}
            onClick={onClose}
          />
          <motion.aside
            key={id}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative h-full w-full max-w-md overflow-y-auto"
            style={{ background: "var(--d-surface)", borderLeft: "1px solid var(--d-border)" }}
          >
            <div
              className="sticky top-0 z-10 flex items-center justify-between px-5 py-3"
              style={{ borderBottom: "1px solid var(--d-border)", background: "var(--d-surface)" }}
            >
              <span className="d-label">{d.drawer.detail}</span>
              <button
                onClick={onClose}
                className="grid h-7 w-7 place-items-center rounded-md text-[15px] transition-colors hover:bg-[var(--d-surface-2)]"
                style={{ color: "var(--d-muted)" }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <Body id={id} d={d} onClose={onClose} />
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

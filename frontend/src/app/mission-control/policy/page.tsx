"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import PageHeader from "@/components/dashboard/PageHeader";
import { Card, CardHeader } from "@/components/dashboard/Card";
import { ErrorState, Loading } from "@/components/dashboard/PageState";
import { useApi } from "@/hooks/useApi";
import {
  editPolicy,
  fetchPolicy,
  screenMessage,
  validateAction,
  type ScreenResult,
  type ValidateResult,
} from "@/lib/dashboard/api";
import { humanize, inr } from "@/lib/dashboard/format";
import { useDash, tVocab } from "@/lib/dashboard/i18n";
import { useDashboardRefresh } from "@/lib/dashboard/refresh";

const ALL_ACTIONS = [
  "SEND_WHATSAPP",
  "VOICE_CALL",
  "OFFER_FEE_WAIVER",
  "GENERATE_PAYMENT_LINK",
  "RETRY_CHARGE",
  "CANCEL_SUBSCRIPTION",
];
const ALL_CHANNELS = ["WHATSAPP", "VOICE", "PAYMENT_LINK"];

function Pill({
  children,
  money,
  on = true,
  onClick,
}: {
  children: React.ReactNode;
  money?: boolean;
  on?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-medium transition-opacity disabled:cursor-default"
      style={{
        background: !on
          ? "transparent"
          : money
            ? "var(--d-warn-soft)"
            : "var(--d-surface-2)",
        color: !on ? "var(--d-faint)" : money ? "var(--d-warn)" : "var(--d-ink)",
        border: `1px solid ${on ? "transparent" : "var(--d-border)"}`,
        opacity: on ? 1 : 0.55,
      }}
    >
      {children}
    </button>
  );
}

export default function PolicyPage() {
  const { bump, refresh } = useDashboardRefresh();
  const { d } = useDash();
  const pp = d.policy;
  const load = useCallback((signal: AbortSignal) => fetchPolicy(signal), []);
  const { data, error, loading } = useApi(load, [bump]);

  // --- edit state ---
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{
    ceiling: number;
    discount: number;
    actions: string[];
    channels: string[];
  } | null>(null);

  // --- test-the-bouncer state ---
  const [tAction, setTAction] = useState("RETRY_CHARGE");
  const [tAmount, setTAmount] = useState("84000");
  const [tChannel, setTChannel] = useState("");
  const [tDiscount, setTDiscount] = useState("");
  const [tResult, setTResult] = useState<ValidateResult | null>(null);
  const [tBusy, setTBusy] = useState(false);

  // --- adversarial-screen state ---
  const [msg, setMsg] = useState("");
  const [sResult, setSResult] = useState<ScreenResult | null>(null);
  const [sBusy, setSBusy] = useState(false);

  if (loading) return <Loading label={d.state.policy} />;
  if (error || !data) return <ErrorState message={error ?? "no data"} />;

  const { policy, money_moving_actions } = data;

  const startEdit = () => {
    setDraft({
      ceiling: policy.max_intervention_amount_minor / 100,
      discount: policy.max_discount_pct,
      actions: [...policy.allowed_actions],
      channels: [...policy.allowed_channels],
    });
    setEditing(true);
  };

  const toggle = (list: "actions" | "channels", v: string) => {
    if (!draft) return;
    const has = draft[list].includes(v);
    setDraft({ ...draft, [list]: has ? draft[list].filter((x) => x !== v) : [...draft[list], v] });
  };

  const saveEdit = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await editPolicy({
        max_intervention_amount_minor: Math.round(draft.ceiling * 100),
        max_discount_pct: draft.discount,
        allowed_actions: draft.actions,
        allowed_channels: draft.channels,
      });
      setEditing(false);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const runTest = async () => {
    setTBusy(true);
    try {
      const r = await validateAction({
        action: tAction,
        channel: tChannel || null,
        discount_pct: tDiscount ? Number(tDiscount) : null,
        amount_inr: tAmount ? Number(tAmount) : null,
      });
      setTResult(r);
    } finally {
      setTBusy(false);
    }
  };

  const runScreen = async () => {
    const text = msg.trim();
    if (!text) return;
    setSBusy(true);
    try {
      setSResult(await screenMessage(text));
    } finally {
      setSBusy(false);
    }
  };

  const cur = editing && draft;
  const shownActions = cur ? ALL_ACTIONS : policy.allowed_actions;
  const shownChannels = cur ? ALL_CHANNELS : policy.allowed_channels;

  const inputStyle = {
    borderColor: "var(--d-border)",
    background: "var(--d-bg)",
    color: "var(--d-ink)",
  };

  const screenTone =
    sResult?.disposition === "CONTINUE"
      ? { fg: "var(--d-ok)", label: pp.continued }
      : sResult?.disposition === "ESCALATE"
        ? { fg: "var(--d-info)", label: pp.escalated }
        : { fg: "var(--d-bad)", label: pp.halted };

  return (
    <motion.div
      className="mx-auto max-w-[1000px] space-y-5 p-5 md:p-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <PageHeader
        title={pp.title}
        subtitle={pp.desc}
        right={
          editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium"
                style={{ border: "1px solid var(--d-border)", color: "var(--d-muted)" }}
              >
                {pp.cancel}
              </button>
              <button
                onClick={saveEdit}
                disabled={busy}
                className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--d-ink)" }}
              >
                {busy ? pp.saving : pp.save}
              </button>
            </>
          ) : (
            <button
              onClick={startEdit}
              className="rounded-lg px-3 py-1.5 text-[12px] font-semibold"
              style={{ border: "1px solid var(--d-border)", color: "var(--d-ink)" }}
            >
              {pp.editRules}
            </button>
          )
        }
      />
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11.5px]"
        style={{ background: "var(--d-accent-soft)", color: "var(--d-accent)" }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z" />
        </svg>
        {editing ? pp.editHint : d.comp.rexNote}
      </div>

      {/* Ceiling + discount */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <p className="d-label">{pp.ceiling}</p>
          {cur ? (
            <input
              type="number"
              value={draft.ceiling}
              onChange={(e) => setDraft({ ...draft, ceiling: Number(e.target.value) })}
              className="d-num mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xl font-semibold outline-none"
              style={inputStyle}
            />
          ) : (
            <p className="d-num mt-1 text-2xl font-semibold">
              {inr(policy.max_intervention_amount_minor / 100)}
            </p>
          )}
          <p className="mt-1.5 text-[12px]" style={{ color: "var(--d-muted)" }}>
            {pp.ceilingSub}
          </p>
        </Card>
        <Card className="p-5">
          <p className="d-label">{pp.discount}</p>
          {cur ? (
            <input
              type="number"
              value={draft.discount}
              onChange={(e) => setDraft({ ...draft, discount: Number(e.target.value) })}
              className="d-num mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xl font-semibold outline-none"
              style={inputStyle}
            />
          ) : (
            <p className="d-num mt-1 text-2xl font-semibold">{policy.max_discount_pct}%</p>
          )}
          <p className="mt-1.5 text-[12px]" style={{ color: "var(--d-muted)" }}>
            {pp.discountSub}
          </p>
        </Card>
      </div>

      {/* Allowed actions */}
      <Card>
        <CardHeader title={pp.actionsTitle} subtitle={pp.actionsSub} />
        <div className="flex flex-wrap gap-2 px-5 pb-5">
          {shownActions.map((a) => {
            const on = cur ? draft.actions.includes(a) : true;
            return (
              <Pill
                key={a}
                money={money_moving_actions.includes(a)}
                on={on}
                onClick={cur ? () => toggle("actions", a) : undefined}
              >
                {money_moving_actions.includes(a) ? "₹ " : ""}
                {humanize(a)}
              </Pill>
            );
          })}
        </div>
        <p className="px-5 pb-4 text-[11.5px]" style={{ color: "var(--d-faint)" }}>
          {pp.actionsNote}
        </p>
      </Card>

      {/* Allowed channels */}
      <Card>
        <CardHeader title={pp.channelsTitle} subtitle={pp.channelsSub} />
        <div className="flex flex-wrap gap-2 px-5 pb-5">
          {shownChannels.map((c) => (
            <Pill
              key={c}
              on={cur ? draft.channels.includes(c) : true}
              onClick={cur ? () => toggle("channels", c) : undefined}
            >
              {tVocab("channel", c, d)}
            </Pill>
          ))}
        </div>
      </Card>

      {/* Test the Bouncer */}
      <Card>
        <CardHeader title={pp.testTitle} subtitle={pp.testSub} />
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-4">
          <label className="text-[12px]">
            <span className="d-label">{pp.tAction}</span>
            <select
              value={tAction}
              onChange={(e) => setTAction(e.target.value)}
              className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-[12.5px] outline-none"
              style={inputStyle}
            >
              {ALL_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {humanize(a)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px]">
            <span className="d-label">{pp.tAmount}</span>
            <input
              type="number"
              value={tAmount}
              onChange={(e) => setTAmount(e.target.value)}
              className="d-num mt-1 w-full rounded-lg border px-2.5 py-1.5 text-[12.5px] outline-none"
              style={inputStyle}
            />
          </label>
          <label className="text-[12px]">
            <span className="d-label">{pp.tChannel}</span>
            <select
              value={tChannel}
              onChange={(e) => setTChannel(e.target.value)}
              className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-[12.5px] outline-none"
              style={inputStyle}
            >
              <option value="">{pp.tNone}</option>
              {ALL_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {humanize(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px]">
            <span className="d-label">{pp.tDiscount}</span>
            <input
              type="number"
              value={tDiscount}
              onChange={(e) => setTDiscount(e.target.value)}
              className="d-num mt-1 w-full rounded-lg border px-2.5 py-1.5 text-[12.5px] outline-none"
              style={inputStyle}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-5 pb-5">
          <button
            onClick={runTest}
            disabled={tBusy}
            className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--d-accent)" }}
          >
            {tBusy ? pp.testing : pp.testBtn}
          </button>
          {tResult ? (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px]"
              style={{
                background: tResult.approved ? "var(--d-ok-soft)" : "var(--d-bad-soft)",
                color: tResult.approved ? "var(--d-ok)" : "var(--d-bad)",
              }}
            >
              <span className="font-semibold">
                {tResult.approved ? pp.approved : pp.denied}
              </span>
              <span style={{ color: "var(--d-muted)" }}>— {tResult.reason}</span>
            </div>
          ) : null}
        </div>
      </Card>

      {/* Adversarial screen */}
      <Card>
        <CardHeader title={pp.screenTitle} subtitle={pp.screenSub} />
        <div className="space-y-3 px-5 pb-5">
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder={pp.screenPh}
            rows={2}
            className="w-full rounded-lg border px-3 py-2 text-[12.5px] outline-none"
            style={inputStyle}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={runScreen}
              disabled={sBusy || !msg.trim()}
              className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--d-accent)" }}
            >
              {sBusy ? pp.screening : pp.screenBtn}
            </button>
            <button
              onClick={() => setMsg(pp.jailbreakSample)}
              className="rounded-lg px-3 py-2 text-[12px] font-medium"
              style={{ border: "1px solid var(--d-border)", color: "var(--d-muted)" }}
            >
              {pp.tryJailbreak}
            </button>
            {sResult ? (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px]"
                style={{
                  background: `color-mix(in srgb, ${screenTone.fg} 14%, transparent)`,
                  color: screenTone.fg,
                }}
              >
                <span className="font-semibold">{screenTone.label}</span>
                {sResult.rule ? (
                  <span className="d-num" style={{ color: "var(--d-muted)" }}>
                    · {humanize(sResult.rule)}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

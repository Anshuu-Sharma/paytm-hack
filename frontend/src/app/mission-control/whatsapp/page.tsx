"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { container, item } from "@/lib/dashboard/motion";
import { Card, CardHeader, Chip } from "@/components/dashboard/Card";
import PageHeader from "@/components/dashboard/PageHeader";
import PhoneFrame from "@/components/dashboard/PhoneFrame";
import WhatsAppThread from "@/components/dashboard/WhatsAppThread";
import { useDash } from "@/lib/dashboard/i18n";
import type { ConversationMessage } from "@/lib/dashboard/types";
import { loadStoredCampaigns } from "@/lib/dashboard/campaignStore";
import { AUDIENCE_COUNT, customersInAudience, type AudienceKey } from "@/lib/dashboard/customers";

type CampaignStatus = "draft" | "scheduled" | "sending" | "sent";

interface Campaign {
  id: string;
  name: string;
  audience: AudienceKey;
  audienceCount: number;
  status: CampaignStatus;
  sent: number;
  delivered: number;
  read: number;
  messages: ConversationMessage[];
  source?: "voice" | "chat";
}

let msgSeq = 1000;
function msg(partial: Omit<ConversationMessage, "id" | "seq" | "created_at"> & { minutesAgo?: number }): ConversationMessage {
  const { minutesAgo = 0, ...rest } = partial;
  msgSeq += 1;
  return {
    id: msgSeq,
    seq: msgSeq,
    created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    ...rest,
  };
}

function sampleCustomerName(audience: AudienceKey): string {
  return customersInAudience(audience)[0]?.name ?? "Priya Sharma";
}

function campaignThread(headline: string, body: string, discount: string | null, customer: string): ConversationMessage[] {
  const full = discount ? `${headline}\n\n${body}\n\n🎁 ${discount}` : `${headline}\n\n${body}`;
  return [
    msg({ channel: "whatsapp", direction: "OUTBOUND", sender: "AGENT", body: full.replace("{name}", customer.split(" ")[0]), status: "READ", meta: null, minutesAgo: 42 }),
    msg({ channel: "whatsapp", direction: "INBOUND", sender: "CUSTOMER", body: "Wahh REX, ekdum badhiya! 😍", status: "DELIVERED", meta: null, minutesAgo: 35 }),
  ];
}

const SEED_CAMPAIGNS: Campaign[] = [
  {
    id: "c1",
    name: "Diwali Dhamaka 🎉",
    audience: "all",
    audienceCount: AUDIENCE_COUNT.all,
    status: "sent",
    sent: AUDIENCE_COUNT.all,
    delivered: Math.round(AUDIENCE_COUNT.all * 0.98),
    read: Math.round(AUDIENCE_COUNT.all * 0.76),
    messages: campaignThread(
      "Diwali Dhamaka 🎉",
      "Hi {name}! Wishing you a very Happy Diwali from all of us. We've got something special for you.",
      "20% off on your next order — code DIWALI20",
      sampleCustomerName("all"),
    ),
  },
  {
    id: "c2",
    name: "Weekend Flash Sale",
    audience: "vip",
    audienceCount: AUDIENCE_COUNT.vip,
    status: "sent",
    sent: AUDIENCE_COUNT.vip,
    delivered: Math.round(AUDIENCE_COUNT.vip * 0.98),
    read: Math.round(AUDIENCE_COUNT.vip * 0.82),
    messages: campaignThread(
      "Weekend Flash Sale ⚡",
      "Hi {name}! Just for our top customers — this weekend only.",
      "15% off, no minimum — code FLASH15",
      sampleCustomerName("vip"),
    ),
  },
  {
    id: "c3",
    name: "We miss you 💌",
    audience: "dormant",
    audienceCount: AUDIENCE_COUNT.dormant,
    status: "scheduled",
    sent: 0,
    delivered: 0,
    read: 0,
    messages: campaignThread(
      "We miss you 💌",
      "Hi {name}, it's been a while! Come back and we'll make it worth your while.",
      "₹100 off your comeback order",
      sampleCustomerName("dormant"),
    ),
  },
  {
    id: "c4",
    name: "New Menu Launch",
    audience: "custom",
    audienceCount: AUDIENCE_COUNT.custom,
    status: "draft",
    sent: 0,
    delivered: 0,
    read: 0,
    messages: campaignThread(
      "New Menu Launch 🍽️",
      "Hi {name}! Something new just dropped — take a look.",
      null,
      sampleCustomerName("custom"),
    ),
  },
];

function StatusChip({ status, d }: { status: CampaignStatus; d: ReturnType<typeof useDash>["d"] }) {
  const tone: Record<CampaignStatus, { fg: string; soft: string }> = {
    draft: { fg: "var(--d-muted)", soft: "var(--d-surface-2)" },
    scheduled: { fg: "var(--d-info)", soft: "var(--d-info-soft)" },
    sending: { fg: "var(--d-warn)", soft: "var(--d-warn-soft)" },
    sent: { fg: "var(--d-ok)", soft: "var(--d-ok-soft)" },
  };
  return <Chip tone={tone[status]}>{d.wa.status[status]}</Chip>;
}

function KpiTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <section
      className="relative flex min-h-[110px] flex-col justify-between rounded-[22px] p-4"
      style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)" }}
    >
      <span className="d-label text-[11px]" style={{ color: "var(--d-muted)" }}>{label}</span>
      <div className="d-num text-[24px] font-semibold leading-none tracking-[-0.03em]" style={{ color }}>
        {value}
      </div>
    </section>
  );
}

/* ── Create campaign modal ──────────────────────────────────────────────── */
function CreateCampaignModal({
  open,
  onClose,
  onCreate,
  d,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (c: { name: string; audience: AudienceKey; body: string; sendNow: boolean }) => void;
  d: ReturnType<typeof useDash>["d"];
}) {
  const [name, setName] = useState("");
  const [audience, setAudience] = useState<AudienceKey>("all");
  const [bodyText, setBodyText] = useState("Hi {name}! ");
  const [sendNow, setSendNow] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const submit = () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setTimeout(() => {
      onCreate({ name: name.trim(), audience, body: bodyText.trim() || "Hi {name}!", sendNow });
      setSaving(false);
      setName("");
      setBodyText("Hi {name}! ");
      setAudience("all");
      setSendNow(true);
      onClose();
    }, sendNow ? 1100 : 400);
  };

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      style={{ background: "rgba(12,12,15,0.72)", backdropFilter: "blur(6px)" }}
      onClick={() => !saving && onClose()}
    >
      <div
        className="relative w-full max-w-[460px] rounded-[22px] p-5"
        style={{ background: "var(--d-surface)", border: "1px solid var(--d-border-strong)", boxShadow: "0 32px 80px rgba(0,0,0,0.55)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--d-ink)" }}>{d.wa.modal.title}</h3>

        <label className="mt-4 block text-[11px] font-medium" style={{ color: "var(--d-muted)" }}>{d.wa.modal.name}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={d.wa.modal.namePh}
          className="mt-1 w-full rounded-lg px-3 py-2 text-[13px] outline-none"
          style={{ background: "var(--d-surface-2)", border: "1px solid var(--d-border)", color: "var(--d-ink)" }}
        />

        <label className="mt-3 block text-[11px] font-medium" style={{ color: "var(--d-muted)" }}>{d.wa.modal.audience}</label>
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value as AudienceKey)}
          className="mt-1 w-full rounded-lg px-3 py-2 text-[13px] outline-none"
          style={{ background: "var(--d-surface-2)", border: "1px solid var(--d-border)", color: "var(--d-ink)" }}
        >
          {(Object.keys(d.wa.audiences) as AudienceKey[]).map((k) => (
            <option key={k} value={k}>{d.wa.audiences[k]}</option>
          ))}
        </select>

        <label className="mt-3 block text-[11px] font-medium" style={{ color: "var(--d-muted)" }}>{d.wa.modal.template}</label>
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          placeholder={d.wa.modal.templatePh}
          rows={3}
          className="mt-1 w-full resize-none rounded-lg px-3 py-2 text-[13px] outline-none"
          style={{ background: "var(--d-surface-2)", border: "1px solid var(--d-border)", color: "var(--d-ink)" }}
        />

        <div className="mt-3 flex items-center gap-2">
          <span className="text-[11px] font-medium" style={{ color: "var(--d-muted)" }}>{d.wa.modal.schedule}</span>
          <div className="ml-auto inline-flex rounded-lg p-0.5" style={{ background: "var(--d-surface-2)" }}>
            {[{ v: true, l: d.wa.modal.sendNow }, { v: false, l: d.wa.modal.sendLater }].map((o) => (
              <button
                key={o.l}
                type="button"
                onClick={() => setSendNow(o.v)}
                className="rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors"
                style={{
                  background: sendNow === o.v ? "var(--d-accent)" : "transparent",
                  color: sendNow === o.v ? "#fff" : "var(--d-muted)",
                }}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-2 text-[12.5px] font-medium"
            style={{ color: "var(--d-muted)" }}
          >
            {d.wa.modal.cancel}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim() || saving}
            className="rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(160deg, #25d366, #128c7e)" }}
          >
            {saving ? d.wa.modal.saving : d.wa.modal.save}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */
export default function WhatsappCampaignsPage() {
  const { d } = useDash();
  const [campaigns, setCampaigns] = useState<Campaign[]>(SEED_CAMPAIGNS);
  const [selectedId, setSelectedId] = useState<string | null>(SEED_CAMPAIGNS[0]?.id ?? null);
  const [modalOpen, setModalOpen] = useState(false);

  // Voice-drafted campaigns are saved to localStorage by the Voice Help page
  // (there's no backend campaign record in this demo) — pick them up on
  // mount and whenever this tab regains focus, so a campaign sent by voice
  // shows up here without a refresh.
  useEffect(() => {
    const merge = () => {
      const stored = loadStoredCampaigns();
      if (!stored.length) return;
      setCampaigns((prev) => {
        const knownIds = new Set(prev.map((c) => c.id));
        const fresh = stored.filter((c) => !knownIds.has(c.id));
        if (!fresh.length) return prev;
        return [...fresh, ...prev];
      });
      setSelectedId((prev) => prev ?? stored[0]?.id ?? null);
    };
    merge();
    window.addEventListener("focus", merge);
    return () => window.removeEventListener("focus", merge);
  }, []);

  const selected = campaigns.find((c) => c.id === selectedId) ?? null;

  const totalSent = campaigns.reduce((s, c) => s + c.sent, 0);
  const totalDelivered = campaigns.reduce((s, c) => s + c.delivered, 0);
  const activeCount = campaigns.filter((c) => c.status === "scheduled" || c.status === "sending").length;
  const deliveryRate = totalSent ? Math.round((totalDelivered / totalSent) * 100) : 0;
  const optOuts = Math.max(1, Math.round(totalSent * 0.004));

  const createCampaign = (input: { name: string; audience: AudienceKey; body: string; sendNow: boolean }) => {
    const id = `c${Date.now()}`;
    const audienceCount = AUDIENCE_COUNT[input.audience];
    const draftMessages = campaignThread(input.name, input.body, null, sampleCustomerName(input.audience));

    const fresh: Campaign = {
      id,
      name: input.name,
      audience: input.audience,
      audienceCount,
      status: input.sendNow ? "sending" : "scheduled",
      sent: 0,
      delivered: 0,
      read: 0,
      messages: draftMessages,
    };
    setCampaigns((prev) => [fresh, ...prev]);
    setSelectedId(id);

    if (input.sendNow) {
      setTimeout(() => {
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, status: "sent", sent: audienceCount, delivered: Math.round(audienceCount * 0.97), read: Math.round(audienceCount * 0.74) }
              : c,
          ),
        );
      }, 1400);
    }
  };

  return (
    <motion.div className="mx-auto max-w-[1280px] p-4 md:p-5" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader
          title={d.wa.title}
          subtitle={d.wa.desc}
          accent="#25d366"
          right={
            <>
              <Link
                href="/mission-control/whatsapp/voice"
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold"
                style={{ background: "var(--d-surface-2)", border: "1px solid var(--d-border)", color: "var(--d-ink)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
                {d.wa.voiceCta}
              </Link>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-white"
                style={{ background: "linear-gradient(160deg, #25d366, #128c7e)", boxShadow: "0 4px 16px rgba(37,211,102,.3)" }}
              >
                {d.wa.create}
              </button>
            </>
          }
        />
      </motion.div>

      {/* KPI row */}
      <motion.div variants={item} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label={d.wa.kpi.active} value={String(activeCount)} color="var(--d-ink)" />
        <KpiTile label={d.wa.kpi.sent} value={totalSent.toLocaleString("en-IN")} color="var(--d-ink)" />
        <KpiTile label={d.wa.kpi.delivery} value={`${deliveryRate}%`} color="#25d366" />
        <KpiTile label={d.wa.kpi.optout} value={String(optOuts)} color="var(--d-warn)" />
      </motion.div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Campaign list */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card>
            <CardHeader title={d.wa.listTitle} subtitle={d.wa.listSub} />
            <div className="overflow-x-auto px-1 pb-3">
              <table className="w-full border-collapse text-left text-[12.5px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--d-border)" }}>
                    {[d.wa.col.name, d.wa.col.audience, d.wa.col.status, d.wa.col.sent, d.wa.col.delivered, d.wa.col.read].map((h) => (
                      <th key={h} className="px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--d-muted)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderBottom: "1px solid var(--d-border)",
                        background: selectedId === c.id ? "var(--d-surface-2)" : "transparent",
                      }}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--d-ink)" }}>{c.name}</td>
                      <td className="px-4 py-3" style={{ color: "var(--d-muted)" }}>
                        {d.wa.audiences[c.audience]} · {c.audienceCount.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3"><StatusChip status={c.status} d={d} /></td>
                      <td className="px-4 py-3 font-mono" style={{ color: "var(--d-muted)" }}>{c.sent.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: "var(--d-muted)" }}>{c.delivered.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: "var(--d-muted)" }}>{c.read.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Voice Help tile */}
          <motion.div variants={item} className="mt-4">
            <Link
              href="/mission-control/whatsapp/voice"
              className="d-card flex items-center gap-4 rounded-[22px] p-5 transition-transform hover:scale-[1.005]"
              style={{ background: "linear-gradient(135deg, rgba(37,211,102,.14), rgba(18,140,126,.08))", border: "1px solid rgba(37,211,102,.25)" }}
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ background: "#25d366" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold" style={{ color: "var(--d-ink)" }}>{d.wa.voiceTitle}</div>
                <p className="mt-0.5 text-[12px] leading-snug" style={{ color: "var(--d-muted)" }}>{d.wa.voiceDesc}</p>
              </div>
              <span
                className="ml-auto shrink-0 rounded-lg px-3.5 py-2 text-[12px] font-semibold text-white"
                style={{ background: "linear-gradient(160deg, #25d366, #128c7e)" }}
              >
                {d.wa.voiceCta}
              </span>
            </Link>
          </motion.div>
        </motion.div>

        {/* Phone preview */}
        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader title={d.wa.previewTitle} subtitle={d.wa.previewSub} />
            <div className="flex flex-col items-center px-5 pb-5">
              {selected ? (
                <PhoneFrame width={252}>
                  <WhatsAppThread
                    messages={selected.messages}
                    customerName={d.wa.audiences[selected.audience]}
                    typingWho={selected.status === "sending" ? "agent" : null}
                  />
                </PhoneFrame>
              ) : (
                <div className="flex h-[400px] items-center justify-center text-center text-[12px]" style={{ color: "var(--d-muted)" }}>
                  {d.wa.previewEmpty}
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      <CreateCampaignModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={createCampaign} d={d} />
    </motion.div>
  );
}

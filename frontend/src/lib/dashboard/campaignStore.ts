/** Local persistence for WhatsApp campaigns created outside the main list page
 * (currently just the voice-drafted ones) so they still show up there.
 *
 * This is a dummy-data demo with no backend campaign record, so the simplest
 * thing that lets the voice page and the list page agree on "what campaigns
 * exist" is localStorage — written by the voice flow on send, read once by
 * the list page on mount. */

import type { ConversationMessage } from "./types";
import { AUDIENCE_COUNT, customersInAudience, type AudienceKey } from "./customers";

export type { AudienceKey };
export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent";

export interface CampaignTemplate {
  headline: string;
  body: string;
  discount: string | null;
}

/** A WhatsApp campaign REX is mid-way through drafting conversationally —
 * lifted into shared state (not local to the floating widget) so the full
 * Ask Rex page can also start/continue one and have it land in the same
 * popup instead of dead-ending. */
export interface CampaignDraftState {
  template: CampaignTemplate;
  audience: AudienceKey | null;
  history: { role: string; text: string }[];
}

export interface StoredCampaign {
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

const KEY = "rex_wa_campaigns_v1";
const MAX_STORED = 20;

export function loadStoredCampaigns(): StoredCampaign[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredCampaign(campaign: StoredCampaign): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadStoredCampaigns();
    const next = [campaign, ...existing.filter((c) => c.id !== campaign.id)].slice(0, MAX_STORED);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — voice campaign just won't persist to the list */
  }
}

/** Turns a finished REX-drafted template into a "sent" campaign record and
 * persists it — the one place that logic lives, shared by the voice-drafted
 * flow and the chat/floating-widget-drafted flow so they can't drift apart. */
export function finalizeCampaign(
  template: CampaignTemplate,
  audience: AudienceKey,
  source: "voice" | "chat",
): StoredCampaign {
  const count = AUDIENCE_COUNT[audience];
  const sampleFirstName = customersInAudience(audience)[0]?.name.split(" ")[0] ?? "Priya";
  const body = template.discount
    ? `${template.headline}\n\n${template.body}\n\n🎁 ${template.discount}`
    : `${template.headline}\n\n${template.body}`;

  const campaign: StoredCampaign = {
    id: `${source}-${Date.now()}`,
    name: template.headline,
    audience,
    audienceCount: count,
    status: "sent",
    sent: count,
    delivered: Math.round(count * 0.97),
    read: Math.round(count * 0.74),
    source,
    messages: [
      {
        id: 1, seq: 1, channel: "whatsapp", direction: "OUTBOUND", sender: "AGENT",
        status: "READ", meta: null, created_at: new Date().toISOString(),
        body: body.replace("{name}", sampleFirstName),
      },
    ],
  };
  saveStoredCampaign(campaign);
  return campaign;
}

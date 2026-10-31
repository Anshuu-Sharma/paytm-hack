import { API_BASE } from "@/lib/api";
import type {
  AuditList,
  CallData,
  Conversation,
  ConversationMessage,
  EscalationTicket,
  Metrics,
  PolicyResponse,
  TransactionDetail,
  TransactionList,
  TransactionRow,
} from "./types";
import type { CampaignTemplate } from "./campaignStore";
import type { AudienceKey } from "./customers";

const V1 = `${API_BASE}/api/v1`;

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${V1}${path}`, { signal, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} — ${path}`);
  }
  return (await res.json()) as T;
}

// Named "dashboard-summary", not "/metrics" — that path trips ad/tracker
// blocklists (uBlock, EasyList, etc.) in some judges'/users' browsers.
export const fetchMetrics = (signal?: AbortSignal) =>
  getJson<Metrics>("/dashboard-summary", signal);

export interface TxnQuery {
  failure_class?: number;
  status?: string;
  archetype?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export function fetchTransactions(query: TxnQuery = {}, signal?: AbortSignal) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return getJson<TransactionList>(`/transactions${qs ? `?${qs}` : ""}`, signal);
}

export const fetchTransaction = (id: string, signal?: AbortSignal) =>
  getJson<TransactionDetail>(`/transactions/${encodeURIComponent(id)}`, signal);

export function fetchAudit(
  query: { transaction_id?: string; limit?: number; offset?: number } = {},
  signal?: AbortSignal
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return getJson<AuditList>(`/audit${qs ? `?${qs}` : ""}`, signal);
}

export const fetchEscalations = (signal?: AbortSignal) =>
  getJson<EscalationTicket[]>("/escalations", signal);

export const fetchPolicy = (signal?: AbortSignal) =>
  getJson<PolicyResponse>("/policy", signal);

export interface PolicyPatch {
  max_discount_pct?: number;
  max_intervention_amount_minor?: number;
  allowed_actions?: string[];
  allowed_channels?: string[];
}

export const editPolicy = (patch: PolicyPatch) =>
  patchJson<PolicyResponse>("/policy", patch);

export interface ValidateResult {
  approved: boolean;
  reason: string;
}

export const validateAction = (body: {
  action: string;
  channel?: string | null;
  discount_pct?: number | null;
  amount_inr?: number | null;
}) => postJson<ValidateResult>("/policy/validate", body);

export interface ScreenResult {
  disposition: string;
  rule: string | null;
  reason: string;
}

export const screenMessage = (message: string) =>
  postJson<ScreenResult>("/policy/screen", { message });

export interface SubscriptionItem {
  transaction_id: string;
  serial: number;
  customer_name: string;
  plan: string;
  amount_inr: number;
  cycle: string;
  next_debit_date: string;
  salary_day: number;
  mandate_status: string;
  retry_count: number;
  retry_cap: number;
  predicted_fail: boolean;
  status: string;
}

export interface InvoiceItem {
  transaction_id: string;
  serial: number;
  buyer_name: string;
  invoice_no: string;
  amount_inr: number;
  issue_date: string;
  due_date: string;
  terms: string;
  days_overdue: number;
  aging_bucket: string;
  p2p_date: string | null;
  next_reminder_date: string;
  status: string;
  open: boolean;
}

export const fetchSubscriptions = (signal?: AbortSignal) =>
  getJson<SubscriptionItem[]>("/subscriptions", signal);

export const fetchInvoices = (signal?: AbortSignal) =>
  getJson<InvoiceItem[]>("/invoices", signal);

export const addSubscription = (body: {
  customer_name: string;
  plan: string;
  amount_inr: number;
  next_debit_date: string;
  salary_day: number;
}) => postJson<SubscriptionItem>("/subscriptions", body);

export const addInvoice = (body: {
  buyer_name: string;
  amount_inr: number;
  issue_date: string;
  due_date: string;
  terms?: string;
}) => postJson<InvoiceItem>("/invoices", body);

export const fetchConversation = (id: string, signal?: AbortSignal) =>
  getJson<Conversation>(`/transactions/${encodeURIComponent(id)}/conversation`, signal);

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${V1}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${V1}${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const sendMessage = (id: string, body: string, aiDrafted = false) =>
  postJson<ConversationMessage>(`/transactions/${encodeURIComponent(id)}/messages`, {
    body,
    ai_drafted: aiDrafted,
  });

export const draftMessage = (id: string, prompt: string) =>
  postJson<{ draft: string }>(`/transactions/${encodeURIComponent(id)}/messages/draft`, {
    prompt,
  });

export const createPaymentLink = (id: string) =>
  postJson<{ url: string; paytm_id: string; simulated: boolean; message: ConversationMessage }>(
    `/transactions/${encodeURIComponent(id)}/payment-link`,
    {}
  );

export const paymentLinkStatus = (id: string) =>
  getJson<{ paid: boolean; status: string; current_state: string }>(
    `/transactions/${encodeURIComponent(id)}/payment-link/status`
  );

export const startCall = (id: string) =>
  postJson<CallData>(`/transactions/${encodeURIComponent(id)}/call/start`, {});

export const fetchCalls = (id: string, signal?: AbortSignal) =>
  getJson<{ calls: CallData[] }>(`/transactions/${encodeURIComponent(id)}/calls`, signal);

export const setStatus = (id: string, status: string, note?: string) =>
  postJson<TransactionRow>(`/transactions/${encodeURIComponent(id)}/status`, { status, note });

export const addNote = (id: string, note: string) =>
  postJson<{ id: number }>(`/transactions/${encodeURIComponent(id)}/note`, { note });

export const resolveEscalation = (ticketId: number) =>
  postJson<{ status: string }>(`/escalations/${ticketId}/resolve`, {});

export type AssistantActionType =
  | "run_recovery"
  | "set_status"
  | "add_note"
  | "navigate"
  | "resolve_escalation"
  | "create_payment_link"
  | "draft_message"
  | "send_message"
  | "simulate_case"
  | "call_customer"
  | "start_campaign";

export interface AssistantCampaignTurn {
  role: string;
  text: string;
}

export interface AssistantAction {
  type: AssistantActionType;
  transaction_id: string | null;
  status: string | null;
  note: string | null;
  route: string | null;
  requires_confirmation: boolean;
  scope?: "one" | "batch" | null;
  transaction_ids?: string[] | null;
  escalation_id?: number | null;
  prompt?: string | null;
  failure_class?: number | null;
  customer_name?: string | null;
  call_reason?: string | null;
  template?: CampaignTemplate | null;
  audience?: AudienceKey | null;
  ready_to_send?: boolean;
  history?: AssistantCampaignTurn[];
}

export interface AssistantReply {
  reply: string;
  action: AssistantAction | null;
}

export interface AssistantContext {
  route?: string | null;
  focused_transaction_id?: string | null;
  class_filter?: number | null;
  status_filter?: string | null;
  search?: string | null;
}

export const sendAssistantChat = (
  message: string,
  locale: string,
  context: AssistantContext = {},
) => postJson<AssistantReply>("/assistant/chat", { message, locale, context });

export interface CampaignChatReply {
  reply_text: string;
  template: CampaignTemplate;
  audience: AudienceKey | null;
  ready_to_send: boolean;
}

/** One turn of a campaign-drafting conversation, continued outside the voice
 * page — used when "start_campaign" hands a chat session into campaign mode. */
export const continueCampaignChat = (body: {
  message: string;
  locale: string;
  history: AssistantCampaignTurn[];
  template: CampaignTemplate | null;
  audience: AudienceKey | null;
}) => postJson<CampaignChatReply>("/assistant/campaign-chat", body);

export interface RecoverBatchResult {
  total: number;
  recovered: number;
  results: { transaction_id: string; final_state: string | null }[];
}

export const recoverBatch = (ids: string[], locale: string) =>
  postJson<RecoverBatchResult>("/transactions/recover-batch", {
    transaction_ids: ids,
    locale,
  });

/** SSE URL for the live "REX works this case" run (consumed via EventSource).
 * ``locale`` (en|hi) drives the language REX drafts its outreach in. */
export const runUrl = (id: string, locale = "en") =>
  `${V1}/transactions/${encodeURIComponent(id)}/run?locale=${locale}`;

export const simulateCase = (failureClass?: number) =>
  postJson<TransactionRow>(
    `/transactions/simulate${failureClass ? `?failure_class=${failureClass}` : ""}`,
    {}
  );

export async function reseedDemo(): Promise<{ seeded: number }> {
  const res = await fetch(`${V1}/admin/seed`, { method: "POST" });
  if (!res.ok) throw new Error(`Seed failed: ${res.status}`);
  return (await res.json()) as { seeded: number };
}

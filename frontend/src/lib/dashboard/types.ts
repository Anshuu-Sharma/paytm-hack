/** Wire types mirroring the REX backend's dashboard endpoints. */

export interface ClassMetric {
  at_risk_inr: number;
  recovered_inr: number;
  count: number;
  recovered_count: number;
  recovery_rate: number;
  top_playbook: string | null;
  avg_time_to_recovery_seconds: number;
}

export interface Funnel {
  at_risk: number;
  intervened: number;
  recovered: number;
  escalated: number;
  cancelled: number;
  failed: number;
}

export interface ChannelStat {
  dispatched: number;
  recovered: number;
}

export interface TimePoint {
  date: string;
  recovered_inr: number;
  cumulative_inr: number;
}

export interface Metrics {
  at_risk_inr: number;
  recovered_inr: number;
  in_flight_inr: number;
  lost_inr: number;
  grrr: number;
  by_class: Record<string, ClassMetric>;
  funnel: Funnel;
  channel_breakdown: Record<string, ChannelStat>;
  time_series: TimePoint[];
  stopping_rules_by_name: Record<string, number>;
  counts: {
    total: number;
    interventions: number;
    escalations: number;
    stopping_rules_fired: number;
    recovered: number;
    cancelled: number;
    failed: number;
  };
  avg_time_to_recovery_seconds: number;
}

export type LifecycleStatus =
  | "PENDING"
  | "DIAGNOSING"
  | "WAITING"
  | "INTERVENING"
  | "RECOVERED"
  | "ESCALATED"
  | "CANCELLED"
  | "FAILED";

export interface TransactionRow {
  serial: number;
  transaction_id: string;
  paytm_payment_id: string;
  failure_class: number;
  class_label: string | null;
  archetype: string | null;
  ai_tag: string | null;
  is_at_risk: boolean;
  confidence: number | null;
  event_type: string | null;
  error_code: string | null;
  status: LifecycleStatus;
  amount_inr: number;
  currency: string;
  customer_name: string | null;
  customer_contact_masked: string;
  time_to_recovery_seconds: number | null;
  playbook: string | null;
  channel: string | null;
  stopping_rule: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionList {
  total: number;
  items: TransactionRow[];
}

export interface AuditEntry {
  id: number;
  transaction_id: string;
  node_name: string;
  action_type: string;
  payload: Record<string, unknown>;
  outcome: string;
  timestamp: string;
}

export interface TransactionDetail extends TransactionRow {
  diagnosis: {
    root_cause?: string;
    recommended_playbook?: string;
    confidence?: number;
  };
  audit_trail: AuditEntry[];
}

export interface AuditList {
  total: number;
  items: AuditEntry[];
}

export interface EscalationTicket {
  id: number;
  transaction_id: string;
  reason: string;
  rule: string | null;
  status: string;
  created_at: string;
}

export interface ConversationMessage {
  id: number;
  channel: string;
  direction: "OUTBOUND" | "INBOUND";
  sender: "AGENT" | "CUSTOMER" | "SYSTEM";
  body: string;
  status: "SENT" | "DELIVERED" | "READ";
  seq: number;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface CallTurnData {
  speaker: "AGENT" | "CUSTOMER";
  text: string;
  seq: number;
  at_offset_sec: number;
}

export interface CallData {
  id: number;
  status: string;
  duration_sec: number;
  outcome: string | null;
  provider: string | null;
  started_at?: string;
  turns: CallTurnData[];
}

export interface Conversation {
  messages: ConversationMessage[];
  call: CallData | null;
}

export interface PolicyResponse {
  policy: {
    max_discount_pct: number;
    max_intervention_amount_minor: number;
    allowed_channels: string[];
    allowed_actions: string[];
  };
  money_moving_actions: string[];
  stopping_rules: { name: string; description: string }[];
}

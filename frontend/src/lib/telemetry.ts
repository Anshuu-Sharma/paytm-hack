/**
 * Sample audit-trail telemetry per failure class, used to animate the Mission
 * Control terminal in Phase 2. The line shape mirrors the backend `AuditTrail`
 * model (event_id, node_name, action_type, payload, outcome) so this can be
 * swapped for a live WS/SSE stream in Phase 4 with no visual change.
 */

export type LogLevel = "faint" | "cyan" | "blue" | "fail" | "wait" | "violet";

export interface LogLine {
  time: string;
  key: string;
  json: string;
  level: LogLevel;
}

export type SimStatus =
  | "ingesting"
  | "diagnosing"
  | "intervening"
  | "waiting"
  | "recovered";

interface Scenario {
  status: SimStatus[]; // status timeline (index-synced to reveal cadence)
  lines: LogLine[];
}

const TELEMETRY: Record<number, Scenario> = {
  1: {
    status: ["ingesting", "diagnosing", "intervening", "recovered"],
    lines: [
      { time: "14:32:01", key: "EVENT_INGESTED", json: '{ "event":"payment.failed", "id":"pay_Nx91k" }', level: "cyan" },
      { time: "14:32:02", key: "DIAGNOSIS", json: '{ "class":1, "root_cause":"UPI_SWITCH_TIMEOUT", "conf":0.91 }', level: "violet" },
      { time: "14:32:03", key: "NODE_HEALTH", json: '{ "acquiring_bank":"DEGRADED", "latency_ms":4200 }', level: "fail" },
      { time: "14:32:04", key: "POLICY_CHECK", json: '{ "action":"REROUTE_RAIL", "authorized":true }', level: "faint" },
      { time: "14:32:05", key: "ACTION_EXECUTED", json: '{ "reroute_to":"UPI_INTENT", "rail":"fallback_2" }', level: "blue" },
      { time: "14:32:09", key: "STATE_TRANSITION", json: '{ "to":"RECOVERED", "amount":"₹2,499.00" }', level: "blue" },
    ],
  },
  2: {
    status: ["ingesting", "diagnosing", "intervening", "recovered"],
    lines: [
      { time: "14:41:11", key: "EVENT_INGESTED", json: '{ "event":"payment.failed", "id":"pay_Pb27r" }', level: "cyan" },
      { time: "14:41:12", key: "DIAGNOSIS", json: '{ "class":2, "root_cause":"OTP_FRICTION_ABANDONMENT", "conf":0.94 }', level: "violet" },
      { time: "14:41:13", key: "POLICY_CHECK", json: '{ "action":"DISPATCH_WHATSAPP_UPI_LINK", "authorized":true }', level: "faint" },
      { time: "14:41:14", key: "ACTION_EXECUTED", json: '{ "channel":"whatsapp", "template":"upi_autopay_1tap" }', level: "blue" },
      { time: "14:47:03", key: "STATE_TRANSITION", json: '{ "to":"RECOVERED", "amount":"₹1,499.00" }', level: "blue" },
    ],
  },
  3: {
    status: ["ingesting", "diagnosing", "waiting", "recovered"],
    lines: [
      { time: "09:02:00", key: "EVENT_INGESTED", json: '{ "event":"mandate.failed", "id":"sub_Qc55m" }', level: "cyan" },
      { time: "09:02:01", key: "DIAGNOSIS", json: '{ "class":3, "root_cause":"MONTH_END_LOW_BALANCE", "conf":0.88 }', level: "violet" },
      { time: "09:02:02", key: "LIQUIDITY_SIGNAL", json: '{ "status":"LOW", "salary_credit_eta":"2nd" }', level: "wait" },
      { time: "09:02:03", key: "POLICY_CHECK", json: '{ "action":"DEFER_RETRY", "to":"month+1:02", "authorized":true }', level: "faint" },
      { time: "09:02:04", key: "STATE_TRANSITION", json: '{ "to":"WAITING", "resume":"2nd 09:00" }', level: "wait" },
      { time: "02:00:07", key: "STATE_TRANSITION", json: '{ "to":"RECOVERED", "amount":"₹899.00" }', level: "blue" },
    ],
  },
  4: {
    status: ["ingesting", "diagnosing", "intervening", "recovered"],
    lines: [
      { time: "11:15:40", key: "EVENT_INGESTED", json: '{ "event":"invoice.overdue", "id":"inv_Rd88n" }', level: "cyan" },
      { time: "11:15:41", key: "DIAGNOSIS", json: '{ "class":4, "root_cause":"NET30_UNPAID", "days_overdue":12 }', level: "violet" },
      { time: "11:15:43", key: "ACTION_EXECUTED", json: '{ "channel":"conversational", "intent":"negotiate_p2p" }', level: "blue" },
      { time: "11:18:22", key: "P2P_EXTRACTED", json: '{ "promise_to_pay":"2026-09-05", "commitment":"HARD" }', level: "blue" },
      { time: "11:18:23", key: "STATE_TRANSITION", json: '{ "to":"RECOVERED", "amount":"₹84,000.00" }', level: "blue" },
    ],
  },
};

export const getScenario = (id: number): Scenario => TELEMETRY[id] ?? TELEMETRY[1];

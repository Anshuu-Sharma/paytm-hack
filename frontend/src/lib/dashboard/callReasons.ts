/** Preset reasons REX can place a "Call Customer" call for, plus a free-text
 * custom option — shared between the customer-picker page and the call UI so
 * the backend's ``reason`` key and the label shown on screen always agree. */

export type CallReasonKey = "late_payment" | "failed_payment" | "missed_subscription" | "win_back" | "custom";

export const CALL_REASONS: { key: CallReasonKey; label: string }[] = [
  { key: "late_payment", label: "Late Payment Reminder" },
  { key: "failed_payment", label: "Failed Transaction Follow-up" },
  { key: "missed_subscription", label: "Missed Subscription Renewal" },
  { key: "win_back", label: "Win-back Check-in" },
  { key: "custom", label: "Custom reason" },
];

export function callReasonLabel(key: CallReasonKey): string {
  return CALL_REASONS.find((r) => r.key === key)?.label ?? "General Check-in";
}

"use client";

import type { TransactionRow, LifecycleStatus } from "@/lib/dashboard/types";
import { inr } from "@/lib/dashboard/format";
import { useDash, tVocab } from "@/lib/dashboard/i18n";
import { CLASS_COLOR, statusTone } from "@/lib/dashboard/status";
import type { DashStrings } from "@/lib/dashboard/i18n";

function StatusBadge({ status, d }: { status: string; d: DashStrings }) {
  const tone = statusTone(status);
  const label = d.status[status as LifecycleStatus] ?? status;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: tone.soft, color: tone.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.fg }} />
      {label}
    </span>
  );
}

const TH = "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide";
const TD = "px-3 py-2.5 align-middle";

function WaIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-1-.3-1.6-.6-2.9-1.2-4.7-4.1-4.9-4.3-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.3 0 .5l-.4.5c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2 1.2.9 2 1.2 2.3 1.3.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.6-.1l1.8.9c.3.1.4.2.5.3.1.2.1.6-.1 1.1Z" />
    </svg>
  );
}
function CallIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 18l5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 2 8a2 2 0 0 1 2-2Z" transform="translate(-1 -3) scale(0.95)" />
    </svg>
  );
}

export type OpenConversation = (
  txnId: string,
  channel: "whatsapp" | "call",
  name: string
) => void;

export default function TransactionTable({
  rows,
  onSelect,
  showClass = true,
  onOpenConversation,
}: {
  rows: TransactionRow[];
  onSelect: (id: string) => void;
  showClass?: boolean;
  onOpenConversation?: OpenConversation;
}) {
  const { d } = useDash();
  const col = d.txns.col;

  if (!rows.length) {
    return (
      <div className="px-4 py-16 text-center text-[13px]" style={{ color: "var(--d-faint)" }}>
        {d.txns.noMatch}
      </div>
    );
  }
  return (
    <div className="max-h-[68vh] overflow-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 z-10">
          <tr
            style={{
              color: "var(--d-muted)",
              borderBottom: "1px solid var(--d-border)",
              background: "var(--d-surface)",
              boxShadow: "inset 0 -1px 0 var(--d-border)",
            }}
          >
            <th className={`${TH} text-right`}>{col.serial}</th>
            <th className={TH}>{col.customer}</th>
            {showClass ? <th className={TH}>{col.class}</th> : null}
            <th className={`${TH} text-right`}>{col.amount}</th>
            <th className={TH}>{col.status}</th>
            <th className={TH}>{col.playbook}</th>
            <th className={TH}>{col.channel}</th>
            <th className={`${TH} text-right`}>{col.when}</th>
            {onOpenConversation ? <th className={`${TH} text-center`} /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            return (
              <tr
                key={r.transaction_id}
                onClick={() => onSelect(r.transaction_id)}
                className="d-row cursor-pointer"
                style={
                  {
                    borderBottom: "1px solid var(--d-border)",
                    "--row-accent": CLASS_COLOR[r.failure_class],
                  } as React.CSSProperties
                }
              >
                <td className={`${TD} d-num text-right text-[12px]`} style={{ color: "var(--d-faint)" }}>
                  #{r.serial}
                </td>
                <td className={TD}>
                  <div className="font-medium" style={{ color: "var(--d-ink)" }}>
                    {r.customer_name ?? "—"}
                  </div>
                  <div className="d-num text-[11px]" style={{ color: "var(--d-faint)" }}>
                    {r.customer_contact_masked}
                  </div>
                </td>
                {showClass ? (
                  <td className={TD}>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-[3px]"
                        style={{ background: CLASS_COLOR[r.failure_class] }}
                      />
                      <span className="text-[12px]" style={{ color: "var(--d-muted)" }}>
                        {d.classShort[r.failure_class]}
                      </span>
                    </span>
                  </td>
                ) : null}
                <td className={`${TD} d-num text-right font-medium`}>{inr(r.amount_inr)}</td>
                <td className={TD}>
                  <StatusBadge status={r.status} d={d} />
                </td>
                <td className={`${TD} text-[12px]`} style={{ color: "var(--d-muted)" }}>
                  {tVocab("playbook", r.playbook, d)}
                </td>
                <td className={`${TD} text-[12px]`} style={{ color: "var(--d-muted)" }}>
                  {tVocab("channel", r.channel, d)}
                </td>
                <td className={`${TD} d-num text-right text-[12px]`} style={{ color: "var(--d-faint)" }}>
                  {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                </td>
                {onOpenConversation ? (
                  <td className={`${TD} whitespace-nowrap text-center`}>
                    <span className="inline-flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenConversation(r.transaction_id, "whatsapp", r.customer_name ?? "Customer");
                        }}
                        className="grid h-7 w-7 place-items-center rounded-md transition-colors"
                        style={{ color: "#25d366", background: "rgba(37,211,102,0.1)" }}
                        title="WhatsApp"
                        aria-label="WhatsApp"
                      >
                        <WaIcon />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenConversation(r.transaction_id, "call", r.customer_name ?? "Customer");
                        }}
                        className="grid h-7 w-7 place-items-center rounded-md transition-colors"
                        style={{ color: "var(--d-accent)", background: "var(--d-accent-soft)" }}
                        title="Call"
                        aria-label="Call"
                      >
                        <CallIcon />
                      </button>
                    </span>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

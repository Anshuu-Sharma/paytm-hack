"use client";

import { useMemo, useState } from "react";
import { inr } from "@/lib/dashboard/format";
import { useDash } from "@/lib/dashboard/i18n";

export type EventCategory = "paid" | "pending" | "sent";

export interface CalEvent {
  id: string;
  date: string; // "YYYY-MM-DD"
  label: string;
  amount: number;
  category: EventCategory;
}

export const CAT_COLOR: Record<EventCategory, string> = {
  paid: "var(--d-ok)",
  pending: "var(--d-warn)",
  sent: "var(--d-info)",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function keyOf(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

interface Cell {
  key: string;
  day: number;
  inMonth: boolean;
}

function monthCells(year: number, month: number): Cell[] {
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells: Cell[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = prevDays - i;
    cells.push({ key: keyOf(year, month - 1, d), day: d, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ key: keyOf(year, month, d), day: d, inMonth: true });
  let next = 1;
  while (cells.length % 7 !== 0) cells.push({ key: keyOf(year, month + 1, next), day: next++, inMonth: false });
  return cells;
}

export default function CalendarGrid({
  events,
  onEventClick,
}: {
  events: CalEvent[];
  onEventClick?: (id: string) => void;
}) {
  const { d } = useDash();
  const byDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const e of events) (map[e.date] ??= []).push(e);
    return map;
  }, [events]);

  // Default to the month holding the most events (so it's never empty on load).
  const defaultMonth = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) {
      const ym = e.date.slice(0, 7);
      counts[ym] = (counts[ym] ?? 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const base = top ? new Date(`${top}-01T00:00:00`) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  }, [events]);

  const [view, setView] = useState(defaultMonth);
  const cells = monthCells(view.year, view.month);
  const monthTitle = new Date(view.year, view.month, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const todayKey = keyOf(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const step = (delta: number) => {
    const dt = new Date(view.year, view.month + delta, 1);
    setView({ year: dt.getFullYear(), month: dt.getMonth() });
  };

  return (
    <div>
      {/* Month nav + legend */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} className="grid h-7 w-7 place-items-center rounded-md text-[14px] hover:bg-[var(--d-surface-2)]" style={{ color: "var(--d-muted)" }} aria-label="Previous month">‹</button>
          <span className="min-w-[130px] text-center text-[13px] font-semibold">{monthTitle}</span>
          <button onClick={() => step(1)} className="grid h-7 w-7 place-items-center rounded-md text-[14px] hover:bg-[var(--d-surface-2)]" style={{ color: "var(--d-muted)" }} aria-label="Next month">›</button>
          <button onClick={() => setView(defaultMonth)} className="ml-1 rounded-md px-2 py-1 text-[11px] font-medium hover:bg-[var(--d-surface-2)]" style={{ color: "var(--d-faint)" }}>•</button>
        </div>
        <div className="ml-auto flex items-center gap-3 text-[11px]" style={{ color: "var(--d-muted)" }}>
          {(["paid", "pending", "sent"] as EventCategory[]).map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: CAT_COLOR[c] }} />
              {d.cal[c]}
            </span>
          ))}
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-t-lg text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--d-faint)" }}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-1.5" style={{ background: "var(--d-surface-2)" }}>{w}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-b-lg" style={{ background: "var(--d-border)" }}>
        {cells.map((c) => {
          const evs = byDate[c.key] ?? [];
          const shown = evs.slice(0, 3);
          const extra = evs.length - shown.length;
          return (
            <div key={c.key} className="min-h-[96px] p-1.5" style={{ background: "var(--d-surface)", opacity: c.inMonth ? 1 : 0.45 }}>
              <div className="mb-1 flex justify-end">
                <span
                  className="grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[11px] font-medium"
                  style={c.key === todayKey
                    ? { background: "var(--d-accent)", color: "#fff" }
                    : { color: "var(--d-muted)" }}
                >
                  {c.day}
                </span>
              </div>
              <div className="space-y-1">
                {shown.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onEventClick?.(e.id)}
                    title={`${e.label} · ${inr(e.amount)}`}
                    className="flex w-full items-center gap-1 truncate rounded-[5px] px-1.5 py-0.5 text-left text-[10.5px] font-medium"
                    style={{ background: `color-mix(in srgb, ${CAT_COLOR[e.category]} 18%, transparent)`, color: CAT_COLOR[e.category] }}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CAT_COLOR[e.category] }} />
                    <span className="truncate">{e.label}</span>
                    <span className="d-num ml-auto shrink-0 opacity-80">{inr(e.amount, { compact: true })}</span>
                  </button>
                ))}
                {extra > 0 ? (
                  <div className="px-1.5 text-[10px]" style={{ color: "var(--d-faint)" }}>{d.cal.more(extra)}</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

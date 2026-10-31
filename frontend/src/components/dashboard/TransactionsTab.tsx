"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { item } from "@/lib/dashboard/motion";
import { Card, CardHeader, Chip } from "@/components/dashboard/Card";
import { AreaChart, FunnelBars, Donut, CountUp } from "@/components/dashboard/charts";
import { inr, pct, shortDate } from "@/lib/dashboard/format";
import { CLASS_COLOR } from "@/lib/dashboard/status";

/* ── Seeded RNG ── */
function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

/* ── Mock data (computed only when this chunk loads) ── */
const CLASS_META = [
  { id: 1, short: "C1", color: CLASS_COLOR[1], rate: 0.78, cases: 142, recoveredCases: 111, avgTtrMin: 4.7  },
  { id: 2, short: "C2", color: CLASS_COLOR[2], rate: 0.65, cases: 89,  recoveredCases: 58,  avgTtrMin: 7.0  },
  { id: 3, short: "C3", color: CLASS_COLOR[3], rate: 0.71, cases: 56,  recoveredCases: 40,  avgTtrMin: 14.8 },
  { id: 4, short: "C4", color: CLASS_COLOR[4], rate: 0.58, cases: 34,  recoveredCases: 20,  avgTtrMin: 40.0 },
];

const ROOT_CAUSES = ["Acquirer timeout", "OTP drop-off", "Low balance", "AP cycle delay", "Session expired"];
const ROOT_HEAT: number[][] = [
  [82, 12, 8,  4,  24],
  [6,  74, 14, 2,  18],
  [4,  8,  62, 6,   5],
  [2,  4,  12, 28,  3],
];

const rng1 = seeded(42);
const VELOCITY: number[][] = Array.from({ length: 14 }, () =>
  CLASS_META.map((c) => Math.max(0, Math.round((c.cases / 14) * (0.5 + rng1() * 1.0))))
);

const GMV_TOTAL    = 4_28_000;
const AVG_ORDER    = 1240;
const TOTAL_TXNS   = 3452;
const SUCCESS_RATE = 94.2;
const REFUND_RATE  = 1.8;
const DISPUTE_RATE = 0.6;

const rng2 = seeded(99);
let cumGmv = 0;
const GMV_SERIES = Array.from({ length: 30 }, (_, i) => {
  cumGmv += 8000 + rng2() * 12000;
  const d = new Date("2026-10-01");
  d.setDate(d.getDate() + i);
  return { label: shortDate(d.toISOString()), value: Math.round(cumGmv) };
});

const PAY_METHODS = [
  { label: "UPI",         value: 2140, failRate: 3.2, color: "var(--d-accent)" },
  { label: "Cards",       value: 759,  failRate: 8.4, color: CLASS_COLOR[2] },
  { label: "Net Banking", value: 380,  failRate: 4.1, color: CLASS_COLOR[3] },
  { label: "Wallets",     value: 173,  failRate: 1.2, color: CLASS_COLOR[4] },
];

const AOV_BUCKETS = [
  { label: "₹0–200",   count: 420,  color: "var(--d-slate)"  },
  { label: "₹200–500", count: 890,  color: CLASS_COLOR[2]    },
  { label: "₹500–1k",  count: 760,  color: CLASS_COLOR[1]    },
  { label: "₹1k–5k",   count: 980,  color: "var(--d-accent)" },
  { label: "₹5k+",     count: 180,  color: CLASS_COLOR[4]    },
];

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const rng3 = seeded(77);
const PEAK_GRID: number[][] = DAYS_OF_WEEK.map((_, d) =>
  Array.from({ length: 24 }, (_, h) => {
    const lunch = Math.exp(-0.5 * ((h - 13) / 1.5) ** 2);
    const eve   = Math.exp(-0.5 * ((h - 20) / 1.8) ** 2);
    const morn  = Math.exp(-0.5 * ((h - 10) / 1.2) ** 2) * 0.5;
    return Math.max(0, Math.min(1, (lunch + eve + morn) * (d < 5 ? 1.0 : 0.65) * (0.7 + rng3() * 0.6)));
  })
);

const TOP_CUSTOMERS = [
  { rank: 1,  name: "Mohan Verma",   txns: 128, gmv: 1_58_400, last: "Today",     growth: "+12%" },
  { rank: 2,  name: "Priya Sharma",  txns: 94,  gmv: 1_12_800, last: "Yesterday", growth: "+8%"  },
  { rank: 3,  name: "Kavita Nair",   txns: 87,  gmv: 1_04_400, last: "Yesterday", growth: "+21%" },
  { rank: 4,  name: "Suresh Mehta",  txns: 76,  gmv: 91_200,   last: "2d ago",    growth: "+5%"  },
  { rank: 5,  name: "Nirmala Yadav", txns: 68,  gmv: 81_600,   last: "2d ago",    growth: "+18%" },
  { rank: 6,  name: "Geeta Mishra",  txns: 61,  gmv: 73_200,   last: "3d ago",    growth: "+3%"  },
  { rank: 7,  name: "Sunita Patel",  txns: 55,  gmv: 66_000,   last: "4d ago",    growth: "-2%"  },
  { rank: 8,  name: "Rajesh Kumar",  txns: 48,  gmv: 57_600,   last: "5d ago",    growth: "-7%"  },
  { rank: 9,  name: "Ashok Tiwari",  txns: 42,  gmv: 50_400,   last: "6d ago",    growth: "+1%"  },
  { rank: 10, name: "Vikram Rao",    txns: 36,  gmv: 43_200,   last: "1w ago",    growth: "-14%" },
];

const fmtPct = (v: number) => `${Math.round(v)}%`;

/* ── Sub-components ── */

function VelocityStrip({ data, color, label }: { data: number[]; color: string; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data, 1);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium" style={{ color: "var(--d-ink)" }}>{label}</span>
        <span className="font-mono text-[11px]" style={{ color: "var(--d-muted)" }}>
          {hover !== null ? `Day ${hover + 1}: ${data[hover]}` : `${data[data.length - 1]} today`}
        </span>
      </div>
      <div className="flex items-end gap-[3px]" style={{ height: 36 }} onPointerLeave={() => setHover(null)}>
        {data.map((v, i) => (
          <div key={i} className="flex-1 cursor-default rounded-[3px]"
            style={{
              height: `${18 + (v / max) * 82}%`,
              background: color,
              opacity: hover === null ? 0.28 + (i / data.length) * 0.72 : hover === i ? 1 : 0.2,
              transition: "opacity 150ms ease",
            }}
            onPointerEnter={() => setHover(i)} />
        ))}
      </div>
    </div>
  );
}

function ClassKpiTile({ c }: { c: (typeof CLASS_META)[0] }) {
  return (
    <section className="relative flex h-full flex-col justify-between overflow-hidden rounded-[26px] p-5"
      style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)" }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--d-muted)" }}>{c.short}</span>
        <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
      </div>
      <div>
        <div className="mt-3 text-[30px] font-semibold leading-none tracking-[-0.03em]" style={{ color: c.color }}>
          <CountUp value={c.rate * 100} format={fmtPct} />
        </div>
        <div className="mt-1 text-[11px]" style={{ color: "var(--d-muted)" }}>{c.recoveredCases}/{c.cases} recovered</div>
      </div>
      <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--d-border)" }}>
        <span className="text-[10px]" style={{ color: "var(--d-faint)" }}>avg TTR · </span>
        <span className="font-mono text-[12px] font-semibold" style={{ color: "var(--d-ink)" }}>
          {c.avgTtrMin < 60 ? `${c.avgTtrMin}m` : `${(c.avgTtrMin / 60).toFixed(1)}h`}
        </span>
      </div>
    </section>
  );
}

function RootCauseHeatmap() {
  const [hovered, setHovered] = useState<[number, number] | null>(null);
  const maxVal = Math.max(...ROOT_HEAT.flat());
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="pb-2 pr-3 text-left text-[10px] font-medium" style={{ color: "var(--d-faint)" }}>Class</th>
            {ROOT_CAUSES.map((c) => (
              <th key={c} className="pb-2 px-1 text-center text-[9.5px] font-medium leading-tight"
                style={{ color: "var(--d-faint)", maxWidth: 60, wordBreak: "break-word" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CLASS_META.map((cls, ri) => (
            <tr key={cls.id}>
              <td className="py-1 pr-3 whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: cls.color }} />
                  <span style={{ color: "var(--d-muted)" }}>{cls.short}</span>
                </div>
              </td>
              {ROOT_HEAT[ri].map((val, ci) => {
                const intensity = val / maxVal;
                const isHov = hovered?.[0] === ri && hovered?.[1] === ci;
                return (
                  <td key={ci} className="px-1 py-1"
                    onPointerEnter={() => setHovered([ri, ci])}
                    onPointerLeave={() => setHovered(null)}>
                    <div className="relative mx-auto flex h-9 w-full min-w-[40px] cursor-default items-center justify-center rounded-lg transition-all duration-150"
                      style={{
                        background: `color-mix(in oklch, ${cls.color} ${Math.round(intensity * 80)}%, var(--d-surface-2))`,
                        transform: isHov ? "scale(1.08)" : "scale(1)",
                      }}>
                      <span className="font-mono font-semibold"
                        style={{ color: intensity > 0.5 ? cls.color : "var(--d-muted)", fontSize: 11 }}>{val}</span>
                      {isHov && (
                        <div className="absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-medium"
                          style={{ background: "var(--d-surface)", border: "1px solid var(--d-border-strong)", color: "var(--d-ink)" }}>
                          {cls.short} · {ROOT_CAUSES[ci]}
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeakHoursHeatmap() {
  const [hovered, setHovered] = useState<[number, number] | null>(null);
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const showHours = [0, 3, 6, 9, 12, 15, 18, 21, 23];
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex gap-3">
          {[{ label: "Low", opacity: 0.15 }, { label: "Med", opacity: 0.5 }, { label: "High", opacity: 1 }].map((l) => (
            <div key={l.label} className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm" style={{ background: "var(--d-accent)", opacity: l.opacity }} />
              <span className="text-[10px]" style={{ color: "var(--d-faint)" }}>{l.label}</span>
            </div>
          ))}
        </div>
        {hovered && (
          <span className="text-[11px] font-medium" style={{ color: "var(--d-ink)" }}>
            {DAYS_OF_WEEK[hovered[0]]} · {hovered[1]}:00 — {Math.round(PEAK_GRID[hovered[0]][hovered[1]] * 220)} txns
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: 560 }}>
          <div className="mb-1 flex" style={{ paddingLeft: 32 }}>
            {hours.map((h) => (
              <div key={h} className="flex-1 text-center font-mono"
                style={{ fontSize: 8.5, color: showHours.includes(h) ? "var(--d-muted)" : "transparent" }}>{h}</div>
            ))}
          </div>
          {DAYS_OF_WEEK.map((day, di) => (
            <div key={day} className="mb-[3px] flex items-center">
              <span className="w-8 shrink-0 pr-2 text-right text-[10px]" style={{ color: "var(--d-muted)" }}>{day}</span>
              {hours.map((h) => {
                const val = PEAK_GRID[di][h];
                const isHov = hovered?.[0] === di && hovered?.[1] === h;
                return (
                  <div key={h} className="flex-1 cursor-default" style={{ padding: "0 1px" }}
                    onPointerEnter={() => setHovered([di, h])}
                    onPointerLeave={() => setHovered(null)}>
                    <div className="w-full rounded-[4px] transition-transform duration-100"
                      style={{
                        height: 22,
                        background: `color-mix(in oklch, var(--d-accent) ${Math.round(val * 90)}%, var(--d-surface-2))`,
                        transform: isHov ? "scale(1.25)" : "scale(1)",
                        position: "relative", zIndex: isHov ? 10 : 1,
                      }} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AovHistogram() {
  const [hovered, setHovered] = useState<number | null>(null);
  const maxCount = Math.max(...AOV_BUCKETS.map((b) => b.count));
  const total = AOV_BUCKETS.reduce((s, b) => s + b.count, 0);
  return (
    <div className="space-y-2">
      {AOV_BUCKETS.map((b, i) => (
        <div key={b.label} className="flex cursor-default items-center gap-3"
          onPointerEnter={() => setHovered(i)} onPointerLeave={() => setHovered(null)}>
          <span className="w-16 shrink-0 text-[11px]" style={{ color: "var(--d-muted)" }}>{b.label}</span>
          <div className="h-5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--d-surface-2)" }}>
            <motion.div className="h-full rounded-full"
              style={{ background: b.color, opacity: hovered === null || hovered === i ? 1 : 0.3 }}
              initial={{ width: 0 }}
              animate={{ width: `${(b.count / maxCount) * 100}%` }}
              transition={{ duration: 0.75, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className="w-16 shrink-0 text-right font-mono text-[11px]" style={{ color: "var(--d-ink)" }}>
            {b.count.toLocaleString("en-IN")}
            <span className="ml-1 text-[10px]" style={{ color: "var(--d-faint)" }}>({pct(b.count / total)})</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Main export ── */
export default function TransactionsTab() {
  const velByClass = CLASS_META.map((_, ci) => VELOCITY.map((row) => row[ci]));
  const totalRecovered = CLASS_META.reduce((s, c) => s + c.recoveredCases, 0);
  const totalCases     = CLASS_META.reduce((s, c) => s + c.cases, 0);
  const overallRate    = totalRecovered / totalCases;
  const dailyTotal     = VELOCITY.map((row) => row.reduce((s, v) => s + v, 0));
  const maxDailyAbs    = Math.max(...dailyTotal, 1);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

      {/* Recovery hero */}
      <motion.div variants={item} className="d-hero relative overflow-hidden rounded-[26px] p-6 sm:col-span-2">
        <div className="d-hero-mesh" aria-hidden />
        <div className="relative flex h-full flex-col justify-between gap-6">
          <div>
            <span className="d-label text-[11px]" style={{ color: "rgba(255,255,255,0.65)" }}>Overall Recovery Rate</span>
            <div className="d-num mt-2 font-semibold leading-none tracking-[-0.04em] text-white"
              style={{ fontSize: "clamp(3rem, 6vw, 4.5rem)" }}>
              <CountUp value={overallRate * 100} format={fmtPct} />
            </div>
            <p className="mt-2 text-[13px]" style={{ color: "rgba(255,255,255,0.75)" }}>
              {totalRecovered} of {totalCases} cases recovered across 4 failure classes
            </p>
            <div className="mt-5">
              <div className="flex items-end gap-[3px]" style={{ height: 44 }}>
                {dailyTotal.map((v, i) => (
                  <div key={i} className="flex-1 rounded-[3px]"
                    style={{
                      height: `${18 + (v / maxDailyAbs) * 82}%`,
                      background: "rgba(255,255,255,0.9)",
                      opacity: 0.18 + (i / dailyTotal.length) * 0.65,
                    }} />
                ))}
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.42)" }}>
                <span>14d ago</span><span>Cases closed / day</span><span>Today</span>
              </div>
            </div>
          </div>
          <div className="flex gap-6 border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
            {CLASS_META.map((c) => (
              <div key={c.id}>
                <span className="d-label text-[10px]" style={{ color: "rgba(255,255,255,0.55)" }}>{c.short}</span>
                <div className="d-num mt-1 text-[18px] font-semibold text-white">{Math.round(c.rate * 100)}%</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* 4 class KPI tiles */}
      {CLASS_META.map((c) => (
        <motion.div key={c.id} variants={item}><ClassKpiTile c={c} /></motion.div>
      ))}

      {/* Root cause heatmap (3 cols) */}
      <motion.div variants={item} className="sm:col-span-2 lg:col-span-3">
        <Card>
          <CardHeader title="Root Cause Heatmap" subtitle="Cases per class × failure mode — brighter = more frequent" />
          <div className="px-5 pb-5"><RootCauseHeatmap /></div>
        </Card>
      </motion.div>

      {/* Recovery velocity (1 col) */}
      <motion.div variants={item}>
        <Card className="h-full">
          <CardHeader title="Velocity" subtitle="Cases / day · 14d" />
          <div className="space-y-4 px-5 pb-5">
            {CLASS_META.map((c, ci) => (
              <VelocityStrip key={c.id} label={c.short} data={velByClass[ci]} color={c.color} />
            ))}
          </div>
        </Card>
      </motion.div>

      {/* GMV chart (2 cols, 2 rows) */}
      <motion.div variants={item} className="sm:col-span-2 lg:col-span-2 lg:row-span-2">
        <Card className="h-full">
          <CardHeader title="GMV Over Time" subtitle="Cumulative gross merchandise value — October 2026"
            right={<span className="d-num text-[13px] font-semibold" style={{ color: "var(--d-ok)" }}>{inr(GMV_TOTAL)}</span>}
          />
          <div className="px-3 pb-3"><AreaChart data={GMV_SERIES} color="var(--d-ok)" height={220} /></div>
        </Card>
      </motion.div>

      {/* Total Transactions solid */}
      <motion.div variants={item}>
        <section className="relative flex min-h-[130px] flex-col justify-between overflow-hidden rounded-[26px] p-5"
          style={{ background: "var(--d-info)", color: "white" }}>
          <span className="text-[12px] font-semibold" style={{ opacity: 0.75 }}>Total Transactions</span>
          <div>
            <div className="d-num text-[28px] font-semibold leading-none tracking-[-0.03em]">
              {TOTAL_TXNS.toLocaleString("en-IN")}
            </div>
            <div className="mt-1 text-[11px]" style={{ opacity: 0.65 }}>payment attempts · 30d</div>
          </div>
        </section>
      </motion.div>

      {/* Success Rate solid */}
      <motion.div variants={item}>
        <section className="relative flex min-h-[130px] flex-col justify-between overflow-hidden rounded-[26px] p-5"
          style={{ background: "var(--d-ok)", color: "oklch(0.22 0.08 145)" }}>
          <span className="text-[12px] font-semibold" style={{ opacity: 0.75 }}>Success Rate</span>
          <div>
            <div className="d-num text-[28px] font-semibold leading-none tracking-[-0.03em]">{SUCCESS_RATE}%</div>
            <div className="mt-1 text-[11px]" style={{ opacity: 0.65 }}>{REFUND_RATE}% refund · {DISPUTE_RATE}% dispute</div>
          </div>
        </section>
      </motion.div>

      {/* Payment Mix */}
      <motion.div variants={item}>
        <Card>
          <CardHeader title="Payment Mix" subtitle="By method" />
          <div className="flex flex-col items-center px-5 pb-5">
            <Donut
              segments={PAY_METHODS.map((m) => ({ label: m.label, value: m.value, color: m.color }))}
              size={130} centerLabel="methods" centerValue="4"
            />
            <div className="mt-3 w-full space-y-1.5">
              {PAY_METHODS.map((m) => {
                const share = m.value / PAY_METHODS.reduce((s, x) => s + x.value, 0);
                return (
                  <div key={m.label} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
                      <span style={{ color: "var(--d-ink)" }}>{m.label}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-mono" style={{ color: "var(--d-muted)" }}>{pct(share)}</span>
                      <span className="font-mono" style={{ color: m.failRate > 5 ? "var(--d-bad)" : "var(--d-faint)" }}>
                        {m.failRate}%✗
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Customer Segments */}
      <motion.div variants={item}>
        <Card>
          <CardHeader title="Customer Segments" subtitle="Frequency cohorts" />
          <div className="px-5 pb-5">
            <FunnelBars stages={[
              { label: "Loyal (4+ visits)", value: 48,  color: "var(--d-ok)",     amount: inr(2_14_000, { compact: true }) },
              { label: "Returning (2–3)",   value: 87,  color: "var(--d-accent)", amount: inr(1_56_000, { compact: true }) },
              { label: "New (1 visit)",      value: 120, color: "var(--d-info)",  amount: inr(98_000,   { compact: true }) },
              { label: "At-Risk (dormant)",  value: 39,  color: "var(--d-warn)",  amount: inr(54_000,   { compact: true }) },
              { label: "Lost (60d+)",        value: 14,  color: "var(--d-bad)"                                             },
            ]} />
          </div>
        </Card>
      </motion.div>

      {/* AOV distribution */}
      <motion.div variants={item}>
        <Card>
          <CardHeader title="Order Value Distribution" subtitle="By amount bucket" />
          <div className="px-5 pb-5"><AovHistogram /></div>
        </Card>
      </motion.div>

      {/* Top 10 customers (3 cols) */}
      <motion.div variants={item} className="sm:col-span-2 lg:col-span-3">
        <Card>
          <CardHeader title="Top 10 Customers by GMV" subtitle="Ranked by 30-day gross spend"
            right={
              <Chip tone={{ fg: "var(--d-slate)", soft: "var(--d-slate-soft)" }}>
                {inr(TOP_CUSTOMERS.reduce((s, c) => s + c.gmv, 0), { compact: true })} combined
              </Chip>
            }
          />
          <div className="px-1 pb-3">
            <table className="w-full border-collapse text-left text-[12.5px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--d-border)" }}>
                  {["#", "Customer", "Transactions", "GMV", "Last Active", "30d Trend"].map((h) => (
                    <th key={h} className="px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--d-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TOP_CUSTOMERS.map((c) => {
                  const positive = c.growth.startsWith("+");
                  return (
                    <tr key={c.rank} className="transition-colors" style={{ borderBottom: "1px solid var(--d-border)" }}
                      onPointerEnter={(e) => (e.currentTarget.style.background = "var(--d-surface-2)")}
                      onPointerLeave={(e) => (e.currentTarget.style.background = "")}>
                      <td className="px-4 py-3">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10.5px] font-bold"
                          style={{
                            background: c.rank <= 3 ? "var(--d-accent-soft)" : "var(--d-surface-2)",
                            color: c.rank <= 3 ? "var(--d-accent)" : "var(--d-faint)",
                          }}>{c.rank}</span>
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--d-ink)" }}>{c.name}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: "var(--d-muted)" }}>{c.txns}</td>
                      <td className="px-4 py-3 font-mono font-semibold" style={{ color: "var(--d-ok)" }}>{inr(c.gmv, { compact: true })}</td>
                      <td className="px-4 py-3 text-[11px]" style={{ color: "var(--d-muted)" }}>{c.last}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full px-2 py-0.5 font-mono text-[10.5px] font-semibold"
                          style={{
                            background: positive ? "var(--d-ok-soft)" : "var(--d-bad-soft)",
                            color: positive ? "var(--d-ok)" : "var(--d-bad)",
                          }}>{c.growth}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>

      {/* Peak hours heatmap (full width) */}
      <motion.div variants={item} className="sm:col-span-2 lg:col-span-4">
        <Card>
          <CardHeader title="Peak Transaction Hours" subtitle="Volume heatmap — day of week × hour of day"
            right={<Chip tone={{ fg: "var(--d-info)", soft: "var(--d-info-soft)" }}>168 time slots</Chip>}
          />
          <div className="px-5 pb-5"><PeakHoursHeatmap /></div>
        </Card>
      </motion.div>

    </div>
  );
}

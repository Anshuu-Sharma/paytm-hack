"use client";

/**
 * Hand-rolled SVG chart primitives — a small, cohesive set tuned to the light
 * dashboard aesthetic. No chart dependency: every mark is drawn here so the
 * styling stays consistent and the bundle stays lean.
 */

import { animate, motion } from "framer-motion";
import { useEffect, useRef } from "react";

interface XY {
  x: number;
  y: number;
}

/** Animated number that counts up from 0 on mount / when the value changes.
 * Writes to the DOM node directly (no React state), so it never trips the
 * strict set-state-in-effect lint and never re-renders the tree per frame. */
export function CountUp({
  value,
  format,
  className,
  duration = 0.9,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        node.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [value, format, duration]);
  return (
    <span ref={ref} className={className}>
      {format(0)}
    </span>
  );
}

function buildPath(points: XY[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

/** Tiny inline trend line for KPI cards. */
export function Sparkline({
  values,
  color,
  width = 96,
  height = 30,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return <svg width={width} height={height} />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * width,
    y: height - ((v - min) / span) * (height - 4) - 2,
  }));
  const area = `${buildPath(pts)} L ${width} ${height} L 0 ${height} Z`;
  const id = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={buildPath(pts)} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Cumulative area chart with a soft gradient fill and light gridlines. */
export function AreaChart({
  data,
  color,
  height = 220,
}: {
  data: { label: string; value: number }[];
  color: string;
  height?: number;
}) {
  const W = 760;
  const H = height;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 26;
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[12px]"
        style={{ height, color: "var(--d-faint)" }}
      >
        Not enough data yet.
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const pts = data.map((d, i) => ({
    x: padL + (i / (data.length - 1)) * innerW,
    y: padT + innerH - (d.value / max) * innerH,
  }));
  const line = buildPath(pts);
  const area = `${line} L ${pts[pts.length - 1].x} ${padT + innerH} L ${pts[0].x} ${
    padT + innerH
  } Z`;
  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((f) => padT + innerH - f * innerH);
  // Thin the x labels so they don't collide.
  const step = Math.ceil(data.length / 7);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <defs>
        <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridYs.map((y, i) => (
        <line key={i} x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--d-border)" strokeWidth="1" />
      ))}
      <path d={area} fill="url(#area-fill)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {pts.map((p, i) =>
        i === pts.length - 1 ? (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={color} stroke="var(--d-surface)" strokeWidth="2" />
        ) : null
      )}
      {data.map((d, i) =>
        i % step === 0 || i === data.length - 1 ? (
          <text
            key={i}
            x={pts[i].x}
            y={H - 8}
            textAnchor="middle"
            fontSize="10"
            fill="var(--d-faint)"
            fontFamily="var(--font-num)"
          >
            {d.label}
          </text>
        ) : null
      )}
    </svg>
  );
}

/** Semicircular gauge for a 0..1 rate (e.g. GRRR). */
export function Gauge({
  value,
  color,
  size = 176,
}: {
  value: number;
  color: string;
  size?: number;
}) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = Math.PI * r; // half circle
  const clamped = Math.max(0, Math.min(1, value));
  const arc = (a: number) => {
    const x = cx + r * Math.cos(Math.PI - Math.PI * a);
    const y = cy - r * Math.sin(Math.PI - Math.PI * a);
    return { x, y };
  };
  const start = arc(0);
  const end = arc(1);
  const trackPath = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;
  return (
    <svg width={size} height={size / 2 + 24} viewBox={`0 0 ${size} ${size / 2 + 24}`}>
      <path d={trackPath} fill="none" stroke="var(--d-surface-2)" strokeWidth={stroke} strokeLinecap="round" />
      <path
        d={trackPath}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - clamped)}
      />
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        fontSize="30"
        fontWeight="600"
        fill="var(--d-ink)"
        fontFamily="var(--font-num)"
      >
        {Math.round(clamped * 100)}%
      </text>
    </svg>
  );
}

/** Decreasing horizontal funnel — the overview centrepiece. Bars fill on load,
 * staggered, and each stage carries its count plus (where known) its rupee value. */
export function FunnelBars({
  stages,
}: {
  stages: { label: string; value: number; color: string; amount?: string }[];
}) {
  const max = Math.max(...stages.map((s) => s.value)) || 1;
  return (
    <div className="space-y-3">
      {stages.map((s, i) => (
        <div key={s.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-[12.5px]" style={{ color: "var(--d-muted)" }}>
            {s.label}
          </span>
          <div className="relative h-9 flex-1 overflow-hidden rounded-lg" style={{ background: "var(--d-surface-2)" }}>
            <motion.div
              className="flex h-full items-center rounded-lg pl-3 text-white"
              style={{ background: s.color }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max((s.value / max) * 100, 9)}%` }}
              transition={{ duration: 0.7, delay: 0.1 + i * 0.09, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="d-num text-[13px] font-semibold">{s.value}</span>
            </motion.div>
          </div>
          <span
            className="d-num w-20 shrink-0 text-right text-[12px]"
            style={{ color: "var(--d-muted)" }}
          >
            {s.amount ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Labeled horizontal bars (e.g. recovered by class, stopping rules). */
export function HBarList({
  rows,
}: {
  rows: { label: string; value: number; display?: string; color: string; sub?: string }[];
}) {
  const max = Math.max(...rows.map((r) => r.value)) || 1;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-baseline justify-between text-[12px]">
            <span className="font-medium" style={{ color: "var(--d-ink)" }}>
              {r.label}
            </span>
            <span className="d-num" style={{ color: "var(--d-muted)" }}>
              {r.display ?? r.value}
              {r.sub ? <span style={{ color: "var(--d-faint)" }}> · {r.sub}</span> : null}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--d-surface-2)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.max((r.value / max) * 100, 3)}%`, background: r.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Donut with a centred total. */
export function Donut({
  segments,
  size = 168,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const stroke = 20;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--d-surface-2)" strokeWidth={stroke} />
        {segments.map((seg) => {
          const frac = seg.value / total;
          const dash = frac * circ;
          const el = (
            <circle
              key={seg.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      {centerValue ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="d-num text-xl font-semibold">{centerValue}</span>
          {centerLabel ? (
            <span className="d-label mt-0.5" style={{ color: "var(--d-faint)" }}>
              {centerLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

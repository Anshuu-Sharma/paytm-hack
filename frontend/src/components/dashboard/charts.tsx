"use client";

/**
 * Hand-rolled SVG chart primitives — a small, cohesive set tuned to the light
 * dashboard aesthetic. No chart dependency: every mark is drawn here so the
 * styling stays consistent and the bundle stays lean.
 */

import { animate, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

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

/** Cubic bezier smooth path — same algorithm as ChartTile in the bento file. */
function smooth(pts: Array<[number, number]>): string {
  return pts
    .map(([x, y], i) => {
      if (i === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      const [px, py] = pts[i - 1];
      const m = (px + x) / 2;
      return `C ${m.toFixed(1)} ${py.toFixed(1)}, ${m.toFixed(1)} ${y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

type ChartRange = "2W" | "1M" | "All";

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

/**
 * Interactive area chart — smooth bezier curves, hover crosshair, range pills.
 * Pattern taken from ChartTile in the bento design reference.
 */
export function AreaChart({
  data,
  color,
  height = 220,
}: {
  data: { label: string; value: number }[];
  color: string;
  height?: number;
}) {
  const [range, setRange] = useState<ChartRange>("All");
  const [hover, setHover] = useState<number | null>(null);

  const W = 640;
  const H = height;
  const padL = 4;
  const padR = 4;
  const padT = 10;
  const padB = 28;

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center text-[12px]" style={{ height, color: "var(--d-faint)" }}>
        Not enough data yet.
      </div>
    );
  }

  const take = { "2W": 14, "1M": 30, "All": data.length }[range];
  const slice = data.slice(-take);
  const max = Math.max(...slice.map((d) => d.value)) || 1;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const pts: [number, number][] = slice.map((d, i) => [
    padL + (i / Math.max(slice.length - 1, 1)) * innerW,
    padT + innerH - (d.value / max) * innerH,
  ]);

  const la = smooth(pts);
  const area = `${la} L ${pts[pts.length - 1][0]} ${padT + innerH} L ${pts[0][0]} ${padT + innerH} Z`;
  const idx = hover ?? slice.length - 1;
  const uid = `af-${color.replace(/[^a-z0-9]/gi, "")}`;

  /* sparse x-axis labels */
  const labelStep = Math.ceil(slice.length / 5);
  const labelIdxs = slice
    .map((_, i) => i)
    .filter((i) => i === 0 || i % labelStep === 0 || i === slice.length - 1);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(slice.length - 1, Math.round(((e.clientX - r.left) / r.width) * (slice.length - 1)))));
  };

  return (
    <div>
      {/* Pills + hovered label */}
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <p className="d-num text-[13px] font-medium" style={{ color: "var(--d-muted)" }} aria-live="polite">
          {slice[idx]?.label ?? ""}
        </p>
        <div role="radiogroup" aria-label="Chart range" className="inline-flex rounded-full border p-0.5" style={{ borderColor: "var(--d-border)" }}>
          {(["2W", "1M", "All"] as ChartRange[]).map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={o === range}
              onClick={() => { setRange(o); setHover(null); }}
              className="rounded-full px-2.5 py-1 font-mono text-[11px] font-medium transition-colors focus-visible:outline-none"
              style={o === range
                ? { background: "var(--d-ink)", color: "var(--d-bg)" }
                : { color: "var(--d-muted)" }}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div
        className="relative touch-pan-y"
        style={{ height }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Recovery chart, current value ${slice[idx]?.label ?? ""}`}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.26" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* dashed grid */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f}
              x1={padL} y1={padT + innerH - f * innerH}
              x2={W - padR} y2={padT + innerH - f * innerH}
              stroke="var(--d-border)" strokeWidth="1"
              vectorEffect="non-scaling-stroke" strokeDasharray="1 5"
            />
          ))}
          {/* area fill */}
          <path d={area} fill={`url(#${uid})`} />
          {/* smooth line */}
          <path
            key={range}
            d={la}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* endpoint dot */}
          <circle
            cx={pts[pts.length - 1][0]}
            cy={pts[pts.length - 1][1]}
            r="4"
            fill={color}
            stroke="var(--d-surface)"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
          {/* x labels */}
          {labelIdxs.map((li) => (
            <text key={li}
              x={pts[li][0]}
              y={H - 8}
              textAnchor={li === 0 ? "start" : li === slice.length - 1 ? "end" : "middle"}
              fontSize="10"
              fill="var(--d-faint)"
              fontFamily="var(--font-num)"
            >
              {slice[li].label}
            </text>
          ))}
        </svg>

        {/* hover crosshair */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2"
          style={{
            left: `${(pts[idx][0] / W) * 100}%`,
            background: "var(--d-border-strong)",
            opacity: hover !== null ? 1 : 0,
            transition: "opacity 150ms ease",
          }}
        />
        {/* hover dot */}
        <span
          aria-hidden
          className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px]"
          style={{
            left: `${(pts[idx][0] / W) * 100}%`,
            top: `${(pts[idx][1] / H) * 100}%`,
            background: color,
            borderColor: "var(--d-surface)",
            opacity: hover !== null ? 1 : 0,
            transition: "opacity 150ms ease",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Horizontal segmented allocation bar — pattern from AllocationTile in the bento reference.
 */
export function SegmentBar({
  segments,
  colors,
}: {
  segments: { label: string; value: number }[];
  colors: string[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;

  return (
    <div>
      <div
        className="flex h-8 gap-1"
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label="Allocation breakdown"
      >
        {segments.map((s, i) => (
          <div
            key={s.label}
            onPointerEnter={() => setHover(i)}
            className="rounded-[8px] transition-opacity duration-200"
            style={{
              flexBasis: `${(s.value / total) * 100}%`,
              background: colors[i % colors.length],
              opacity: hover === null || hover === i ? 1 : 0.28,
            }}
            aria-label={`${s.label}: ${((s.value / total) * 100).toFixed(1)}%`}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {segments.map((s, i) => (
          <li key={s.label}
            className="flex items-center justify-between gap-2 text-[12px]"
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          >
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: colors[i % colors.length] }} aria-hidden />
              <span style={{ color: "var(--d-muted)" }}>{s.label}</span>
            </span>
            <span className="d-num" style={{ color: "var(--d-ink)" }}>
              {((s.value / total) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
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

/**
 * Funnel stages rendered as activity-style list rows — icon chip, label,
 * animated fill bar, count badge and optional rupee amount.
 * Row pattern from ActivityTile in the bento design reference.
 */
export function FunnelBars({
  stages,
}: {
  stages: { label: string; value: number; color: string; amount?: string }[];
}) {
  const max = Math.max(...stages.map((s) => s.value)) || 1;
  return (
    <div className="-mx-2 space-y-1">
      {stages.map((s, i) => (
        <div
          key={s.label}
          className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors"
          style={{ ["--hover-bg" as string]: "var(--d-surface-2)" }}
          onPointerEnter={(e) => (e.currentTarget.style.background = "var(--d-surface-2)")}
          onPointerLeave={(e) => (e.currentTarget.style.background = "")}
        >
          {/* Colour-coded icon chip */}
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
            style={{ background: `color-mix(in oklch, ${s.color} 18%, var(--d-surface-2))`, color: s.color }}
            aria-hidden
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M22 12H2M2 12l6-6M2 12l6 6" />
            </svg>
          </span>

          {/* Label + bar */}
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[13px] font-medium" style={{ color: "var(--d-ink)" }}>{s.label}</span>
              <span className="d-num text-[12px]" style={{ color: "var(--d-muted)" }}>{s.amount ?? ""}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--d-surface-2)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: s.color }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max((s.value / max) * 100, 4)}%` }}
                transition={{ duration: 0.75, delay: 0.08 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>

          {/* Count badge */}
          <span
            className="d-num shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{
              background: `color-mix(in oklch, ${s.color} 14%, var(--d-surface-2))`,
              color: s.color,
            }}
          >
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Activity-style list — icon chip, label, display value, sub text, inline fill bar.
 * Pattern from ActivityTile in the bento design reference.
 */
export function HBarList({
  rows,
}: {
  rows: { label: string; value: number; display?: string; color: string; sub?: string }[];
}) {
  const max = Math.max(...rows.map((r) => r.value)) || 1;
  return (
    <div className="-mx-2 space-y-0.5">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors"
          onPointerEnter={(e) => (e.currentTarget.style.background = "var(--d-surface-2)")}
          onPointerLeave={(e) => (e.currentTarget.style.background = "")}
        >
          {/* icon chip */}
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[11px] font-bold"
            style={{ background: `color-mix(in oklch, ${r.color} 18%, var(--d-surface-2))`, color: r.color }}
            aria-hidden
          >
            {r.label.slice(0, 2).toUpperCase()}
          </span>
          {/* bar track */}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="truncate text-[13px] font-medium" style={{ color: "var(--d-ink)" }}>
                {r.label}
              </span>
              <span className="d-num ml-2 shrink-0 text-[12px]" style={{ color: "var(--d-muted)" }}>
                {r.display ?? r.value}
                {r.sub ? <span style={{ color: "var(--d-faint)" }}> · {r.sub}</span> : null}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--d-surface-2)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.max((r.value / max) * 100, 3)}%`, background: r.color }}
              />
            </div>
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

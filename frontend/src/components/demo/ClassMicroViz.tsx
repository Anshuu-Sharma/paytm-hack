"use client";

import type { MicroViz } from "@/lib/failure-classes";

/**
 * Small class-specific wireframe visual that animates its "fix" on card hover
 * (triggered by the parent `.group`). Pure SVG/CSS — a preview of what the
 * Mission Control visualizer will render in full.
 */

const STROKE = "var(--wire-line)";
const FAIL = "var(--color-fail)";
const BLUE = "var(--color-blue)";
const WAIT = "var(--color-wait)";

export default function ClassMicroViz({ type }: { type: MicroViz }) {
  return (
    <svg
      viewBox="0 0 120 72"
      className="h-16 w-28 overflow-visible"
      fill="none"
      aria-hidden
    >
      {type === "reroute" && <Reroute />}
      {type === "otp" && <Otp />}
      {type === "calendar" && <Calendar />}
      {type === "invoice" && <Invoice />}
    </svg>
  );
}

function Node({ x, y, color = STROKE }: { x: number; y: number; color?: string }) {
  return <rect x={x - 5} y={y - 5} width="10" height="10" rx="2" stroke={color} />;
}

function Reroute() {
  return (
    <>
      <Node x={12} y={36} />
      <Node x={60} y={12} color={FAIL} />
      <Node x={108} y={36} color={BLUE} />
      {/* broken direct path (fades on hover) */}
      <path
        d="M17 34 L55 15"
        stroke={FAIL}
        strokeDasharray="4 3"
        className="transition-opacity duration-500 group-hover:opacity-20"
      />
      {/* new re-routed blue path (draws on hover) */}
      <path
        d="M17 40 C 50 66, 78 60, 103 40"
        stroke={BLUE}
        strokeDasharray="120"
        strokeDashoffset="120"
        className="transition-all duration-700 [stroke-dashoffset:120] group-hover:[stroke-dashoffset:0]"
        style={{ filter: "drop-shadow(0 0 4px var(--brand-blue-glow))" }}
      />
    </>
  );
}

function Otp() {
  return (
    <>
      <Node x={12} y={36} />
      {/* OTP gate — fails red, dims on hover */}
      <rect
        x={48}
        y={22}
        width="24"
        height="28"
        rx="3"
        stroke={FAIL}
        className="transition-opacity duration-500 group-hover:opacity-25"
      />
      <text x={60} y={40} fontSize="7" fill={FAIL} textAnchor="middle" fontFamily="monospace">
        OTP
      </text>
      <Node x={108} y={36} color={BLUE} />
      {/* bypass link that pulses in on hover */}
      <path
        d="M17 44 C 45 68, 80 68, 103 42"
        stroke={BLUE}
        strokeDasharray="120"
        strokeDashoffset="120"
        className="transition-all duration-700 group-hover:[stroke-dashoffset:0]"
        style={{ filter: "drop-shadow(0 0 4px var(--brand-blue-glow))" }}
      />
    </>
  );
}

function Calendar() {
  return (
    <>
      <rect x={10} y={8} width="100" height="56" rx="4" stroke={STROKE} />
      {[24, 42, 60, 78, 96].map((x) =>
        [24, 40, 56].map((y) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="2" fill={STROKE} opacity="0.4" />
        ))
      )}
      {/* the failing 26th (amber) slides to the 2nd (blue) on hover */}
      <circle
        cx={78}
        cy={40}
        r="4"
        fill={WAIT}
        className="transition-all duration-700 group-hover:translate-x-[-54px] group-hover:translate-y-[16px] group-hover:fill-[var(--color-blue)]"
        style={{ filter: "drop-shadow(0 0 4px var(--brand-blue-glow))" }}
      />
    </>
  );
}

function Invoice() {
  return (
    <>
      <rect x={30} y={10} width="44" height="52" rx="3" stroke={STROKE} />
      {[22, 30, 38].map((y) => (
        <line key={y} x1={38} y1={y} x2={66} y2={y} stroke={STROKE} opacity="0.5" />
      ))}
      {/* overdue marker (red) resolves to a locked P2P date (blue) on hover */}
      <circle
        cx={74}
        cy={54}
        r="4"
        fill={FAIL}
        className="transition-colors duration-500 group-hover:fill-[var(--color-blue)]"
      />
      <text
        x={92}
        y={57}
        fontSize="6"
        fill={BLUE}
        fontFamily="monospace"
        className="opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      >
        P2P
      </text>
    </>
  );
}

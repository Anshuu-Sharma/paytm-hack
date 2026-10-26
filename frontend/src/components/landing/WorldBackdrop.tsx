"use client";

/**
 * The fixed, full-viewport "world" behind the landing narrative.
 *
 * This is the Phase-2 CSS stand-in for the Phase-4 React Three Fiber scene:
 * a pure-black void, a central blue core glow, the "revenue surface" wire-grid
 * horizon, and a scatter of wireframe entity labels. `#scene-mount` is the
 * empty node the R3F <Canvas> will hydrate into later.
 */

const ENTITIES = [
  { label: "Payment Gateway", x: "12%", y: "30%" },
  { label: "Issuing Bank", x: "78%", y: "24%" },
  { label: "UPI Switch", x: "24%", y: "62%" },
  { label: "Acquiring Bank", x: "70%", y: "68%" },
];

export default function WorldBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-void">
      {/* R3F canvas mount point (Phase 4) */}
      <div id="scene-mount" className="absolute inset-0" />

      {/* Central core glow */}
      <div
        className="absolute left-1/2 top-1/2 h-[70vh] w-[70vh] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(2,94,232,0.16) 0%, rgba(2,94,232,0.04) 40%, transparent 70%)",
        }}
      />
      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue shadow-[0_0_40px_12px_var(--brand-blue-glow)]" />

      {/* Faint starfield */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.5), transparent), radial-gradient(1px 1px at 70% 60%, rgba(0,229,255,0.4), transparent), radial-gradient(1px 1px at 40% 80%, rgba(255,255,255,0.35), transparent), radial-gradient(1px 1px at 85% 15%, rgba(142,45,226,0.4), transparent), radial-gradient(1px 1px at 55% 45%, rgba(255,255,255,0.3), transparent)",
          backgroundSize: "300px 300px",
        }}
      />

      {/* Wireframe entity labels */}
      {ENTITIES.map((e) => (
        <div
          key={e.label}
          className="absolute flex items-center gap-2"
          style={{ left: e.x, top: e.y }}
        >
          <span className="h-8 w-8 rounded-[3px] border border-[var(--wire-line)]" />
          <span className="wire-label whitespace-nowrap">{e.label}</span>
        </div>
      ))}

      {/* The revenue surface — glowing wire-grid horizon */}
      <div className="absolute inset-x-0 bottom-0 h-[45vh]">
        <div className="revenue-surface absolute inset-0" />
      </div>
    </div>
  );
}

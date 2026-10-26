"use client";

import { useSyncExternalStore } from "react";

/**
 * Intro gate state. The landing opens on a particle "REX" wordmark; clicking
 * disperses it into the system scene. Kept in a module store (not React
 * context) so both the DOM overlay and the in-canvas components can read it
 * across the R3F canvas boundary.
 */

export type IntroPhase = "intro" | "entering" | "entered";

const DURATION = 1900; // ms for the REX → system transition

let phase: IntroPhase = "intro";
let startAt = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function enterRex() {
  if (phase !== "intro") return;
  phase = "entering";
  startAt = performance.now();
  notify();
  window.setTimeout(() => {
    phase = "entered";
    notify();
  }, DURATION);
}

/** 0 while formed, → 1 as the wordmark disperses. Read every frame in-canvas. */
export function introEnterT(): number {
  if (phase === "intro") return 0;
  if (phase === "entered") return 1;
  return Math.min(1, (performance.now() - startAt) / DURATION);
}

export function introPhase(): IntroPhase {
  return phase;
}

const store = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  getSnapshot: () => phase,
  getServerSnapshot: (): IntroPhase => "intro",
};

export function useIntroPhase(): IntroPhase {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

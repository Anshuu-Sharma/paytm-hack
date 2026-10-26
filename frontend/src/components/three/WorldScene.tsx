"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import WorldBackdrop from "@/components/landing/WorldBackdrop";

// WebGL scene is client-only (no SSR) and code-split so it never blocks paint.
const SceneCanvas = dynamic(() => import("./SceneCanvas"), { ssr: false });

// Capability is fixed for the session, so compute once and cache it. Read via
// useSyncExternalStore: server renders the CSS fallback, the client swaps to
// 3D after hydration — no setState-in-effect, no hydration mismatch.
let cached: boolean | null = null;
function detect(): boolean {
  if (cached !== null) return cached;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let webgl = false;
  try {
    const c = document.createElement("canvas");
    webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webgl = false;
  }
  cached = webgl && !reduce;
  return cached;
}

const emptySubscribe = () => () => {};

/**
 * Chooses the 3D particle world when WebGL + motion are available, and falls
 * back to the lightweight CSS backdrop for reduced-motion / no-WebGL users.
 */
export default function WorldScene() {
  const use3D = useSyncExternalStore(emptySubscribe, detect, () => false);
  return use3D ? <SceneCanvas /> : <WorldBackdrop />;
}

"use client";

import { Canvas } from "@react-three/fiber";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import Scene from "./Scene";

/**
 * Fixed, full-viewport WebGL canvas that sits behind the landing narrative.
 * Non-interactive (pointer-events: none) so the DOM above stays clickable.
 *
 * Note: we intentionally do NOT request `powerPreference: "high-performance"`.
 * On dual-GPU Macs that hint triggers a GPU switch that loses the context.
 * React StrictMode is disabled in dev (see next.config.ts) so the Canvas isn't
 * double-mounted, which otherwise force-loses the context on the throwaway mount.
 */
export default function SceneCanvas() {
  const progress = useScrollProgress();

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-void">
      <Canvas
        gl={{ antialias: true, alpha: false, failIfMajorPerformanceCaveat: false }}
        camera={{ position: [0, 34, 58], fov: 50, near: 0.1, far: 260 }}
        dpr={[1, 1.75]}
      >
        <Scene progress={progress} />
      </Canvas>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

/**
 * Tracks whole-document scroll progress (0 at top → 1 at bottom) in a ref that
 * updates on scroll without triggering React re-renders. The R3F scene reads
 * `ref.current` every frame and lerps toward it for an inertial, filmic feel.
 */
export function useScrollProgress() {
  const progress = useRef(0);

  useEffect(() => {
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      progress.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return progress;
}

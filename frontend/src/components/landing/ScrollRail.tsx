"use client";

import { motion, useScroll } from "framer-motion";

/** Thin right-edge progress rail that fills blue as you scroll the film. */
export default function ScrollRail() {
  const { scrollYProgress } = useScroll();

  return (
    <div className="pointer-events-none fixed right-5 top-1/2 z-40 hidden h-40 w-px -translate-y-1/2 bg-white/10 md:block">
      <motion.div
        className="absolute left-0 top-0 w-px origin-top bg-blue shadow-[0_0_8px_var(--brand-blue-glow)]"
        style={{ height: "100%", scaleY: scrollYProgress }}
      />
    </div>
  );
}

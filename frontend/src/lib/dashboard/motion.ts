import type { Variants } from "framer-motion";

/** Shared staggered-entrance variants for Mission Control pages.
 * Wrap a page in <motion.div variants={container} initial="hidden" animate="show">
 * and give each block variants={item}. */
export const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

export const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

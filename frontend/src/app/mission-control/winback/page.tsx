"use client";

import { motion } from "framer-motion";
import { container, item } from "@/lib/dashboard/motion";
import PageHeader from "@/components/dashboard/PageHeader";
import WinbackExplorer from "@/components/dashboard/WinbackExplorer";
import { useDash } from "@/lib/dashboard/i18n";

export default function WinbackPage() {
  const { d } = useDash();
  return (
    <motion.div
      className="mx-auto max-w-[1220px] space-y-4 p-5 md:p-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <PageHeader
          title={d.winback.title}
          subtitle={d.winback.desc}
          accent="var(--d-warn)"
        />
      </motion.div>
      <motion.div variants={item}>
        <WinbackExplorer />
      </motion.div>
    </motion.div>
  );
}

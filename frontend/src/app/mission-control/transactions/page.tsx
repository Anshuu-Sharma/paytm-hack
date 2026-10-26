"use client";

import { motion } from "framer-motion";
import { container, item } from "@/lib/dashboard/motion";
import PageHeader from "@/components/dashboard/PageHeader";
import TransactionExplorer from "@/components/dashboard/TransactionExplorer";
import SimulateButton from "@/components/dashboard/SimulateButton";
import { useDash } from "@/lib/dashboard/i18n";

export default function TransactionsPage() {
  const { d } = useDash();
  return (
    <motion.div
      className="mx-auto max-w-[1220px] space-y-4 p-5 md:p-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <PageHeader title={d.txns.title} subtitle={d.txns.desc} right={<SimulateButton />} />
      </motion.div>
      <motion.div variants={item}>
        <TransactionExplorer />
      </motion.div>
    </motion.div>
  );
}

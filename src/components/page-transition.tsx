"use client";

import { motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";

/** Crossfade rápido (150ms) no conteúdo principal — só opacity. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <motion.div
      key={pathname}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={
        reduce
          ? { duration: 0 }
          : { duration: 0.15, ease: [0.16, 1, 0.3, 1] }
      }
      className="min-h-0 flex-1"
    >
      {children}
    </motion.div>
  );
}

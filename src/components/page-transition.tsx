"use client";

import { motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <motion.div
      key={pathname}
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        reduce
          ? { duration: 0 }
          : { type: "spring", stiffness: 380, damping: 32, mass: 0.8 }
      }
      className="min-h-0 flex-1"
    >
      {children}
    </motion.div>
  );
}

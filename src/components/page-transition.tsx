"use client";

import { motion, useReducedMotion } from "motion/react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function PageTransitionInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduce = useReducedMotion();
  // Inclui query (?post=, ?id=) para reanimar deep-links da mesma rota
  const routeKey = `${pathname}?${searchParams.toString()}`;

  return (
    <motion.div
      key={routeKey}
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

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-0 flex-1">{children}</div>}>
      <PageTransitionInner>{children}</PageTransitionInner>
    </Suspense>
  );
}

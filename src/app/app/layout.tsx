"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { NullainAssistant } from "@/components/nullain-assistant";
import { PageTransition } from "@/components/page-transition";
import { ThemeToggle } from "@/components/theme-toggle";
import { List } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  return (
    <AuthGuard>
      {/* Canvas clássico: neutral-50 (light) / off-black (dark) */}
      <div className="flex min-h-[100dvh] bg-neutral-50 dark:bg-[#0c0c0c]">
        <AppSidebar open={open} onClose={() => setOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-neutral-200/80 bg-white/90 px-4 backdrop-blur-md dark:border-zinc-800 dark:bg-[#141414]/95 lg:hidden">
            <motion.button
              type="button"
              onClick={() => setOpen(true)}
              whileTap={reduce ? undefined : { scale: 0.92 }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
              aria-label="Abrir menu"
            >
              <List size={18} weight="bold" aria-hidden />
            </motion.button>
            <span className="flex-1 text-sm font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-100">
              Nullysh Forum
            </span>
            <div className="w-14 shrink-0">
              <ThemeToggle compact />
            </div>
          </header>
          <main className="flex min-h-0 flex-1 flex-col">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
        <NullainAssistant />
      </div>
    </AuthGuard>
  );
}

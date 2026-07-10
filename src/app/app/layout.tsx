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
      <div className="flex min-h-[100dvh] bg-[var(--background)]">
        <AppSidebar open={open} onClose={() => setOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-elevated)]/90 px-4 backdrop-blur-xl lg:hidden">
            <motion.button
              type="button"
              onClick={() => setOpen(true)}
              whileTap={reduce ? undefined : { scale: 0.96 }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-sm)]"
              aria-label="Abrir menu"
            >
              <List size={18} weight="bold" aria-hidden />
            </motion.button>
            <span className="font-display flex-1 text-[15px] font-medium tracking-tight text-[var(--text-primary)]">
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
        {/* Assistente IA Nullain — FAB canto inferior direito */}
        <NullainAssistant />
      </div>
    </AuthGuard>
  );
}

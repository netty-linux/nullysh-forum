"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { List } from "@phosphor-icons/react";
import { useState } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <AuthGuard>
      <div className="flex min-h-[100dvh] bg-neutral-50">
        <AppSidebar open={open} onClose={() => setOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-neutral-200/80 bg-white/90 px-4 backdrop-blur-md lg:hidden">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200"
              aria-label="Abrir menu"
            >
              <List size={18} />
            </button>
            <span className="text-sm font-semibold tracking-tight">
              Nullysh Forum
            </span>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}

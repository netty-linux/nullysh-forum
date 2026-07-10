"use client";

import { ChatFab } from "@/components/chat-fab";
import { ComposeFab } from "@/components/compose-fab";
import { cn } from "@/lib/utils";

/**
 * Coluna de FABs do app: Direct + Publicar.
 * (Assistente Nullain removida a pedido.)
 */
export function AppFabs() {
  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-5 right-5 z-[60]",
        "sm:bottom-6 sm:right-6"
      )}
    >
      <div className="relative flex flex-col items-center gap-3.5 sm:gap-4">
        <ChatFab />
        <ComposeFab />
      </div>
    </div>
  );
}

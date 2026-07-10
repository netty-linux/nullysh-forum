"use client";

import { FabShell } from "@/components/fab-shell";
import { ChatsCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";

/**
 * FAB atalho para Direct / Bate-papo.
 */
export function ChatFab({ className }: { className?: string }) {
  const router = useRouter();

  return (
    <FabShell
      label="Direct · Bate-papo"
      title="Direct · Bate-papo"
      className={className}
      onClick={() => router.push("/app/chat")}
    >
      <ChatsCircle
        size={26}
        weight="bold"
        className="drop-shadow-[0_1px_2px_rgb(0_0_0/0.4)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/fab:rotate-[-6deg]"
      />
    </FabShell>
  );
}

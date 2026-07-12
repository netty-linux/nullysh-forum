"use client";

/**
 * Ticks estilo WhatsApp:
 * · 1 check  — enviada (no servidor)
 * · 2 checks cinza — entregue (outro usuário recebeu)
 * · 2 checks azul — lida (outro usuário abriu a conversa)
 */

import type { ChatDeliveryStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Check, Checks } from "@phosphor-icons/react";

/** Cor do tick azul WhatsApp */
const WA_BLUE = "#53bdeb";

export function deliveryStatusOf(
  message: {
    authorId: string;
    deliveredTo?: string[];
    readBy?: string[];
  },
  opts?: { pending?: boolean }
): ChatDeliveryStatus {
  if (opts?.pending) return "sending";
  const readBy = message.readBy ?? [];
  const deliveredTo = message.deliveredTo ?? [];
  // Alguém além do autor leu?
  if (readBy.some((id) => id !== message.authorId)) return "read";
  if (deliveredTo.some((id) => id !== message.authorId)) return "delivered";
  return "sent";
}

type Props = {
  status: ChatDeliveryStatus;
  /** Bolha escura (DM minha) → ticks claros no “enviado” */
  onDarkBubble?: boolean;
  className?: string;
};

export function ChatMessageTicks({
  status,
  onDarkBubble,
  className,
}: Props) {
  if (status === "sending") {
    return (
      <span
        className={cn(
          "inline-flex items-center opacity-50",
          className
        )}
        title="Enviando…"
        aria-label="Enviando"
      >
        <Check size={14} weight="bold" className="opacity-40" />
      </span>
    );
  }

  const isRead = status === "read";
  const isDouble = status === "delivered" || status === "read";

  const colorClass = isRead
    ? ""
    : onDarkBubble
      ? "text-white/70 dark:text-black/55"
      : "text-neutral-400 dark:text-zinc-500";

  const label =
    status === "read"
      ? "Lida"
      : status === "delivered"
        ? "Entregue"
        : "Enviada";

  return (
    <span
      className={cn("inline-flex items-center leading-none", colorClass, className)}
      title={label}
      aria-label={label}
      style={isRead ? { color: WA_BLUE } : undefined}
    >
      {isDouble ? (
        <Checks size={15} weight="bold" />
      ) : (
        <Check size={14} weight="bold" />
      )}
    </span>
  );
}

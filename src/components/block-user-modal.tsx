"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-mounted";
import { cn, displayUsername } from "@/lib/utils";
import type { AvatarFrameId } from "@/lib/types";
import {
  ChatCircleSlash,
  EyeSlash,
  Prohibit,
  UserMinus,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  user: {
    id: string;
    name: string;
    username?: string;
    email?: string;
    avatarUrl?: string | null;
    isVip?: boolean;
    avatarFrame?: AvatarFrameId | null;
  };
};

const EFFECTS = [
  {
    icon: EyeSlash,
    title: "Posts ocultos",
    body: "Vocês não verão publicações um do outro no feed.",
  },
  {
    icon: ChatCircleSlash,
    title: "Sem mensagens",
    body: "Não será possível se mandar DM nem conversar.",
  },
  {
    icon: UserMinus,
    title: "Perfil restrito",
    body: "O perfil fica bloqueado e o follow entre vocês é removido.",
  },
] as const;

/**
 * Modal de confirmação de bloqueio — mesmo idioma visual do FollowListModal.
 */
export function BlockUserModal({
  open,
  onClose,
  onConfirm,
  loading = false,
  user,
}: Props) {
  const reduce = useReducedMotion();
  const mounted = useMounted();
  const handle = displayUsername(user);
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, loading, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="block-user-title"
          aria-describedby="block-user-desc"
        >
          <motion.button
            type="button"
            aria-label="Fechar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 overscroll-contain bg-black/50 backdrop-blur-[3px]"
            onClick={() => {
              if (!loading) onClose();
            }}
          />

          <motion.div
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.97 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }
            }
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className={cn(
              "pointer-events-auto relative z-10 flex w-full max-w-lg flex-col",
              "max-h-[min(92dvh,560px)] overflow-hidden",
              "rounded-t-3xl border-2 border-[#1f1f1f] bg-white sm:rounded-3xl",
              "shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_24px_64px_-12px_rgb(0_0_0/0.45),0_8px_24px_-8px_rgb(0_0_0/0.2)]",
              "dark:border-zinc-100 dark:bg-[#141414]",
              "dark:shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_24px_64px_-12px_rgb(0_0_0/0.7)]"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle mobile */}
            <div className="flex justify-center pt-2 sm:hidden">
              <span className="h-1 w-10 rounded-full bg-neutral-300 dark:bg-zinc-600" />
            </div>

            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b-2 border-[#1f1f1f]/10 px-5 pb-3 pt-3 dark:border-zinc-700 sm:pt-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-red-500/80">
                  Bloquear perfil
                </p>
                <h2
                  id="block-user-title"
                  className="mt-0.5 text-base font-bold tracking-tight text-[#1f1f1f] dark:text-zinc-50"
                >
                  Bloquear {firstName}?
                </h2>
                <p
                  id="block-user-desc"
                  className="mt-1 max-w-[36ch] text-[13px] leading-relaxed text-neutral-500 dark:text-zinc-400"
                >
                  Confirme se deseja restringir o contato com esta pessoa no
                  Nullysh Forum.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!loading) onClose();
                }}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition hover:bg-neutral-50 hover:text-[#1f1f1f] dark:border-zinc-700 dark:hover:bg-zinc-800"
                aria-label="Fechar"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            {/* Alvo */}
            <div className="border-b border-neutral-100 px-5 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-3 rounded-2xl border border-neutral-200/80 bg-neutral-50/80 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900/60">
                <Avatar
                  name={user.name}
                  src={user.avatarUrl}
                  size="md"
                  frame={user.isVip ? user.avatarFrame : null}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[#1f1f1f] dark:text-zinc-100">
                    {user.name}
                  </p>
                  <p className="truncate text-[12px] text-neutral-400">
                    @{handle}
                  </p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                  <Prohibit size={18} weight="bold" aria-hidden />
                </div>
              </div>
            </div>

            {/* Efeitos */}
            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
                O que acontece
              </p>
              <ul className="space-y-2.5">
                {EFFECTS.map(({ icon: Icon, title, body }) => (
                  <li
                    key={title}
                    className="flex gap-3 rounded-2xl border border-neutral-100 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/40"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 dark:bg-zinc-800 dark:text-zinc-300">
                      <Icon size={16} weight="bold" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#1f1f1f] dark:text-zinc-100">
                        {title}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-neutral-500 dark:text-zinc-400">
                        {body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12px] leading-relaxed text-neutral-400">
                Você pode desbloquear a qualquer momento no perfil desta pessoa.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse gap-2 border-t border-neutral-100 px-5 py-4 dark:border-zinc-800 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="w-full rounded-full sm:w-auto sm:min-w-[7.5rem]"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={onConfirm}
                disabled={loading}
                loading={loading}
                className="w-full rounded-full sm:w-auto sm:min-w-[9rem]"
              >
                <Prohibit size={15} weight="bold" />
                Bloquear {firstName}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

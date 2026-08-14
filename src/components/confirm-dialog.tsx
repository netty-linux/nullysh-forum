"use client";

import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import { WarningCircle, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Modal de confirmação interno Nullysh.
 * Renderiza em portal no body — evita bug de layout com parents transformados (motion).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const reduce = useReducedMotion();
  const mounted = useMounted();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nullysh-confirm-title"
          aria-describedby={
            description ? "nullysh-confirm-desc" : undefined
          }
        >
          <motion.button
            type="button"
            aria-label="Fechar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
            onClick={() => {
              if (!loading) onCancel();
            }}
          />

          <motion.div
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }
            }
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={cn(
              "relative z-10 w-full max-w-[22rem]",
              "rounded-2xl border-2 border-[#1f1f1f] bg-white",
              "shadow-[0_24px_64px_-16px_rgb(0_0_0/0.5)]",
              "dark:border-zinc-600 dark:bg-[#141414]"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-neutral-100 px-5 pb-3 pt-5 dark:border-zinc-800">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  variant === "danger"
                    ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                    : "bg-neutral-100 text-[#1f1f1f] dark:bg-zinc-800 dark:text-zinc-100"
                )}
              >
                <WarningCircle size={22} weight="fill" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2
                  id="nullysh-confirm-title"
                  className="text-[15px] font-bold tracking-tight text-[#1f1f1f] dark:text-zinc-50"
                >
                  {title}
                </h2>
                {description && (
                  <p
                    id="nullysh-confirm-desc"
                    className="mt-1.5 text-[13px] leading-relaxed text-neutral-500 dark:text-zinc-400"
                  >
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!loading) onCancel();
                }}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-[#1f1f1f] dark:hover:bg-zinc-800"
                aria-label="Fechar"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {cancelLabel}
              </Button>
              <Button
                type="button"
                variant={variant === "danger" ? "danger" : "primary"}
                onClick={onConfirm}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? "Aguarde…" : confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WarningCircle, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
            transition={{ duration: reduce ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 overscroll-contain bg-black/55 backdrop-blur-[3px]"
            onClick={() => {
              if (!loading) onCancel();
            }}
          />

          <motion.div
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }
            }
            animate={{ opacity: 1, scale: 1 }}
            exit={
              reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }
            }
            transition={{
              duration: reduce ? 0 : 0.25,
              ease: [0.16, 1, 0.3, 1],
            }}
            className={cn(
              "modal-panel relative z-10 w-full max-w-[22rem] overscroll-contain"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-[var(--border)] px-5 pb-3 pt-5">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  variant === "danger"
                    ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                    : "bg-neutral-100 text-[var(--text-primary)] dark:bg-zinc-800"
                )}
              >
                <WarningCircle size={22} weight="fill" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2
                  id="nullysh-confirm-title"
                  className="font-display text-[15px] font-medium tracking-tight text-[var(--text-primary)]"
                >
                  {title}
                </h2>
                {description && (
                  <p
                    id="nullysh-confirm-desc"
                    className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]"
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
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-neutral-100 hover:text-[var(--text-primary)] dark:hover:bg-zinc-800"
                aria-label="Fechar"
              >
                <X size={16} weight="bold" aria-hidden />
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

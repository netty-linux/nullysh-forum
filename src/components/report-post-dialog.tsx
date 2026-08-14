"use client";

import { Button } from "@/components/ui/button";
import {
  REPORT_REASONS,
  type ReportReason,
  useReportStore,
} from "@/lib/report-store";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import { Flag, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  postId: string;
  reporterId: string;
  reporterName: string;
  onClose: () => void;
  onSubmitted?: () => void;
};

/**
 * Modal de denúncia — portal no body para não herdar transform do PostCard.
 */
export function ReportPostDialog({
  open,
  postId,
  reporterId,
  reporterName,
  onClose,
  onSubmitted,
}: Props) {
  const reportPost = useReportStore((s) => s.reportPost);
  const reduce = useReducedMotion();
  const mounted = useMounted();
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  // Reset do formulário ao (re)abrir para um novo post — sem efeito,
  // segue o padrão React de resetar estado durante a renderização.
  const openKey = open ? postId : null;
  const [prevOpenKey, setPrevOpenKey] = useState(openKey);
  if (prevOpenKey !== openKey) {
    setPrevOpenKey(openKey);
    if (openKey !== null) {
      setReason("spam");
      setNote("");
      setError("");
      setDone(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function submit() {
    setLoading(true);
    setError("");
    const res = reportPost({
      postId,
      reporterId,
      reporterName,
      reason,
      note,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDone(true);
    onSubmitted?.();
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-title"
        >
          <motion.button
            type="button"
            aria-label="Fechar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
            onClick={() => {
              if (!loading) onClose();
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
              "relative z-10 flex max-h-[min(90dvh,640px)] w-full max-w-md flex-col",
              "overflow-hidden rounded-2xl border-2 border-[#1f1f1f] bg-white",
              "shadow-[0_24px_64px_-16px_rgb(0_0_0/0.5)]",
              "dark:border-zinc-600 dark:bg-[#141414]"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start gap-3 border-b border-neutral-100 px-5 py-4 dark:border-zinc-800">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                <Flag size={20} weight="fill" />
              </div>
              <div className="min-w-0 flex-1">
                <h2
                  id="report-title"
                  className="text-[15px] font-bold tracking-tight text-[#1f1f1f] dark:text-zinc-50"
                >
                  {done ? "Denúncia enviada" : "Denunciar postagem"}
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
                  {done
                    ? "Obrigado. Nossa equipe vai revisar este conteúdo."
                    : "Conte por que este post viola as regras da comunidade."}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-zinc-800"
                aria-label="Fechar"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            {done ? (
              <div className="flex shrink-0 justify-end px-5 py-4">
                <Button type="button" onClick={onClose}>
                  Fechar
                </Button>
              </div>
            ) : (
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="space-y-1.5">
                  {REPORT_REASONS.map((r) => (
                    <label
                      key={r.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition",
                        reason === r.id
                          ? "border-[#1f1f1f] bg-neutral-50 dark:border-white dark:bg-zinc-800"
                          : "border-neutral-200 hover:border-neutral-300 dark:border-zinc-700"
                      )}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        className="accent-[#1f1f1f]"
                        checked={reason === r.id}
                        onChange={() => setReason(r.id)}
                      />
                      <span className="font-medium text-[#1f1f1f] dark:text-zinc-100">
                        {r.label}
                      </span>
                    </label>
                  ))}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-neutral-500">
                    Detalhes (opcional)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 400))}
                    rows={3}
                    placeholder="Contexto extra para a moderação…"
                    className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-[#1f1f1f] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>

                {error && (
                  <p className="text-xs font-medium text-red-600">{error}</p>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                  <Button type="button" onClick={submit} disabled={loading}>
                    {loading ? "Enviando…" : "Enviar denúncia"}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

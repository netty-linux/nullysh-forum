"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMounted } from "@/hooks/use-mounted";
import {
  COMMUNITY_ICONS,
  type CommunityIconName,
  useCommunityStore,
} from "@/lib/community-store";
import type { CommunityAccess } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ChartLineUp,
  Code,
  CrownSimple,
  Heart,
  House,
  Lightbulb,
  Lightning,
  Lock,
  Megaphone,
  Palette,
  Robot,
  Rocket,
  Star,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const ICON_MAP = {
  UsersThree,
  House,
  Robot,
  ChartLineUp,
  Palette,
  Lightning,
  Megaphone,
  Lightbulb,
  Code,
  Heart,
  Star,
  Rocket,
} as const;

type Props = {
  open: boolean;
  onClose: () => void;
  creatorId: string;
  creatorName: string;
  onCreated?: (slug: string) => void;
};

/**
 * Modal VIP para criar assunto — mesmo idioma visual do FollowListModal.
 */
export function CreateCommunityModal({
  open,
  onClose,
  creatorId,
  creatorName,
  onCreated,
}: Props) {
  const reduce = useReducedMotion();
  const createCommunity = useCommunityStore((s) => s.createCommunity);
  const mounted = useMounted();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hashtag, setHashtag] = useState("");
  const [access, setAccess] = useState<CommunityAccess>("everyone");
  const [icon, setIcon] = useState<CommunityIconName>("UsersThree");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  function reset() {
    setName("");
    setDescription("");
    setHashtag("");
    setAccess("everyone");
    setIcon("UsersThree");
    setError("");
    setLoading(false);
  }

  function handleClose() {
    if (loading) return;
    reset();
    onClose();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = createCommunity({
        name,
        description,
        hashtag,
        access,
        icon,
        creatorId,
        creatorName,
        isVip: true,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const slug = res.community.slug;
      reset();
      onClose();
      onCreated?.(slug);
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-community-title"
        >
          <motion.button
            type="button"
            aria-label="Fechar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 overscroll-contain bg-black/50 backdrop-blur-[3px]"
            onClick={handleClose}
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
              "max-h-[min(92dvh,680px)] overflow-hidden",
              "rounded-t-3xl border-2 border-[#1f1f1f] bg-white sm:rounded-3xl",
              "shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_24px_64px_-12px_rgb(0_0_0/0.45)]",
              "dark:border-zinc-100 dark:bg-[#141414]"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2 sm:hidden">
              <span className="h-1 w-10 rounded-full bg-neutral-300 dark:bg-zinc-600" />
            </div>

            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b-2 border-[#1f1f1f]/10 px-5 pb-3 pt-3 dark:border-zinc-700 sm:pt-4">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-600">
                  <CrownSimple size={12} weight="fill" />
                  Exclusivo VIP
                </p>
                <h2
                  id="create-community-title"
                  className="mt-0.5 text-base font-bold tracking-tight text-[#1f1f1f] dark:text-zinc-50"
                >
                  Novo assunto
                </h2>
                <p className="mt-1 max-w-[36ch] text-[13px] leading-relaxed text-neutral-500">
                  Posts com a #hashtag do assunto aparecem aqui.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition hover:bg-neutral-50 hover:text-[#1f1f1f] dark:border-zinc-700 dark:hover:bg-zinc-800"
                aria-label="Fechar"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            <form
              onSubmit={onSubmit}
              className="thin-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
            >
              <div className="space-y-4 px-5 py-4">
                <Input
                  label="Nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Automação com IA"
                  maxLength={48}
                  required
                  autoComplete="off"
                />

                <Input
                  label="Hashtag de sincronização"
                  value={hashtag}
                  onChange={(e) =>
                    setHashtag(
                      e.target.value
                        .replace(/^#+/, "")
                        .toLowerCase()
                        .replace(/[^a-z0-9_]/g, "")
                    )
                  }
                  placeholder="ex.: automacao"
                  maxLength={32}
                  required
                  autoComplete="off"
                  spellCheck={false}
                />
                {hashtag ? (
                  <p className="-mt-2 text-[12px] text-neutral-400">
                    Posts com{" "}
                    <span className="font-semibold text-[#1f1f1f] dark:text-zinc-200">
                      #{hashtag}
                    </span>{" "}
                    entram neste assunto.
                  </p>
                ) : null}

                <Textarea
                  label="Descrição"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Sobre o que é este espaço?"
                  className="min-h-[88px]"
                  maxLength={280}
                  required
                />

                {/* Público-alvo */}
                <div>
                  <p className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">
                    Quem pode participar
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setAccess("everyone")}
                      className={cn(
                        "flex items-start gap-2.5 rounded-2xl border-2 px-3.5 py-3 text-left transition",
                        access === "everyone"
                          ? "border-[#1f1f1f] bg-neutral-50 dark:border-zinc-100 dark:bg-zinc-900"
                          : "border-neutral-200 hover:border-neutral-300 dark:border-zinc-700"
                      )}
                    >
                      <UsersThree
                        size={18}
                        weight="bold"
                        className="mt-0.5 shrink-0 text-[#1f1f1f] dark:text-zinc-100"
                      />
                      <span>
                        <span className="block text-[13px] font-semibold text-[#1f1f1f] dark:text-zinc-100">
                          Todos leem
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-neutral-500">
                          Free e VIP veem os posts
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccess("vip")}
                      className={cn(
                        "flex items-start gap-2.5 rounded-2xl border-2 px-3.5 py-3 text-left transition",
                        access === "vip"
                          ? "border-[#1f1f1f] bg-neutral-50 dark:border-zinc-100 dark:bg-zinc-900"
                          : "border-neutral-200 hover:border-neutral-300 dark:border-zinc-700"
                      )}
                    >
                      <Lock
                        size={18}
                        weight="bold"
                        className="mt-0.5 shrink-0 text-amber-600"
                      />
                      <span>
                        <span className="block text-[13px] font-semibold text-[#1f1f1f] dark:text-zinc-100">
                          Só VIP
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-neutral-500">
                          Só VIP marca a # e lê os posts
                        </span>
                      </span>
                    </button>
                  </div>
                </div>

                {/* Ícone */}
                <div>
                  <p className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">
                    Ícone
                  </p>
                  <div className="grid grid-cols-6 gap-2">
                    {COMMUNITY_ICONS.map((key) => {
                      const Icon = ICON_MAP[key];
                      const active = icon === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setIcon(key)}
                          aria-label={key}
                          aria-pressed={active}
                          className={cn(
                            "inline-flex h-11 w-full items-center justify-center rounded-xl border transition",
                            active
                              ? "border-[#1f1f1f] bg-[#1f1f1f] text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-[#141414]"
                              : "border-neutral-200 text-neutral-600 hover:border-neutral-400 dark:border-zinc-700 dark:text-zinc-300"
                          )}
                        >
                          <Icon size={18} weight="fill" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error && (
                  <p className="text-[13px] font-medium text-red-600" role="alert">
                    {error}
                  </p>
                )}
              </div>

              <div className="mt-auto flex flex-col-reverse gap-2 border-t border-neutral-100 px-5 py-4 dark:border-zinc-800 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={loading}
                  className="w-full rounded-full sm:w-auto sm:min-w-[7.5rem]"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  loading={loading}
                  className="w-full rounded-full sm:w-auto sm:min-w-[9rem]"
                >
                  Criar assunto
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

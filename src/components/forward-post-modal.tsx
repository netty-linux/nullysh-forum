"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import { useBlockStore } from "@/lib/block-store";
import { dmChannelId } from "@/lib/dm";
import { useForumStore } from "@/lib/forum-store";
import { useSocialStore } from "@/lib/social-store";
import type { Post } from "@/lib/types";
import { cn, displayUsername } from "@/lib/utils";
import {
  CheckCircle,
  MagnifyingGlass,
  PaperPlaneTilt,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  post: Post;
};

/**
 * Encaminha um post para DM de um seguidor / alguém que você segue.
 */
export function ForwardPostModal({ open, onClose, post }: Props) {
  const reduce = useReducedMotion();
  const { user: me } = useAuth();
  const users = useAuthStore((s) => s.users);
  const follows = useSocialStore((s) => s.follows);
  const followingOf = useSocialStore((s) => s.followingOf);
  const followersOf = useSocialStore((s) => s.followersOf);
  const isEitherBlocked = useBlockStore((s) => s.isEitherBlocked);
  const sendMessage = useForumStore((s) => s.sendMessage);

  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  void follows;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !sending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, sending, onClose]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedId(null);
      setNote("");
      setError("");
      setSent(false);
      setSending(false);
    }
  }, [open]);

  const candidates = useMemo(() => {
    if (!me) return [];
    const ids = new Set<string>([
      ...followingOf(me.id),
      ...followersOf(me.id),
    ]);
    return users
      .filter((u) => ids.has(u.id) && u.id !== me.id)
      .filter((u) => !isEitherBlocked(me.id, u.id))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [me, users, followingOf, followersOf, isEitherBlocked, follows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    if (!q) return candidates;
    return candidates.filter((u) => {
      const handle = displayUsername(u);
      return (
        u.name.toLowerCase().includes(q) ||
        handle.includes(q) ||
        `@${handle}`.includes(q)
      );
    });
  }, [candidates, query]);

  function onSend() {
    if (!me || !selectedId) return;
    setError("");
    setSending(true);
    try {
      const peer = users.find((u) => u.id === selectedId);
      if (!peer) {
        setError("Usuário não encontrado.");
        return;
      }
      const channelId = dmChannelId(me.id, peer.id);
      // Só a frase do usuário — o preview do post vem do sharedPostId no chat
      const body = note.trim();

      sendMessage({
        channelId,
        authorId: me.id,
        authorName: me.name,
        authorAvatar: me.avatar,
        content: body,
        sharedPostId: post.id,
      });
      setSent(true);
      window.setTimeout(() => {
        onClose();
      }, 900);
    } finally {
      setSending(false);
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
          aria-labelledby="forward-post-title"
        >
          <motion.button
            type="button"
            aria-label="Fechar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-[3px]"
            onClick={() => !sending && onClose()}
          />
          <motion.div
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className={cn(
              "relative z-10 flex w-full max-w-md flex-col",
              "max-h-[min(88dvh,560px)] overflow-hidden",
              "rounded-t-3xl border-2 border-[#1f1f1f] bg-white sm:rounded-3xl",
              "dark:border-zinc-100 dark:bg-[#141414]"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4 dark:border-zinc-800">
              <div>
                <h2
                  id="forward-post-title"
                  className="text-base font-bold tracking-tight text-[#1f1f1f] dark:text-zinc-50"
                >
                  Encaminhar post
                </h2>
                <p className="mt-0.5 text-[12px] text-neutral-500">
                  Envie para alguém que você segue ou te segue
                </p>
              </div>
              <button
                type="button"
                onClick={() => !sending && onClose()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 dark:border-zinc-700"
                aria-label="Fechar"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            <div className="border-b border-neutral-100 px-4 py-3 dark:border-zinc-800">
              <label className="relative block">
                <MagnifyingGlass
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nome ou @"
                  className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-[14px] outline-none focus:border-[#1f1f1f] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  autoComplete="off"
                />
              </label>
            </div>

            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {filtered.length === 0 ? (
                <p className="px-4 py-10 text-center text-[13px] text-neutral-500">
                  {candidates.length === 0
                    ? "Siga alguém ou ganhe seguidores para encaminhar."
                    : "Nenhum resultado."}
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {filtered.map((u) => {
                    const active = selectedId === u.id;
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(u.id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition",
                            active
                              ? "bg-neutral-100 dark:bg-zinc-800"
                              : "hover:bg-neutral-50 dark:hover:bg-zinc-900"
                          )}
                        >
                          <Avatar
                            name={u.name}
                            src={u.avatarUrl}
                            size="sm"
                            frame={u.isVip ? u.avatarFrame : null}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-semibold text-[#1f1f1f] dark:text-zinc-100">
                              {u.name}
                            </span>
                            <span className="block truncate text-[12px] text-neutral-400">
                              @{displayUsername(u)}
                            </span>
                          </span>
                          {active && (
                            <CheckCircle
                              size={18}
                              weight="fill"
                              className="shrink-0 text-[#1f1f1f] dark:text-zinc-100"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="space-y-3 border-t border-neutral-100 px-4 py-4 dark:border-zinc-800">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                placeholder="Mensagem opcional…"
                className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[14px] outline-none focus:border-[#1f1f1f] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              {error && (
                <p className="text-[12px] font-medium text-red-600">{error}</p>
              )}
              <Button
                type="button"
                className="w-full rounded-full"
                disabled={!selectedId || sending || sent}
                loading={sending}
                onClick={onSend}
              >
                {sent ? (
                  <>
                    <CheckCircle size={16} weight="fill" />
                    Enviado
                  </>
                ) : (
                  <>
                    <PaperPlaneTilt size={16} weight="fill" />
                    Encaminhar no chat
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

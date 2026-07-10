"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/verified-badge";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import { useBlockStore } from "@/lib/block-store";
import { useSocialStore } from "@/lib/social-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fetchAllProfiles,
  fetchProfileById,
} from "@/lib/supabase/auth-service";
import type { User, UserPublic } from "@/lib/types";
import { cn, displayUsername, initials } from "@/lib/utils";
import {
  MagnifyingGlass,
  SpinnerGap,
  UserCircle,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export type FollowListMode = "followers" | "following";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Perfil cujos follows estamos listando */
  profileUserId: string;
  profileName: string;
  mode: FollowListMode;
};

/** Stub mínimo quando o edge existe mas o perfil ainda não está no catálogo */
function stubUser(id: string): User {
  const short = id.replace(/-/g, "").slice(0, 8) || "user";
  return {
    id,
    name: "Membro",
    username: short,
    email: "",
    password: "",
    bio: "",
    avatar: initials("Membro") || "M",
    avatarUrl: null,
    bannerUrl: null,
    bannerFit: null,
    avatarFrame: null,
    role: "member",
    isVip: false,
    isVerified: false,
    interests: [],
    goals: [],
    seekingMentorship: false,
    offeringMentorship: false,
    mentorTopics: [],
    links: [],
    favoriteTracks: [],
    badgesUnlocked: [],
    badgeEquipped: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

/**
 * Modal moderno (estilo compose) para espiar seguidores / quem a pessoa segue.
 */
export function FollowListModal({
  open,
  onClose,
  profileUserId,
  profileName,
  mode,
}: Props) {
  const reduce = useReducedMotion();
  const { user: me } = useAuth();
  const users = useAuthStore((s) => s.users);
  const mergePublicUsers = useAuthStore((s) => s.mergePublicUsers);
  const follows = useSocialStore((s) => s.follows);
  const followersOf = useSocialStore((s) => s.followersOf);
  const followingOf = useSocialStore((s) => s.followingOf);
  const isFollowing = useSocialStore((s) => s.isFollowing);
  const follow = useSocialStore((s) => s.follow);
  const unfollow = useSocialStore((s) => s.unfollow);
  const isEitherBlocked = useBlockStore((s) => s.isEitherBlocked);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [resolving, setResolving] = useState(false);

  // re-render com grafo social
  void follows;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  /**
   * Ao abrir: recarrega perfis e resolve IDs de follow que sumiram do catálogo.
   * Isso corrige o caso em que Account B segue Netty, o edge fica no social-store,
   * mas o auth-store só tem o user logado → lista vazia.
   */
  useEffect(() => {
    if (!open || !profileUserId) return;
    let cancelled = false;

    async function resolveProfiles() {
      setResolving(true);
      try {
        const edgeIds =
          mode === "followers"
            ? useSocialStore.getState().followersOf(profileUserId)
            : useSocialStore.getState().followingOf(profileUserId);

        if (isSupabaseConfigured()) {
          try {
            const profiles = await fetchAllProfiles();
            if (!cancelled && profiles.length) {
              mergePublicUsers(profiles);
            }
          } catch (e) {
            console.warn("[follow-list] fetchAllProfiles falhou", e);
          }

          const known = new Set(
            useAuthStore.getState().users.map((u) => u.id)
          );
          const missing = edgeIds.filter((id) => id && !known.has(id));
          if (missing.length) {
            const fetched = await Promise.all(
              missing.map(async (id) => {
                try {
                  return await fetchProfileById(id);
                } catch {
                  return null;
                }
              })
            );
            const ok = fetched.filter((p): p is UserPublic => !!p);
            if (!cancelled && ok.length) {
              mergePublicUsers(ok);
            }
          }
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    }

    void resolveProfiles();
    return () => {
      cancelled = true;
    };
  }, [open, mode, profileUserId, mergePublicUsers, follows]);

  const edgeIds = useMemo(() => {
    return mode === "followers"
      ? followersOf(profileUserId)
      : followingOf(profileUserId);
  }, [mode, profileUserId, followersOf, followingOf, follows]);

  const list = useMemo(() => {
    return edgeIds
      .map((id) => {
        const found = users.find((u) => u.id === id);
        // Não descarta edge órfão — mostra stub até o fetch resolver
        return found ?? stubUser(id);
      })
      .filter((u) => {
        if (!me) return true;
        return !isEitherBlocked(me.id, u.id);
      })
      .sort((a, b) => {
        // stubs (sem nome real) por último
        const aStub = a.name === "Membro" && !a.avatarUrl;
        const bStub = b.name === "Membro" && !b.avatarUrl;
        if (aStub !== bStub) return aStub ? 1 : -1;
        return a.name.localeCompare(b.name, "pt-BR");
      });
  }, [edgeIds, users, me, isEitherBlocked]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    if (!q) return list;
    return list.filter((u) => {
      const handle = displayUsername(u);
      return (
        u.name.toLowerCase().includes(q) ||
        handle.includes(q) ||
        `@${handle}`.includes(q)
      );
    });
  }, [list, query]);

  function onToggleFollow(targetId: string) {
    if (!me || me.id === targetId) return;
    if (isFollowing(me.id, targetId)) {
      unfollow(me.id, targetId);
    } else {
      follow(me.id, targetId);
    }
  }

  const title =
    mode === "followers"
      ? `Seguidores de ${profileName.split(" ")[0]}`
      : `${profileName.split(" ")[0]} segue`;

  const emptyLabel =
    mode === "followers"
      ? "Ninguém segue este perfil ainda."
      : "Este perfil ainda não segue ninguém.";

  // Contagem = edges (igual ao número no perfil), não só users resolvidos
  const peopleCount = edgeIds.filter((id) => {
    if (!me) return true;
    return !isEitherBlocked(me.id, id);
  }).length;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        setQuery("");
      }}
    >
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="follow-list-title"
        >
          <motion.button
            type="button"
            aria-label="Fechar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 overscroll-contain bg-black/50 backdrop-blur-[3px]"
            onClick={onClose}
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
              "max-h-[min(92dvh,640px)] overflow-hidden",
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
            <div className="flex items-center justify-between gap-3 border-b-2 border-[#1f1f1f]/10 px-5 pb-3 pt-3 dark:border-zinc-700 sm:pt-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  {mode === "followers" ? "Seguidores" : "Seguindo"}
                </p>
                <h2
                  id="follow-list-title"
                  className="truncate text-base font-bold tracking-tight text-[#1f1f1f] dark:text-zinc-50"
                >
                  {title}
                </h2>
                <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-neutral-500">
                  <span>
                    {peopleCount}{" "}
                    {mode === "followers"
                      ? peopleCount === 1
                        ? "pessoa"
                        : "pessoas"
                      : peopleCount === 1
                        ? "perfil"
                        : "perfis"}
                  </span>
                  {resolving ? (
                    <span className="inline-flex items-center gap-1 text-neutral-400">
                      <SpinnerGap
                        size={12}
                        className="animate-spin"
                        aria-hidden
                      />
                      atualizando…
                    </span>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition hover:bg-neutral-50 hover:text-[#1f1f1f] dark:border-zinc-700 dark:hover:bg-zinc-800"
                aria-label="Fechar"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            {/* Busca */}
            <div className="border-b border-neutral-100 px-4 py-3 dark:border-zinc-800">
              <label className="relative block">
                <MagnifyingGlass
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nome ou @…"
                  className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-[14px] text-[#1f1f1f] outline-none placeholder:text-neutral-400 focus:border-[#1f1f1f] focus:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            </div>

            {/* Lista */}
            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-14 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 dark:bg-zinc-800">
                    {resolving ? (
                      <SpinnerGap
                        size={22}
                        className="animate-spin"
                        aria-hidden
                      />
                    ) : mode === "followers" ? (
                      <UsersThree size={22} weight="duotone" aria-hidden />
                    ) : (
                      <UserCircle size={22} weight="duotone" aria-hidden />
                    )}
                  </div>
                  <p className="text-[14px] font-semibold text-[#1f1f1f] dark:text-zinc-100">
                    {resolving
                      ? "Carregando…"
                      : query.trim()
                        ? "Nenhum resultado"
                        : "Lista vazia"}
                  </p>
                  <p className="mt-1 max-w-[28ch] text-[13px] leading-relaxed text-neutral-500">
                    {resolving
                      ? "Buscando quem segue este perfil."
                      : query.trim()
                        ? "Tente outro nome ou @."
                        : emptyLabel}
                  </p>
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {filtered.map((u) => {
                    const handle = displayUsername(u);
                    const isMe = me?.id === u.id;
                    const amFollowing =
                      !!me && !isMe && isFollowing(me.id, u.id);
                    const isStub = u.name === "Membro" && !u.email;

                    return (
                      <li key={u.id}>
                        <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-neutral-50 dark:hover:bg-zinc-900/80">
                          <Link
                            href={`/app/u/${u.id}`}
                            onClick={onClose}
                            className="avatar-link shrink-0"
                          >
                            <Avatar
                              name={u.name}
                              src={u.avatarUrl}
                              size="md"
                              frame={u.isVip ? u.avatarFrame : null}
                            />
                          </Link>
                          <Link
                            href={`/app/u/${u.id}`}
                            onClick={onClose}
                            className="min-w-0 flex-1"
                          >
                            <p className="flex items-center gap-1 truncate text-[14px] font-semibold text-[#1f1f1f] dark:text-zinc-100">
                              <span className="truncate">{u.name}</span>
                              {u.isVerified && <VerifiedBadge size={14} />}
                            </p>
                            <p className="truncate text-[12px] text-neutral-400">
                              {isStub ? "carregando perfil…" : `@${handle}`}
                            </p>
                          </Link>
                          {me && !isMe ? (
                            <Button
                              type="button"
                              size="sm"
                              variant={amFollowing ? "outline" : "primary"}
                              className="shrink-0 rounded-full px-3.5"
                              onClick={() => onToggleFollow(u.id)}
                            >
                              {amFollowing ? "Seguindo" : "Seguir"}
                            </Button>
                          ) : isMe ? (
                            <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-500 dark:bg-zinc-800">
                              Você
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

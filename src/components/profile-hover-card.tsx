"use client";

import { BannerImage } from "@/components/gif-banner-editor";
import { RichText } from "@/components/rich-text";
import { Avatar } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { VipBadge } from "@/components/vip-gate";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import { isMediaRef, mediaGet } from "@/lib/media-storage";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useSocialStore } from "@/lib/social-store";
import type { AvatarFrameId } from "@/lib/avatar-frames";
import type { UserPublic } from "@/lib/types";
import { cn, displayUsername, initials } from "@/lib/utils";
import { SpinnerGap, UserMinus, UserPlus } from "@phosphor-icons/react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const OPEN_DELAY_MS = 450;
const CLOSE_DELAY_MS = 220;
const CARD_W = 300;

/** Evita N fetches do mesmo user ao hover em vários triggers */
const inflight = new Map<string, Promise<UserPublic | null>>();
const fetchedOk = new Set<string>();

export type ProfileHoverFallback = {
  name?: string;
  avatar?: string;
  avatarUrl?: string | null;
  isVerified?: boolean;
  isVip?: boolean;
  avatarFrame?: AvatarFrameId | null;
  username?: string;
  bio?: string;
};

type Props = {
  userId: string;
  children: ReactNode;
  className?: string;
  /** Desliga o preview (ex.: no próprio hover card) */
  disabled?: boolean;
  /**
   * Dados mínimos do post/lista quando o user ainda não está no catálogo.
   * Garante preview para TODOS (não só quem já veio em fetchAllProfiles).
   */
  fallback?: ProfileHoverFallback;
};

function buildStub(
  userId: string,
  fb?: ProfileHoverFallback
): UserPublic | null {
  if (!userId) return null;
  const name = (fb?.name || "Membro").trim() || "Membro";
  return {
    id: userId,
    email: "",
    username: (fb?.username || "").trim() || "membro",
    name,
    bio: fb?.bio || "",
    avatar: fb?.avatar || initials(name) || "U",
    avatarUrl: fb?.avatarUrl ?? null,
    bannerUrl: null,
    bannerFit: null,
    avatarFrame: fb?.avatarFrame ?? null,
    role: "member",
    isVip: !!fb?.isVip,
    isVerified: !!fb?.isVerified,
    interests: [],
    goals: [],
    seekingMentorship: false,
    offeringMentorship: false,
    mentorTopics: [],
    links: [],
    favoriteTracks: [],
    badgesUnlocked: [],
    badgeEquipped: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Preview de perfil ao pairar o mouse sobre nome/avatar (estilo X/Twitter).
 * Funciona para TODOS os membros — busca no Supabase se não estiver no store.
 */
export function ProfileHoverCard({
  userId,
  children,
  className,
  disabled,
  fallback,
}: Props) {
  const { user: me } = useAuth();
  const storeProfile = useAuthStore((s) =>
    s.users.find((u) => u.id === userId)
  );
  const mergePublicUsers = useAuthStore((s) => s.mergePublicUsers);
  const follow = useSocialStore((s) => s.follow);
  const unfollow = useSocialStore((s) => s.unfollow);
  const isFollowing = useSocialStore((s) => s.isFollowing);
  const follows = useSocialStore((s) => s.follows);

  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const cardId = useId();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remote, setRemote] = useState<UserPublic | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, placeAbove: false });
  const [bannerSrc, setBannerSrc] = useState<string | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  const stub = useMemo(
    () => buildStub(userId, fallback),
    // fallback fields used for display
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      userId,
      fallback?.name,
      fallback?.avatarUrl,
      fallback?.avatar,
      fallback?.isVerified,
      fallback?.isVip,
      fallback?.username,
      fallback?.bio,
    ]
  );

  /** Perfil efetivo: store > remoto fetch > stub do post */
  const profile = storeProfile || remote || stub;

  const clearOpen = useCallback(() => {
    if (openTimer.current != null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  }, []);

  const clearClose = useCallback(() => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const ensureProfile = useCallback(async () => {
    if (!userId) return;
    if (storeProfile && storeProfile.name !== "Membro") {
      fetchedOk.add(userId);
      return;
    }
    if (!isSupabaseConfigured()) return;
    if (fetchedOk.has(userId) && storeProfile) return;

    setLoading(true);
    try {
      let p = inflight.get(userId);
      if (!p) {
        p = (async () => {
          const { fetchProfileById } = await import(
            "@/lib/supabase/auth-service"
          );
          return fetchProfileById(userId);
        })();
        inflight.set(userId, p);
      }
      const result = await p;
      inflight.delete(userId);
      if (result) {
        fetchedOk.add(userId);
        setRemote(result);
        mergePublicUsers([result]);
      }
    } catch {
      inflight.delete(userId);
    } finally {
      setLoading(false);
    }
  }, [userId, storeProfile, mergePublicUsers]);

  const scheduleOpen = useCallback(() => {
    if (disabled || !userId) return;
    clearClose();
    clearOpen();
    // Prefetch assim que o mouse entra (antes do delay do card)
    void ensureProfile();
    openTimer.current = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  }, [disabled, userId, clearClose, clearOpen, ensureProfile]);

  const scheduleClose = useCallback(() => {
    clearOpen();
    clearClose();
    closeTimer.current = window.setTimeout(
      () => setOpen(false),
      CLOSE_DELAY_MS
    );
  }, [clearOpen, clearClose]);

  useEffect(() => {
    return () => {
      clearOpen();
      clearClose();
    };
  }, [clearOpen, clearClose]);

  // Resolve mídia (data URL / idb / http)
  useEffect(() => {
    if (!open || !profile) return;
    let cancelled = false;

    (async () => {
      async function resolve(url: string | null | undefined) {
        if (!url) return null;
        if (isMediaRef(url)) return (await mediaGet(url)) || null;
        return url;
      }
      const [b, a] = await Promise.all([
        resolve(profile.bannerUrl),
        resolve(profile.avatarUrl),
      ]);
      if (cancelled) return;
      setBannerSrc(b);
      setAvatarSrc(a ?? fallback?.avatarUrl ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, profile, fallback?.avatarUrl]);

  // Posiciona o card sob/acima do trigger
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function place() {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const gap = 8;
      const cardH = cardRef.current?.offsetHeight || 220;
      const spaceBelow = window.innerHeight - r.bottom;
      const placeAbove = spaceBelow < cardH + gap && r.top > spaceBelow;

      let left = r.left;
      left = Math.min(Math.max(8, left), window.innerWidth - CARD_W - 8);

      const top = placeAbove ? r.top - cardH - gap : r.bottom + gap;

      setPos({
        top: Math.max(8, top),
        left,
        placeAbove,
      });
    }

    place();
    const t = window.requestAnimationFrame(place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.cancelAnimationFrame(t);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, profile?.id, bannerSrc, loading]);

  if (disabled || !userId) {
    return <>{children}</>;
  }

  const isOwn = me?.id === userId;
  const amFollowing = !!(me && !isOwn && isFollowing(me.id, userId));
  const nFollowers = follows.filter((f) => f.followingId === userId).length;
  const nFollowing = follows.filter((f) => f.followerId === userId).length;

  function onFollowToggle() {
    if (!me || isOwn) return;
    if (amFollowing) unfollow(me.id, userId);
    else follow(me.id, userId);
  }

  const name = profile?.name || fallback?.name || "Usuário";
  const handle = profile
    ? displayUsername(profile)
    : fallback?.username || "user";
  const bio = (profile?.bio || fallback?.bio || "").trim();
  const isVerified = !!(profile?.isVerified || fallback?.isVerified);
  const isVip = !!(profile?.isVip || fallback?.isVip);
  const frame =
    (profile?.isVip || fallback?.isVip
      ? profile?.avatarFrame ?? fallback?.avatarFrame
      : null) ?? null;

  return (
    <>
      <span
        ref={triggerRef}
        className={cn("inline-flex max-w-full", className)}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onFocus={scheduleOpen}
        onBlur={scheduleClose}
        aria-describedby={open ? cardId : undefined}
      >
        {children}
      </span>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={cardRef}
            id={cardId}
            role="tooltip"
            className={cn(
              "fixed z-[100] w-[300px] overflow-hidden rounded-2xl border border-neutral-200/90 bg-white",
              "shadow-[0_12px_40px_-12px_rgb(0_0_0/0.28)]",
              "dark:border-zinc-700 dark:bg-[#141414]",
              "origin-top transition duration-150 ease-out",
              "opacity-100"
            )}
            style={{ top: pos.top, left: pos.left }}
            onMouseEnter={() => {
              clearClose();
              setOpen(true);
            }}
            onMouseLeave={scheduleClose}
          >
            {/* Banner */}
            <div className="relative h-[88px] overflow-hidden bg-neutral-100 dark:bg-zinc-900">
              {bannerSrc ? (
                <BannerImage
                  src={bannerSrc}
                  fit={profile?.bannerFit ?? null}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800" />
              )}
              {loading && !storeProfile && !remote && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <SpinnerGap
                    size={18}
                    className="animate-spin text-white drop-shadow"
                  />
                </div>
              )}
            </div>

            <div className="relative px-3.5 pb-3.5 pt-0">
              <div className="-mt-8 mb-2 flex items-end justify-between gap-2">
                <Link
                  href={`/app/u/${userId}`}
                  className="avatar-link shrink-0 rounded-full ring-2 ring-white dark:ring-[#141414]"
                  onClick={() => setOpen(false)}
                >
                  <Avatar
                    name={name}
                    src={avatarSrc}
                    size="lg"
                    frame={frame}
                  />
                </Link>
                {!isOwn && me && (
                  <button
                    type="button"
                    onClick={onFollowToggle}
                    className={cn(
                      "mb-0.5 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition",
                      amFollowing
                        ? "border border-neutral-200 bg-white text-neutral-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                        : "bg-[#1f1f1f] text-white hover:bg-neutral-800 dark:bg-white dark:text-[#1f1f1f]"
                    )}
                  >
                    {amFollowing ? (
                      <>
                        <UserMinus size={13} weight="bold" />
                        Seguindo
                      </>
                    ) : (
                      <>
                        <UserPlus size={13} weight="bold" />
                        Seguir
                      </>
                    )}
                  </button>
                )}
              </div>

              <Link
                href={`/app/u/${userId}`}
                className="group/name block min-w-0"
                onClick={() => setOpen(false)}
              >
                <span className="flex min-w-0 flex-wrap items-center gap-1">
                  <span className="truncate text-[15px] font-semibold tracking-tight text-[#1f1f1f] group-hover/name:underline dark:text-zinc-50">
                    {name}
                  </span>
                  {isVerified && <VerifiedBadge size={14} />}
                  {isVip && <VipBadge />}
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-neutral-500 dark:text-zinc-400">
                  @{handle}
                </span>
              </Link>

              {bio ? (
                <p className="mt-2 line-clamp-3 text-[13px] leading-snug text-neutral-700 dark:text-zinc-300">
                  <RichText text={bio} emojiSize={16} />
                </p>
              ) : (
                <p className="mt-2 text-[12px] italic text-neutral-400">
                  {loading ? "Carregando perfil…" : "Sem biografia"}
                </p>
              )}

              <div className="mt-2.5 flex gap-3 text-[12px] text-neutral-500 dark:text-zinc-400">
                <span>
                  <strong className="font-semibold tabular-nums text-[#1f1f1f] dark:text-zinc-100">
                    {nFollowing}
                  </strong>{" "}
                  seguindo
                </span>
                <span>
                  <strong className="font-semibold tabular-nums text-[#1f1f1f] dark:text-zinc-100">
                    {nFollowers}
                  </strong>{" "}
                  seguidores
                </span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

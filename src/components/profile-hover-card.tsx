"use client";

import { BannerImage } from "@/components/gif-banner-editor";
import { Avatar } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { VipBadge } from "@/components/vip-gate";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import { isMediaRef, mediaGet } from "@/lib/media-storage";
import { useSocialStore } from "@/lib/social-store";
import { cn, displayUsername } from "@/lib/utils";
import { UserPlus, UserMinus } from "@phosphor-icons/react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const OPEN_DELAY_MS = 650;
const CLOSE_DELAY_MS = 220;
const CARD_W = 300;

type Props = {
  userId: string;
  children: ReactNode;
  className?: string;
  /** Desliga o preview (ex.: no próprio hover card) */
  disabled?: boolean;
};

/**
 * Preview de perfil ao pairar o mouse ~0,65s sobre o nome/avatar
 * (estilo X/Twitter): banner + foto + bio.
 */
export function ProfileHoverCard({
  userId,
  children,
  className,
  disabled,
}: Props) {
  const { user: me } = useAuth();
  const profile = useAuthStore((s) => s.users.find((u) => u.id === userId));
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
  const [pos, setPos] = useState({ top: 0, left: 0, placeAbove: false });
  const [bannerSrc, setBannerSrc] = useState<string | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

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

  const scheduleOpen = useCallback(() => {
    if (disabled || !profile) return;
    clearClose();
    clearOpen();
    openTimer.current = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  }, [disabled, profile, clearClose, clearOpen]);

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
      setAvatarSrc(a);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, profile]);

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
      left = Math.min(
        Math.max(8, left),
        window.innerWidth - CARD_W - 8
      );

      const top = placeAbove
        ? r.top - cardH - gap
        : r.bottom + gap;

      setPos({
        top: Math.max(8, top),
        left,
        placeAbove,
      });
    }

    place();
    // re-mede após paint (altura do card)
    const t = window.requestAnimationFrame(place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.cancelAnimationFrame(t);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, profile?.id, bannerSrc]);

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

  const name = profile?.name || "Usuário";
  const handle = profile ? displayUsername(profile) : "user";
  const bio = (profile?.bio || "").trim();

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
        profile &&
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
                <BannerImage src={bannerSrc} fit={profile.bannerFit} />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800" />
              )}
            </div>

            <div className="relative px-3.5 pb-3.5 pt-0">
              {/* Avatar sobreposto */}
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
                    frame={profile.isVip ? profile.avatarFrame : null}
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
                  {profile.isVerified && <VerifiedBadge size={14} />}
                  {profile.isVip && <VipBadge />}
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-neutral-500 dark:text-zinc-400">
                  @{handle}
                </span>
              </Link>

              {bio ? (
                <p className="mt-2 line-clamp-3 text-[13px] leading-snug text-neutral-700 dark:text-zinc-300">
                  {bio}
                </p>
              ) : (
                <p className="mt-2 text-[12px] italic text-neutral-400">
                  Sem biografia
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

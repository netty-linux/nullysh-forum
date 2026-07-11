"use client";

import { useAuth } from "@/hooks/use-auth";
import { useEventStore } from "@/lib/event-store";
import { useMaterialStore } from "@/lib/material-store";
import {
  type AppNotification,
  type NotificationType,
  notifyEventStart,
  notifyMaterial,
  notifyVideo,
  useNotificationStore,
} from "@/lib/notification-store";
import { useProgressStore } from "@/lib/progress-store";
import { fetchVideos } from "@/lib/videos/client";
import { cn, formatRelative } from "@/lib/utils";
import {
  Bell,
  CalendarBlank,
  ChatCircle,
  FilmStrip,
  Gift,
  Heart,
  Package,
  Repeat,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TYPE_ICON: Record<
  NotificationType,
  { Icon: typeof Heart; className: string }
> = {
  like: { Icon: Heart, className: "bg-red-500 text-white" },
  comment: { Icon: ChatCircle, className: "bg-sky-500 text-white" },
  repost: { Icon: Repeat, className: "bg-emerald-500 text-white" },
  dm: { Icon: ChatCircle, className: "bg-violet-500 text-white" },
  material: { Icon: Package, className: "bg-amber-500 text-white" },
  video: { Icon: FilmStrip, className: "bg-rose-500 text-white" },
  event: { Icon: CalendarBlank, className: "bg-[#1f1f1f] text-white" },
};

/** Garante href válido mesmo se a notificação antiga veio sem path */
function resolveHref(n: AppNotification): string {
  const raw = (n.href || "").trim();
  if (raw.startsWith("/")) return raw;
  // fallback por tipo
  switch (n.type) {
    case "material":
      return "/app/materials";
    case "video":
      return "/app/videos";
    case "event":
      return "/app/events";
    case "dm":
      return n.actorId ? `/app/chat?dm=${encodeURIComponent(n.actorId)}` : "/app/chat";
    default:
      return "/app";
  }
}

/**
 * Ícone de coração + badge dopamina + barulinho + painel de notificações.
 * Também observa catálogo (materiais/vídeos) e eventos RSVP.
 */
export function NotificationsCenter() {
  const { user } = useAuth();
  const router = useRouter();
  const reduce = useReducedMotion();
  const items = useNotificationStore((s) => s.items);
  const live = useNotificationStore((s) => s.live);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const clearLive = useNotificationStore((s) => s.clearLive);
  const catalogSeen = useNotificationStore((s) => s.catalogSeen);
  const setCatalogBooted = useNotificationStore((s) => s.setCatalogBooted);
  const markMaterialSeen = useNotificationStore((s) => s.markMaterialSeen);
  const markVideoSeen = useNotificationStore((s) => s.markVideoSeen);
  const markEventStartSeen = useNotificationStore((s) => s.markEventStartSeen);
  const materials = useMaterialStore((s) => s.materials);
  const events = useEventStore((s) => s.events);
  const rsvps = useProgressStore((s) => s.rsvps);

  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigatingRef = useRef(false);

  const mine = useMemo(() => {
    if (!user) return [] as AppNotification[];
    return items
      .filter((n) => n.userId === user.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [items, user]);

  const unread = mine.filter((n) => !n.read).length;
  const hot = unread > 0;

  /**
   * Navega de forma confiável:
   * - não depende do Link do Next (que pode abortar se o painel desmontar)
   * - fecha UI primeiro e empurra a rota no próximo tick
   */
  const goToNotification = useCallback(
    (n: AppNotification) => {
      if (navigatingRef.current) return;
      navigatingRef.current = true;

      const href = resolveHref(n);
      markRead(n.id);
      clearLive();
      setOpen(false);

      // Deixa o React fechar o painel sem cancelar a navegação
      window.setTimeout(() => {
        try {
          router.push(href);
        } catch {
          window.location.assign(href);
        } finally {
          navigatingRef.current = false;
        }
      }, 0);
    },
    [markRead, clearLive, router]
  );

  // Fecha painel ao clicar fora (pointerdown — não interfere no click do item)
  useEffect(() => {
    if (!open) return;
    function onDoc(e: PointerEvent) {
      if (navigatingRef.current) return;
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  // Auto-some barulinho
  useEffect(() => {
    if (!live || !user || live.userId !== user.id) return;
    const t = window.setTimeout(() => clearLive(), 5200);
    return () => window.clearTimeout(t);
  }, [live, user, clearLive]);

  // Catálogo: materiais (mock) + vídeos (API / Telegram)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const matIds = materials.map((m) => m.id);
      let videoList: { id: string; title: string }[] = [];
      try {
        const res = await fetchVideos();
        videoList = (res.videos || []).map((v) => ({
          id: v.id,
          title: v.title,
        }));
      } catch {
        videoList = [];
      }
      if (cancelled) return;

      const vidIds = videoList.map((v) => v.id);

      if (!catalogSeen.catalogBooted) {
        // primeira carga: marca tudo como visto, sem spam
        matIds.forEach(markMaterialSeen);
        vidIds.forEach(markVideoSeen);
        setCatalogBooted(true);
        return;
      }

      for (const m of materials) {
        if (!catalogSeen.materials.includes(m.id)) {
          notifyMaterial({
            userId: user.id,
            title: m.title,
            materialId: m.id,
          });
          markMaterialSeen(m.id);
        }
      }
      for (const v of videoList) {
        if (!catalogSeen.videos.includes(v.id)) {
          notifyVideo({
            userId: user.id,
            title: v.title,
            videoId: v.id,
          });
          markVideoSeen(v.id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    user,
    materials,
    catalogSeen.catalogBooted,
    catalogSeen.materials,
    catalogSeen.videos,
    markMaterialSeen,
    markVideoSeen,
    setCatalogBooted,
  ]);

  // Eventos RSVP — avisa perto do horário
  useEffect(() => {
    if (!user) return;

    function checkEvents() {
      if (!user) return;
      const now = Date.now();
      const myRsvps = rsvps.filter((r) => r.userId === user.id);
      for (const r of myRsvps) {
        const ev = events.find((e) => e.id === r.eventId);
        if (!ev) continue;
        if (catalogSeen.eventStarts.includes(ev.id)) continue;
        const start = new Date(ev.startsAt).getTime();
        // janela: 10 min antes até 20 min depois
        if (start - 10 * 60 * 1000 <= now && now <= start + 20 * 60 * 1000) {
          notifyEventStart({
            userId: user.id,
            title: ev.title,
            eventId: ev.id,
          });
          markEventStartSeen(ev.id);
        }
      }
    }

    checkEvents();
    const id = window.setInterval(checkEvents, 30_000);
    return () => window.clearInterval(id);
  }, [user, events, rsvps, catalogSeen.eventStarts, markEventStartSeen]);

  if (!user) return null;

  const showLive = live && live.userId === user.id;

  return (
    <>
      {/* Barulinho dopamina — topo */}
      <AnimatePresence>
        {showLive && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="pointer-events-auto fixed left-1/2 top-3 z-[90] w-[min(100%-1.5rem,24rem)] -translate-x-1/2"
          >
            {/* div (não button aninhado) — evita HTML inválido que quebra o click */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => goToNotification(live!)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  goToNotification(live!);
                }
              }}
              className={cn(
                "group relative flex w-full cursor-pointer items-start gap-3 overflow-hidden rounded-2xl border-2 border-white/30 px-3.5 py-3 text-left",
                "bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-600 text-white",
                "shadow-[0_12px_40px_-8px_rgb(236_72_153/0.65),0_0_0_1px_rgb(255_255_255/0.12)]"
              )}
            >
              {!reduce && (
                <span
                  className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[notif-shimmer_2.2s_ease-in-out_infinite]"
                  aria-hidden
                />
              )}
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/40">
                <Heart size={20} weight="fill" className="text-white drop-shadow" />
                {!reduce && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-white/30" />
                )}
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/85">
                  <Bell size={12} weight="fill" />
                  Nova notificação
                </span>
                <span className="mt-0.5 block truncate text-[14px] font-bold leading-tight">
                  {live!.title}
                </span>
                <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-white/90">
                  {live!.body}
                </span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearLive();
                }}
                className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
                aria-label="Dispensar"
              >
                <X size={14} weight="bold" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão coração + painel */}
      <div className="relative" ref={panelRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={
            unread > 0
              ? `Notificações, ${unread} não lidas`
              : "Notificações"
          }
          aria-expanded={open}
          className={cn(
            "relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition",
            hot
              ? "border-rose-300 bg-gradient-to-br from-rose-50 to-fuchsia-50 text-rose-600 shadow-[0_0_0_3px_rgb(244_63_94/0.15)] dark:border-rose-800 dark:from-rose-950/50 dark:to-fuchsia-950/40 dark:text-rose-400"
              : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-[#1f1f1f] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          )}
        >
          <Heart
            size={20}
            weight={hot ? "fill" : "regular"}
            className={cn(hot && !reduce && "notif-heart-beat")}
          />
          {hot && (
            <>
              {!reduce && (
                <>
                  <span className="pointer-events-none absolute inset-0 rounded-full bg-rose-400/30 animate-ping" />
                  <span className="pointer-events-none absolute -inset-1 rounded-full border-2 border-rose-400/40 notif-ring" />
                </>
              )}
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-fuchsia-600 px-1 text-[10px] font-bold tabular-nums text-white shadow-md ring-2 ring-white dark:ring-[#141414]">
                {unread > 99 ? "99+" : unread}
              </span>
            </>
          )}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={cn(
                "absolute right-0 z-[70] mt-2 w-[min(100vw-1.5rem,22rem)] overflow-hidden",
                "rounded-2xl border-2 border-[#1f1f1f]/10 bg-white shadow-[0_20px_50px_-16px_rgb(0_0_0/0.35)]",
                "dark:border-zinc-700 dark:bg-[#141414]"
              )}
            >
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white">
                    <Heart size={16} weight="fill" />
                  </span>
                  <div>
                    <p className="text-[14px] font-bold tracking-tight text-[#1f1f1f] dark:text-zinc-50">
                      Notificações
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      {unread > 0
                        ? `${unread} nova${unread === 1 ? "" : "s"}`
                        : "Tudo em dia"}
                    </p>
                  </div>
                </div>
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllRead(user.id)}
                    className="text-[12px] font-semibold text-rose-600 hover:underline dark:text-rose-400"
                  >
                    Marcar lidas
                  </button>
                )}
              </div>

              <ul className="thin-scroll max-h-[min(60dvh,22rem)] overflow-y-auto py-1">
                {mine.length === 0 ? (
                  <li className="px-4 py-12 text-center">
                    <Gift
                      size={28}
                      weight="duotone"
                      className="mx-auto text-neutral-300"
                    />
                    <p className="mt-2 text-[13px] font-medium text-neutral-500">
                      Nenhuma notificação ainda
                    </p>
                    <p className="mt-1 text-[12px] text-neutral-400">
                      Curtidas, comentários, DMs e drops aparecem aqui.
                    </p>
                  </li>
                ) : (
                  mine.map((n) => {
                    const { Icon, className } = TYPE_ICON[n.type];
                    const href = resolveHref(n);
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => goToNotification(n)}
                          className={cn(
                            "flex w-full gap-3 px-3 py-2.5 text-left transition hover:bg-neutral-50 dark:hover:bg-zinc-900",
                            !n.read && "bg-rose-50/60 dark:bg-rose-950/20"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                              className
                            )}
                          >
                            <Icon size={16} weight="fill" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="text-[13px] font-bold text-[#1f1f1f] dark:text-zinc-100">
                                {n.title}
                              </span>
                              {!n.read && (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                              )}
                            </span>
                            <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-neutral-600 dark:text-zinc-400">
                              {n.body}
                            </span>
                            <span className="mt-1 block text-[10px] font-medium text-neutral-400">
                              {formatRelative(n.createdAt)}
                              <span className="sr-only"> — {href}</span>
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

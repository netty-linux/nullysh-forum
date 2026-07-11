"use client";

import { uid } from "./utils";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NotificationType =
  | "like"
  | "comment"
  | "repost"
  | "dm"
  | "material"
  | "video"
  | "event";

export type AppNotification = {
  id: string;
  /** Quem recebe */
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  actorId?: string;
  actorName?: string;
  read: boolean;
  createdAt: string;
  /** chave anti-spam (ex.: like:postId:actorId) */
  dedupeKey?: string;
};

type CatalogSeen = {
  materials: string[];
  videos: string[];
  /** eventId já avisados (início) */
  eventStarts: string[];
  /** primeira hidratação do catálogo sem spam */
  catalogBooted: boolean;
};

interface NotificationState {
  items: AppNotification[];
  /** toast “barulinho” atual */
  live: AppNotification | null;
  catalogSeen: CatalogSeen;
  push: (
    input: Omit<AppNotification, "id" | "read" | "createdAt"> & {
      dedupeKey?: string;
    }
  ) => AppNotification | null;
  markRead: (id: string) => void;
  markAllRead: (userId: string) => void;
  clearLive: () => void;
  unreadCount: (userId: string) => number;
  forUser: (userId: string) => AppNotification[];
  setCatalogBooted: (v: boolean) => void;
  markMaterialSeen: (id: string) => void;
  markVideoSeen: (id: string) => void;
  markEventStartSeen: (id: string) => void;
}

const MAX_ITEMS = 80;

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      items: [],
      live: null,
      catalogSeen: {
        materials: [],
        videos: [],
        eventStarts: [],
        catalogBooted: false,
      },

      push: (input) => {
        if (!input.userId) return null;
        // não notifica a si mesmo
        if (input.actorId && input.actorId === input.userId) return null;

        if (input.dedupeKey) {
          const recent = get().items.find(
            (n) =>
              n.userId === input.userId &&
              n.dedupeKey === input.dedupeKey &&
              Date.now() - new Date(n.createdAt).getTime() < 1000 * 60 * 30
          );
          if (recent) return null;
        }

        const n: AppNotification = {
          id: uid("ntf"),
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          href: input.href,
          actorId: input.actorId,
          actorName: input.actorName,
          read: false,
          createdAt: new Date().toISOString(),
          dedupeKey: input.dedupeKey,
        };

        set((s) => ({
          items: [n, ...s.items].slice(0, MAX_ITEMS),
          live: n,
        }));
        return n;
      },

      markRead: (id) => {
        set((s) => ({
          items: s.items.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
          live: s.live?.id === id ? null : s.live,
        }));
      },

      markAllRead: (userId) => {
        set((s) => ({
          items: s.items.map((n) =>
            n.userId === userId ? { ...n, read: true } : n
          ),
          live:
            s.live && s.live.userId === userId ? null : s.live,
        }));
      },

      clearLive: () => set({ live: null }),

      unreadCount: (userId) =>
        get().items.filter((n) => n.userId === userId && !n.read).length,

      forUser: (userId) =>
        get()
          .items.filter((n) => n.userId === userId)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime()
          ),

      setCatalogBooted: (v) =>
        set((s) => ({
          catalogSeen: { ...s.catalogSeen, catalogBooted: v },
        })),

      markMaterialSeen: (id) =>
        set((s) => ({
          catalogSeen: {
            ...s.catalogSeen,
            materials: s.catalogSeen.materials.includes(id)
              ? s.catalogSeen.materials
              : [...s.catalogSeen.materials, id],
          },
        })),

      markVideoSeen: (id) =>
        set((s) => ({
          catalogSeen: {
            ...s.catalogSeen,
            videos: s.catalogSeen.videos.includes(id)
              ? s.catalogSeen.videos
              : [...s.catalogSeen.videos, id],
          },
        })),

      markEventStartSeen: (id) =>
        set((s) => ({
          catalogSeen: {
            ...s.catalogSeen,
            eventStarts: s.catalogSeen.eventStarts.includes(id)
              ? s.catalogSeen.eventStarts
              : [...s.catalogSeen.eventStarts, id],
          },
        })),
    }),
    {
      name: "nullysh-notifications",
      version: 1,
      partialize: (s) => ({
        items: s.items,
        catalogSeen: s.catalogSeen,
      }),
    }
  )
);

/** Helpers para chamar de stores/UI sem hooks */
/** Deep-links usados ao clicar na notificação */
export function postHref(postId: string, commentId?: string | null) {
  const q = new URLSearchParams({ post: postId });
  if (commentId) q.set("comment", commentId);
  return `/app?${q.toString()}`;
}

export function notifyLike(opts: {
  postAuthorId: string;
  actorId: string;
  actorName: string;
  postId: string;
  excerpt?: string;
}) {
  return useNotificationStore.getState().push({
    userId: opts.postAuthorId,
    type: "like",
    title: "Nova curtida",
    body: `${opts.actorName} curtiu seu post${opts.excerpt ? `: “${opts.excerpt}”` : ""}`,
    href: postHref(opts.postId),
    actorId: opts.actorId,
    actorName: opts.actorName,
    dedupeKey: `like:${opts.postId}:${opts.actorId}`,
  });
}

export function notifyCommentLike(opts: {
  commentAuthorId: string;
  actorId: string;
  actorName: string;
  postId: string;
  commentId: string;
  excerpt?: string;
}) {
  return useNotificationStore.getState().push({
    userId: opts.commentAuthorId,
    type: "like",
    title: "Curtida no comentário",
    body: `${opts.actorName} curtiu seu comentário${opts.excerpt ? `: “${opts.excerpt}”` : ""}`,
    href: postHref(opts.postId, opts.commentId),
    actorId: opts.actorId,
    actorName: opts.actorName,
    dedupeKey: `comment-like:${opts.commentId}:${opts.actorId}`,
  });
}

export function notifyComment(opts: {
  postAuthorId: string;
  actorId: string;
  actorName: string;
  postId: string;
  commentId?: string;
  excerpt?: string;
  /** true = resposta a um comentário (não só no post) */
  isReply?: boolean;
}) {
  return useNotificationStore.getState().push({
    userId: opts.postAuthorId,
    type: "comment",
    title: opts.isReply ? "Nova resposta" : "Novo comentário",
    body: opts.isReply
      ? `${opts.actorName} respondeu seu comentário${opts.excerpt ? `: “${opts.excerpt}”` : ""}`
      : `${opts.actorName} comentou no seu post${opts.excerpt ? `: “${opts.excerpt}”` : ""}`,
    href: postHref(opts.postId, opts.commentId),
    actorId: opts.actorId,
    actorName: opts.actorName,
    dedupeKey: `comment:${opts.postId}:${opts.actorId}:${opts.commentId || Date.now() % 100000}`,
  });
}

export function notifyRepost(opts: {
  postAuthorId: string;
  actorId: string;
  actorName: string;
  postId: string;
}) {
  return useNotificationStore.getState().push({
    userId: opts.postAuthorId,
    type: "repost",
    title: "Repost",
    body: `${opts.actorName} repostou sua publicação`,
    href: postHref(opts.postId),
    actorId: opts.actorId,
    actorName: opts.actorName,
    dedupeKey: `repost:${opts.postId}:${opts.actorId}`,
  });
}

export function notifyDm(opts: {
  recipientId: string;
  actorId: string;
  actorName: string;
  preview?: string;
}) {
  return useNotificationStore.getState().push({
    userId: opts.recipientId,
    type: "dm",
    title: "Nova mensagem",
    body: opts.preview
      ? `${opts.actorName}: ${opts.preview}`
      : `${opts.actorName} te enviou uma mensagem direta`,
    href: `/app/chat?dm=${encodeURIComponent(opts.actorId)}`,
    actorId: opts.actorId,
    actorName: opts.actorName,
    dedupeKey: `dm:${opts.actorId}:${opts.recipientId}:${Math.floor(Date.now() / 15000)}`,
  });
}

export function notifyMaterial(opts: {
  userId: string;
  title: string;
  materialId: string;
}) {
  return useNotificationStore.getState().push({
    userId: opts.userId,
    type: "material",
    title: "Drop de material 🎁",
    body: `Novo material disponível: ${opts.title}`,
    href: `/app/materials?id=${encodeURIComponent(opts.materialId)}`,
    dedupeKey: `material:${opts.materialId}`,
  });
}

export function notifyVideo(opts: {
  userId: string;
  title: string;
  videoId: string;
}) {
  return useNotificationStore.getState().push({
    userId: opts.userId,
    type: "video",
    title: "Vídeo novo 🎬",
    body: `Acabou de sair: ${opts.title}`,
    href: `/app/videos?id=${encodeURIComponent(opts.videoId)}`,
    dedupeKey: `video:${opts.videoId}`,
  });
}

export function notifyEventStart(opts: {
  userId: string;
  title: string;
  eventId: string;
}) {
  return useNotificationStore.getState().push({
    userId: opts.userId,
    type: "event",
    title: "Evento começando ⚡",
    body: `“${opts.title}” está começando agora — entra lá!`,
    href: `/app/events?id=${encodeURIComponent(opts.eventId)}`,
    dedupeKey: `event-start:${opts.eventId}`,
  });
}

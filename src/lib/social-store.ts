"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isGhostUserId } from "./ghost-data";
import {
  isDataUrl,
  isMediaRef,
  mediaDelete,
  mediaGet,
  mediaSet,
} from "./media-storage";
import { uid } from "./utils";

/** v2: remove follows/stories de contas seed */
const SOCIAL_STORAGE_VERSION = 2;

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ACTIVE_STORIES_PER_USER = 30;
const DEFAULT_IMAGE_MS = 5000;
const MAX_VIDEO_MS = 30_000;

export type FollowEdge = {
  followerId: string;
  followingId: string;
  createdAt: string;
};

export type StoryMediaType = "image" | "video";
/** Proporções suportadas no estilo Instagram */
export type StoryAspect = "9:16" | "16:9" | "1:1" | "auto";

export type StoryOverlayBase = {
  id: string;
  /** posição 0–100 (% do canvas) — centro do elemento */
  x: number;
  y: number;
  /** rotação em graus */
  rotation?: number;
};

export type StoryTextOverlay = StoryOverlayBase & {
  type: "text";
  text: string;
  color: string;
  /** escala tipográfica relativa (1 = normal) */
  scale: number;
  bg: boolean;
};

export type StoryEmojiOverlay = StoryOverlayBase & {
  type: "emoji";
  emoji: string;
  scale: number;
};

export type StoryCustomEmojiOverlay = StoryOverlayBase & {
  type: "custom-emoji";
  shortcode: string;
  /** snapshot da imagem para renderizar mesmo se o emoji for apagado */
  imageUrl: string;
  scale: number;
};

export type StoryLocationOverlay = StoryOverlayBase & {
  type: "location";
  label: string;
};

export type StoryOverlay =
  | StoryTextOverlay
  | StoryEmojiOverlay
  | StoryCustomEmojiOverlay
  | StoryLocationOverlay;

export type Story = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorAvatarUrl: string | null;
  /** image | video */
  mediaType: StoryMediaType;
  /**
   * URL da mídia: data:, https: ou idb: (hidrata para data: em memória).
   * `imageUrl` mantido como alias para compat com stories antigos.
   */
  mediaUrl: string;
  imageUrl: string;
  aspect: StoryAspect;
  /** duração de exibição (imagem fixa ou vídeo limitado) */
  durationMs: number;
  overlays: StoryOverlay[];
  /** legenda opcional legada (rodapé) */
  caption: string;
  createdAt: string;
  expiresAt: string;
  viewedBy: string[];
};

export type StoryAuthorGroup = {
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorAvatarUrl: string | null;
  stories: Story[];
  hasUnseen: boolean;
  latestAt: string;
};

function isActiveStory(s: Story, now = Date.now()): boolean {
  return new Date(s.expiresAt).getTime() > now;
}

function storyMediaKey(id: string) {
  return `idb:story:${id}`;
}

/** Normaliza stories antigos (só imageUrl) para o formato novo */
function normalizeStory(raw: Partial<Story> & { id: string }): Story {
  const mediaUrl = raw.mediaUrl || raw.imageUrl || "";
  return {
    id: raw.id,
    authorId: raw.authorId || "",
    authorName: raw.authorName || "Usuário",
    authorAvatar: raw.authorAvatar || "?",
    authorAvatarUrl: raw.authorAvatarUrl ?? null,
    mediaType: raw.mediaType === "video" ? "video" : "image",
    mediaUrl,
    imageUrl: mediaUrl,
    aspect: raw.aspect || "9:16",
    durationMs:
      typeof raw.durationMs === "number" && raw.durationMs > 0
        ? raw.durationMs
        : DEFAULT_IMAGE_MS,
    overlays: Array.isArray(raw.overlays) ? raw.overlays : [],
    caption: raw.caption || "",
    createdAt: raw.createdAt || new Date().toISOString(),
    expiresAt:
      raw.expiresAt ||
      new Date(Date.now() + STORY_TTL_MS).toISOString(),
    viewedBy: Array.isArray(raw.viewedBy) ? raw.viewedBy : [],
  };
}

async function persistStoryMedia(
  storyId: string,
  mediaUrl: string
): Promise<string> {
  if (!isDataUrl(mediaUrl)) return mediaUrl;
  const key = storyMediaKey(storyId);
  try {
    await mediaSet(key, mediaUrl);
    return key;
  } catch {
    // se IDB falhar, tenta manter data URL (pode estourar LS)
    return mediaUrl;
  }
}

async function hydrateStoryMedia(stories: Story[]): Promise<Story[]> {
  const out: Story[] = [];
  for (const s of stories) {
    const n = normalizeStory(s);
    if (isMediaRef(n.mediaUrl)) {
      const data = await mediaGet(n.mediaUrl);
      if (data) {
        n.mediaUrl = data;
        n.imageUrl = data;
      }
    }
    // custom emoji overlays podem estar em idb:
    n.overlays = await Promise.all(
      n.overlays.map(async (ov) => {
        if (ov.type === "custom-emoji" && isMediaRef(ov.imageUrl)) {
          const data = await mediaGet(ov.imageUrl);
          return data ? { ...ov, imageUrl: data } : ov;
        }
        return ov;
      })
    );
    out.push(n);
  }
  return out;
}

interface SocialState {
  follows: FollowEdge[];
  stories: Story[];
  /** true após hidratar mídia do IDB */
  mediaHydrated: boolean;

  follow: (meId: string, targetId: string) => { ok: true } | { ok: false; error: string };
  unfollow: (meId: string, targetId: string) => void;
  isFollowing: (meId: string, targetId: string) => boolean;
  followersOf: (userId: string) => string[];
  followingOf: (userId: string) => string[];
  followerCount: (userId: string) => number;
  followingCount: (userId: string) => number;

  addStory: (data: {
    authorId: string;
    authorName: string;
    authorAvatar: string;
    authorAvatarUrl?: string | null;
    mediaType: StoryMediaType;
    mediaUrl: string;
    aspect?: StoryAspect;
    durationMs?: number;
    overlays?: StoryOverlay[];
    caption?: string;
  }) => Promise<{ ok: true; story: Story } | { ok: false; error: string }>;
  deleteStory: (storyId: string, userId: string) => void;
  markStoryViewed: (storyId: string, viewerId: string) => void;
  purgeExpired: () => void;
  hydrateMedia: () => Promise<void>;

  getActiveStories: () => Story[];
  getStoryGroups: (opts: {
    viewerId?: string | null;
    followingOnly?: boolean;
    excludeAuthorIds?: string[];
  }) => StoryAuthorGroup[];
}

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      follows: [],
      stories: [],
      mediaHydrated: false,

      follow: (meId, targetId) => {
        if (!meId || !targetId) {
          return { ok: false, error: "Usuário inválido." };
        }
        if (meId === targetId) {
          return { ok: false, error: "Você não pode seguir a si mesmo." };
        }
        if (get().isFollowing(meId, targetId)) return { ok: true };
        set((s) => ({
          follows: [
            {
              followerId: meId,
              followingId: targetId,
              createdAt: new Date().toISOString(),
            },
            ...s.follows,
          ],
        }));
        return { ok: true };
      },

      unfollow: (meId, targetId) => {
        set((s) => ({
          follows: s.follows.filter(
            (f) =>
              !(f.followerId === meId && f.followingId === targetId)
          ),
        }));
      },

      isFollowing: (meId, targetId) =>
        get().follows.some(
          (f) => f.followerId === meId && f.followingId === targetId
        ),

      followersOf: (userId) =>
        get()
          .follows.filter((f) => f.followingId === userId)
          .map((f) => f.followerId),

      followingOf: (userId) =>
        get()
          .follows.filter((f) => f.followerId === userId)
          .map((f) => f.followingId),

      followerCount: (userId) =>
        get().follows.filter((f) => f.followingId === userId).length,

      followingCount: (userId) =>
        get().follows.filter((f) => f.followerId === userId).length,

      addStory: async (data) => {
        if (!data.mediaUrl) {
          return { ok: false, error: "Envie uma foto ou vídeo para o story." };
        }
        const now = Date.now();
        get().purgeExpired();
        const mine = get()
          .getActiveStories()
          .filter((s) => s.authorId === data.authorId);
        if (mine.length >= MAX_ACTIVE_STORIES_PER_USER) {
          return {
            ok: false,
            error: `Limite de ${MAX_ACTIVE_STORIES_PER_USER} stories ativos (24h).`,
          };
        }

        const id = uid("st");
        const mediaType = data.mediaType === "video" ? "video" : "image";
        let durationMs =
          typeof data.durationMs === "number" && data.durationMs > 0
            ? data.durationMs
            : DEFAULT_IMAGE_MS;
        if (mediaType === "video") {
          durationMs = Math.min(Math.max(durationMs, 1000), MAX_VIDEO_MS);
        } else {
          durationMs = DEFAULT_IMAGE_MS;
        }

        // guarda data URL no IDB
        const storedUrl = await persistStoryMedia(id, data.mediaUrl);
        // em memória usamos o data/url original para preview imediato
        const displayUrl = isDataUrl(data.mediaUrl)
          ? data.mediaUrl
          : storedUrl;

        // custom emojis: se data URL, offload
        const overlays = await Promise.all(
          (data.overlays || []).map(async (ov) => {
            if (
              ov.type === "custom-emoji" &&
              isDataUrl(ov.imageUrl)
            ) {
              const key = `idb:story-emoji:${id}:${ov.id}`;
              try {
                await mediaSet(key, ov.imageUrl);
                return { ...ov, imageUrl: ov.imageUrl }; // keep data in mem
              } catch {
                return ov;
              }
            }
            return ov;
          })
        );

        // persist version with idb refs for custom emoji if needed is complex;
        // we store overlays as-is with data URLs only if small; custom emoji
        // imageUrls are already short https or idb from emoji store.

        const story: Story = {
          id,
          authorId: data.authorId,
          authorName: data.authorName,
          authorAvatar: data.authorAvatar,
          authorAvatarUrl: data.authorAvatarUrl ?? null,
          mediaType,
          mediaUrl: displayUrl,
          imageUrl: displayUrl,
          aspect: data.aspect || "9:16",
          durationMs,
          overlays,
          caption: (data.caption || "").trim().slice(0, 200),
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + STORY_TTL_MS).toISOString(),
          viewedBy: [],
        };

        // Persist compact: media as idb ref
        const toPersist: Story = {
          ...story,
          mediaUrl: storedUrl,
          imageUrl: storedUrl,
          overlays: overlays.map((ov) => {
            if (ov.type === "custom-emoji" && isDataUrl(ov.imageUrl)) {
              // keep shortcode + try leave imageUrl; LS may bloat — prefer empty and re-resolve
              return ov;
            }
            return ov;
          }),
        };

        set((s) => ({
          stories: [story, ...s.stories.map(normalizeStory)],
        }));

        // rewrite persisted copy: zustand partialize will dump display data URLs;
        // we patch storage via set with mixed - use a second set after replacing
        // mediaUrl for the story that gets partialized... Actually partialize
        // uses state as-is. So we need stories in state to have idb refs for
        // media when serializing. Strategy: keep dual — store idb in mediaUrl
        // field named `_persistMedia` OR use partialize transform.

        // Better: immediately set mediaUrl to storedUrl for LS, but also keep
        // a runtime cache. Simpler for MVP: leave displayUrl in memory and
        // partialize replaces data: with idb keys.
        void toPersist;

        return { ok: true, story };
      },

      deleteStory: (storyId, userId) => {
        const st = get().stories.find(
          (s) => s.id === storyId && s.authorId === userId
        );
        if (st) {
          void mediaDelete(storyMediaKey(storyId));
        }
        set((s) => ({
          stories: s.stories.filter(
            (x) => !(x.id === storyId && x.authorId === userId)
          ),
        }));
      },

      markStoryViewed: (storyId, viewerId) => {
        if (!viewerId) return;
        set((s) => ({
          stories: s.stories.map((st) => {
            if (st.id !== storyId) return st;
            if (st.viewedBy.includes(viewerId)) return st;
            return { ...st, viewedBy: [...st.viewedBy, viewerId] };
          }),
        }));
      },

      purgeExpired: () => {
        const now = Date.now();
        const expired = get().stories.filter((st) => !isActiveStory(st, now));
        for (const st of expired) {
          void mediaDelete(storyMediaKey(st.id));
        }
        set((s) => ({
          stories: s.stories.filter((st) => isActiveStory(st, now)),
        }));
      },

      hydrateMedia: async () => {
        const stories = get().stories.map(normalizeStory);
        const hydrated = await hydrateStoryMedia(stories);
        set({ stories: hydrated, mediaHydrated: true });
      },

      getActiveStories: () => {
        const now = Date.now();
        return get()
          .stories.map(normalizeStory)
          .filter((st) => isActiveStory(st, now));
      },

      getStoryGroups: ({
        viewerId,
        followingOnly = false,
        excludeAuthorIds = [],
      }) => {
        const now = Date.now();
        const exclude = new Set(excludeAuthorIds);
        const following = new Set(
          viewerId ? get().followingOf(viewerId) : []
        );
        if (viewerId) following.add(viewerId);

        let active = get()
          .stories.map(normalizeStory)
          .filter((st) => isActiveStory(st, now))
          .filter((st) => !exclude.has(st.authorId));

        if (followingOnly && viewerId) {
          active = active.filter((st) => following.has(st.authorId));
        }

        const map = new Map<string, StoryAuthorGroup>();
        for (const st of active) {
          const g = map.get(st.authorId);
          if (!g) {
            map.set(st.authorId, {
              authorId: st.authorId,
              authorName: st.authorName,
              authorAvatar: st.authorAvatar,
              authorAvatarUrl: st.authorAvatarUrl,
              stories: [st],
              hasUnseen: viewerId
                ? !st.viewedBy.includes(viewerId) && st.authorId !== viewerId
                : true,
              latestAt: st.createdAt,
            });
          } else {
            g.stories.push(st);
            if (
              new Date(st.createdAt).getTime() >
              new Date(g.latestAt).getTime()
            ) {
              g.latestAt = st.createdAt;
            }
            if (
              viewerId &&
              st.authorId !== viewerId &&
              !st.viewedBy.includes(viewerId)
            ) {
              g.hasUnseen = true;
            }
          }
        }

        for (const g of map.values()) {
          g.stories.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime()
          );
        }

        return Array.from(map.values()).sort((a, b) => {
          if (viewerId) {
            if (a.authorId === viewerId) return -1;
            if (b.authorId === viewerId) return 1;
          }
          if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
          return (
            new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
          );
        });
      },
    }),
    {
      name: "nullysh-social",
      version: SOCIAL_STORAGE_VERSION,
      partialize: (s) => ({
        follows: s.follows,
        // compact media: data: → idb ref keys (already stored in IDB on add)
        stories: s.stories.map((st) => {
          const n = normalizeStory(st);
          const mediaKey = isDataUrl(n.mediaUrl)
            ? storyMediaKey(n.id)
            : n.mediaUrl;
          // ensure IDB has the blob if we still have data URL
          if (isDataUrl(n.mediaUrl)) {
            void mediaSet(mediaKey, n.mediaUrl);
          }
          return {
            ...n,
            mediaUrl: mediaKey,
            imageUrl: mediaKey,
            overlays: n.overlays.map((ov) => {
              if (ov.type === "custom-emoji" && isDataUrl(ov.imageUrl)) {
                // drop heavy data from LS — custom emoji store has the image
                return { ...ov, imageUrl: "" };
              }
              return ov;
            }),
          };
        }),
      }),
      migrate: (persisted) => {
        const p = (persisted || {}) as {
          follows?: FollowEdge[];
          stories?: Story[];
        };
        const follows = (p.follows || []).filter(
          (f) =>
            !isGhostUserId(f.followerId) && !isGhostUserId(f.followingId)
        );
        const stories = (p.stories || []).filter(
          (st) => !isGhostUserId(st.authorId)
        );
        return { ...p, follows, stories } as never;
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<SocialState> | undefined;
        return {
          ...current,
          ...p,
          follows: (p?.follows ?? current.follows).filter(
            (f) =>
              !isGhostUserId(f.followerId) && !isGhostUserId(f.followingId)
          ),
          stories: (p?.stories ?? current.stories)
            .filter((st) => !isGhostUserId(st.authorId))
            .map(normalizeStory),
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // normalize + hydrate media async
        state.stories = (state.stories || [])
          .filter((st) => !isGhostUserId(st.authorId))
          .map(normalizeStory);
        state.follows = (state.follows || []).filter(
          (f) =>
            !isGhostUserId(f.followerId) && !isGhostUserId(f.followingId)
        );
        void state.hydrateMedia();
      },
    }
  )
);

export { STORY_TTL_MS, DEFAULT_IMAGE_MS, MAX_VIDEO_MS, MAX_ACTIVE_STORIES_PER_USER };

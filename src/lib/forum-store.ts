"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  isGhostComment,
  isGhostMessage,
  isGhostPost,
  isGhostUserId,
} from "./ghost-data";
import { useAuthStore } from "./auth-store";
import { getDmPeerId, isDmChannel } from "./dm";
import {
  notifyChatReaction,
  notifyComment,
  notifyCommentLike,
  notifyDislike,
  notifyDm,
  notifyLike,
  notifyRepost,
} from "./notification-store";
import { isSupabaseConfigured } from "./supabase/config";
import { normalizePostMusic } from "./post-music";
import type {
  ChatMediaKind,
  ChatMessage,
  Comment,
  Post,
  PostMusic,
  PostRepost,
} from "./types";
import { uid } from "./utils";

/** v6: música no post (estilo IG) */
const FORUM_STORAGE_VERSION = 6;

function normalizePost(p: Post): Post {
  const likedBy = (Array.isArray(p.likedBy) ? p.likedBy : []).filter(
    (id) => !isGhostUserId(id)
  );
  const dislikedBy = (Array.isArray(p.dislikedBy) ? p.dislikedBy : []).filter(
    (id) => !isGhostUserId(id)
  );
  const savedBy = (Array.isArray(p.savedBy) ? p.savedBy : []).filter(
    (id) => !isGhostUserId(id)
  );
  return {
    ...p,
    music: normalizePostMusic(p.music) ?? null,
    likes: likedBy.length,
    dislikes: dislikedBy.length,
    comments: p.comments ?? 0,
    likedBy,
    dislikedBy,
    savedBy,
  };
}

function normalizeComment(c: Comment): Comment {
  const likedBy = (Array.isArray(c.likedBy) ? c.likedBy : []).filter(
    (id) => !isGhostUserId(id)
  );
  return {
    ...c,
    likedBy,
    parentId: c.parentId ?? null,
    replyToName: c.replyToName ?? null,
    replyToAuthorId: c.replyToAuthorId ?? null,
    gifUrl: c.gifUrl ?? null,
  };
}

interface ForumState {
  posts: Post[];
  comments: Comment[];
  messages: ChatMessage[];
  reposts: PostRepost[];
  createPost: (data: {
    authorId: string;
    authorName: string;
    authorAvatar: string;
    authorAvatarUrl?: string | null;
    title?: string;
    content: string;
    imageUrl?: string | null;
    gifUrl?: string | null;
    location?: string | null;
    music?: PostMusic | null;
    communityId?: string;
    communityName?: string;
    type?: Post["type"];
    vipOnly?: boolean;
    /** hashtag sem # (ex.: geral) — gravado no Supabase */
    hashtag?: string | null;
  }) => Promise<Post>;
  /** Substitui/mescla posts remotos (fonte da verdade quando Supabase ativo) */
  hydratePosts: (posts: Post[]) => void;
  upsertPost: (post: Post) => void;
  removePostById: (postId: string) => void;
  toggleLike: (postId: string, userId: string) => Promise<void>;
  toggleDislike: (postId: string, userId: string) => Promise<void>;
  toggleSave: (postId: string, userId: string) => void;
  hydrateComments: (comments: Comment[]) => void;
  hydrateReposts: (reposts: PostRepost[]) => void;
  upsertComment: (comment: Comment) => void;
  /** Remove post próprio (ou admin). Apaga no Supabase + store local. */
  deletePost: (
    postId: string,
    userId: string,
    opts?: { isAdmin?: boolean }
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  /**
   * Apaga comentário se:
   * - for o autor do comentário, ou
   * - for o dono do post (só nos próprios posts), ou
   * - for admin
   */
  deleteComment: (
    commentId: string,
    userId: string,
    opts?: { isAdmin?: boolean }
  ) => { ok: true } | { ok: false; error: string };
  addComment: (data: {
    postId: string;
    authorId: string;
    authorName: string;
    authorAvatar: string;
    content: string;
    /** id do comentário ao qual está respondendo (qualquer nível → normaliza p/ raiz) */
    replyToId?: string | null;
    /** GIF opcional no comentário */
    gifUrl?: string | null;
  }) => Promise<Comment>;
  /** Curtir / descurtir comentário (qualquer usuário logado, incl. dono do post) */
  toggleCommentLike: (
    commentId: string,
    userId: string,
    actorName: string
  ) => Promise<void>;
  toggleRepost: (
    postId: string,
    userId: string,
    userName: string
  ) => Promise<
    { ok: true; reposted: boolean } | { ok: false; error: string }
  >;
  isReposted: (postId: string, userId: string) => boolean;
  repostCount: (postId: string) => number;
  getRepostsByUser: (userId: string) => PostRepost[];
  hydrateMessages: (messages: ChatMessage[]) => void;
  upsertMessage: (message: ChatMessage) => void;
  removeMessageById: (messageId: string) => void;
  sendMessage: (data: {
    channelId: string;
    authorId: string;
    authorName: string;
    authorAvatar: string;
    content: string;
    sharedPostId?: string | null;
    mediaKind?: ChatMediaKind | null;
    mediaUrl?: string | null;
    mediaMime?: string | null;
    mediaDuration?: number | null;
    mediaThumbUrl?: string | null;
    mediaWidth?: number | null;
    mediaHeight?: number | null;
  }) => Promise<ChatMessage>;
  /**
   * Apaga mensagem própria (ou admin).
   */
  deleteMessage: (
    messageId: string,
    userId: string,
    opts?: { isAdmin?: boolean }
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  /**
   * Alterna reação do usuário em uma mensagem (emoji único por pessoa —
   * clicar de novo no mesmo remove; trocar emoji substitui).
   */
  toggleMessageReaction: (
    messageId: string,
    userId: string,
    emoji: string
  ) => void;
  getCommentsForPost: (postId: string) => Comment[];
  getMessagesForChannel: (channelId: string) => ChatMessage[];
  getSavedPosts: (userId: string) => Post[];
  getPostById: (postId: string) => Post | undefined;
}

export const useForumStore = create<ForumState>()(
  persist(
    (set, get) => ({
      // Sem seeds: só conteúdo real criado pelos membros (ou importado do Supabase)
      posts: [],
      comments: [],
      messages: [],
      reposts: [],

      createPost: async (data) => {
        const content = data.content.trim();
        const hashtag =
          data.hashtag?.replace(/^#/, "").toLowerCase() ||
          data.communityName
            ?.replace(/^#/, "")
            .toLowerCase()
            .replace(/\s+/g, "") ||
          null;

        // ── Supabase = fonte da verdade multi-user ──────────────
        if (isSupabaseConfigured()) {
          const { insertRemotePost } = await import(
            "@/lib/supabase/posts-service"
          );
          const remote = await insertRemotePost({
            authorId: data.authorId,
            authorName: data.authorName,
            authorAvatar: data.authorAvatar,
            authorAvatarUrl: data.authorAvatarUrl ?? null,
            content: content || " ",
            imageUrl: data.imageUrl ?? null,
            gifUrl: data.gifUrl?.trim() || null,
            location: data.location?.trim() || null,
            music: normalizePostMusic(data.music),
            type: data.type ?? "discussion",
            communityId: data.communityId,
            communityName: data.communityName,
            vipOnly: data.vipOnly ?? false,
            hashtag,
            title: data.title?.trim(),
          });
          if (!remote.ok) {
            throw new Error(remote.error);
          }
          const post: Post = remote.post;
          set((s) => ({
            posts: [post, ...s.posts.filter((p) => p.id !== post.id)],
          }));
          return post;
        }

        // ── Modo local (dev sem Supabase) ───────────────────────
        const post: Post = {
          id: uid("post"),
          authorId: data.authorId,
          authorName: data.authorName,
          authorAvatar: data.authorAvatar,
          authorAvatarUrl: data.authorAvatarUrl ?? null,
          communityId: data.communityId,
          communityName: data.communityName,
          title: data.title?.trim() || undefined,
          content,
          imageUrl: data.imageUrl ?? null,
          gifUrl: data.gifUrl?.trim() || null,
          location: data.location?.trim() || null,
          music: normalizePostMusic(data.music),
          type: data.type ?? "discussion",
          likes: 0,
          dislikes: 0,
          comments: 0,
          likedBy: [],
          dislikedBy: [],
          savedBy: [],
          createdAt: new Date().toISOString(),
          vipOnly: data.vipOnly ?? false,
        };
        set((s) => ({ posts: [post, ...s.posts] }));
        return post;
      },

      hydratePosts: (posts) => {
        const normalized = posts
          .map(normalizePost)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime()
          );
        // Com Supabase, Postgres é a fonte da verdade — NÃO manter fantasmas
        // post_* do localStorage (senão User A vê o post e User B não).
        if (isSupabaseConfigured()) {
          set({ posts: normalized });
          return;
        }
        set((s) => {
          const remoteIds = new Set(normalized.map((p) => p.id));
          const localOnly = s.posts.filter(
            (p) => !remoteIds.has(p.id) && p.id.startsWith("post_")
          );
          return {
            posts: [...normalized, ...localOnly].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            ),
          };
        });
      },

      upsertPost: (post) => {
        const n = normalizePost(post);
        set((s) => {
          const prev = s.posts.find((p) => p.id === n.id);
          // Realtime/DB sem coluna music ainda não deve apagar o que o autor
          // acabou de anexar no client (migration P1.i pendente).
          const merged: Post = {
            ...n,
            music: n.music ?? prev?.music ?? null,
            gifUrl: n.gifUrl ?? prev?.gifUrl ?? null,
          };
          if (prev) {
            return {
              posts: s.posts.map((p) => (p.id === merged.id ? merged : p)),
            };
          }
          return {
            posts: [merged, ...s.posts].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            ),
          };
        });
      },

      removePostById: (postId) => {
        set((s) => ({
          posts: s.posts.filter((p) => p.id !== postId),
          comments: s.comments.filter((c) => c.postId !== postId),
        }));
      },

      hydrateComments: (comments) => {
        if (isSupabaseConfigured()) {
          set({ comments });
          return;
        }
        set((s) => {
          const remoteIds = new Set(comments.map((c) => c.id));
          const localOnly = s.comments.filter(
            (c) => !remoteIds.has(c.id) && c.id.startsWith("cm")
          );
          return { comments: [...comments, ...localOnly] };
        });
      },

      upsertComment: (comment) => {
        set((s) => {
          const exists = s.comments.some((c) => c.id === comment.id);
          if (exists) {
            return {
              comments: s.comments.map((c) =>
                c.id === comment.id ? comment : c
              ),
            };
          }
          return {
            comments: [...s.comments, comment],
            posts: s.posts.map((p) =>
              p.id === comment.postId
                ? { ...p, comments: p.comments + 1 }
                : p
            ),
          };
        });
      },

      hydrateReposts: (reposts) => {
        if (isSupabaseConfigured()) {
          set({ reposts });
          return;
        }
        set((s) => {
          const remoteIds = new Set(reposts.map((r) => r.id));
          const localOnly = s.reposts.filter(
            (r) => !remoteIds.has(r.id) && r.id.startsWith("rp")
          );
          return { reposts: [...reposts, ...localOnly] };
        });
      },

      toggleLike: async (postId, userId) => {
        // Multi-user: RPC Supabase (liked_by + notificação ao dono)
        if (isSupabaseConfigured() && !postId.startsWith("post_")) {
          const before = get().posts.find((p) => p.id === postId);
          const wasLiked = !!before?.likedBy?.includes(userId);
          // Otimista
          set((s) => ({
            posts: s.posts.map((raw) => {
              const p = normalizePost(raw);
              if (p.id !== postId) return p;
              if (wasLiked) {
                return {
                  ...p,
                  likes: Math.max(0, p.likes - 1),
                  likedBy: p.likedBy.filter((id) => id !== userId),
                };
              }
              return {
                ...p,
                likes: p.likes + 1,
                likedBy: [...p.likedBy.filter((id) => id !== userId), userId],
              };
            }),
          }));
          try {
            const { toggleRemotePostLike } = await import(
              "@/lib/supabase/posts-service"
            );
            const remote = await toggleRemotePostLike(postId);
            if (remote.ok) {
              set((s) => ({
                posts: s.posts.map((p) =>
                  p.id === postId
                    ? {
                        ...p,
                        likes: remote.post.likes,
                        likedBy: remote.post.likedBy,
                        gifUrl: remote.post.gifUrl ?? p.gifUrl,
                      }
                    : p
                ),
              }));
            } else {
              // reverte; se o post sumiu no servidor, remove em silêncio
              const gone =
                /not found|0 rows|PGRST116|does not exist/i.test(
                  remote.error || ""
                );
              if (gone) {
                get().removePostById(postId);
              } else {
                set((s) => ({
                  posts: s.posts.map((p) =>
                    p.id === postId && before ? before : p
                  ),
                }));
              }
              console.error("[toggleLike] remote", remote.error);
            }
          } catch (e) {
            console.error("[toggleLike]", e);
          }
          return;
        }

        const before = get().posts.find((p) => p.id === postId);
        const wasLiked = !!before?.likedBy?.includes(userId);
        set((s) => ({
          posts: s.posts.map((raw) => {
            const p = normalizePost(raw);
            if (p.id !== postId) return p;
            const liked = p.likedBy.includes(userId);
            const disliked = p.dislikedBy.includes(userId);
            if (liked) {
              return {
                ...p,
                likes: Math.max(0, p.likes - 1),
                likedBy: p.likedBy.filter((id) => id !== userId),
              };
            }
            return {
              ...p,
              likes: p.likes + 1,
              likedBy: [...p.likedBy, userId],
              dislikes: disliked ? Math.max(0, p.dislikes - 1) : p.dislikes,
              dislikedBy: disliked
                ? p.dislikedBy.filter((id) => id !== userId)
                : p.dislikedBy,
            };
          }),
        }));
        if (!wasLiked && before) {
          const actor =
            useAuthStore.getState().users.find((u) => u.id === userId)?.name ||
            "Alguém";
          notifyLike({
            postAuthorId: before.authorId,
            actorId: userId,
            actorName: actor,
            postId,
            excerpt: before.content.slice(0, 48),
          });
        }
      },

      toggleDislike: async (postId, userId) => {
        if (isSupabaseConfigured() && !postId.startsWith("post_")) {
          const before = get().posts.find((p) => p.id === postId);
          const wasDisliked = !!before?.dislikedBy?.includes(userId);
          // Otimista
          set((s) => ({
            posts: s.posts.map((raw) => {
              const p = normalizePost(raw);
              if (p.id !== postId) return p;
              if (wasDisliked) {
                return {
                  ...p,
                  dislikes: Math.max(0, p.dislikes - 1),
                  dislikedBy: p.dislikedBy.filter((id) => id !== userId),
                };
              }
              return {
                ...p,
                dislikes: p.dislikes + 1,
                dislikedBy: [
                  ...p.dislikedBy.filter((id) => id !== userId),
                  userId,
                ],
                likes: p.likedBy.includes(userId)
                  ? Math.max(0, p.likes - 1)
                  : p.likes,
                likedBy: p.likedBy.filter((id) => id !== userId),
              };
            }),
          }));
          try {
            const { toggleRemotePostDislike } = await import(
              "@/lib/supabase/posts-service"
            );
            const remote = await toggleRemotePostDislike(postId);
            if (remote.ok) {
              set((s) => ({
                posts: s.posts.map((p) =>
                  p.id === postId
                    ? {
                        ...p,
                        likes: remote.post.likes,
                        likedBy: remote.post.likedBy,
                        dislikes: remote.post.dislikes,
                        dislikedBy: remote.post.dislikedBy,
                      }
                    : p
                ),
              }));
            } else {
              set((s) => ({
                posts: s.posts.map((p) =>
                  p.id === postId && before ? before : p
                ),
              }));
              console.error("[toggleDislike] remote", remote.error);
            }
          } catch (e) {
            console.error("[toggleDislike]", e);
          }
          return;
        }

        const before = get().posts.find((p) => p.id === postId);
        const wasDisliked = !!before?.dislikedBy?.includes(userId);
        set((s) => ({
          posts: s.posts.map((raw) => {
            const p = normalizePost(raw);
            if (p.id !== postId) return p;
            const disliked = p.dislikedBy.includes(userId);
            const liked = p.likedBy.includes(userId);
            if (disliked) {
              return {
                ...p,
                dislikes: Math.max(0, p.dislikes - 1),
                dislikedBy: p.dislikedBy.filter((id) => id !== userId),
              };
            }
            return {
              ...p,
              dislikes: p.dislikes + 1,
              dislikedBy: [...p.dislikedBy, userId],
              likes: liked ? Math.max(0, p.likes - 1) : p.likes,
              likedBy: liked
                ? p.likedBy.filter((id) => id !== userId)
                : p.likedBy,
            };
          }),
        }));
        if (!wasDisliked && before && before.authorId !== userId) {
          const actor =
            useAuthStore.getState().users.find((u) => u.id === userId)?.name ||
            "Alguém";
          notifyDislike({
            postAuthorId: before.authorId,
            actorId: userId,
            actorName: actor,
            postId,
            excerpt: before.content.slice(0, 48),
          });
        }
      },

      toggleSave: (postId, userId) => {
        set((s) => ({
          posts: s.posts.map((raw) => {
            const p = normalizePost(raw);
            if (p.id !== postId) return p;
            const saved = p.savedBy.includes(userId);
            return {
              ...p,
              savedBy: saved
                ? p.savedBy.filter((id) => id !== userId)
                : [...p.savedBy, userId],
            };
          }),
        }));
      },

      deletePost: async (postId, userId, opts) => {
        const post = get().posts.find((p) => p.id === postId);
        if (!post) {
          return { ok: false, error: "Post não encontrado." };
        }
        const canDelete = post.authorId === userId || !!opts?.isAdmin;
        if (!canDelete) {
          return {
            ok: false,
            error: "Você só pode apagar as suas próprias postagens.",
          };
        }

        // Multi-user: apagar no Postgres primeiro (fonte da verdade)
        // IDs locais legados (post_*) não existem no DB
        if (isSupabaseConfigured() && !postId.startsWith("post_")) {
          const { deleteRemotePost } = await import(
            "@/lib/supabase/posts-service"
          );
          const remote = await deleteRemotePost(postId);
          if (!remote.ok) {
            return remote;
          }
        }

        set((s) => ({
          posts: s.posts.filter((p) => p.id !== postId),
          comments: s.comments.filter((c) => c.postId !== postId),
        }));
        return { ok: true };
      },

      addComment: async (data) => {
        let parentId: string | null = null;
        let replyToName: string | null = null;
        let replyToAuthorId: string | null = null;

        if (data.replyToId) {
          const target = get().comments.find((c) => c.id === data.replyToId);
          if (target && target.postId === data.postId) {
            parentId = target.parentId || target.id;
            replyToName = target.authorName;
            replyToAuthorId = target.authorId;
          }
        }

        const gifUrl = data.gifUrl?.trim() || null;

        // Multi-user: grava no Supabase (trigger notifica o dono)
        if (isSupabaseConfigured() && !data.postId.startsWith("post_")) {
          const { insertRemoteComment } = await import(
            "@/lib/supabase/posts-service"
          );
          const remote = await insertRemoteComment({
            postId: data.postId,
            authorId: data.authorId,
            authorName: data.authorName,
            authorAvatar: data.authorAvatar,
            content: data.content.trim(),
            gifUrl,
            parentId,
            replyToName,
            replyToAuthorId,
          });
          if (!remote.ok) {
            throw new Error(remote.error);
          }
          const comment = remote.comment;
          set((s) => {
            if (s.comments.some((c) => c.id === comment.id)) {
              return s;
            }
            return {
              comments: [...s.comments, comment],
              posts: s.posts.map((p) =>
                p.id === data.postId
                  ? { ...p, comments: p.comments + 1 }
                  : p
              ),
            };
          });
          return comment;
        }

        const comment: Comment = {
          id: uid("cm"),
          postId: data.postId,
          authorId: data.authorId,
          authorName: data.authorName,
          authorAvatar: data.authorAvatar,
          content: data.content.trim(),
          createdAt: new Date().toISOString(),
          likedBy: [],
          parentId,
          replyToName,
          replyToAuthorId,
          gifUrl,
        };
        const post = get().posts.find((p) => p.id === data.postId);
        set((s) => ({
          comments: [...s.comments, comment],
          posts: s.posts.map((p) =>
            p.id === data.postId ? { ...p, comments: p.comments + 1 } : p
          ),
        }));
        if (post) {
          const excerpt =
            data.content.trim().slice(0, 48) ||
            (gifUrl ? "enviou um GIF" : "");
          if (post.authorId !== data.authorId) {
            notifyComment({
              postAuthorId: post.authorId,
              actorId: data.authorId,
              actorName: data.authorName,
              postId: data.postId,
              commentId: comment.id,
              excerpt,
              isReply: !!parentId && replyToAuthorId === post.authorId,
            });
          }
          if (
            replyToAuthorId &&
            replyToAuthorId !== data.authorId &&
            replyToAuthorId !== post.authorId
          ) {
            notifyComment({
              postAuthorId: replyToAuthorId,
              actorId: data.authorId,
              actorName: data.authorName,
              postId: data.postId,
              commentId: comment.id,
              excerpt,
              isReply: true,
            });
          }
        }
        return comment;
      },

      toggleCommentLike: async (commentId, userId, actorName) => {
        const before = get().comments.find((c) => c.id === commentId);
        if (!before) return;
        const wasLiked = (before.likedBy ?? []).includes(userId);

        // Multi-user: RPC notifica o autor do comentário
        if (isSupabaseConfigured() && !commentId.startsWith("cm")) {
          set((s) => ({
            comments: s.comments.map((c) => {
              if (c.id !== commentId) return c;
              const likedBy = Array.isArray(c.likedBy) ? c.likedBy : [];
              if (likedBy.includes(userId)) {
                return {
                  ...c,
                  likedBy: likedBy.filter((id) => id !== userId),
                };
              }
              return { ...c, likedBy: [...likedBy, userId] };
            }),
          }));
          try {
            const { toggleRemoteCommentLike } = await import(
              "@/lib/supabase/posts-service"
            );
            const remote = await toggleRemoteCommentLike(commentId);
            if (remote.ok) {
              set((s) => ({
                comments: s.comments.map((c) =>
                  c.id === commentId
                    ? { ...c, likedBy: remote.comment.likedBy ?? [] }
                    : c
                ),
              }));
            } else {
              set((s) => ({
                comments: s.comments.map((c) =>
                  c.id === commentId ? before : c
                ),
              }));
              console.error("[toggleCommentLike] remote", remote.error);
            }
          } catch (e) {
            console.error("[toggleCommentLike]", e);
          }
          return;
        }

        set((s) => ({
          comments: s.comments.map((c) => {
            if (c.id !== commentId) return c;
            const likedBy = Array.isArray(c.likedBy) ? c.likedBy : [];
            if (likedBy.includes(userId)) {
              return {
                ...c,
                likedBy: likedBy.filter((id) => id !== userId),
              };
            }
            return { ...c, likedBy: [...likedBy, userId] };
          }),
        }));

        // Notifica o autor do comentário só ao curtir (não ao descurtir)
        if (!wasLiked && before.authorId !== userId) {
          notifyCommentLike({
            commentAuthorId: before.authorId,
            actorId: userId,
            actorName,
            postId: before.postId,
            commentId: before.id,
            excerpt: before.content.slice(0, 48),
          });
        }
      },

      deleteComment: (commentId, userId, opts) => {
        const comment = get().comments.find((c) => c.id === commentId);
        if (!comment) {
          return { ok: false, error: "Comentário não encontrado." };
        }
        const post = get().posts.find((p) => p.id === comment.postId);
        const isCommentAuthor = comment.authorId === userId;
        const isPostOwner = !!post && post.authorId === userId;
        const can =
          isCommentAuthor || isPostOwner || !!opts?.isAdmin;
        if (!can) {
          return {
            ok: false,
            error:
              "Você só pode apagar comentários nos seus posts ou os seus próprios.",
          };
        }

        // Multi-user: apaga no Postgres (cascade de replies no DB se parent_id)
        if (isSupabaseConfigured() && !commentId.startsWith("cm")) {
          void import("@/lib/supabase/posts-service").then(
            async ({ deleteRemoteComment }) => {
              const remote = await deleteRemoteComment(commentId);
              if (!remote.ok) {
                console.error("[deleteComment] remote", remote.error);
              }
            }
          );
        }

        // apaga o comentário e respostas aninhadas sob ele
        const toRemove = new Set<string>([commentId]);
        for (const c of get().comments) {
          if (c.parentId === commentId) toRemove.add(c.id);
        }
        const removed = toRemove.size;
        set((s) => ({
          comments: s.comments.filter((c) => !toRemove.has(c.id)),
          posts: s.posts.map((p) =>
            p.id === comment.postId
              ? { ...p, comments: Math.max(0, p.comments - removed) }
              : p
          ),
        }));
        return { ok: true };
      },

      toggleRepost: async (postId, userId, userName) => {
        const post = get().posts.find((p) => p.id === postId);
        if (!post) return { ok: false, error: "Post não encontrado." };
        if (post.authorId === userId) {
          return { ok: false, error: "Você não pode repostar o próprio post." };
        }

        // Multi-user: RPC grava + notifica o autor
        if (isSupabaseConfigured() && !postId.startsWith("post_")) {
          const existing = get().reposts.find(
            (r) => r.postId === postId && r.userId === userId
          );
          // Otimista
          if (existing) {
            set((s) => ({
              reposts: s.reposts.filter((r) => r.id !== existing.id),
            }));
          } else {
            const temp: PostRepost = {
              id: uid("rp"),
              userId,
              userName,
              postId,
              createdAt: new Date().toISOString(),
            };
            set((s) => ({ reposts: [temp, ...s.reposts] }));
          }
          try {
            const { toggleRemoteRepost } = await import(
              "@/lib/supabase/posts-service"
            );
            const remote = await toggleRemoteRepost(postId);
            if (!remote.ok) {
              // reverte
              if (existing) {
                set((s) => ({ reposts: [existing, ...s.reposts] }));
              } else {
                set((s) => ({
                  reposts: s.reposts.filter(
                    (r) => !(r.postId === postId && r.userId === userId)
                  ),
                }));
              }
              return { ok: false, error: remote.error };
            }
            if (remote.reposted && remote.repost) {
              set((s) => ({
                reposts: [
                  {
                    id: remote.repost!.id,
                    userId: remote.repost!.userId,
                    userName: remote.repost!.userName,
                    postId: remote.repost!.postId,
                    createdAt: remote.repost!.createdAt,
                  },
                  ...s.reposts.filter(
                    (r) =>
                      !(
                        r.postId === postId &&
                        r.userId === userId &&
                        r.id.startsWith("rp")
                      )
                  ),
                ],
              }));
            } else if (!remote.reposted) {
              set((s) => ({
                reposts: s.reposts.filter(
                  (r) => !(r.postId === postId && r.userId === userId)
                ),
              }));
            }
            return { ok: true, reposted: remote.reposted };
          } catch (e) {
            console.error("[toggleRepost]", e);
            return {
              ok: false,
              error: e instanceof Error ? e.message : "Falha ao repostar",
            };
          }
        }

        const existing = get().reposts.find(
          (r) => r.postId === postId && r.userId === userId
        );
        if (existing) {
          set((s) => ({
            reposts: s.reposts.filter((r) => r.id !== existing.id),
          }));
          return { ok: true, reposted: false };
        }
        const repost: PostRepost = {
          id: uid("rp"),
          userId,
          userName,
          postId,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ reposts: [repost, ...s.reposts] }));
        notifyRepost({
          postAuthorId: post.authorId,
          actorId: userId,
          actorName: userName,
          postId,
        });
        return { ok: true, reposted: true };
      },

      isReposted: (postId, userId) =>
        get().reposts.some((r) => r.postId === postId && r.userId === userId),

      repostCount: (postId) =>
        get().reposts.filter((r) => r.postId === postId).length,

      getRepostsByUser: (userId) =>
        get()
          .reposts.filter((r) => r.userId === userId)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ),

      hydrateMessages: (messages) => {
        const sorted = [...messages].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        if (isSupabaseConfigured()) {
          set({ messages: sorted });
          return;
        }
        set((s) => {
          const remoteIds = new Set(sorted.map((m) => m.id));
          const localOnly = s.messages.filter(
            (m) => !remoteIds.has(m.id) && m.id.startsWith("msg")
          );
          return {
            messages: [...sorted, ...localOnly].sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
            ),
          };
        });
      },

      upsertMessage: (message) => {
        set((s) => {
          const prev = s.messages.find((m) => m.id === message.id);
          if (prev) {
            // Merge: realtime/poll às vezes chega sem reactions ainda —
            // não apagar o que o user acabou de reagir localmente.
            const remoteR = message.reactions || {};
            const localR = prev.reactions || {};
            const remoteEmpty = Object.keys(remoteR).length === 0;
            const localHas = Object.keys(localR).length > 0;
            const merged = {
              ...message,
              reactions: remoteEmpty && localHas ? localR : remoteR,
              deliveredTo:
                (message.deliveredTo?.length || 0) >=
                (prev.deliveredTo?.length || 0)
                  ? message.deliveredTo
                  : prev.deliveredTo,
              readBy:
                (message.readBy?.length || 0) >= (prev.readBy?.length || 0)
                  ? message.readBy
                  : prev.readBy,
            };
            return {
              messages: s.messages.map((m) =>
                m.id === message.id ? merged : m
              ),
            };
          }
          return {
            messages: [...s.messages, message].sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
            ),
          };
        });
      },

      removeMessageById: (messageId) => {
        set((s) => ({
          messages: s.messages.filter((m) => m.id !== messageId),
        }));
      },

      sendMessage: async (data) => {
        const kind = data.mediaKind || (data.sharedPostId ? "text" : "text");

        // AppSec XSS: texto puro, sem HTML; limita tamanho (anti-flood / payload)
        const safeContent = (data.content || "")
          .replace(/\0/g, "")
          .slice(0, 4000)
          .trim();

        // Multi-user: grava no Supabase (realtime + notif DM via trigger)
        if (isSupabaseConfigured()) {
          const { insertRemoteChatMessage } = await import(
            "@/lib/supabase/chat-service"
          );
          const remote = await insertRemoteChatMessage({
            channelId: data.channelId,
            authorId: data.authorId,
            authorName: data.authorName,
            authorAvatar: data.authorAvatar,
            content: safeContent,
            sharedPostId: data.sharedPostId ?? null,
            mediaKind: data.mediaKind ?? null,
            mediaUrl: data.mediaUrl ?? null,
            mediaMime: data.mediaMime ?? null,
            mediaDuration: data.mediaDuration ?? null,
            mediaThumbUrl: data.mediaThumbUrl ?? null,
            mediaWidth: data.mediaWidth ?? null,
            mediaHeight: data.mediaHeight ?? null,
          });
          if (!remote.ok) {
            throw new Error(remote.error);
          }
          const message = remote.message;
          set((s) => {
            if (s.messages.some((m) => m.id === message.id)) return s;
            return {
              messages: [...s.messages, message].sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime()
              ),
            };
          });
          return message;
        }

        const message: ChatMessage = {
          id: uid("msg"),
          channelId: data.channelId,
          authorId: data.authorId,
          authorName: data.authorName,
          authorAvatar: data.authorAvatar,
          content: safeContent,
          createdAt: new Date().toISOString(),
          sharedPostId: data.sharedPostId ?? null,
          mediaKind: data.mediaKind ?? null,
          mediaUrl: data.mediaUrl ?? null,
          mediaMime: data.mediaMime ?? null,
          mediaDuration: data.mediaDuration ?? null,
          mediaThumbUrl: data.mediaThumbUrl ?? null,
          mediaWidth: data.mediaWidth ?? null,
          mediaHeight: data.mediaHeight ?? null,
        };
        set((s) => ({ messages: [...s.messages, message] }));
        // DM: notifica o outro participante (modo local)
        if (isDmChannel(data.channelId)) {
          const peer = getDmPeerId(data.channelId, data.authorId);
          if (peer) {
            const preview =
              safeContent.slice(0, 60) ||
              (data.sharedPostId
                ? "encaminhou um post"
                : kind === "image"
                  ? "enviou uma foto"
                  : kind === "video"
                    ? "enviou um vídeo"
                    : kind === "audio"
                      ? "enviou um áudio"
                      : kind === "sticker"
                        ? "enviou uma figurinha"
                        : kind === "gif"
                          ? "enviou um GIF"
                          : "");
            notifyDm({
              recipientId: peer,
              actorId: data.authorId,
              actorName: data.authorName,
              preview,
            });
          }
        }
        return message;
      },

      deleteMessage: async (messageId, userId, opts) => {
        const msg = get().messages.find((m) => m.id === messageId);
        if (!msg) {
          return { ok: false, error: "Mensagem não encontrada." };
        }
        const can = msg.authorId === userId || !!opts?.isAdmin;
        if (!can) {
          return {
            ok: false,
            error: "Você só pode apagar as suas próprias mensagens.",
          };
        }

        if (isSupabaseConfigured() && !messageId.startsWith("msg")) {
          const { deleteRemoteChatMessage } = await import(
            "@/lib/supabase/chat-service"
          );
          const remote = await deleteRemoteChatMessage(messageId);
          if (!remote.ok) {
            return remote;
          }
        }

        set((s) => ({
          messages: s.messages.filter((m) => m.id !== messageId),
        }));
        return { ok: true };
      },

      toggleMessageReaction: (messageId, userId, emoji) => {
        if (!userId || !emoji) return;
        const before = get().messages.find((m) => m.id === messageId);
        if (!before) return;

        const hadThis = (before.reactions?.[emoji] || []).includes(userId);
        let nextReactions: Record<string, string[]> = {};

        // Otimista local
        set((s) => ({
          messages: s.messages.map((m) => {
            if (m.id !== messageId) return m;
            const reactions: Record<string, string[]> = {
              ...(m.reactions || {}),
            };
            for (const key of Object.keys(reactions)) {
              reactions[key] = (reactions[key] || []).filter(
                (id) => id !== userId
              );
              if (reactions[key].length === 0) delete reactions[key];
            }
            if (!hadThis) {
              reactions[emoji] = [...(reactions[emoji] || []), userId];
            }
            nextReactions = reactions;
            return { ...m, reactions };
          }),
        }));

        if (isSupabaseConfigured() && !messageId.startsWith("msg")) {
          void import("@/lib/supabase/chat-service").then(
            ({ toggleRemoteChatReaction }) => {
              void toggleRemoteChatReaction(messageId, emoji).then((res) => {
                if (res.ok) {
                  set((s) => ({
                    messages: s.messages.map((m) =>
                      m.id === messageId
                        ? { ...m, reactions: res.reactions }
                        : m
                    ),
                  }));
                } else {
                  // rollback
                  set((s) => ({
                    messages: s.messages.map((m) =>
                      m.id === messageId ? before : m
                    ),
                  }));
                  console.error("[toggleMessageReaction] remote", res.error);
                  // Superfície erro p/ UI (event) — chat page pode ouvir
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(
                      new CustomEvent("nullysh:chat-reaction-error", {
                        detail: { messageId, error: res.error },
                      })
                    );
                  }
                }
              });
            }
          );
          // Notif multi-user vem do RPC (insert em notifications)
          return;
        }

        // Modo local: notifica o autor se adicionou reação de terceiros
        if (!hadThis && before.authorId !== userId) {
          const actor =
            useAuthStore.getState().users.find((u) => u.id === userId)?.name ||
            "Alguém";
          notifyChatReaction({
            messageAuthorId: before.authorId,
            actorId: userId,
            actorName: actor,
            emoji,
            channelId: before.channelId,
            excerpt: before.content?.slice(0, 48),
          });
        }
        void nextReactions;
      },

      getPostById: (postId) => {
        const p = get().posts.find((x) => x.id === postId);
        return p ? normalizePost(p) : undefined;
      },

      getCommentsForPost: (postId) =>
        get()
          .comments.filter((c) => c.postId === postId)
          .sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ),

      getMessagesForChannel: (channelId) =>
        get()
          .messages.filter((m) => m.channelId === channelId)
          .sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ),

      getSavedPosts: (userId) =>
        get()
          .posts.map(normalizePost)
          .filter((p) => p.savedBy.includes(userId))
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ),
    }),
    {
      name: "nullysh-forum",
      version: FORUM_STORAGE_VERSION,
      partialize: (s) => ({
        posts: s.posts,
        comments: s.comments,
        messages: s.messages,
        reposts: s.reposts,
      }),
      migrate: (persisted) => {
        const p = (persisted || {}) as Partial<ForumState>;
        const posts = (p.posts || [])
          .filter((post) => !isGhostPost(post as Post))
          .map((post) => normalizePost(post as Post));
        const realPostIds = new Set(posts.map((x) => x.id));
        const comments = (p.comments || [])
          .filter((c) => {
            if (isGhostComment(c as Comment)) return false;
            const postId = (c as Comment).postId;
            return (
              !postId || realPostIds.has(postId) || !isGhostPost({ id: postId })
            );
          })
          .map((c) => normalizeComment(c as Comment));
        const messages = (p.messages || []).filter(
          (m) => !isGhostMessage(m as ChatMessage)
        );
        const reposts = (p.reposts || []).filter(
          (r) => r && realPostIds.has(r.postId) && !isGhostUserId(r.userId)
        );
        return { ...p, posts, comments, messages, reposts } as never;
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<ForumState> | undefined;
        const posts = (p?.posts ?? current.posts)
          .filter((post) => !isGhostPost(post as Post))
          .map((post) => normalizePost(post as Post));
        const realPostIds = new Set(posts.map((x) => x.id));
        const comments = (p?.comments ?? current.comments)
          .filter((c) => {
            if (isGhostComment(c as Comment)) return false;
            const postId = (c as Comment).postId;
            return !postId || realPostIds.has(postId);
          })
          .map((c) => normalizeComment(c as Comment));
        const messages = (p?.messages ?? current.messages).filter(
          (m) => !isGhostMessage(m as ChatMessage)
        );
        const reposts = (p?.reposts ?? current.reposts ?? []).filter(
          (r) => r && realPostIds.has(r.postId) && !isGhostUserId(r.userId)
        );
        return {
          ...current,
          ...p,
          posts,
          comments,
          messages,
          reposts,
        };
      },
    }
  )
);

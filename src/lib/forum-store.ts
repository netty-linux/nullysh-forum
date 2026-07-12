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
  notifyComment,
  notifyCommentLike,
  notifyDm,
  notifyLike,
  notifyRepost,
} from "./notification-store";
import { isSupabaseConfigured } from "./supabase/config";
import type {
  ChatMediaKind,
  ChatMessage,
  Comment,
  Post,
  PostRepost,
} from "./types";
import { uid } from "./utils";

/** v5: mídia no chat (áudio/imagem/vídeo/sticker/gif) */
const FORUM_STORAGE_VERSION = 5;

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
  toggleLike: (postId: string, userId: string) => void;
  toggleDislike: (postId: string, userId: string) => void;
  toggleSave: (postId: string, userId: string) => void;
  /** Remove post próprio (ou admin). Apaga comentários do post também. */
  deletePost: (
    postId: string,
    userId: string,
    opts?: { isAdmin?: boolean }
  ) => { ok: true } | { ok: false; error: string };
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
  }) => Comment;
  /** Curtir / descurtir comentário (qualquer usuário logado, incl. dono do post) */
  toggleCommentLike: (
    commentId: string,
    userId: string,
    actorName: string
  ) => void;
  toggleRepost: (
    postId: string,
    userId: string,
    userName: string
  ) => { ok: true; reposted: boolean } | { ok: false; error: string };
  isReposted: (postId: string, userId: string) => boolean;
  repostCount: (postId: string) => number;
  getRepostsByUser: (userId: string) => PostRepost[];
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
  }) => ChatMessage;
  /**
   * Apaga mensagem própria (ou admin).
   */
  deleteMessage: (
    messageId: string,
    userId: string,
    opts?: { isAdmin?: boolean }
  ) => { ok: true } | { ok: false; error: string };
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
            location: data.location?.trim() || null,
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
          // GIFs ainda locais na UI (coluna DB ainda não tem gif_url)
          const post: Post = {
            ...remote.post,
            gifUrl: data.gifUrl?.trim() || remote.post.gifUrl || null,
          };
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
          const exists = s.posts.some((p) => p.id === n.id);
          if (exists) {
            return {
              posts: s.posts.map((p) => (p.id === n.id ? n : p)),
            };
          }
          return {
            posts: [n, ...s.posts].sort(
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

      toggleLike: (postId, userId) => {
        const before = get().posts.find((p) => p.id === postId);
        const wasLiked = !!before?.likedBy?.includes(userId);
        set((s) => ({
          posts: s.posts.map((raw) => {
            const p = normalizePost(raw);
            if (p.id !== postId) return p;
            const liked = p.likedBy.includes(userId);
            const disliked = p.dislikedBy.includes(userId);
            // Like e dislike são exclusivos
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

      toggleDislike: (postId, userId) => {
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

      deletePost: (postId, userId, opts) => {
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
        set((s) => ({
          posts: s.posts.filter((p) => p.id !== postId),
          comments: s.comments.filter((c) => c.postId !== postId),
        }));
        return { ok: true };
      },

      addComment: (data) => {
        let parentId: string | null = null;
        let replyToName: string | null = null;
        let replyToAuthorId: string | null = null;

        if (data.replyToId) {
          const target = get().comments.find((c) => c.id === data.replyToId);
          if (target && target.postId === data.postId) {
            // 1 nível: resposta a raiz ou a outra resposta → sob a raiz
            parentId = target.parentId || target.id;
            replyToName = target.authorName;
            replyToAuthorId = target.authorId;
          }
        }

        const gifUrl = data.gifUrl?.trim() || null;
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
          // dono do post
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
          // quem foi respondido (se não for o dono — já notificado — nem o próprio autor)
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

      toggleCommentLike: (commentId, userId, actorName) => {
        const before = get().comments.find((c) => c.id === commentId);
        if (!before) return;
        const wasLiked = (before.likedBy ?? []).includes(userId);

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

      toggleRepost: (postId, userId, userName) => {
        const post = get().posts.find((p) => p.id === postId);
        if (!post) return { ok: false, error: "Post não encontrado." };
        if (post.authorId === userId) {
          return { ok: false, error: "Você não pode repostar o próprio post." };
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

      sendMessage: (data) => {
        const kind = data.mediaKind || (data.sharedPostId ? "text" : "text");
        const message: ChatMessage = {
          id: uid("msg"),
          channelId: data.channelId,
          authorId: data.authorId,
          authorName: data.authorName,
          authorAvatar: data.authorAvatar,
          content: (data.content || "").trim(),
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
        // DM: notifica o outro participante
        if (isDmChannel(data.channelId)) {
          const peer = getDmPeerId(data.channelId, data.authorId);
          if (peer) {
            const preview =
              data.content.trim().slice(0, 60) ||
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

      deleteMessage: (messageId, userId, opts) => {
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
        set((s) => ({
          messages: s.messages.filter((m) => m.id !== messageId),
        }));
        return { ok: true };
      },

      toggleMessageReaction: (messageId, userId, emoji) => {
        if (!userId || !emoji) return;
        set((s) => ({
          messages: s.messages.map((m) => {
            if (m.id !== messageId) return m;
            const reactions: Record<string, string[]> = {
              ...(m.reactions || {}),
            };
            // remove user de qualquer emoji
            for (const key of Object.keys(reactions)) {
              reactions[key] = (reactions[key] || []).filter(
                (id) => id !== userId
              );
              if (reactions[key].length === 0) delete reactions[key];
            }
            // se clicou no mesmo que já tinha, só remove (toggle off)
            const hadThis = (m.reactions?.[emoji] || []).includes(userId);
            if (!hadThis) {
              reactions[emoji] = [...(reactions[emoji] || []), userId];
            }
            return { ...m, reactions };
          }),
        }));
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

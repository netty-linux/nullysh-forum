"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  isGhostComment,
  isGhostMessage,
  isGhostPost,
  isGhostUserId,
} from "./ghost-data";
import type { ChatMessage, Comment, Post } from "./types";
import { uid } from "./utils";

/** v2: remove posts/comentários/chat seed (Marina, Nullysh demo, etc.) */
const FORUM_STORAGE_VERSION = 2;

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

interface ForumState {
  posts: Post[];
  comments: Comment[];
  messages: ChatMessage[];
  createPost: (data: {
    authorId: string;
    authorName: string;
    authorAvatar: string;
    authorAvatarUrl?: string | null;
    title?: string;
    content: string;
    imageUrl?: string | null;
    location?: string | null;
    communityId?: string;
    communityName?: string;
    type?: Post["type"];
    vipOnly?: boolean;
  }) => Post;
  toggleLike: (postId: string, userId: string) => void;
  toggleDislike: (postId: string, userId: string) => void;
  toggleSave: (postId: string, userId: string) => void;
  /** Remove post próprio (ou admin). Apaga comentários do post também. */
  deletePost: (
    postId: string,
    userId: string,
    opts?: { isAdmin?: boolean }
  ) => { ok: true } | { ok: false; error: string };
  addComment: (data: {
    postId: string;
    authorId: string;
    authorName: string;
    authorAvatar: string;
    content: string;
  }) => Comment;
  sendMessage: (data: {
    channelId: string;
    authorId: string;
    authorName: string;
    authorAvatar: string;
    content: string;
  }) => ChatMessage;
  getCommentsForPost: (postId: string) => Comment[];
  getMessagesForChannel: (channelId: string) => ChatMessage[];
  getSavedPosts: (userId: string) => Post[];
}

export const useForumStore = create<ForumState>()(
  persist(
    (set, get) => ({
      // Sem seeds: só conteúdo real criado pelos membros (ou importado do Supabase)
      posts: [],
      comments: [],
      messages: [],

      createPost: (data) => {
        const content = data.content.trim();
        // Sync community via hashtags (opcional no payload; UI resolve antes)
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
          location: data.location?.trim() || null,
          type: data.type ?? "discussion",
          likes: 0,
          dislikes: 0,
          comments: 0,
          likedBy: [],
          dislikedBy: [],
          savedBy: [],
          createdAt: new Date().toISOString(),
          // VIP-only se o post foi marcado para comunidade VIP
          vipOnly: data.vipOnly ?? false,
        };
        set((s) => ({ posts: [post, ...s.posts] }));
        return post;
      },

      toggleLike: (postId, userId) => {
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
        const comment: Comment = {
          id: uid("cm"),
          postId: data.postId,
          authorId: data.authorId,
          authorName: data.authorName,
          authorAvatar: data.authorAvatar,
          content: data.content.trim(),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          comments: [...s.comments, comment],
          posts: s.posts.map((p) =>
            p.id === data.postId ? { ...p, comments: p.comments + 1 } : p
          ),
        }));
        return comment;
      },

      sendMessage: (data) => {
        const message: ChatMessage = {
          id: uid("msg"),
          channelId: data.channelId,
          authorId: data.authorId,
          authorName: data.authorName,
          authorAvatar: data.authorAvatar,
          content: data.content.trim(),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ messages: [...s.messages, message] }));
        return message;
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
      }),
      migrate: (persisted) => {
        const p = (persisted || {}) as Partial<ForumState>;
        const posts = (p.posts || [])
          .filter((post) => !isGhostPost(post as Post))
          .map((post) => normalizePost(post as Post));
        const realPostIds = new Set(posts.map((x) => x.id));
        const comments = (p.comments || []).filter((c) => {
          if (isGhostComment(c as Comment)) return false;
          // drop comentários órfãos de posts fantasma já apagados
          const postId = (c as Comment).postId;
          return !postId || realPostIds.has(postId) || !isGhostPost({ id: postId });
        });
        const messages = (p.messages || []).filter(
          (m) => !isGhostMessage(m as ChatMessage)
        );
        return { ...p, posts, comments, messages } as never;
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<ForumState> | undefined;
        const posts = (p?.posts ?? current.posts)
          .filter((post) => !isGhostPost(post as Post))
          .map((post) => normalizePost(post as Post));
        const realPostIds = new Set(posts.map((x) => x.id));
        const comments = (p?.comments ?? current.comments).filter((c) => {
          if (isGhostComment(c as Comment)) return false;
          const postId = (c as Comment).postId;
          return !postId || realPostIds.has(postId);
        });
        const messages = (p?.messages ?? current.messages).filter(
          (m) => !isGhostMessage(m as ChatMessage)
        );
        return {
          ...current,
          ...p,
          posts,
          comments,
          messages,
        };
      },
    }
  )
);

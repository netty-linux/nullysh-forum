"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  initialChatMessages,
  posts as seedPosts,
} from "./mock-data";
import type { ChatMessage, Comment, Post } from "./types";
import { uid } from "./utils";

function normalizePost(p: Post): Post {
  return {
    ...p,
    likes: p.likes ?? 0,
    dislikes: p.dislikes ?? 0,
    comments: p.comments ?? 0,
    likedBy: Array.isArray(p.likedBy) ? p.likedBy : [],
    dislikedBy: Array.isArray(p.dislikedBy) ? p.dislikedBy : [],
    savedBy: Array.isArray(p.savedBy) ? p.savedBy : [],
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
      posts: seedPosts.map(normalizePost),
      comments: [
        {
          id: "cm1",
          postId: "p1",
          authorId: "u2",
          authorName: "Marina Costa",
          authorAvatar: "M",
          content: "Comunidade incrível. Já explorei os materiais!",
          createdAt: "2026-07-01T12:00:00.000Z",
        },
      ],
      messages: initialChatMessages,

      createPost: (data) => {
        const post: Post = {
          id: uid("post"),
          authorId: data.authorId,
          authorName: data.authorName,
          authorAvatar: data.authorAvatar,
          authorAvatarUrl: data.authorAvatarUrl ?? null,
          communityId: data.communityId,
          communityName: data.communityName,
          title: data.title?.trim() || undefined,
          content: data.content.trim(),
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
      partialize: (s) => ({
        posts: s.posts,
        comments: s.comments,
        messages: s.messages,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<ForumState> | undefined;
        return {
          ...current,
          ...p,
          posts: (p?.posts ?? current.posts).map((post) =>
            normalizePost(post as Post)
          ),
        };
      },
    }
  )
);

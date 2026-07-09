"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  initialChatMessages,
  posts as seedPosts,
} from "./mock-data";
import type { ChatMessage, Comment, Post } from "./types";
import { uid } from "./utils";

interface ForumState {
  posts: Post[];
  comments: Comment[];
  messages: ChatMessage[];
  createPost: (data: {
    authorId: string;
    authorName: string;
    authorAvatar: string;
    title: string;
    content: string;
    communityId?: string;
    communityName?: string;
    type?: Post["type"];
    vipOnly?: boolean;
  }) => Post;
  toggleLike: (postId: string, userId: string) => void;
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
}

export const useForumStore = create<ForumState>()(
  persist(
    (set, get) => ({
      posts: seedPosts,
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
          communityId: data.communityId,
          communityName: data.communityName,
          title: data.title.trim(),
          content: data.content.trim(),
          type: data.type ?? "discussion",
          likes: 0,
          comments: 0,
          likedBy: [],
          createdAt: new Date().toISOString(),
          vipOnly: data.vipOnly ?? false,
        };
        set((s) => ({ posts: [post, ...s.posts] }));
        return post;
      },

      toggleLike: (postId, userId) => {
        set((s) => ({
          posts: s.posts.map((p) => {
            if (p.id !== postId) return p;
            const liked = p.likedBy.includes(userId);
            return {
              ...p,
              likes: liked ? Math.max(0, p.likes - 1) : p.likes + 1,
              likedBy: liked
                ? p.likedBy.filter((id) => id !== userId)
                : [...p.likedBy, userId],
            };
          }),
        }));
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
    }),
    {
      name: "nullysh-forum",
      partialize: (s) => ({
        posts: s.posts,
        comments: s.comments,
        messages: s.messages,
      }),
    }
  )
);

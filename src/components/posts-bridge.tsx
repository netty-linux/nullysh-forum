"use client";

/**
 * Hidrata o feed a partir do Supabase e assina INSERT/UPDATE/DELETE em tempo real.
 * Espera o rehydrate do Zustand (localStorage) ANTES de sobrescrever com Postgres,
 * senão o persist pode “ganhar” e cada browser fica com o próprio castelo de areia.
 *
 * Também hidrata comentários e assina realtime em `comments` + updates de likes.
 */

import { useForumStore } from "@/lib/forum-store";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fetchRemoteComments,
  fetchRemotePosts,
  fetchRemoteReposts,
  mapPostRow,
  rowToComment,
  type CommentRow,
} from "@/lib/supabase/posts-service";
import type { PostRow } from "@/lib/supabase/database.types";
import type { PostRepost } from "@/lib/types";
import { useEffect } from "react";

function waitForForumPersist(): Promise<void> {
  const api = useForumStore.persist;
  if (api.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = api.onFinishHydration(() => {
      unsub();
      resolve();
    });
    // safety
    window.setTimeout(() => {
      unsub();
      resolve();
    }, 2500);
  });
}

export function PostsBridge({ children }: { children: React.ReactNode }) {
  const hydratePosts = useForumStore((s) => s.hydratePosts);
  const hydrateComments = useForumStore((s) => s.hydrateComments);
  const hydrateReposts = useForumStore((s) => s.hydrateReposts);
  const upsertPost = useForumStore((s) => s.upsertPost);
  const upsertComment = useForumStore((s) => s.upsertComment);
  const removePostById = useForumStore((s) => s.removePostById);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    let cancelled = false;

    (async () => {
      try {
        await waitForForumPersist();
        if (cancelled) return;
        const posts = await fetchRemotePosts(100);
        if (cancelled) return;
        hydratePosts(posts);
        console.info(
          "[posts-bridge] hydrated",
          posts.length,
          "posts from Supabase"
        );

        const postIds = posts.map((p) => p.id);
        const comments = await fetchRemoteComments(
          postIds.length > 0 ? postIds : undefined
        );
        if (!cancelled) {
          hydrateComments(comments);
          console.info(
            "[posts-bridge] hydrated",
            comments.length,
            "comments from Supabase"
          );
        }

        const reposts = await fetchRemoteReposts(
          postIds.length > 0 ? postIds : undefined
        );
        if (!cancelled) {
          hydrateReposts(
            reposts.map(
              (r): PostRepost => ({
                id: r.id,
                postId: r.postId,
                userId: r.userId,
                userName: r.userName,
                createdAt: r.createdAt,
              })
            )
          );
          console.info(
            "[posts-bridge] hydrated",
            reposts.length,
            "reposts from Supabase"
          );
        }
      } catch (e) {
        console.error("[posts-bridge] hydrate failed", e);
      }
    })();

    const channel = supabase
      .channel("nullysh-social")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => {
          const row = payload.new as PostRow;
          if (row?.id) upsertPost(mapPostRow(row));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts" },
        (payload) => {
          const row = payload.new as PostRow;
          if (row?.id) upsertPost(mapPostRow(row));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "posts" },
        (payload) => {
          const row = payload.old as { id?: string };
          if (row?.id) removePostById(row.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments" },
        (payload) => {
          const row = payload.new as CommentRow;
          if (row?.id) {
            upsertComment(rowToComment(row));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "comments" },
        (payload) => {
          const row = payload.new as CommentRow;
          if (row?.id) {
            // update sem incrementar contador de novo
            const comment = rowToComment(row);
            useForumStore.setState((s) => {
              const exists = s.comments.some((c) => c.id === comment.id);
              if (!exists) {
                return {
                  comments: [...s.comments, comment],
                  posts: s.posts.map((p) =>
                    p.id === comment.postId
                      ? { ...p, comments: p.comments + 1 }
                      : p
                  ),
                };
              }
              return {
                comments: s.comments.map((c) =>
                  c.id === comment.id ? comment : c
                ),
              };
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "comments" },
        (payload) => {
          const row = payload.old as { id?: string; post_id?: string };
          if (!row?.id) return;
          useForumStore.setState((s) => {
            const found = s.comments.find((c) => c.id === row.id);
            if (!found) return s;
            return {
              comments: s.comments.filter((c) => c.id !== row.id),
              posts: s.posts.map((p) =>
                p.id === found.postId
                  ? { ...p, comments: Math.max(0, p.comments - 1) }
                  : p
              ),
            };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_reposts" },
        (payload) => {
          const r = payload.new as Record<string, unknown>;
          if (!r?.id) return;
          const repost: PostRepost = {
            id: String(r.id),
            postId: String(r.post_id),
            userId: String(r.user_id),
            userName: String(r.user_name || "Membro"),
            createdAt: String(r.created_at || new Date().toISOString()),
          };
          useForumStore.setState((s) => {
            if (s.reposts.some((x) => x.id === repost.id)) return s;
            // remove temp local
            const withoutDup = s.reposts.filter(
              (x) =>
                !(x.postId === repost.postId && x.userId === repost.userId)
            );
            return { reposts: [repost, ...withoutDup] };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "post_reposts" },
        (payload) => {
          const r = payload.old as { id?: string };
          if (!r?.id) return;
          useForumStore.setState((s) => ({
            reposts: s.reposts.filter((x) => x.id !== r.id),
          }));
        }
      )
      .subscribe((status) => {
        console.info("[posts-bridge] realtime", status);
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [
    hydratePosts,
    hydrateComments,
    hydrateReposts,
    upsertPost,
    upsertComment,
    removePostById,
  ]);

  return <>{children}</>;
}

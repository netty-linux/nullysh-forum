"use client";

/**
 * Hidrata o feed a partir do Supabase e assina realtime seletivo.
 *
 * DELETE de posts NÃO é propagado em tempo real para outros usuários —
 * apagar o próprio post deve ser silencioso (sem o feed de terceiros
 * “sumir” o card na cara deles). A remoção só entra no próximo reconcile
 * (reload, troca de aba, intervalo) sem toast/animação de alerta.
 *
 * INSERT/UPDATE de posts e comments continuam em tempo real (likes, etc.).
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

/**
 * Remove do store local posts que sumiram no Postgres, sem toast e sem
 * reordenar o feed inteiro — só filtra o que não existe mais.
 */
function pruneDeletedPostsSilently(remoteIds: Set<string>) {
  useForumStore.setState((s) => {
    const gone = s.posts.filter(
      (p) => !p.id.startsWith("post_") && !remoteIds.has(p.id)
    );
    if (gone.length === 0) return s;
    const goneIds = new Set(gone.map((p) => p.id));
    return {
      posts: s.posts.filter((p) => !goneIds.has(p.id)),
      comments: s.comments.filter((c) => !goneIds.has(c.postId)),
      reposts: s.reposts.filter((r) => !goneIds.has(r.postId)),
    };
  });
}

export function PostsBridge({ children }: { children: React.ReactNode }) {
  const hydratePosts = useForumStore((s) => s.hydratePosts);
  const hydrateComments = useForumStore((s) => s.hydrateComments);
  const hydrateReposts = useForumStore((s) => s.hydrateReposts);
  const upsertPost = useForumStore((s) => s.upsertPost);
  const upsertComment = useForumStore((s) => s.upsertComment);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    let cancelled = false;

    async function fullHydrate() {
      const posts = await fetchRemotePosts(100);
      if (cancelled) return;
      hydratePosts(posts);

      const postIds = posts.map((p) => p.id);
      const comments = await fetchRemoteComments(
        postIds.length > 0 ? postIds : undefined
      );
      if (cancelled) return;
      hydrateComments(comments);

      const reposts = await fetchRemoteReposts(
        postIds.length > 0 ? postIds : undefined
      );
      if (cancelled) return;
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
    }

    /** Só remove posts apagados — não chama atenção (sem realtime DELETE). */
    async function silentPrune() {
      try {
        const posts = await fetchRemotePosts(100);
        if (cancelled) return;
        pruneDeletedPostsSilently(new Set(posts.map((p) => p.id)));
      } catch {
        /* ignore */
      }
    }

    (async () => {
      try {
        await waitForForumPersist();
        if (cancelled) return;
        await fullHydrate();
        if (!cancelled) {
          console.info("[posts-bridge] hydrated from Supabase");
        }
      } catch (e) {
        console.error("[posts-bridge] hydrate failed", e);
      }
    })();

    // Reconcile silencioso: volta à aba / a cada ~3 min
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void silentPrune();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    const pruneTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void silentPrune();
      }
    }, 180_000);

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
          // Só atualiza se o post ainda estiver no feed local
          // (post apagado não “reaparece” nem some com drama)
          if (!row?.id) return;
          const stillThere = useForumStore
            .getState()
            .posts.some((p) => p.id === row.id);
          if (stillThere) upsertPost(mapPostRow(row));
        }
      )
      // propositalmente SEM handler de DELETE em posts — apagar é silencioso
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
          // Comentário apagado: remove sem toast (menos ruidoso que post sumindo)
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
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(pruneTimer);
      void supabase.removeChannel(channel);
    };
  }, [
    hydratePosts,
    hydrateComments,
    hydrateReposts,
    upsertPost,
    upsertComment,
  ]);

  return <>{children}</>;
}

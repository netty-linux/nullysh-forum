"use client";

/**
 * Hidrata o feed a partir do Supabase e assina INSERT/DELETE em tempo real.
 * Espera o rehydrate do Zustand (localStorage) ANTES de sobrescrever com Postgres,
 * senão o persist pode “ganhar” e cada browser fica com o próprio castelo de areia.
 */

import { useForumStore } from "@/lib/forum-store";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fetchRemotePosts,
  mapPostRow,
} from "@/lib/supabase/posts-service";
import type { PostRow } from "@/lib/supabase/database.types";
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
  const upsertPost = useForumStore((s) => s.upsertPost);
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
        if (!cancelled) {
          hydratePosts(posts);
          console.info(
            "[posts-bridge] hydrated",
            posts.length,
            "posts from Supabase"
          );
        }
      } catch (e) {
        console.error("[posts-bridge] hydrate failed", e);
      }
    })();

    const channel = supabase
      .channel("nullysh-posts")
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
      .subscribe((status) => {
        console.info("[posts-bridge] realtime", status);
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [hydratePosts, upsertPost, removePostById]);

  return <>{children}</>;
}

"use client";

/**
 * Hidrata o feed a partir do Supabase e assina INSERT/DELETE em tempo real.
 * Zustand continua espelho local de UI; multi-user = Postgres.
 */

import { useForumStore } from "@/lib/forum-store";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fetchRemotePosts,
  mapPostRow,
} from "@/lib/supabase/posts-service";
import type { PostRow } from "@/lib/supabase/database.types";
import { useEffect, useRef } from "react";

export function PostsBridge({ children }: { children: React.ReactNode }) {
  const hydratePosts = useForumStore((s) => s.hydratePosts);
  const upsertPost = useForumStore((s) => s.upsertPost);
  const removePostById = useForumStore((s) => s.removePostById);
  const booted = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    let cancelled = false;

    (async () => {
      try {
        const posts = await fetchRemotePosts(100);
        if (!cancelled) {
          hydratePosts(posts);
          booted.current = true;
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
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [hydratePosts, upsertPost, removePostById]);

  return <>{children}</>;
}

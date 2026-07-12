"use client";

/**
 * Hidrata follows do Supabase e assina realtime do grafo social.
 */

import { useSocialStore } from "@/lib/social-store";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fetchRemoteFollows,
  mapFollowRow,
} from "@/lib/supabase/social-service";
import { useEffect } from "react";

function waitForSocialPersist(): Promise<void> {
  const api = useSocialStore.persist;
  if (api.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = api.onFinishHydration(() => {
      unsub();
      resolve();
    });
    window.setTimeout(() => {
      unsub();
      resolve();
    }, 2500);
  });
}

export function SocialBridge({ children }: { children: React.ReactNode }) {
  const hydrateFollows = useSocialStore((s) => s.hydrateFollows);
  const upsertFollowEdge = useSocialStore((s) => s.upsertFollowEdge);
  const removeFollowEdge = useSocialStore((s) => s.removeFollowEdge);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    let cancelled = false;

    (async () => {
      await waitForSocialPersist();
      if (cancelled) return;
      try {
        const edges = await fetchRemoteFollows();
        if (cancelled) return;
        // Só substitui se o remoto respondeu (mesmo vazio = grafo real limpo)
        hydrateFollows(edges);
        console.info("[social-bridge] hydrated follows", edges.length);
      } catch (e) {
        console.error("[social-bridge] hydrate failed", e);
      }
    })();

    const channel = supabase
      .channel("nullysh-follows")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "follows",
        },
        (payload) => {
          const r = payload.new as {
            follower_id?: string;
            following_id?: string;
            created_at?: string;
          };
          if (!r?.follower_id || !r?.following_id) return;
          upsertFollowEdge(
            mapFollowRow({
              follower_id: r.follower_id,
              following_id: r.following_id,
              created_at: r.created_at || new Date().toISOString(),
            })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "follows",
        },
        (payload) => {
          const r = payload.old as {
            follower_id?: string;
            following_id?: string;
          };
          if (!r?.follower_id || !r?.following_id) return;
          removeFollowEdge(r.follower_id, r.following_id);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [hydrateFollows, upsertFollowEdge, removeFollowEdge]);

  return <>{children}</>;
}

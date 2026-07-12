"use client";

/**
 * Hidrata follows do Supabase e assina realtime do grafo social.
 *
 * Crítico: só substitui o grafo local DEPOIS de ter sessão autenticada.
 * Sem auth, o RLS devolve [] e apagava os contadores no reload.
 */

import { useSocialStore } from "@/lib/social-store";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fetchRemoteFollows,
  mapFollowRow,
} from "@/lib/supabase/social-service";
import { useEffect, useRef } from "react";

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
  const genRef = useRef(0);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    let cancelled = false;

    async function hydrateFromRemote(reason: string) {
      if (cancelled) return;
      const gen = ++genRef.current;
      try {
        await waitForSocialPersist();
        if (cancelled || gen !== genRef.current) return;

        const result = await fetchRemoteFollows();
        if (cancelled || gen !== genRef.current) return;

        if (!result.ok) {
          // Sem sessão ou erro de rede: NÃO zera o grafo local
          if (!result.unauthorized) {
            console.warn("[social-bridge] hydrate skip:", result.error, reason);
          }
          return;
        }

        hydrateFollows(result.edges);
        console.info(
          "[social-bridge] hydrated follows",
          result.edges.length,
          reason
        );
      } catch (e) {
        console.error("[social-bridge] hydrate failed", e);
      }
    }

    void hydrateFromRemote("mount");

    // Re-hidrata quando a sessão fica pronta (reload / login)
    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED"
      ) {
        void hydrateFromRemote(event);
      }
    });

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

    // Reconcile ao voltar para a aba
    function onVis() {
      if (document.visibilityState === "visible") {
        void hydrateFromRemote("visibility");
      }
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      authSub.unsubscribe();
      document.removeEventListener("visibilitychange", onVis);
      void supabase.removeChannel(channel);
    };
  }, [hydrateFollows, upsertFollowEdge, removeFollowEdge]);

  return <>{children}</>;
}

"use client";

/**
 * Catálogo global de emojis customizados.
 * Free e VIP leem o mesmo catálogo — free só visualiza no feed/bio;
 * VIP cria (RLS).
 */

import { useEmojiStore } from "@/lib/emoji-store";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fetchRemoteEmojis,
  mapEmojiRow,
} from "@/lib/supabase/emoji-service";
import { useEffect, useRef } from "react";

function waitForEmojiPersist(): Promise<void> {
  const api = useEmojiStore.persist;
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

export function EmojiBridge({ children }: { children: React.ReactNode }) {
  const hydrateEmojis = useEmojiStore((s) => s.hydrateEmojis);
  const upsertEmoji = useEmojiStore((s) => s.upsertEmoji);
  const removeEmojiById = useEmojiStore((s) => s.removeEmojiById);
  const genRef = useRef(0);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    let cancelled = false;

    async function hydrate(reason: string) {
      if (cancelled) return;
      const gen = ++genRef.current;
      try {
        await waitForEmojiPersist();
        if (cancelled || gen !== genRef.current) return;

        const result = await fetchRemoteEmojis();
        if (cancelled || gen !== genRef.current) return;

        if (!result.ok) {
          console.warn("[emoji-bridge] hydrate skip:", result.error, reason);
          return;
        }

        hydrateEmojis(result.emojis);
        console.info(
          "[emoji-bridge] hydrated",
          result.emojis.length,
          reason
        );
      } catch (e) {
        console.error("[emoji-bridge] hydrate failed", e);
      }
    }

    void hydrate("mount");

    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED"
      ) {
        void hydrate(event);
      }
    });

    const channel = supabase
      .channel("nullysh-custom-emojis")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "custom_emojis",
        },
        (payload) => {
          const r = payload.new as {
            id?: string;
            name?: string;
            image_url?: string;
            created_by_id?: string;
            created_by_name?: string;
            created_at?: string;
          };
          if (!r?.id || !r.name || !r.image_url) return;
          upsertEmoji(
            mapEmojiRow({
              id: r.id,
              name: r.name,
              image_url: r.image_url,
              created_by_id: r.created_by_id || "",
              created_by_name: r.created_by_name || "VIP",
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
          table: "custom_emojis",
        },
        (payload) => {
          const r = payload.old as { id?: string };
          if (r?.id) removeEmojiById(r.id);
        }
      )
      .subscribe();

    function onVis() {
      if (document.visibilityState === "visible") {
        void hydrate("visibility");
      }
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      authSub.unsubscribe();
      document.removeEventListener("visibilitychange", onVis);
      void supabase.removeChannel(channel);
    };
  }, [hydrateEmojis, upsertEmoji, removeEmojiById]);

  return <>{children}</>;
}

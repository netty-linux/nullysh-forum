"use client";

/**
 * Hidrata mensagens de chat do Supabase e assina INSERT/UPDATE/DELETE em tempo real.
 * Sem isso, o bate-papo fica só no localStorage de cada browser.
 */

import { useForumStore } from "@/lib/forum-store";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fetchRemoteChatMessages,
  rowToChatMessage,
  type ChatMessageRow,
} from "@/lib/supabase/chat-service";
import { useEffect } from "react";

function waitForForumPersist(): Promise<void> {
  const api = useForumStore.persist;
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

export function ChatBridge({ children }: { children: React.ReactNode }) {
  const hydrateMessages = useForumStore((s) => s.hydrateMessages);
  const upsertMessage = useForumStore((s) => s.upsertMessage);
  const removeMessageById = useForumStore((s) => s.removeMessageById);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    let cancelled = false;

    (async () => {
      try {
        await waitForForumPersist();
        if (cancelled) return;
        const messages = await fetchRemoteChatMessages(500);
        if (!cancelled) {
          hydrateMessages(messages);
          console.info(
            "[chat-bridge] hydrated",
            messages.length,
            "messages from Supabase"
          );
        }
      } catch (e) {
        console.error("[chat-bridge] hydrate failed", e);
      }
    })();

    const channel = supabase
      .channel("nullysh-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          if (row?.id) upsertMessage(rowToChatMessage(row));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages" },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          if (row?.id) upsertMessage(rowToChatMessage(row));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages" },
        (payload) => {
          const row = payload.old as { id?: string };
          if (row?.id) removeMessageById(row.id);
        }
      )
      .subscribe((status) => {
        console.info("[chat-bridge] realtime", status);
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [hydrateMessages, upsertMessage, removeMessageById]);

  return <>{children}</>;
}

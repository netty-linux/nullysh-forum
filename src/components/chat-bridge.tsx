"use client";

/**
 * Hidrata chat + realtime + receipts (entregue).
 * Poll leve quando a aba está visível — conversa fluida mesmo se o WS oscilar.
 */

import { useAuthStore } from "@/lib/auth-store";
import { useChatReadStore } from "@/lib/chat-read-store";
import { useForumStore } from "@/lib/forum-store";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fetchRemoteChatMessages,
  fetchRemoteReadCursors,
  markRemoteChatDelivered,
  rowToChatMessage,
  type ChatMessageRow,
} from "@/lib/supabase/chat-service";
import { useEffect, useRef } from "react";

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

/** Marca como entregues msgs de terceiros que acabamos de ver. */
function queueDelivered(messageIds: string[], myId: string | undefined) {
  if (!myId || !messageIds.length) return;
  const store = useForumStore.getState();
  const toMark = messageIds.filter((id) => {
    const m = store.messages.find((x) => x.id === id);
    if (!m || m.authorId === myId) return false;
    if ((m.deliveredTo ?? []).includes(myId)) return false;
    return true;
  });
  if (!toMark.length) return;

  // Otimista local
  useForumStore.setState((s) => ({
    messages: s.messages.map((m) => {
      if (!toMark.includes(m.id)) return m;
      const deliveredTo = Array.from(
        new Set([...(m.deliveredTo ?? []), myId])
      );
      return { ...m, deliveredTo };
    }),
  }));

  void markRemoteChatDelivered(toMark);
}

export function ChatBridge({ children }: { children: React.ReactNode }) {
  const hydrateMessages = useForumStore((s) => s.hydrateMessages);
  const upsertMessage = useForumStore((s) => s.upsertMessage);
  const removeMessageById = useForumStore((s) => s.removeMessageById);
  const mergeCursors = useChatReadStore((s) => s.mergeCursors);
  const lastIdsRef = useRef<string>("");

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    let cancelled = false;

    async function hydrateOnce() {
      const messages = await fetchRemoteChatMessages(500);
      if (cancelled) return;
      hydrateMessages(messages);

      const myId = useAuthStore.getState().currentUserId;
      if (myId) {
        queueDelivered(
          messages.filter((m) => m.authorId !== myId).map((m) => m.id),
          myId
        );
        const cursors = await fetchRemoteReadCursors(myId);
        if (!cancelled) mergeCursors(cursors);
      }
    }

    (async () => {
      try {
        await waitForForumPersist();
        if (cancelled) return;
        await hydrateOnce();
        if (!cancelled) {
          console.info("[chat-bridge] hydrated from Supabase");
        }
      } catch (e) {
        console.error("[chat-bridge] hydrate failed", e);
      }
    })();

    // Poll de segurança (~2.5s) — conversa flui se realtime falhar
    const poll = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void (async () => {
        try {
          const messages = await fetchRemoteChatMessages(500);
          if (cancelled) return;
          const sig = messages
            .map((m) => {
              const r = m.reactions || {};
              const rSig = Object.keys(r)
                .sort()
                .map((k) => `${k}:${(r[k] || []).length}`)
                .join(",");
              return `${m.id}:${(m.deliveredTo ?? []).length}:${(m.readBy ?? []).length}:{${rSig}}`;
            })
            .join("|");
          if (sig === lastIdsRef.current) return;
          lastIdsRef.current = sig;

          // Merge sem apagar otimistas locais (msg_*)
          const remoteIds = new Set(messages.map((m) => m.id));
          useForumStore.setState((s) => {
            const localPending = s.messages.filter(
              (m) => m.id.startsWith("msg") && !remoteIds.has(m.id)
            );
            return {
              messages: [...messages, ...localPending].sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime()
              ),
            };
          });

          const myId = useAuthStore.getState().currentUserId;
          queueDelivered(
            messages.filter((m) => m.authorId !== myId).map((m) => m.id),
            myId ?? undefined
          );
        } catch {
          /* ignore */
        }
      })();
    }, 2500);

    const channel = supabase
      .channel("nullysh-chat-v2")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          if (!row?.id) return;
          const msg = rowToChatMessage(row);
          upsertMessage(msg);
          const myId = useAuthStore.getState().currentUserId;
          if (myId && msg.authorId !== myId) {
            queueDelivered([msg.id], myId);
          }
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
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [hydrateMessages, upsertMessage, removeMessageById, mergeCursors]);

  return <>{children}</>;
}

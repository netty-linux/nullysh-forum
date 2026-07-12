"use client";

/**
 * Cursores de leitura por canal — badges de não lidas (estilo WhatsApp).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isSupabaseConfigured } from "@/lib/supabase/config";

interface ChatReadState {
  /** channelId → ISO last_read_at */
  cursors: Record<string, string>;
  setCursor: (channelId: string, at?: string) => void;
  mergeCursors: (remote: Record<string, string>) => void;
  lastReadAt: (channelId: string) => string | null;
}

export const useChatReadStore = create<ChatReadState>()(
  persist(
    (set, get) => ({
      cursors: {},

      setCursor: (channelId, at) => {
        const ts = at || new Date().toISOString();
        set((s) => ({
          cursors: { ...s.cursors, [channelId]: ts },
        }));
      },

      mergeCursors: (remote) => {
        set((s) => {
          const next = { ...s.cursors };
          for (const [ch, ts] of Object.entries(remote)) {
            const local = next[ch];
            if (!local || new Date(ts) > new Date(local)) {
              next[ch] = ts;
            }
          }
          return { cursors: next };
        });
      },

      lastReadAt: (channelId) => get().cursors[channelId] ?? null,
    }),
    {
      name: "nullysh-chat-reads",
      version: 1,
      partialize: (s) => ({ cursors: s.cursors }),
    }
  )
);

/** Conta mensagens não lidas de outros autores após o cursor. */
export function countUnreadInChannel(
  messages: Array<{ channelId: string; authorId: string; createdAt: string }>,
  channelId: string,
  myUserId: string | null | undefined,
  lastReadAt: string | null
): number {
  if (!myUserId) return 0;
  const since = lastReadAt ? new Date(lastReadAt).getTime() : 0;
  let n = 0;
  for (const m of messages) {
    if (m.channelId !== channelId) continue;
    if (m.authorId === myUserId) continue;
    if (new Date(m.createdAt).getTime() > since) n += 1;
  }
  return n;
}

/** Marca canal como lido local + remoto. */
export async function markChannelAsRead(channelId: string) {
  useChatReadStore.getState().setCursor(channelId);
  if (isSupabaseConfigured()) {
    const { markRemoteChannelRead } = await import(
      "@/lib/supabase/chat-service"
    );
    await markRemoteChannelRead(channelId);
  }
}

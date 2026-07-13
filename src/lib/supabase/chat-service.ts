/**
 * Chat multi-user (canais + DM) via Supabase `chat_messages`.
 */

import type { ChatMediaKind, ChatMessage } from "@/lib/types";
import { getSupabaseBrowser } from "./client";
import { isSupabaseConfigured } from "./config";

export type ChatMessageRow = {
  id: string;
  channel_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string;
  content: string;
  created_at: string;
  shared_post_id?: string | null;
  media_kind?: string | null;
  media_url?: string | null;
  media_mime?: string | null;
  media_duration?: number | null;
  media_thumb_url?: string | null;
  media_width?: number | null;
  media_height?: number | null;
  reactions?: Record<string, string[]> | null;
  delivered_to?: string[] | null;
  read_by?: string[] | null;
};

function asMediaKind(v: unknown): ChatMediaKind | null {
  const s = String(v || "");
  if (
    s === "text" ||
    s === "image" ||
    s === "video" ||
    s === "audio" ||
    s === "sticker" ||
    s === "gif"
  ) {
    return s;
  }
  return null;
}

/** Normaliza JSONB de reações → Record<emoji, userId[]> */
export function normalizeChatReactions(
  raw: unknown
): Record<string, string[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [emoji, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!emoji) continue;
    if (Array.isArray(val)) {
      const ids = val.map(String).filter(Boolean);
      if (ids.length) out[emoji] = ids;
      continue;
    }
    // alguns drivers devolvem objeto indexado
    if (val && typeof val === "object") {
      const ids = Object.values(val as Record<string, unknown>)
        .map(String)
        .filter(Boolean);
      if (ids.length) out[emoji] = ids;
    }
  }
  return out;
}

export function rowToChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    channelId: row.channel_id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatar: row.author_avatar || "U",
    content: row.content || "",
    createdAt: row.created_at,
    sharedPostId: row.shared_post_id ?? null,
    mediaKind: asMediaKind(row.media_kind),
    mediaUrl: row.media_url ?? null,
    mediaMime: row.media_mime ?? null,
    mediaDuration:
      row.media_duration != null ? Number(row.media_duration) : null,
    mediaThumbUrl: row.media_thumb_url ?? null,
    mediaWidth: row.media_width ?? null,
    mediaHeight: row.media_height ?? null,
    reactions: normalizeChatReactions(row.reactions),
    deliveredTo: Array.isArray(row.delivered_to)
      ? row.delivered_to.map(String)
      : [],
    readBy: Array.isArray(row.read_by) ? row.read_by.map(String) : [],
  };
}

export async function fetchRemoteChatMessages(
  limit = 400
): Promise<ChatMessage[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseBrowser();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[chat] fetchRemoteChatMessages", error);
    return [];
  }
  return ((data || []) as ChatMessageRow[]).map(rowToChatMessage);
}

export type InsertRemoteChatInput = {
  channelId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  sharedPostId?: string | null;
  mediaKind?: ChatMediaKind | null;
  mediaUrl?: string | null;
  mediaMime?: string | null;
  mediaDuration?: number | null;
  mediaThumbUrl?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
};

/** Evita data URLs gigantes no Postgres (texto). GIFs https e refs curtas ok. */
function sanitizeMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;
  // IndexedDB local — outro browser não resolve
  if (u.startsWith("idb:")) return null;
  // data URL muito grande quebra insert / RLS payload
  if (u.startsWith("data:") && u.length > 900_000) {
    console.warn("[chat] media_url data URL too large, skipping media");
    return null;
  }
  return u;
}

export async function insertRemoteChatMessage(
  input: InsertRemoteChatInput
): Promise<{ ok: true; message: ChatMessage } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não configurado" };
  }
  const supabase = getSupabaseBrowser();
  if (!supabase) {
    return { ok: false, error: "Cliente Supabase indisponível" };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "Sessão Supabase ausente." };
  }

  const mediaUrl = sanitizeMediaUrl(input.mediaUrl);
  const mediaThumb = sanitizeMediaUrl(input.mediaThumbUrl);
  const content = (input.content || "").trim();
  const kind = input.mediaKind || null;
  const hasMedia = !!(mediaUrl || (kind && kind !== "text"));
  if (!content && !hasMedia && !input.sharedPostId) {
    return { ok: false, error: "Mensagem vazia" };
  }

  const insert: Record<string, unknown> = {
    channel_id: input.channelId,
    author_id: session.user.id,
    author_name: input.authorName,
    author_avatar: input.authorAvatar || "U",
    content: content || "",
    shared_post_id: input.sharedPostId || null,
    media_kind: kind,
    media_url: mediaUrl,
    media_mime: input.mediaMime || null,
    media_duration: input.mediaDuration ?? null,
    media_thumb_url: mediaThumb,
    media_width: input.mediaWidth ?? null,
    media_height: input.mediaHeight ?? null,
    reactions: {},
  };

  const { data, error } = await supabase
    .from("chat_messages")
    .insert(insert)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[chat] insertRemoteChatMessage", error);
    // Retry sem colunas de mídia se migration não aplicada
    if (
      error?.message?.includes("media_") ||
      error?.code === "PGRST204" ||
      /column/i.test(error?.message || "")
    ) {
      const minimal = {
        channel_id: input.channelId,
        author_id: session.user.id,
        author_name: input.authorName,
        author_avatar: input.authorAvatar || "U",
        content:
          content ||
          (mediaUrl ? "[mídia]" : input.sharedPostId ? "[post]" : ""),
      };
      const retry = await supabase
        .from("chat_messages")
        .insert(minimal)
        .select("*")
        .single();
      if (retry.data) {
        const msg = rowToChatMessage(retry.data as ChatMessageRow);
        return {
          ok: true,
          message: {
            ...msg,
            mediaKind: kind,
            mediaUrl: mediaUrl ?? msg.mediaUrl,
            mediaMime: input.mediaMime ?? null,
            sharedPostId: input.sharedPostId ?? null,
          },
        };
      }
    }
    return {
      ok: false,
      error:
        (error?.message || "Falha ao enviar mensagem") +
        " — aplique a migration P1.d (chat multi-user)",
    };
  }

  return { ok: true, message: rowToChatMessage(data as ChatMessageRow) };
}

export async function deleteRemoteChatMessage(
  messageId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não configurado" };
  }
  const supabase = getSupabaseBrowser();
  if (!supabase) {
    return { ok: false, error: "Cliente Supabase indisponível" };
  }

  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .eq("id", messageId);

  if (error) {
    console.error("[chat] deleteRemoteChatMessage", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Toggle de reação no servidor (security definer).
 * Contorna RLS (só o autor podia UPDATE) e cria notificação multi-user.
 */
export async function toggleRemoteChatReaction(
  messageId: string,
  emoji: string
): Promise<
  | { ok: true; reactions: Record<string, string[]> }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não configurado" };
  }
  const supabase = getSupabaseBrowser();
  if (!supabase) {
    return { ok: false, error: "Cliente Supabase indisponível" };
  }

  // UUID de mensagem remota — local msg_* não passa por RPC
  const id = String(messageId || "").trim();
  if (!id || id.startsWith("msg")) {
    return { ok: false, error: "Mensagem local — use store offline." };
  }

  // Garante JWT fresco (RPC security definer usa auth.uid())
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return {
      ok: false,
      error: "Sessão ausente. Entre de novo para reagir.",
    };
  }

  const { data, error } = await supabase.rpc("toggle_chat_reaction", {
    p_message_id: id,
    p_emoji: emoji,
  });

  if (error) {
    console.error("[chat] toggleRemoteChatReaction", error);
    const msg = error.message || "Falha ao reagir";
    // Dica se a migration P1.f / P1.j ainda não rodou
    if (
      /function .*toggle_chat_reaction/i.test(msg) ||
      error.code === "PGRST202" ||
      /could not find/i.test(msg)
    ) {
      return {
        ok: false,
        error:
          "RPC de reação ausente. Aplique supabase/migrations/20260712_p1j_fix_chat_reactions.sql no Supabase.",
      };
    }
    return { ok: false, error: msg };
  }

  return { ok: true, reactions: normalizeChatReactions(data) };
}

/** @deprecated Preferir toggleRemoteChatReaction (RPC + notif). */
export async function updateRemoteChatReactions(
  messageId: string,
  reactions: Record<string, string[]>
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não configurado" };
  }
  const supabase = getSupabaseBrowser();
  if (!supabase) {
    return { ok: false, error: "Cliente Supabase indisponível" };
  }

  const { error } = await supabase
    .from("chat_messages")
    .update({ reactions })
    .eq("id", messageId);

  if (error) {
    console.error("[chat] updateRemoteChatReactions", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Marca mensagens de terceiros como entregues (tick ✓✓ cinza no autor). */
export async function markRemoteChatDelivered(
  messageIds: string[]
): Promise<void> {
  if (!messageIds.length || !isSupabaseConfigured()) return;
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  const uuids = messageIds.filter((id) => !id.startsWith("msg"));
  if (!uuids.length) return;
  const { error } = await supabase.rpc("mark_chat_delivered", {
    p_message_ids: uuids,
  });
  if (error) {
    console.error("[chat] markRemoteChatDelivered", error);
  }
}

/** Abriu a sala: marca lido + atualiza cursor de não-lidas. */
export async function markRemoteChannelRead(
  channelId: string
): Promise<void> {
  if (!channelId || !isSupabaseConfigured()) return;
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  const { error } = await supabase.rpc("mark_channel_read", {
    p_channel_id: channelId,
  });
  if (error) {
    console.error("[chat] markRemoteChannelRead", error);
  }
}

export async function fetchRemoteReadCursors(
  userId: string
): Promise<Record<string, string>> {
  if (!userId || !isSupabaseConfigured()) return {};
  const supabase = getSupabaseBrowser();
  if (!supabase) return {};

  const { data, error } = await supabase
    .from("chat_read_cursors")
    .select("channel_id, last_read_at")
    .eq("user_id", userId);

  if (error || !data) {
    console.error("[chat] fetchRemoteReadCursors", error);
    return {};
  }

  const out: Record<string, string> = {};
  for (const row of data as Array<{ channel_id: string; last_read_at: string }>) {
    out[row.channel_id] = row.last_read_at;
  }
  return out;
}

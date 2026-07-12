/**
 * Custom emojis multi-user (Supabase `custom_emojis`).
 * Todos autenticados (e anônimos via RLS public select) podem LER.
 * Só VIP/admin cria/apaga (RLS).
 */

import type { CustomEmoji } from "@/lib/emoji-store";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type EmojiRow = {
  id: string;
  name: string;
  image_url: string;
  created_by_id: string;
  created_by_name: string;
  created_at: string;
};

export function mapEmojiRow(row: EmojiRow): CustomEmoji {
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.image_url,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  };
}

export async function fetchRemoteEmojis(
  limit = 500
): Promise<
  { ok: true; emojis: CustomEmoji[] } | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não configurado" };
  }
  const supabase = getSupabaseBrowser();
  if (!supabase) {
    return { ok: false, error: "Cliente Supabase indisponível" };
  }

  const { data, error } = await supabase
    .from("custom_emojis")
    .select(
      "id, name, image_url, created_by_id, created_by_name, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[emoji] fetchRemoteEmojis", error);
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    emojis: (data as EmojiRow[] | null)?.map(mapEmojiRow) ?? [],
  };
}

export async function insertRemoteEmoji(input: {
  name: string;
  imageUrl: string;
  createdById: string;
  createdByName: string;
}): Promise<
  { ok: true; emoji: CustomEmoji } | { ok: false; error: string }
> {
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
    return { ok: false, error: "Sessão ausente" };
  }

  const { data, error } = await supabase
    .from("custom_emojis")
    .insert({
      name: input.name,
      image_url: input.imageUrl,
      created_by_id: session.user.id,
      created_by_name: input.createdByName,
    })
    .select(
      "id, name, image_url, created_by_id, created_by_name, created_at"
    )
    .single();

  if (error || !data) {
    console.error("[emoji] insertRemoteEmoji", error);
    if (error?.code === "23505") {
      return { ok: false, error: `O emoji :${input.name}: já existe.` };
    }
    // RLS VIP
    if (error?.code === "42501" || /policy|row-level/i.test(error?.message || "")) {
      return {
        ok: false,
        error: "Só membros VIP podem criar emojis personalizados.",
      };
    }
    return {
      ok: false,
      error: error?.message || "Falha ao publicar o emoji.",
    };
  }

  return { ok: true, emoji: mapEmojiRow(data as EmojiRow) };
}

export async function deleteRemoteEmoji(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não configurado" };
  }
  const supabase = getSupabaseBrowser();
  if (!supabase) {
    return { ok: false, error: "Cliente Supabase indisponível" };
  }

  // Só apaga UUID do banco (ids locais legados `ce_…` não existem remoto)
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    );
  if (!isUuid) return { ok: true };

  const { error } = await supabase.from("custom_emojis").delete().eq("id", id);

  if (error) {
    console.error("[emoji] deleteRemoteEmoji", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

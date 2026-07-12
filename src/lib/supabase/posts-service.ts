/**
 * Posts multi-user no Supabase.
 * UI ainda usa o tipo `Post` do app; este módulo é a borda DB ↔ domínio.
 */

import type { Post } from "@/lib/types";
import { initials } from "@/lib/utils";
import { getSupabaseBrowser } from "./client";
import { isSupabaseConfigured } from "./config";
import type { PostRow, PostWithAuthorRow } from "./database.types";

function rowToPost(row: PostWithAuthorRow | PostRow): Post {
  const profile =
    "profiles" in row && row.profiles ? row.profiles : null;
  const authorName = profile?.name || row.author_name || "Membro";
  const authorAvatar =
    profile?.avatar || row.author_avatar || initials(authorName) || "U";
  const authorAvatarUrl =
    profile?.avatar_url ?? row.author_avatar_url ?? null;

  return {
    id: row.id,
    authorId: row.author_id,
    authorName,
    authorAvatar,
    authorAvatarUrl,
    communityId: row.community_id || undefined,
    communityName: row.community_name || undefined,
    title: row.title || undefined,
    content: row.content || "",
    imageUrl: row.image_url,
    gifUrl: null,
    location: row.location,
    type: (["discussion", "news", "tutorial", "announcement"].includes(
      String(row.type)
    )
      ? row.type
      : "discussion") as Post["type"],
    likes: row.likes ?? 0,
    dislikes: 0,
    comments: row.comments_count ?? 0,
    likedBy: Array.isArray(row.liked_by) ? row.liked_by : [],
    dislikedBy: [],
    savedBy: [],
    createdAt: row.created_at,
    vipOnly: !!row.vip_only,
  };
}

export async function fetchRemotePosts(limit = 80): Promise<Post[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseBrowser();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("posts")
    .select(
      `
      *,
      profiles:author_id (
        id,
        username,
        name,
        avatar,
        avatar_url,
        is_vip,
        role
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[posts] fetchRemotePosts", error);
    // Fallback sem join se FK embed falhar
    const plain = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (plain.error || !plain.data) return [];
    return (plain.data as PostRow[]).map(rowToPost);
  }

  return ((data || []) as PostWithAuthorRow[]).map(rowToPost);
}

export type CreateRemotePostInput = {
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorAvatarUrl?: string | null;
  content: string;
  imageUrl?: string | null;
  location?: string | null;
  type?: Post["type"];
  communityId?: string;
  communityName?: string;
  vipOnly?: boolean;
  /** hashtag sem # (ex.: geral) */
  hashtag?: string | null;
  title?: string;
};

export async function insertRemotePost(
  input: CreateRemotePostInput
): Promise<{ ok: true; post: Post } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não configurado" };
  }
  const supabase = getSupabaseBrowser();
  if (!supabase) {
    return { ok: false, error: "Cliente Supabase indisponível" };
  }

  const content = input.content.trim();
  if (!content) {
    return { ok: false, error: "Conteúdo vazio" };
  }

  const insert = {
    author_id: input.authorId,
    author_name: input.authorName,
    author_avatar: input.authorAvatar || "U",
    author_avatar_url: input.authorAvatarUrl ?? null,
    community_id: input.communityId ?? null,
    community_name: input.communityName ?? null,
    title: input.title?.trim() || null,
    content,
    image_url: input.imageUrl ?? null,
    location: input.location?.trim() || null,
    type: input.type ?? "discussion",
    likes: 0,
    comments_count: 0,
    liked_by: [] as string[],
    vip_only: !!input.vipOnly,
    hashtag: input.hashtag?.replace(/^#/, "").toLowerCase() || null,
  };

  // Garante sessão (RLS exige auth.uid() = author_id)
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return {
      ok: false,
      error: "Sessão Supabase ausente. Saia e entre de novo.",
    };
  }
  if (session.user.id !== input.authorId) {
    // Corrige author_id para o uid real da sessão (evita RLS reject)
    insert.author_id = session.user.id;
  }

  const { data, error } = await supabase
    .from("posts")
    .insert(insert)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[posts] insertRemotePost", error);
    const hint =
      error?.code === "42501" || /row-level security|RLS/i.test(error?.message || "")
        ? " (RLS: confira se o profile existe e author_id = auth.uid())"
        : "";
    return {
      ok: false,
      error: (error?.message || "Falha ao publicar no Supabase") + hint,
    };
  }

  return { ok: true, post: rowToPost(data as PostRow) };
}

/** Mapeia row crua (realtime payload) → Post */
export function mapPostRow(row: PostRow): Post {
  return rowToPost(row);
}

/** Apaga post no Supabase (RLS: dono ou admin). */
export async function deleteRemotePost(
  postId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
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
    return {
      ok: false,
      error: "Sessão Supabase ausente. Saia e entre de novo.",
    };
  }

  const { error, count } = await supabase
    .from("posts")
    .delete({ count: "exact" })
    .eq("id", postId);

  if (error) {
    console.error("[posts] deleteRemotePost", error);
    const hint =
      error.code === "42501" || /row-level security|RLS/i.test(error.message)
        ? " (RLS: só o autor ou admin pode apagar)"
        : "";
    return { ok: false, error: error.message + hint };
  }

  // Se 0 rows, post já não existia no DB (ou RLS bloqueou sem erro em alguns setups)
  if (count === 0) {
    // Ainda assim ok do ponto de vista do cliente se já sumiu
    console.warn("[posts] deleteRemotePost: 0 rows affected", postId);
  }

  return { ok: true };
}

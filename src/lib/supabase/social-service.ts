/**
 * Follow multi-user via Supabase `follows`.
 */

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { FollowEdge } from "@/lib/social-store";

type FollowRow = {
  follower_id: string;
  following_id: string;
  created_at: string;
};

export function mapFollowRow(row: FollowRow): FollowEdge {
  return {
    followerId: row.follower_id,
    followingId: row.following_id,
    createdAt: row.created_at,
  };
}

export type FetchFollowsResult =
  | { ok: true; edges: FollowEdge[] }
  | { ok: false; error: string; unauthorized?: boolean };

/**
 * Busca o grafo de follows.
 * Importante: exige sessão — sem auth o RLS devolve [] e NÃO devemos
 * tratar isso como “ninguém segue ninguém” (apagaria o cache local).
 */
export async function fetchRemoteFollows(
  limit = 2000
): Promise<FetchFollowsResult> {
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
      error: "Sessão ausente",
      unauthorized: true,
    };
  }

  const { data, error } = await supabase
    .from("follows")
    .select("follower_id, following_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[social] fetchRemoteFollows", error);
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    edges: (data as FollowRow[] | null)?.map(mapFollowRow) ?? [],
  };
}

export async function insertRemoteFollow(
  targetId: string
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
  const me = session?.user?.id;
  if (!me) return { ok: false, error: "Sessão ausente" };
  if (me === targetId) {
    return { ok: false, error: "Você não pode seguir a si mesmo." };
  }

  const { error } = await supabase.from("follows").insert({
    follower_id: me,
    following_id: targetId,
  });

  if (error) {
    // já segue — ok idempotente
    if (error.code === "23505") return { ok: true };
    console.error("[social] insertRemoteFollow", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteRemoteFollow(
  targetId: string
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
  const me = session?.user?.id;
  if (!me) return { ok: false, error: "Sessão ausente" };

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", me)
    .eq("following_id", targetId);

  if (error) {
    console.error("[social] deleteRemoteFollow", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Contagens diretas no banco (fonte da verdade, sem depender do cache). */
export async function fetchFollowCounts(userId: string): Promise<{
  followers: number;
  following: number;
}> {
  if (!userId || !isSupabaseConfigured()) {
    return { followers: 0, following: 0 };
  }
  const supabase = getSupabaseBrowser();
  if (!supabase) return { followers: 0, following: 0 };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return { followers: 0, following: 0 };
  }

  const [followersRes, followingRes] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", userId),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", userId),
  ]);

  if (followersRes.error) {
    console.error("[social] fetchFollowCounts followers", followersRes.error);
  }
  if (followingRes.error) {
    console.error("[social] fetchFollowCounts following", followingRes.error);
  }

  return {
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
  };
}

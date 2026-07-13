/**
 * Posts multi-user no Supabase.
 * UI ainda usa o tipo `Post` / `Comment` do app; este módulo é a borda DB ↔ domínio.
 */

import { lightenGifUrl } from "@/lib/gif-optimize";
import { normalizePostMusic, postMusicToJson } from "@/lib/post-music";
import type { Comment, Post, PostMusic } from "@/lib/types";
import { initials } from "@/lib/utils";
import { getSupabaseBrowser } from "./client";
import { isSupabaseConfigured } from "./config";
import type { PostRow, PostWithAuthorRow } from "./database.types";

export type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string;
  author_avatar_url?: string | null;
  content: string;
  created_at: string;
  gif_url?: string | null;
  parent_id?: string | null;
  reply_to_name?: string | null;
  reply_to_author_id?: string | null;
  liked_by?: string[] | null;
};

function rowToPost(row: PostWithAuthorRow | PostRow & { gif_url?: string | null }): Post {
  const profile =
    "profiles" in row && row.profiles ? row.profiles : null;
  const authorName = profile?.name || row.author_name || "Membro";
  const authorAvatar =
    profile?.avatar || row.author_avatar || initials(authorName) || "U";
  const authorAvatarUrl =
    profile?.avatar_url ?? row.author_avatar_url ?? null;
  const rawGif =
    "gif_url" in row
      ? ((row as { gif_url?: string | null }).gif_url ?? null)
      : null;
  // Fallback: GIFs gravados em image_url antes da migration gif_url
  const imageLooksLikeGif =
    !rawGif &&
    !!row.image_url &&
    /giphy\.com|tenor\.com|\.gif(\?|$)/i.test(row.image_url);
  const gifUrlRaw = rawGif || (imageLooksLikeGif ? row.image_url : null);
  // Posts antigos com /giphy.gif viram 200w.webp no client
  const gifUrl = gifUrlRaw ? lightenGifUrl(gifUrlRaw) : null;
  const imageUrl = gifUrl ? null : row.image_url;

  const musicRaw =
    "music" in row ? (row as PostRow).music : null;

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
    imageUrl,
    gifUrl,
    location: row.location,
    music: normalizePostMusic(musicRaw),
    type: (["discussion", "news", "tutorial", "announcement"].includes(
      String(row.type)
    )
      ? row.type
      : "discussion") as Post["type"],
    likes: row.likes ?? 0,
    dislikes:
      typeof (row as PostRow).dislikes === "number"
        ? ((row as PostRow).dislikes as number)
        : Array.isArray((row as PostRow).disliked_by)
          ? ((row as PostRow).disliked_by as string[]).length
          : 0,
    comments: row.comments_count ?? 0,
    likedBy: Array.isArray(row.liked_by)
      ? row.liked_by.map(String)
      : [],
    dislikedBy: Array.isArray((row as PostRow).disliked_by)
      ? ((row as PostRow).disliked_by as string[]).map(String)
      : [],
    savedBy: [],
    createdAt: row.created_at,
    vipOnly: !!row.vip_only,
  };
}

export function rowToComment(row: CommentRow): Comment {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatar: row.author_avatar || "U",
    content: row.content || "",
    createdAt: row.created_at,
    likedBy: Array.isArray(row.liked_by) ? row.liked_by.map(String) : [],
    parentId: row.parent_id ?? null,
    replyToName: row.reply_to_name ?? null,
    replyToAuthorId: row.reply_to_author_id ?? null,
    gifUrl: row.gif_url ?? null,
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

export async function fetchRemoteComments(
  postIds?: string[]
): Promise<Comment[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseBrowser();
  if (!supabase) return [];

  let q = supabase
    .from("comments")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(500);

  if (postIds && postIds.length > 0) {
    q = q.in("post_id", postIds);
  }

  const { data, error } = await q;
  if (error) {
    console.error("[posts] fetchRemoteComments", error);
    return [];
  }
  return ((data || []) as CommentRow[]).map(rowToComment);
}

export type CreateRemotePostInput = {
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorAvatarUrl?: string | null;
  content: string;
  imageUrl?: string | null;
  gifUrl?: string | null;
  location?: string | null;
  music?: PostMusic | null;
  type?: Post["type"];
  communityId?: string;
  communityName?: string;
  vipOnly?: boolean;
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
  // Nunca persistir original Giphy pesado — reescreve p/ 200w.webp
  const gifUrl = input.gifUrl?.trim()
    ? lightenGifUrl(input.gifUrl.trim())
    : null;
  const imageUrl = input.imageUrl ?? null;
  const music = normalizePostMusic(input.music);
  if (!content && !gifUrl && !imageUrl && !music) {
    return { ok: false, error: "Conteúdo vazio" };
  }

  const insert: Record<string, unknown> = {
    author_id: input.authorId,
    author_name: input.authorName,
    author_avatar: input.authorAvatar || "U",
    author_avatar_url: input.authorAvatarUrl ?? null,
    community_id: input.communityId ?? null,
    community_name: input.communityName ?? null,
    title: input.title?.trim() || null,
    content: content || " ",
    image_url: gifUrl ? null : imageUrl,
    gif_url: gifUrl,
    location: input.location?.trim() || null,
    type: input.type ?? "discussion",
    likes: 0,
    comments_count: 0,
    liked_by: [] as string[],
    vip_only: !!input.vipOnly,
    hashtag: input.hashtag?.replace(/^#/, "").toLowerCase() || null,
  };
  if (music) {
    insert.music = postMusicToJson(music);
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
  if (session.user.id !== input.authorId) {
    insert.author_id = session.user.id;
  }

  const { data, error } = await supabase
    .from("posts")
    .insert(insert)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[posts] insertRemotePost", error);

    // Retry sem music se coluna ainda não migrada
    if (
      music &&
      (error?.message?.includes("music") ||
        error?.code === "PGRST204" ||
        /column .*music/i.test(error?.message || ""))
    ) {
      console.warn(
        "[posts] coluna posts.music ausente — aplique supabase/migrations/20260712_p1i_post_music.sql. Publicando com música só no client."
      );
      delete insert.music;
      const retryMusic = await supabase
        .from("posts")
        .insert(insert)
        .select("*")
        .single();
      if (retryMusic.data) {
        return {
          ok: true,
          post: {
            ...rowToPost(retryMusic.data as PostRow),
            music, // client ainda vê a música localmente até a migration
          },
        };
      }
    }

    // Retry sem gif_url se coluna ainda não existir — grava GIF em image_url
    // para o feed ainda exibir a mídia até aplicar a migration P1.b.
    if (
      gifUrl &&
      (error?.message?.includes("gif_url") ||
        error?.code === "PGRST204" ||
        /column .*gif_url/i.test(error?.message || ""))
    ) {
      delete insert.gif_url;
      insert.image_url = gifUrl;
      const retry = await supabase
        .from("posts")
        .insert(insert)
        .select("*")
        .single();
      if (retry.data) {
        const post = rowToPost(retry.data as PostRow);
        return {
          ok: true,
          post: { ...post, gifUrl, imageUrl: null },
        };
      }
      return {
        ok: false,
        error:
          (retry.error?.message || error?.message || "Falha ao publicar") +
          " — aplique supabase/migrations/20260712_p1b_social_interactions.sql",
      };
    }
    const hint =
      error?.code === "42501" ||
      /row-level security|RLS/i.test(error?.message || "")
        ? " (RLS: confira se o profile existe e author_id = auth.uid())"
        : "";
    return {
      ok: false,
      error: (error?.message || "Falha ao publicar no Supabase") + hint,
    };
  }

  const post = rowToPost(data as PostRow & { gif_url?: string });
  // Garante música no objeto de retorno mesmo se o select omitir o campo
  // (schema cache desatualizado) — o autor acabou de enviar.
  if (music && !post.music) {
    return { ok: true, post: { ...post, music } };
  }
  return { ok: true, post };
}

export function mapPostRow(row: PostRow): Post {
  return rowToPost(row);
}

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

  if (count === 0) {
    console.warn("[posts] deleteRemotePost: 0 rows affected", postId);
  }

  return { ok: true };
}

/** Toggle like via RPC (atualiza liked_by + likes + notifica dono). */
export async function toggleRemotePostLike(
  postId: string
): Promise<{ ok: true; post: Post } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não configurado" };
  }
  const supabase = getSupabaseBrowser();
  if (!supabase) {
    return { ok: false, error: "Cliente Supabase indisponível" };
  }

  const { data, error } = await supabase.rpc("toggle_post_like", {
    p_post_id: postId,
  });

  if (error || !data) {
    console.error("[posts] toggleRemotePostLike", error);
    return {
      ok: false,
      error: error?.message || "Falha ao curtir",
    };
  }

  return { ok: true, post: rowToPost(data as PostRow & { gif_url?: string }) };
}

/** Toggle dislike via RPC (atualiza disliked_by + notifica dono). */
export async function toggleRemotePostDislike(
  postId: string
): Promise<{ ok: true; post: Post } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não configurado" };
  }
  const supabase = getSupabaseBrowser();
  if (!supabase) {
    return { ok: false, error: "Cliente Supabase indisponível" };
  }

  const { data, error } = await supabase.rpc("toggle_post_dislike", {
    p_post_id: postId,
  });

  if (error || !data) {
    console.error("[posts] toggleRemotePostDislike", error);
    return {
      ok: false,
      error: error?.message || "Falha ao dar dislike",
    };
  }

  return { ok: true, post: rowToPost(data as PostRow & { gif_url?: string }) };
}

/** Toggle curtida em comentário + notifica o autor do comentário. */
export async function toggleRemoteCommentLike(
  commentId: string
): Promise<{ ok: true; comment: Comment } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não configurado" };
  }
  const supabase = getSupabaseBrowser();
  if (!supabase) {
    return { ok: false, error: "Cliente Supabase indisponível" };
  }

  const { data, error } = await supabase.rpc("toggle_comment_like", {
    p_comment_id: commentId,
  });

  if (error || !data) {
    console.error("[posts] toggleRemoteCommentLike", error);
    return {
      ok: false,
      error: error?.message || "Falha ao curtir comentário",
    };
  }

  return { ok: true, comment: rowToComment(data as CommentRow) };
}

export type RemoteRepost = {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  createdAt: string;
};

export async function fetchRemoteReposts(
  postIds?: string[]
): Promise<RemoteRepost[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseBrowser();
  if (!supabase) return [];

  let q = supabase
    .from("post_reposts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (postIds && postIds.length > 0) {
    q = q.in("post_id", postIds);
  }

  const { data, error } = await q;
  if (error || !data) {
    console.error("[posts] fetchRemoteReposts", error);
    return [];
  }

  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    postId: String(r.post_id),
    userId: String(r.user_id),
    userName: String(r.user_name || "Membro"),
    createdAt: String(r.created_at),
  }));
}

export async function toggleRemoteRepost(
  postId: string
): Promise<
  | {
      ok: true;
      reposted: boolean;
      count: number;
      repost?: RemoteRepost;
    }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não configurado" };
  }
  const supabase = getSupabaseBrowser();
  if (!supabase) {
    return { ok: false, error: "Cliente Supabase indisponível" };
  }

  const { data, error } = await supabase.rpc("toggle_post_repost", {
    p_post_id: postId,
  });

  if (error || !data) {
    console.error("[posts] toggleRemoteRepost", error);
    return {
      ok: false,
      error: error?.message || "Falha ao repostar",
    };
  }

  const j = data as Record<string, unknown>;
  const reposted = !!j.reposted;
  return {
    ok: true,
    reposted,
    count: Number(j.count ?? 0),
    repost:
      reposted && j.id
        ? {
            id: String(j.id),
            postId: String(j.post_id || postId),
            userId: String(j.user_id),
            userName: String(j.user_name || "Membro"),
            createdAt: String(j.created_at || new Date().toISOString()),
          }
        : undefined,
  };
}

export type CreateRemoteCommentInput = {
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  gifUrl?: string | null;
  parentId?: string | null;
  replyToName?: string | null;
  replyToAuthorId?: string | null;
};

export async function insertRemoteComment(
  input: CreateRemoteCommentInput
): Promise<{ ok: true; comment: Comment } | { ok: false; error: string }> {
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

  const content = input.content.trim();
  const gifUrl = input.gifUrl?.trim()
    ? lightenGifUrl(input.gifUrl.trim())
    : null;
  if (!content && !gifUrl) {
    return { ok: false, error: "Comentário vazio" };
  }

  const insert: Record<string, unknown> = {
    post_id: input.postId,
    author_id: session.user.id,
    author_name: input.authorName,
    author_avatar: input.authorAvatar || "U",
    content: content || "",
    gif_url: gifUrl,
    parent_id: input.parentId || null,
    reply_to_name: input.replyToName || null,
    reply_to_author_id: input.replyToAuthorId || null,
    liked_by: [],
  };

  const { data, error } = await supabase
    .from("comments")
    .insert(insert)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[posts] insertRemoteComment", error);
    // Colunas gif/thread ainda não migradas: tenta insert mínimo
    if (
      error?.message?.includes("gif_url") ||
      error?.message?.includes("parent_id") ||
      error?.code === "PGRST204"
    ) {
      const minimal = {
        post_id: input.postId,
        author_id: session.user.id,
        author_name: input.authorName,
        author_avatar: input.authorAvatar || "U",
        content:
          content ||
          (gifUrl ? "[GIF]" : ""),
      };
      const retry = await supabase
        .from("comments")
        .insert(minimal)
        .select("*")
        .single();
      if (retry.data) {
        const comment = rowToComment(retry.data as CommentRow);
        return {
          ok: true,
          comment: {
            ...comment,
            gifUrl: gifUrl ?? comment.gifUrl,
            parentId: input.parentId ?? null,
            replyToName: input.replyToName ?? null,
            replyToAuthorId: input.replyToAuthorId ?? null,
          },
        };
      }
    }
    return {
      ok: false,
      error:
        (error?.message || "Falha ao comentar") +
        " — confira se a migration P1.b foi aplicada no Supabase",
    };
  }

  return { ok: true, comment: rowToComment(data as CommentRow) };
}

export type RemoteNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  href: string;
  actorId?: string;
  actorName?: string;
  read: boolean;
  createdAt: string;
  dedupeKey?: string;
};

export async function fetchRemoteNotifications(
  userId: string
): Promise<RemoteNotification[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseBrowser();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error || !data) {
    console.error("[notifications] fetch", error);
    return [];
  }

  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    type: String(r.type),
    title: String(r.title),
    body: String(r.body || ""),
    href: String(r.href || "/app"),
    actorId: r.actor_id ? String(r.actor_id) : undefined,
    actorName: r.actor_name ? String(r.actor_name) : undefined,
    read: !!r.read,
    createdAt: String(r.created_at),
    dedupeKey: r.dedupe_key ? String(r.dedupe_key) : undefined,
  }));
}

export async function markRemoteNotificationsRead(
  userId: string
): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
}

export async function clearRemoteNotifications(userId: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  await supabase.from("notifications").delete().eq("user_id", userId);
}

export async function deleteRemoteComment(
  commentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não configurado" };
  }
  const supabase = getSupabaseBrowser();
  if (!supabase) {
    return { ok: false, error: "Cliente Supabase indisponível" };
  }

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    console.error("[posts] deleteRemoteComment", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

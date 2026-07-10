import type { Community, CommunityTagPolicy, UserRole } from "./types";

/** Extrai hashtags do texto (#geral, #vips…) — lower, sem # */
export function extractHashtags(text: string): string[] {
  if (!text) return [];
  const re = /#([a-zA-Z0-9_]{2,32})/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    found.add(m[1].toLowerCase());
  }
  return Array.from(found);
}

/** Normaliza tag digitada (#Geral → geral) */
export function normalizeHashtag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 32);
}

export function isValidHashtag(tag: string): boolean {
  return /^[a-z0-9_]{2,32}$/.test(tag);
}

export function canReadCommunity(
  community: Community,
  opts: { isVip: boolean; isAdmin?: boolean }
): boolean {
  if (opts.isAdmin) return true;
  if (community.access === "vip" || community.vipOnly) {
    return !!opts.isVip;
  }
  return true;
}

export function canUseCommunityTag(
  community: Community,
  opts: { role?: UserRole | string; isVip?: boolean; isAdmin?: boolean }
): boolean {
  if (opts.isAdmin || opts.role === "admin") return true;
  const policy: CommunityTagPolicy = community.tagPolicy || "everyone";
  // #staff e similares — só admin
  if (policy === "admin") return false;
  // Comunidade VIP — só VIP marca a hashtag (free não)
  if (community.access === "vip" || community.vipOnly) {
    return !!opts.isVip;
  }
  return true;
}

/**
 * Valida hashtags do post antes de publicar.
 * Retorna erro amigável ou null se ok.
 */
export function validatePostHashtags(
  content: string,
  communities: Community[],
  author: { role?: string; isVip?: boolean }
): { ok: true; matched: Community[] } | { ok: false; error: string } {
  const tags = extractHashtags(content);
  if (tags.length === 0) {
    return { ok: true, matched: [] };
  }

  const byTag = new Map(
    communities.map((c) => [normalizeHashtag(c.hashtag), c])
  );
  const isAdmin = author.role === "admin";
  const matched: Community[] = [];

  for (const tag of tags) {
    const community = byTag.get(tag);
    if (!community) continue;
    if (
      !canUseCommunityTag(community, {
        role: author.role,
        isVip: author.isVip,
        isAdmin,
      })
    ) {
      if (community.tagPolicy === "admin") {
        return {
          ok: false,
          error: `A hashtag #${community.hashtag} é reservada ao staff/admin (${community.name}).`,
        };
      }
      if (community.access === "vip" || community.vipOnly) {
        return {
          ok: false,
          error: `A hashtag #${community.hashtag} é exclusiva de membros VIP (${community.name}).`,
        };
      }
      return {
        ok: false,
        error: `Você não pode usar #${community.hashtag} nesta comunidade.`,
      };
    }
    matched.push(community);
  }

  return { ok: true, matched };
}

/** Comunidades cujas hashtags aparecem no conteúdo do post */
export function communitiesForPost(
  content: string,
  communities: Community[]
): Community[] {
  const tags = new Set(extractHashtags(content));
  if (tags.size === 0) return [];
  return communities.filter((c) => tags.has(normalizeHashtag(c.hashtag)));
}

/** Post pertence à comunidade? (hashtag no texto ou communityId legado) */
export function postMatchesCommunity(
  post: { content?: string; communityId?: string; title?: string },
  community: Community
): boolean {
  if (post.communityId && post.communityId === community.id) return true;
  const text = `${post.title || ""} ${post.content || ""}`;
  const tags = extractHashtags(text);
  return tags.includes(normalizeHashtag(community.hashtag));
}

/** Conta posts visíveis na comunidade para um viewer */
export function countPostsInCommunity(
  posts: { content?: string; communityId?: string; title?: string }[],
  community: Community
): number {
  return posts.filter((p) => postMatchesCommunity(p, community)).length;
}

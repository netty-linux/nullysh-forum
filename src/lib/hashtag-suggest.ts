import type { Community } from "./types";
import {
  canUseCommunityTag,
  normalizeHashtag,
} from "./community-hashtags";

export type HashtagQuery = {
  /** índice do `#` no texto */
  start: number;
  /** texto após # (sem o #), lower */
  query: string;
  /** posição do cursor */
  cursor: number;
};

/**
 * Detecta se o cursor está digitando uma hashtag (#… parcialmente).
 * Ex.: "oi #ger|" → query "ger", start no `#`.
 */
export function getActiveHashtagQuery(
  text: string,
  cursor: number
): HashtagQuery | null {
  if (cursor < 0 || cursor > text.length) return null;
  const before = text.slice(0, cursor);
  // do cursor para trás até achar # válido
  const match = before.match(/#([a-zA-Z0-9_]*)$/);
  if (!match) return null;
  // não sugere se # está colado em palavra (ex.: email#foo)
  const hashIndex = before.length - match[0].length;
  if (hashIndex > 0) {
    const prev = before[hashIndex - 1];
    if (/[a-zA-Z0-9_]/.test(prev)) return null;
  }
  return {
    start: hashIndex,
    query: (match[1] || "").toLowerCase(),
    cursor,
  };
}

export function filterCommunityHashtags(
  communities: Community[],
  query: string,
  author: { role?: string; isVip?: boolean }
): Community[] {
  const q = query.toLowerCase();
  const isAdmin = author.role === "admin";
  return communities
    .filter((c) =>
      canUseCommunityTag(c, {
        role: author.role,
        isVip: author.isVip,
        isAdmin,
      })
    )
    .filter((c) => {
      const tag = normalizeHashtag(c.hashtag);
      const name = c.name.toLowerCase();
      if (!q) return true;
      return tag.startsWith(q) || name.includes(q);
    })
    .sort((a, b) => {
      const ta = normalizeHashtag(a.hashtag);
      const tb = normalizeHashtag(b.hashtag);
      // matches no início da tag primeiro
      const aStarts = ta.startsWith(q) ? 0 : 1;
      const bStarts = tb.startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return ta.localeCompare(tb, "pt-BR");
    })
    .slice(0, 8);
}

/** Substitui a hashtag parcial pela tag completa + espaço */
export function applyHashtagSuggestion(
  text: string,
  query: HashtagQuery,
  hashtag: string
): { text: string; cursor: number } {
  const tag = normalizeHashtag(hashtag);
  const insert = `#${tag} `;
  const end = query.cursor;
  const next = text.slice(0, query.start) + insert + text.slice(end);
  return {
    text: next,
    cursor: query.start + insert.length,
  };
}

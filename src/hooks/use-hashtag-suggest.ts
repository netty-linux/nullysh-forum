"use client";

import {
  applyHashtagSuggestion,
  filterCommunityHashtags,
  getActiveHashtagQuery,
  type HashtagQuery,
} from "@/lib/hashtag-suggest";
import type { Community } from "@/lib/types";
import {
  useCallback,
  useMemo,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";

type Author = { role?: string; isVip?: boolean };

/**
 * Autocomplete de #hashtags de comunidade para textareas de post.
 */
export function useHashtagSuggest(opts: {
  content: string;
  setContent: (v: string) => void;
  communities: Community[];
  author: Author;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  maxChars?: number;
}) {
  const { content, setContent, communities, author, textareaRef, maxChars } =
    opts;
  const [query, setQuery] = useState<HashtagQuery | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const items = useMemo(() => {
    if (!query) return [];
    return filterCommunityHashtags(communities, query.query, author);
  }, [query, communities, author]);

  const open = items.length > 0 && !!query;

  const refreshFromCaret = useCallback(
    (text: string, cursor: number) => {
      const q = getActiveHashtagQuery(text, cursor);
      setQuery(q);
      setActiveIndex(0);
    },
    []
  );

  const onChangeText = useCallback(
    (text: string, cursor: number) => {
      const limited =
        typeof maxChars === "number" && text.length > maxChars
          ? text.slice(0, maxChars)
          : text;
      setContent(limited);
      // se cortou, cursor no fim
      const cur =
        limited.length < text.length ? limited.length : cursor;
      refreshFromCaret(limited, cur);
    },
    [maxChars, setContent, refreshFromCaret]
  );

  const select = useCallback(
    (community: Community) => {
      if (!query) return;
      const el = textareaRef.current;
      const { text, cursor } = applyHashtagSuggestion(
        content,
        query,
        community.hashtag
      );
      const next =
        typeof maxChars === "number" && text.length > maxChars
          ? text.slice(0, maxChars)
          : text;
      setContent(next);
      setQuery(null);
      setActiveIndex(0);
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        const pos = Math.min(cursor, next.length);
        el.setSelectionRange(pos, pos);
      });
    },
    [query, content, setContent, textareaRef, maxChars]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % items.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + items.length) % items.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const pick = items[activeIndex] ?? items[0];
        if (pick) select(pick);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setQuery(null);
      }
    },
    [open, items, activeIndex, select]
  );

  const close = useCallback(() => {
    setQuery(null);
    setActiveIndex(0);
  }, []);

  return {
    open,
    query,
    items,
    activeIndex,
    setActiveIndex,
    onChangeText,
    onKeyDown,
    select,
    close,
    refreshFromCaret,
  };
}

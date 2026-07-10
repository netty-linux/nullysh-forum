"use client";

import { useCommunityStore } from "@/lib/community-store";
import { normalizeHashtag } from "@/lib/community-hashtags";
import { useEmojiStore } from "@/lib/emoji-store";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useMemo } from "react";

const SHORTCODE_RE = /:([a-zA-Z0-9_]{2,32}):/g;
/** Hashtags + shortcodes no mesmo passe */
const TOKEN_RE = /#([a-zA-Z0-9_]{2,32})|:([a-zA-Z0-9_]{2,32}):/g;

/**
 * Renderiza texto com shortcodes :emoji: e #hashtags de comunidade.
 */
export function RichText({
  text,
  className,
  emojiSize = 20,
}: {
  text: string;
  className?: string;
  emojiSize?: number;
}) {
  const emojis = useEmojiStore((s) => s.emojis);
  const communities = useCommunityStore((s) => s.communities);

  const emojiMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of emojis) {
      m.set(e.name.toLowerCase(), e.imageUrl);
    }
    return m;
  }, [emojis]);

  const communityByTag = useMemo(() => {
    const m = new Map<string, { slug: string; name: string }>();
    for (const c of communities) {
      m.set(normalizeHashtag(c.hashtag), { slug: c.slug, name: c.name });
    }
    return m;
  }, [communities]);

  const nodes = useMemo(() => {
    const parts: React.ReactNode[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    const re = new RegExp(TOKEN_RE.source, "g");
    let i = 0;

    while ((match = re.exec(text)) !== null) {
      if (match.index > last) {
        parts.push(
          <span key={`t-${i++}`}>{text.slice(last, match.index)}</span>
        );
      }

      if (match[1]) {
        // #hashtag
        const tag = match[1].toLowerCase();
        const community = communityByTag.get(tag);
        if (community) {
          parts.push(
            <Link
              key={`h-${i++}`}
              href={`/app/communities/${community.slug}`}
              className="font-semibold text-sky-600 hover:underline dark:text-sky-400"
              title={community.name}
              onClick={(e) => e.stopPropagation()}
            >
              #{tag}
            </Link>
          );
        } else {
          parts.push(
            <span
              key={`h-${i++}`}
              className="font-medium text-sky-600/80 dark:text-sky-400/80"
            >
              #{tag}
            </span>
          );
        }
      } else if (match[2]) {
        // :emoji:
        const name = match[2];
        const src = emojiMap.get(name.toLowerCase());
        if (src) {
          parts.push(
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`e-${i++}`}
              src={src}
              alt={`:${name}:`}
              title={`:${name}:`}
              width={emojiSize}
              height={emojiSize}
              className="inline-block align-[-0.2em] rounded-sm object-contain"
              style={{ width: emojiSize, height: emojiSize }}
            />
          );
        } else {
          parts.push(<span key={`r-${i++}`}>{match[0]}</span>);
        }
      }

      last = match.index + match[0].length;
    }
    if (last < text.length) {
      parts.push(<span key={`t-${i++}`}>{text.slice(last)}</span>);
    }
    return parts;
  }, [text, emojiMap, communityByTag, emojiSize]);

  // silence unused SHORTCODE_RE (kept for clarity / future)
  void SHORTCODE_RE;

  return (
    <span className={cn("whitespace-pre-wrap break-words", className)}>
      {nodes}
    </span>
  );
}

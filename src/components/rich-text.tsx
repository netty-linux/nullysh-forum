"use client";

import { useEmojiStore } from "@/lib/emoji-store";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

const SHORTCODE_RE = /:([a-zA-Z0-9_]{2,32}):/g;

/**
 * Renderiza texto com shortcodes :emoji: como imagens customizadas.
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

  const map = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of emojis) {
      m.set(e.name.toLowerCase(), e.imageUrl);
    }
    return m;
  }, [emojis]);

  const nodes = useMemo(() => {
    const parts: React.ReactNode[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    const re = new RegExp(SHORTCODE_RE.source, "g");
    let i = 0;

    while ((match = re.exec(text)) !== null) {
      if (match.index > last) {
        parts.push(
          <span key={`t-${i++}`}>{text.slice(last, match.index)}</span>
        );
      }
      const name = match[1];
      const src = map.get(name.toLowerCase());
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
      last = match.index + match[0].length;
    }
    if (last < text.length) {
      parts.push(<span key={`t-${i++}`}>{text.slice(last)}</span>);
    }
    return parts;
  }, [text, map, emojiSize]);

  return (
    <span className={cn("whitespace-pre-wrap break-words", className)}>
      {nodes}
    </span>
  );
}

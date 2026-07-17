"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

const sizeMap = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
  "2xl": "h-24 w-24 text-2xl sm:h-[6.5rem] sm:w-[6.5rem] sm:text-3xl",
} as const;

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizeMap;
  className?: string;
  /** @deprecated Molduras removidas — prop ignorada por compatibilidade */
  frame?: string | null;
  framed?: boolean;
}) {
  const letter = (() => {
    const n = (name || "U").trim();
    if (!n) return "U";
    // Já veio como iniciais ("NB") — preserva até 2 chars
    if (n.length <= 2 && !/\s/.test(n)) return n.toUpperCase();
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return n.slice(0, 1).toUpperCase();
  })();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={40}
        height={40}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(
          "shrink-0 overflow-hidden rounded-full bg-neutral-200 object-cover transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)]",
          loaded ? "opacity-100" : "opacity-0",
          sizeMap[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1a1a1a] font-medium tracking-tight text-white",
        sizeMap[size],
        className
      )}
      aria-hidden
    >
      {letter}
    </div>
  );
}

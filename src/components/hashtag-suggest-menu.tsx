"use client";

import type { Community } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Hash,
  Lock,
  SealCheck,
} from "@phosphor-icons/react";

type Props = {
  items: Community[];
  activeIndex: number;
  onSelect: (community: Community) => void;
  onHover: (index: number) => void;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Menu limpo de autocomplete de #hashtags de assuntos.
 */
export function HashtagSuggestMenu({
  items,
  activeIndex,
  onSelect,
  onHover,
  className,
  style,
}: Props) {
  if (items.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Assuntos"
      style={style}
      className={cn(
        "overflow-hidden rounded-xl border border-neutral-200/90 bg-white",
        "shadow-[0_8px_30px_-8px_rgb(0_0_0/0.18),0_0_0_1px_rgb(0_0_0/0.04)]",
        "dark:border-zinc-700 dark:bg-[#1a1a1a]",
        "dark:shadow-[0_12px_40px_-10px_rgb(0_0_0/0.65)]",
        className
      )}
    >
      <p className="border-b border-neutral-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400 dark:border-zinc-800">
        Assuntos
      </p>
      <ul className="max-h-[170px] overflow-y-auto py-1">
        {items.map((c, i) => {
          const active = i === activeIndex;
          const vip = c.access === "vip" || c.vipOnly;
          return (
            <li key={c.id} role="option" aria-selected={active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  // evita blur do textarea antes do click
                  e.preventDefault();
                  onSelect(c);
                }}
                onMouseEnter={() => onHover(i)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left transition",
                  active
                    ? "bg-neutral-100 dark:bg-zinc-800"
                    : "hover:bg-neutral-50 dark:hover:bg-zinc-800/70"
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    active
                      ? "bg-[#1f1f1f] text-white dark:bg-zinc-100 dark:text-[#141414]"
                      : "bg-neutral-100 text-neutral-600 dark:bg-zinc-800 dark:text-zinc-300"
                  )}
                >
                  <Hash size={14} weight="bold" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold text-[#1f1f1f] dark:text-zinc-100">
                      #{c.hashtag}
                    </span>
                    {c.source === "staff" && (
                      <SealCheck
                        size={12}
                        weight="fill"
                        className="shrink-0 text-sky-500"
                        aria-label="Staff"
                      />
                    )}
                    {vip && (
                      <Lock
                        size={11}
                        weight="bold"
                        className="shrink-0 text-amber-600"
                        aria-label="VIP lê"
                      />
                    )}
                  </span>
                  <span className="block truncate text-[11px] text-neutral-400">
                    {c.name}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

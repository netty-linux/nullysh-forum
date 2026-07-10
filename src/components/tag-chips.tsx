"use client";

import { cn } from "@/lib/utils";

export function TagChips({
  tags,
  selected,
  onToggle,
  className,
}: {
  tags: readonly string[] | string[];
  selected: string[];
  onToggle: (tag: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {tags.map((tag) => {
        const active = selected.some(
          (s) => s.toLowerCase() === tag.toLowerCase()
        );
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            className={
              active
                ? "chip rounded-full bg-[#1f1f1f] px-3.5 py-2 text-xs font-semibold text-white shadow-[0_1px_3px_rgb(0_0_0/0.15)]"
                : "chip rounded-full border border-neutral-200/90 bg-white px-3.5 py-2 text-xs font-medium text-neutral-600 shadow-[0_1px_2px_rgb(0_0_0/0.03)] hover:border-[#1f1f1f]/40 hover:text-[#1f1f1f] hover:shadow-sm"
            }
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span
          key={t}
          className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-600"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

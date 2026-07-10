"use client";

import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { Moon, Sun } from "@phosphor-icons/react";

/**
 * Knob de dark mode — sempre clicável, estado visual = tema real.
 */
export function ThemeToggle({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
      title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleTheme();
      }}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2",
        "transition-colors duration-200 select-none",
        "border-neutral-200 bg-neutral-50 hover:bg-neutral-100",
        "dark:border-zinc-700 dark:bg-zinc-800/80 dark:hover:bg-zinc-800",
        compact ? "h-9 justify-between px-2.5" : "h-11",
        className
      )}
    >
      {!compact && (
        <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-zinc-200">
          {isDark ? (
            <Moon size={16} weight="fill" className="shrink-0 text-sky-400" />
          ) : (
            <Sun size={16} weight="fill" className="shrink-0 text-amber-500" />
          )}
          <span className="truncate">
            {isDark ? "Modo escuro" : "Modo claro"}
          </span>
        </span>
      )}

      {/* Track + thumb — thumb sempre #fff real (não remapeado) */}
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200",
          isDark ? "bg-sky-500" : "bg-neutral-300 dark:bg-zinc-600",
          compact && "ml-auto"
        )}
      >
        <span
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-full shadow-md transition-transform duration-200 ease-out",
            "bg-[#ffffff]",
            isDark ? "translate-x-5" : "translate-x-0"
          )}
        >
          {isDark ? (
            <Moon size={12} weight="fill" className="text-sky-600" />
          ) : (
            <Sun size={12} weight="fill" className="text-amber-500" />
          )}
        </span>
      </span>
    </button>
  );
}

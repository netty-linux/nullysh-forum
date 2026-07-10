"use client";

import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Tamanho único dos FABs laterais */
export const FAB_SIZE_CLASS = "h-14 w-14";

const spring = {
  type: "spring" as const,
  stiffness: 380,
  damping: 24,
  mass: 0.65,
};

type Props = {
  children: ReactNode;
  label: string;
  title?: string;
  active?: boolean;
  className?: string;
  /** Conteúdo de fundo (ex.: foto Nullain) — sob o gloss */
  media?: ReactNode;
  onClick?: () => void;
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onClick" | "className" | "title" | "type"
>;

/**
 * Bolha FAB premium — profundidade, gloss e hover fluido (estilo product clean).
 */
export function FabShell({
  children,
  label,
  title,
  active = false,
  className,
  media,
  onClick,
  ...rest
}: Props) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={cn(
        "group/fab pointer-events-auto relative flex shrink-0 items-center justify-center",
        FAB_SIZE_CLASS,
        "isolate",
        className
      )}
      initial={false}
      whileHover={
        reduce
          ? undefined
          : {
              y: -6,
              scale: 1.08,
              transition: spring,
            }
      }
      whileTap={
        reduce
          ? undefined
          : {
              y: -1,
              scale: 0.94,
              transition: { type: "spring", stiffness: 500, damping: 28 },
            }
      }
    >
      {/* Halo externo suave (profundidade ambiente) */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-2.5 rounded-full",
          "bg-gradient-to-b from-black/15 via-black/20 to-black/35 blur-lg",
          "opacity-40 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "group-hover/fab:opacity-100 group-hover/fab:-inset-3 group-hover/fab:blur-xl",
          "dark:from-white/10 dark:via-black/30 dark:to-black/60"
        )}
      />

      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={title ?? label}
        className={cn(
          // no-press: evita scale global do button:active (conflita com spring)
          "no-press absolute inset-0 z-[1] flex items-center justify-center",
          "overflow-hidden rounded-full",
          "bg-[#0a0a0a] text-white",
          "ring-1 ring-white/10",
          "outline outline-2 outline-black/80 outline-offset-0",
          // profundidade multi-camada
          "shadow-[0_1px_0_0_rgb(255_255_255/0.16)_inset,0_-1px_0_0_rgb(0_0_0/0.35)_inset,0_2px_4px_rgb(0_0_0/0.2),0_8px_16px_-4px_rgb(0_0_0/0.45),0_20px_40px_-12px_rgb(0_0_0/0.55)]",
          "transition-[box-shadow,outline-color,ring-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "hover:shadow-[0_1px_0_0_rgb(255_255_255/0.22)_inset,0_-1px_0_0_rgb(0_0_0/0.3)_inset,0_4px_8px_rgb(0_0_0/0.18),0_14px_28px_-6px_rgb(0_0_0/0.5),0_32px_56px_-16px_rgb(0_0_0/0.55)]",
          "hover:ring-white/20",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
          "dark:ring-white/15 dark:hover:ring-white/25",
          active && "ring-white/25"
        )}
        {...rest}
      >
        {/* base / mídia */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-[#0a0a0a]"
        />
        {media ? (
          <span className="absolute inset-0 overflow-hidden rounded-full">
            {media}
          </span>
        ) : null}

        {/* vinheta lateral (volume esférico) */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-full",
            "bg-[radial-gradient(120%_100%_at_50%_0%,rgb(255_255_255/0.14)_0%,transparent_55%),radial-gradient(90%_80%_at_50%_100%,rgb(0_0_0/0.45)_0%,transparent_55%)]",
            "opacity-90 transition-opacity duration-300",
            "group-hover/fab:opacity-100"
          )}
        />

        {/* gloss superior — desliza levemente no hover */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-[14%] top-[8%] h-[42%] rounded-[100%]",
            "bg-gradient-to-b from-white/30 via-white/10 to-transparent",
            "opacity-80 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            "group-hover/fab:inset-x-[12%] group-hover/fab:top-[6%] group-hover/fab:h-[46%] group-hover/fab:opacity-100"
          )}
        />

        {/* brilho de borda (rim light) */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-full",
            "shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]",
            "transition-shadow duration-300",
            "group-hover/fab:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)]"
          )}
        />

        {/* conteúdo (ícone) */}
        <span
          className={cn(
            "relative z-[2] flex items-center justify-center",
            "transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            "group-hover/fab:scale-[1.08]",
            "group-active/fab:scale-95"
          )}
        >
          {children}
        </span>
      </button>
    </motion.div>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { CaretDown } from "@phosphor-icons/react";
import { useId, useState, type ReactNode } from "react";

type Props = {
  /** Título da categoria (ex.: Segurança) */
  title: string;
  /** Texto curto sob o título */
  description?: string;
  /** Abre por padrão na primeira visita */
  defaultOpen?: boolean;
  /** Badge opcional (ex.: VIP, contador) */
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Seção colapsável do Meu Perfil — agrupa campos por categoria
 * e permite minimizar para não alongar a página.
 */
export function ProfileSection({
  title,
  description,
  defaultOpen = false,
  badge,
  children,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const headerId = useId();

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-neutral-200/90 bg-white",
        "shadow-[0_1px_2px_rgb(0_0_0/0.03)]",
        "dark:border-zinc-800 dark:bg-[#141414]",
        className
      )}
    >
      <button
        type="button"
        id={headerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 sm:px-5",
          "hover:bg-neutral-50/80 dark:hover:bg-zinc-900/60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-100">
              {title}
            </span>
            {badge}
          </span>
          {description ? (
            <span className="mt-0.5 block text-[12px] leading-snug text-neutral-500 dark:text-zinc-400">
              {description}
            </span>
          ) : null}
        </span>
        <CaretDown
          size={18}
          weight="bold"
          className={cn(
            "shrink-0 text-neutral-400 transition-transform duration-200 ease-[var(--ease-out)]",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        hidden={!open}
        className={cn(
          "border-t border-neutral-100 dark:border-zinc-800",
          open && "block"
        )}
      >
        <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">{children}</div>
      </div>
    </section>
  );
}

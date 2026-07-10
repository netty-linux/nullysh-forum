"use client";

import { ProfileEmblem } from "@/components/profile-emblem";
import {
  emblemsByCategory,
  getEmblem,
  type EmblemId,
} from "@/lib/emblems";
import { cn } from "@/lib/utils";
import { CaretDown, SealCheck } from "@phosphor-icons/react";
import { useId, useState } from "react";

type Props = {
  unlocked: EmblemId[];
  equipped: EmblemId | null;
  onEquip: (id: EmblemId | null) => void;
  /** Começa expandido? Padrão: fechado (mais limpo no perfil). */
  defaultOpen?: boolean;
};

/**
 * Inventário de emblemas — colapsável.
 * Header sempre visível (equipado); grade abre/fecha no caret.
 */
export function EmblemPicker({
  unlocked,
  equipped,
  onEquip,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const unlockedSet = new Set(unlocked);
  const groups = emblemsByCategory();
  const eq = getEmblem(equipped);

  return (
    <div className="rounded-2xl border border-neutral-200/90 bg-white dark:border-zinc-800 dark:bg-[#141414]">
      {/* Header — sempre visível; clique no caret ou no título expande */}
      <div className="flex items-center gap-2 p-4 sm:px-5 sm:py-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="pressable flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left transition hover:opacity-90"
        >
          <SealCheck
            size={16}
            weight="fill"
            className="shrink-0 text-amber-500"
          />
          <span className="min-w-0 truncate text-[13px] font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-100">
            Emblemas e conquistas
          </span>
          {unlocked.length > 0 && (
            <span className="hidden shrink-0 text-[11px] font-medium tabular-nums text-neutral-400 sm:inline">
              {unlocked.length} liberado{unlocked.length === 1 ? "" : "s"}
            </span>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 dark:border-zinc-700 dark:bg-zinc-900 sm:px-3 sm:py-1.5">
            <span className="text-[11px] font-semibold text-neutral-500">
              Equipado
            </span>
            {eq ? (
              <>
                <ProfileEmblem id={eq.id} size={20} />
                <span className="hidden max-w-[7rem] truncate text-xs font-bold text-[#1f1f1f] dark:text-zinc-100 sm:inline">
                  {eq.name}
                </span>
              </>
            ) : (
              <span className="text-xs text-neutral-400">Nenhum</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Recolher emblemas" : "Expandir emblemas"}
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition",
              "hover:border-neutral-300 hover:bg-neutral-50 hover:text-[#1f1f1f]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
              "active:scale-[0.98] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
              open && "border-[#1f1f1f]/20 bg-neutral-50 dark:bg-zinc-800"
            )}
          >
            <CaretDown
              size={16}
              weight="bold"
              className={cn(
                "transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)]",
                open && "rotate-180"
              )}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {/* Painel colapsável */}
      <div
        id={panelId}
        hidden={!open}
        className={cn(
          "border-t border-neutral-100 px-4 pb-4 pt-3 dark:border-zinc-800 sm:px-5 sm:pb-5",
          !open && "hidden"
        )}
      >
        <div className="mb-3">
          <button
            type="button"
            onClick={() => onEquip(null)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
              equipped === null
                ? "border-[#1f1f1f] bg-[#1f1f1f] text-white"
                : "border-neutral-200 text-neutral-600 hover:border-neutral-400 dark:border-zinc-700 dark:text-zinc-300"
            )}
          >
            Não exibir emblema
          </button>
        </div>

        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.category}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                {g.label}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {g.items.map((item) => {
                  const has = unlockedSet.has(item.id);
                  const isEq = equipped === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!has}
                      onClick={() => {
                        if (!has) return;
                        onEquip(isEq ? null : item.id);
                      }}
                      title={
                        has
                          ? `${item.name} — ${item.description}`
                          : `Bloqueado: ${item.description}`
                      }
                      className={cn(
                        "flex flex-col items-center gap-1.5 overflow-visible rounded-xl border px-1.5 py-2.5 transition",
                        !has &&
                          "cursor-not-allowed opacity-40 grayscale dark:opacity-30",
                        has &&
                          !isEq &&
                          "border-neutral-200 bg-white hover:border-neutral-400 dark:border-zinc-700 dark:bg-zinc-900",
                        isEq &&
                          "border-[#1f1f1f] bg-neutral-50 ring-2 ring-[#1f1f1f]/15 dark:border-white dark:bg-zinc-800"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${item.src}?v=4`}
                        alt={item.name}
                        width={44}
                        height={44}
                        className="h-11 w-11 shrink-0 object-contain object-center"
                        draggable={false}
                      />
                      <span className="max-w-full truncate text-center text-[10px] font-semibold leading-tight text-[#1f1f1f] dark:text-zinc-200">
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

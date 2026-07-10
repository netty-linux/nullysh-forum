"use client";

import { ProfileEmblem } from "@/components/profile-emblem";
import {
  emblemsByCategory,
  getEmblem,
  type EmblemId,
} from "@/lib/emblems";
import { cn } from "@/lib/utils";
import { SealCheck } from "@phosphor-icons/react";

type Props = {
  unlocked: EmblemId[];
  equipped: EmblemId | null;
  onEquip: (id: EmblemId | null) => void;
};

/**
 * Inventário de emblemas — todos salvos; só 1 equipado no perfil.
 */
export function EmblemPicker({ unlocked, equipped, onEquip }: Props) {
  const unlockedSet = new Set(unlocked);
  const groups = emblemsByCategory();
  const eq = getEmblem(equipped);

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-200/90 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-[#141414]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-100">
            <SealCheck size={16} weight="fill" className="text-amber-500" />
            Emblemas e conquistas
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Todos ficam na conta. Escolha <strong>1</strong> para ficar fixo ao
            lado do @usuário no perfil.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
          <span className="text-[11px] font-semibold text-neutral-500">
            Equipado
          </span>
          {eq ? (
            <>
              <ProfileEmblem id={eq.id} size={22} />
              <span className="text-xs font-bold text-[#1f1f1f] dark:text-zinc-100">
                {eq.name}
              </span>
            </>
          ) : (
            <span className="text-xs text-neutral-400">Nenhum</span>
          )}
        </div>
      </div>

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

      <p className="text-[11px] text-neutral-400">
        Desbloqueados: {unlocked.length} · Toque em um emblema liberado para
        equipar.
      </p>
    </div>
  );
}

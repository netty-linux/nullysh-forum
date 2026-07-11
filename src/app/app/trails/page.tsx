"use client";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TagList } from "@/components/tag-chips";
import { useAuth } from "@/hooks/use-auth";
import { useProgressStore } from "@/lib/progress-store";
import { useTrailStore } from "@/lib/trail-store";
import {
  BookOpenText,
  CheckCircle,
  Lock,
  Path,
  PlayCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";

export default function TrailsPage() {
  const { user, isVip } = useAuth();
  const trails = useTrailStore((s) => s.trails);
  const trailsProgress = useProgressStore((s) => s.trails);
  const [filter, setFilter] = useState<"all" | "mine">("all");

  const list = useMemo(() => {
    if (filter === "mine" && user) {
      const ids = new Set(trailsProgress.map((t) => t.trailId));
      return trails.filter((t) => ids.has(t.id));
    }
    return trails;
  }, [filter, trailsProgress, trails, user]);

  return (
    <div className="app-page mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Path size={22} weight="bold" className="text-[#1f1f1f]" />
          <h1 className="text-2xl font-semibold tracking-tight text-[#1f1f1f] sm:text-3xl">
            Trilha de aprendizado
          </h1>
        </div>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-neutral-500">
          Caminhos guiados publicados pelo staff. Free e VIP conforme cada
          trilha.
        </p>
      </div>

      {trails.length > 0 && (
        <div className="mb-5 flex gap-2">
          {(
            [
              ["all", "Todas"],
              ["mine", "Em andamento"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={
                filter === key
                  ? "chip rounded-full bg-[#1f1f1f] px-4 py-2 text-sm font-semibold text-white"
                  : "chip rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-600"
              }
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {list.map((trail) => {
          const progress = trailsProgress.find((t) => t.trailId === trail.id);
          const done = progress?.completedStepIds.length ?? 0;
          const total = trail.steps.length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          const locked = trail.vipOnly && !isVip;

          return (
            <Link
              key={trail.id}
              href={locked ? "/pricing" : `/app/trails/${trail.id}`}
              className="card-interactive block min-w-0 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-6"
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className="min-w-0 max-w-full break-words text-base font-semibold tracking-tight text-[#1f1f1f] [overflow-wrap:anywhere] sm:text-lg">
                      {trail.title}
                    </h2>
                    {trail.vipOnly && (
                      <Badge variant="vip">
                        {locked ? (
                          <>
                            <Lock
                              size={10}
                              weight="bold"
                              className="mr-0.5"
                            />
                            VIP
                          </>
                        ) : (
                          "VIP"
                        )}
                      </Badge>
                    )}
                    {!trail.vipOnly && (
                      <Badge variant="outline">Free</Badge>
                    )}
                    <Badge variant="outline" className="capitalize">
                      {trail.level}
                    </Badge>
                  </div>
                  <p className="mt-1.5 max-w-full break-words text-sm leading-relaxed text-neutral-600 [overflow-wrap:anywhere]">
                    {trail.description}
                  </p>
                  {trail.interestTags.length > 0 && (
                    <div className="mt-3 min-w-0">
                      <TagList tags={trail.interestTags} />
                    </div>
                  )}
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-[#1f1f1f]">
                  {locked ? (
                    <Lock size={20} weight="bold" />
                  ) : done === total && total > 0 ? (
                    <CheckCircle
                      size={22}
                      weight="fill"
                      className="text-emerald-600"
                    />
                  ) : (
                    <BookOpenText size={20} weight="fill" />
                  )}
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-neutral-400">
                  <span>
                    {done}/{total} etapas
                  </span>
                  <span className="tabular-nums">{pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full bg-[#1f1f1f] transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}

        {list.length === 0 && (
          <EmptyState
            icon={<Path size={28} weight="duotone" />}
            title={
              filter === "mine"
                ? "Nenhuma trilha em andamento"
                : "Nenhuma trilha publicada"
            }
            description={
              filter === "mine"
                ? "Escolha uma trilha e marque as etapas para acompanhar o progresso."
                : "O staff ainda não publicou trilhas. Volte em breve."
            }
            action={
              filter === "mine" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFilter("all")}
                >
                  Ver todas
                </Button>
              ) : undefined
            }
          />
        )}
      </div>

      {trails.length > 0 && (
        <div className="mt-8 flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
          <PlayCircle
            size={20}
            weight="fill"
            className="shrink-0 text-[#1f1f1f]"
          />
          <p>
            Dica: preencha{" "}
            <Link href="/app/profile" className="font-semibold underline">
              interesses e objetivos
            </Link>{" "}
            no perfil para combinar com mentorias e eventos.
          </p>
        </div>
      )}
    </div>
  );
}

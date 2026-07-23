"use client";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TagList } from "@/components/tag-chips";
import { useAuth } from "@/hooks/use-auth";
import { useProgressStore } from "@/lib/progress-store";
import { stripHtml } from "@/lib/trail-html";
import { hydrateTrailsFromServer, useTrailStore } from "@/lib/trail-store";
import type { LearningTrail } from "@/lib/catalog";
import {
  ArrowRight,
  BookOpenText,
  CheckCircle,
  CrownSimple,
  Flame,
  GraduationCap,
  Lock,
  MagnifyingGlass,
  Path,
  Play,
  PlayCircle,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type FilterTab = "all" | "mine" | "iniciante" | "intermediario" | "avancado" | "vip";

export default function TrailsPage() {
  const { user, isVip } = useAuth();
  const trails = useTrailStore((s) => s.trails);
  const trailsProgress = useProgressStore((s) => s.trails);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  useEffect(() => {
    void hydrateTrailsFromServer();
  }, []);

  // Set of trail IDs user has progress in
  const userProgressMap = useMemo(() => {
    const map = new Map<string, { done: number; total: number; pct: number }>();
    for (const p of trailsProgress) {
      const trail = trails.find((t) => t.id === p.trailId);
      if (trail) {
        const done = p.completedStepIds.length;
        const total = trail.steps.length;
        const pct = total ? Math.round((done / total) * 100) : 0;
        map.set(trail.id, { done, total, pct });
      }
    }
    return map;
  }, [trailsProgress, trails]);

  // Featured Hero Trail (Trail in progress or top featured)
  const featuredTrail = useMemo(() => {
    if (trails.length === 0) return null;
    // Prefer trail in progress
    const inProgress = trails.find((t) => {
      const p = userProgressMap.get(t.id);
      return p && p.pct > 0 && p.pct < 100;
    });
    return inProgress || trails[0];
  }, [trails, userProgressMap]);

  // Filtered trails list
  const filteredTrails = useMemo(() => {
    return trails.filter((t) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stripHtml(t.description).toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.interestTags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (activeTab === "mine") {
        return userProgressMap.has(t.id);
      }
      if (activeTab === "iniciante") return t.level === "iniciante";
      if (activeTab === "intermediario") return t.level === "intermediário";
      if (activeTab === "avancado") return t.level === "avançado";
      if (activeTab === "vip") return t.vipOnly;

      return true;
    });
  }, [trails, searchQuery, activeTab, userProgressMap]);

  const featuredProgress = featuredTrail ? userProgressMap.get(featuredTrail.id) : null;
  const featuredLocked = featuredTrail ? featuredTrail.vipOnly && !isVip : false;

  return (
    <div className="app-page mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Header section */}
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1 text-[12px] font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 mb-3">
            <GraduationCap size={15} weight="fill" />
            Plataforma de Aprendizado & Cursos
          </div>
          <h1 className="font-display text-[1.75rem] font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-50 sm:text-[2.25rem]">
            Trilhas de Aprendizado
          </h1>
          <p className="mt-2 max-w-[55ch] text-[14px] leading-relaxed text-neutral-500 dark:text-zinc-400">
            Cursos estruturados, aulas práticas e materiais do staff. Escolha seu caminho de conhecimento e acompanhe sua evolução em tempo real.
          </p>
        </div>
      </div>

      {/* Featured Netflix-Style Hero Banner */}
      {!searchQuery && activeTab === "all" && featuredTrail && (
        <section className="mb-10">
          <div className="group relative min-h-[260px] overflow-hidden rounded-3xl border border-neutral-800/80 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-800 p-6 text-white shadow-xl dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900 sm:p-8">
            {/* Subtle background glow effect */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />

            <div className="relative z-10 flex flex-col justify-between h-full min-h-[220px]">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-300 border border-amber-500/30">
                    {featuredProgress && featuredProgress.pct > 0 && featuredProgress.pct < 100 ? (
                      <>
                        <PlayCircle size={13} weight="fill" /> Continue assistindo
                      </>
                    ) : (
                      <>
                        <Flame size={13} weight="fill" /> Trilha em Destaque
                      </>
                    )}
                  </span>
                  {featuredTrail.vipOnly && (
                    <Badge variant="vip" className="bg-amber-500 text-neutral-950">
                      VIP
                    </Badge>
                  )}
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs capitalize text-neutral-200 backdrop-blur-sm">
                    Level: {featuredTrail.level}
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-neutral-200 backdrop-blur-sm">
                    {featuredTrail.steps.length} {featuredTrail.steps.length === 1 ? "etapa" : "etapas"}
                  </span>
                </div>

                <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl md:text-3xl max-w-3xl">
                  {featuredTrail.title}
                </h2>
                <p className="mt-2.5 line-clamp-2 max-w-2xl text-xs sm:text-sm leading-relaxed text-neutral-300">
                  {stripHtml(featuredTrail.description)}
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-white/10">
                {/* Progress bar if available */}
                {featuredProgress && (
                  <div className="flex-1 max-w-xs">
                    <div className="mb-1 flex justify-between text-[11px] text-neutral-300 font-medium">
                      <span>{featuredProgress.done}/{featuredProgress.total} etapas concluídas</span>
                      <span>{featuredProgress.pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                      <div
                        className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                        style={{ width: `${featuredProgress.pct}%` }}
                      />
                    </div>
                  </div>
                )}

                <Link href={featuredLocked ? "/pricing" : `/app/trails/${featuredTrail.id}`}>
                  <Button
                    type="button"
                    className="h-11 rounded-full bg-white px-6 font-semibold text-neutral-950 transition-all hover:bg-neutral-100 hover:scale-[1.02] active:scale-[0.98] shadow-md dark:bg-zinc-100 dark:text-neutral-900"
                  >
                    <Play size={16} weight="fill" className="mr-1.5 text-neutral-950 dark:text-neutral-900" />
                    {featuredLocked
                      ? "Desbloquear com VIP"
                      : featuredProgress && featuredProgress.pct > 0
                      ? "Continuar Aprendizado"
                      : "Começar Trilha"}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Toolbar: Search and Filter Tabs */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-zinc-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por curso, aula ou interesse..."
            className="h-11 w-full rounded-2xl border border-neutral-200 bg-white pl-10 pr-9 text-sm text-[#1f1f1f] placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-zinc-800 dark:bg-[#141414] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-700 dark:focus:ring-zinc-100/10 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
              activeTab === "all"
                ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            Todas ({trails.length})
          </button>

          {user && (
            <button
              type="button"
              onClick={() => setActiveTab("mine")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
                activeTab === "mine"
                  ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                  : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <PlayCircle size={14} weight="fill" className="text-emerald-500" />
              Em Andamento
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab("iniciante")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
              activeTab === "iniciante"
                ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            Iniciante
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("intermediario")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
              activeTab === "intermediario"
                ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            Intermediário
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("avancado")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
              activeTab === "avancado"
                ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            Avançado
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("vip")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
              activeTab === "vip"
                ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            <CrownSimple size={14} weight="fill" className="text-amber-500" />
            VIP
          </button>
        </div>
      </div>

      {/* Netflix-Style Trail Grid */}
      {filteredTrails.length === 0 ? (
        <EmptyState
          icon={<Path size={28} weight="duotone" />}
          title={
            searchQuery
              ? `Nenhuma trilha encontrada para "${searchQuery}"`
              : activeTab === "mine"
              ? "Nenhuma trilha em andamento"
              : "Nenhuma trilha encontrada"
          }
          description={
            searchQuery
              ? "Tente verificar a ortografia ou buscar por outros termos."
              : activeTab === "mine"
              ? "Escolha uma trilha da lista e marque as etapas para acompanhar seu aprendizado."
              : "O staff ainda não publicou trilhas nesta categoria."
          }
          action={
            searchQuery || activeTab !== "all" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setActiveTab("all");
                }}
              >
                Ver todas as trilhas
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTrails.map((trail) => {
            const prog = userProgressMap.get(trail.id);
            const done = prog?.done ?? 0;
            const total = trail.steps.length;
            const pct = prog?.pct ?? 0;
            const locked = trail.vipOnly && !isVip;

            return (
              <TrailNetflixCard
                key={trail.id}
                trail={trail}
                done={done}
                total={total}
                pct={pct}
                locked={locked}
              />
            );
          })}
        </div>
      )}

      {/* Footer Dica / Profile Matching Banner */}
      {trails.length > 0 && (
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 bg-neutral-50/80 p-5 dark:border-zinc-800/80 dark:bg-[#141414]/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white dark:bg-zinc-100 dark:text-neutral-900">
              <Sparkle size={20} weight="fill" />
            </div>
            <div>
              <h4 className="font-display text-sm font-semibold text-[#1f1f1f] dark:text-zinc-100">
                Personalize suas recomendações
              </h4>
              <p className="text-xs text-neutral-500 dark:text-zinc-400">
                Preencha seus objetivos e áreas de interesse no perfil para receber recomendações de mentorias e eventos.
              </p>
            </div>
          </div>
          <Link href="/app/profile" className="shrink-0">
            <Button variant="outline" size="sm" className="rounded-full">
              Editar interesses <ArrowRight size={13} className="ml-1" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

/** Card Estilo Netflix / Streaming de Cursos */
function TrailNetflixCard({
  trail,
  done,
  total,
  pct,
  locked,
}: {
  trail: LearningTrail;
  done: number;
  total: number;
  pct: number;
  locked: boolean;
}) {
  return (
    <Link
      href={locked ? "/pricing" : `/app/trails/${trail.id}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-neutral-300 hover:shadow-md dark:border-zinc-800 dark:bg-[#141414] dark:hover:border-zinc-700"
    >
      <div>
        {/* Cover / Header Area */}
        <div className="flex items-start justify-between gap-3">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-900 transition-transform duration-200 group-hover:scale-105 dark:bg-zinc-800 dark:text-zinc-100">
            {locked ? (
              <Lock size={20} weight="bold" />
            ) : done === total && total > 0 ? (
              <CheckCircle size={22} weight="fill" className="text-emerald-500" />
            ) : (
              <BookOpenText size={20} weight="fill" />
            )}
            
            {/* Play hover badge */}
            {!locked && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-neutral-900/80 text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-zinc-100/90 dark:text-neutral-900">
                <Play size={18} weight="fill" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {trail.vipOnly ? (
              <Badge variant="vip" className="text-[10px]">
                {locked && <Lock size={10} weight="bold" className="mr-1" />}
                VIP
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">Free</Badge>
            )}
            <Badge variant="outline" className="text-[10px] capitalize">
              {trail.level}
            </Badge>
          </div>
        </div>

        {/* Title and Description */}
        <h3 className="mt-4 font-display text-base font-semibold tracking-tight text-[#1f1f1f] group-hover:text-amber-600 dark:text-zinc-50 dark:group-hover:text-amber-400 transition-colors">
          {trail.title}
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-600 dark:text-zinc-400 line-clamp-2">
          {stripHtml(trail.description)}
        </p>

        {trail.interestTags.length > 0 && (
          <div className="mt-3">
            <TagList tags={trail.interestTags} />
          </div>
        )}
      </div>

      {/* Progress Footer */}
      <div className="mt-5 pt-3 border-t border-neutral-100 dark:border-zinc-800/80">
        <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-neutral-500 dark:text-zinc-400">
          <span>{total} {total === 1 ? "etapa" : "etapas"}</span>
          {pct > 0 && <span className="tabular-nums font-semibold text-neutral-800 dark:text-zinc-200">{pct}% concluído</span>}
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              pct === 100 ? "bg-emerald-500" : "bg-[#1f1f1f] dark:bg-zinc-100"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

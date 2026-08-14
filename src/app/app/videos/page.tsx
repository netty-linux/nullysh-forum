"use client";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VipBadge } from "@/components/vip-gate";
import { useAuth } from "@/hooks/use-auth";
import { fetchVideos, videoStreamUrl, videoThumbUrl } from "@/lib/videos/client";
import type { VideoPublic } from "@/lib/videos/types";
import { formatDate } from "@/lib/utils";
import {
  CrownSimple,
  FilmStrip,
  Flame,
  Lock,
  MagnifyingGlass,
  Play,
  PlayCircle,
  Sparkle,
  SpinnerGap,
  Television,
  TrendUp,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

function VideoPlayer({ id, title }: { id: string; title: string }) {
  const [error, setError] = useState<string | null>(null);
  const src = videoStreamUrl(id);

  return (
    <div className="relative h-full w-full bg-black">
      <video
        key={id}
        className="h-full w-full object-contain"
        controls
        autoPlay
        playsInline
        preload="auto"
        src={src}
        onError={async () => {
          try {
            const res = await fetch(src, { method: "GET", headers: { Range: "bytes=0-1" } });
            if (!res.ok) {
              const data = (await res.json().catch(() => null)) as {
                error?: string;
              } | null;
              setError(
                data?.error ||
                  `Não foi possível carregar o vídeo (HTTP ${res.status}). Reenvie pelo Painel ADM.`
              );
            } else {
              setError(
                "O navegador não conseguiu decodificar o vídeo. Tente reenviar em MP4 (H.264)."
              );
            }
          } catch {
            setError(
              "Falha ao carregar o stream. Reenvie o vídeo pelo Painel ADM."
            );
          }
        }}
      >
        Seu navegador não suporta vídeo HTML5.
      </video>
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-6 text-center">
          <p className="max-w-md text-[13px] leading-relaxed text-white/90 font-medium">
            {error}
          </p>
          <span className="sr-only">{title}</span>
        </div>
      )}
    </div>
  );
}

function VideosPageInner() {
  const { isVip } = useAuth();
  const searchParams = useSearchParams();
  const focusId = searchParams.get("id");

  const [category, setCategory] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [videos, setVideos] = useState<VideoPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<VideoPublic | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchVideos();
        if (cancelled) return;
        setVideos(res.videos || []);
      } catch {
        if (!cancelled) setVideos([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set(videos.map((v) => v.category).filter(Boolean));
    return ["Todos", ...Array.from(set)];
  }, [videos]);

  // Featured top video for Netflix Billboard
  const featuredVideo = useMemo(() => {
    if (videos.length === 0) return null;
    const sorted = [...videos].sort((a, b) => b.views - a.views);
    return sorted[0];
  }, [videos]);

  // Filtered list by category and search
  const filteredList = useMemo(() => {
    return videos.filter((v) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.category && v.category.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;
      if (category !== "Todos" && v.category !== category) return false;

      return true;
    });
  }, [videos, searchQuery, category]);

  // Handle deep-link focus
  useEffect(() => {
    if (!focusId) return;
    queueMicrotask(() => setCategory("Todos"));
    const t = window.setTimeout(() => {
      document
        .getElementById(`video-${focusId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      const v = videos.find((x) => x.id === focusId);
      if (v && !(v.vipOnly && !isVip)) {
        setPlaying(v);
      }
    }, 280);
    return () => window.clearTimeout(t);
  }, [focusId, videos, isVip]);

  // Close player modal on Escape
  useEffect(() => {
    if (!playing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPlaying(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);

  const featuredLocked = featuredVideo ? featuredVideo.vipOnly && !isVip : false;

  return (
    <div className="app-page mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Header section */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-200/80 bg-rose-50/80 px-3 py-1 text-[12px] font-semibold text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 mb-3">
            <Television size={15} weight="fill" />
            Nullysh Streaming & Área de Membros
          </div>
          <h1 className="font-display text-[1.75rem] font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-50 sm:text-[2.25rem]">
            Vídeos & Conteúdos Originais
          </h1>
          <p className="mt-2 max-w-[55ch] text-[14px] leading-relaxed text-neutral-500 dark:text-zinc-400">
            Aulas completas, tutoriais práticos, bastidores e tours da metodologia Nullysh em formato de streaming.
          </p>
        </div>
      </div>

      {/* Netflix Hero Billboard */}
      {!loading && !searchQuery && category === "Todos" && featuredVideo && (
        <section className="mb-10">
          <div className="group relative min-h-[300px] overflow-hidden rounded-3xl border border-neutral-800/80 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-800 p-6 text-white shadow-2xl dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900 sm:p-8 md:p-10">
            {/* Background Thumbnail with dark gradient overlay */}
            {featuredVideo.hasThumb && (
              <div className="absolute inset-0 z-0 opacity-40 transition-opacity duration-500 group-hover:opacity-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={videoThumbUrl(featuredVideo.id, featuredVideo.thumbRev)}
                  alt=""
                  className="h-full w-full object-cover object-center blur-[1px]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent" />
              </div>
            )}

            <div className="relative z-10 flex flex-col justify-between h-full min-h-[240px]">
              <div className="space-y-3 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-300 border border-rose-500/30">
                    <Flame size={13} weight="fill" /> Em Destaque no Cinema
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-neutral-200 backdrop-blur-sm">
                    {featuredVideo.category}
                  </span>
                  {featuredVideo.vipOnly && (
                    <Badge variant="vip" className="bg-amber-400 text-neutral-950">
                      VIP
                    </Badge>
                  )}
                  <span className="text-xs text-neutral-300 font-mono">
                    {featuredVideo.duration}
                  </span>
                </div>

                <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl drop-shadow-sm">
                  {featuredVideo.title}
                </h2>
                <p className="line-clamp-2 text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-2xl">
                  {featuredVideo.description}
                </p>

                <div className="flex items-center gap-4 text-xs text-neutral-300 pt-1 font-medium">
                  <span className="flex items-center gap-1">
                    <TrendUp size={14} className="text-rose-400" />
                    <strong className="text-white">{featuredVideo.views.toLocaleString("pt-BR")}</strong> visualizações
                  </span>
                  <span>· Publicado em {formatDate(featuredVideo.createdAt)}</span>
                </div>
              </div>

              <div className="mt-6 pt-4">
                {featuredLocked ? (
                  <Link href="/pricing">
                    <Button className="h-11 rounded-full bg-amber-400 px-7 font-semibold text-neutral-950 transition-all hover:bg-amber-300 hover:scale-[1.02] shadow-lg">
                      <Lock size={18} weight="bold" className="mr-2" />
                      Desbloquear com VIP
                    </Button>
                  </Link>
                ) : (
                  <Button
                    onClick={() => setPlaying(featuredVideo)}
                    className="h-12 rounded-full bg-white px-8 font-semibold text-neutral-950 transition-all hover:bg-neutral-100 hover:scale-[1.03] active:scale-[0.98] shadow-xl dark:bg-zinc-100 dark:text-neutral-900"
                  >
                    <Play size={20} weight="fill" className="mr-2 text-neutral-950 dark:text-neutral-900" />
                    Assistir Agora
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Toolbar: Search and Category Pills */}
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
            placeholder="Buscar por título, aula ou categoria..."
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

        {/* Category Pills */}
        {categories.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
                  category === c
                    ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                    : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {c === "Todos" ? `Todos (${videos.length})` : c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Video Catalog */}
      {loading ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-neutral-400">
          <SpinnerGap size={28} className="animate-spin text-[#1f1f1f] dark:text-zinc-100" />
          Carregando catálogo de vídeos…
        </div>
      ) : filteredList.length === 0 ? (
        <EmptyState
          icon={<FilmStrip size={28} weight="duotone" />}
          title={
            searchQuery
              ? `Nenhum vídeo encontrado para "${searchQuery}"`
              : "Nenhum vídeo publicado ainda"
          }
          description={
            searchQuery
              ? "Tente verificar a ortografia ou limpar os filtros de busca."
              : "O staff publicará novos vídeos, aulas e tutoriais em breve."
          }
          action={
            searchQuery || category !== "Todos" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setCategory("Todos");
                }}
              >
                Limpar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredList.map((v) => {
            const locked = v.vipOnly && !isVip;
            const focused = focusId === v.id;

            const CardContent = (
              <article
                id={`video-${v.id}`}
                className={
                  focused
                    ? "group relative flex h-full flex-col overflow-hidden rounded-2xl border-2 border-rose-500 bg-white shadow-lg ring-2 ring-rose-300/50 dark:bg-[#141414] transition-all duration-200"
                    : "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-neutral-300 hover:shadow-md dark:border-zinc-800 dark:bg-[#141414] dark:hover:border-zinc-700"
                }
              >
                {/* Aspect-video Thumbnail Container */}
                <div className="relative aspect-video w-full overflow-hidden bg-neutral-900">
                  {v.hasThumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={`thumb-${v.id}-${v.thumbRev || "0"}`}
                      src={videoThumbUrl(v.id, v.thumbRev)}
                      alt={v.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        const el = e.currentTarget;
                        el.style.display = "none";
                        const sib = el.nextElementSibling as HTMLElement | null;
                        if (sib) sib.hidden = false;
                      }}
                    />
                  ) : null}

                  {/* Fallback pattern when thumbnail is missing */}
                  <div
                    hidden={!!v.hasThumb}
                    className="absolute inset-0 flex items-center justify-center bg-neutral-900"
                  >
                    <div className="absolute inset-0 hero-grid opacity-30" />
                    <span className="relative font-mono text-4xl font-bold text-neutral-600">
                      {v.thumbnail && v.thumbnail !== "R2" ? v.thumbnail : "▶"}
                    </span>
                  </div>

                  {/* Play overlay on hover */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/40">
                    <div className="inline-flex h-12 w-12 scale-90 items-center justify-center rounded-full bg-white text-neutral-950 shadow-2xl transition-transform duration-300 group-hover:scale-100 dark:bg-zinc-100">
                      {locked ? (
                        <Lock size={18} weight="bold" className="text-neutral-950" />
                      ) : (
                        <Play size={20} weight="fill" className="ml-0.5 text-neutral-950" />
                      )}
                    </div>
                  </div>

                  {/* Duration Badge */}
                  {v.duration && (
                    <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/80 px-2 py-0.5 font-mono text-[11px] font-bold text-white backdrop-blur-sm">
                      {v.duration}
                    </span>
                  )}
                </div>

                {/* Video Info */}
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-zinc-400">
                        {v.category}
                      </span>
                      {v.vipOnly && <VipBadge />}
                    </div>

                    <h3 className="mt-2 font-display text-base font-semibold leading-snug tracking-tight text-[#1f1f1f] group-hover:text-rose-600 dark:text-zinc-50 dark:group-hover:text-rose-400 transition-colors line-clamp-2">
                      {v.title}
                    </h3>

                    <p className="mt-1.5 text-xs leading-relaxed text-neutral-600 dark:text-zinc-400 line-clamp-2">
                      {v.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] font-medium text-neutral-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <TrendUp size={13} className="text-rose-500" />
                      {v.views.toLocaleString("pt-BR")} views
                    </span>
                    <span>{formatDate(v.createdAt)}</span>
                  </div>
                </div>
              </article>
            );

            if (locked) {
              return (
                <Link key={v.id} href="/pricing" className="block h-full">
                  {CardContent}
                </Link>
              );
            }

            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setPlaying(v)}
                className="block h-full text-left"
              >
                {CardContent}
              </button>
            );
          })}
        </div>
      )}

      {/* Lightbox Cinema Video Player Modal */}
      {playing && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in"
          role="dialog"
          aria-modal
          aria-label={playing.title}
          onClick={() => setPlaying(null)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a] shadow-[0_25px_60px_-15px_rgb(0_0_0/0.8)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 bg-neutral-900/50">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                    {playing.category}
                  </span>
                  {playing.duration && (
                    <span className="text-xs text-white/50 font-mono">
                      · {playing.duration}
                    </span>
                  )}
                </div>
                <h3 className="truncate font-display text-base font-semibold text-white mt-0.5">
                  {playing.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setPlaying(null)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="Fechar"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            {/* Video Stream Container */}
            <div className="aspect-video w-full bg-black">
              <VideoPlayer id={playing.id} title={playing.title} />
            </div>

            {/* Description footer */}
            {playing.description && (
              <div className="p-5 border-t border-white/10 bg-neutral-950">
                <p className="text-xs sm:text-sm leading-relaxed text-white/80">
                  {playing.description}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VideosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-neutral-400">
          Carregando cinema Nullysh…
        </div>
      }
    >
      <VideosPageInner />
    </Suspense>
  );
}


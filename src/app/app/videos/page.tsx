"use client";

import { EmptyState } from "@/components/empty-state";
import { VipBadge } from "@/components/vip-gate";
import { useAuth } from "@/hooks/use-auth";
import { fetchVideos, videoStreamUrl, videoThumbUrl } from "@/lib/videos/client";
import type { VideoPublic } from "@/lib/videos/types";
import { formatDate } from "@/lib/utils";
import { FilmStrip, Lock, Play, SpinnerGap, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

function VideoPlayer({ id, title }: { id: string; title: string }) {
  const [error, setError] = useState<string | null>(null);
  const src = videoStreamUrl(id);

  return (
    <div className="relative h-full w-full">
      <video
        key={id}
        className="h-full w-full"
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
              "Falha ao carregar o stream. Reenvie o vídeo pelo Painel ADM (gera cópia local)."
            );
          }
        }}
      >
        Seu navegador não suporta vídeo HTML5.
      </video>
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center">
          <p className="max-w-md text-[13px] leading-relaxed text-white/90">
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

  const list = useMemo(
    () =>
      category === "Todos"
        ? videos
        : videos.filter((v) => v.category === category),
    [category, videos]
  );

  useEffect(() => {
    if (!focusId) return;
    setCategory("Todos");
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

  // Fecha player com Escape
  useEffect(() => {
    if (!playing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPlaying(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);

  return (
    <div className="app-page mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Vídeos
        </h1>
        <p className="mt-2 text-base text-neutral-600 dark:text-zinc-400">
          Tutoriais, aulas e tours da metodologia Nullysh.
        </p>
      </div>

      {categories.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={
                category === c
                  ? "chip rounded-full bg-[#1f1f1f] px-3 py-1.5 text-xs font-medium text-white shadow-sm"
                  : "chip rounded-full bg-white px-3 py-1.5 text-xs font-medium text-neutral-500 ring-1 ring-neutral-200 hover:text-[#1f1f1f] dark:bg-zinc-900 dark:ring-zinc-700"
              }
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2 text-sm text-neutral-400">
          <SpinnerGap size={24} className="animate-spin" />
          Carregando vídeos…
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<FilmStrip size={28} weight="duotone" />}
          title="Nenhum vídeo publicado"
          description="Quando o admin subir vídeos pelo Painel ADM, eles aparecem aqui."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((v) => {
            const locked = v.vipOnly && !isVip;
            const focused = focusId === v.id;
            const Card = (
              <article
                id={`video-${v.id}`}
                className={
                  focused
                    ? "card-interactive group flex h-full scroll-mt-24 flex-col overflow-hidden rounded-2xl border-2 border-rose-400 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-2 ring-rose-300/50 dark:bg-[#141414]"
                    : "card-interactive group flex h-full scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:border-zinc-700 dark:bg-[#141414]"
                }
              >
                <div className="relative flex aspect-video items-center justify-center overflow-hidden border-b border-neutral-100 bg-neutral-100 dark:border-zinc-800 dark:bg-zinc-900">
                  {v.hasThumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={videoThumbUrl(v.id)}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <>
                      <div className="absolute inset-0 hero-grid opacity-50" />
                      <span className="relative font-mono text-4xl font-bold tabular-nums text-neutral-300">
                        {v.thumbnail || "▶"}
                      </span>
                    </>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/25">
                    <span className="inline-flex h-12 w-12 scale-90 items-center justify-center rounded-full bg-[#1f1f1f] text-white opacity-90 shadow-lg transition-transform duration-300 group-hover:scale-100 group-hover:opacity-100">
                      {locked ? (
                        <Lock size={18} weight="bold" />
                      ) : (
                        <Play size={18} weight="fill" className="ml-0.5" />
                      )}
                    </span>
                  </div>
                  <span className="absolute bottom-2 right-2 rounded-md bg-[#1f1f1f] px-2 py-0.5 text-[10px] font-bold tabular-nums text-white">
                    {v.duration}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                      {v.category}
                    </span>
                    {v.vipOnly && <VipBadge />}
                  </div>
                  <h2 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-black dark:text-zinc-50">
                    {v.title}
                  </h2>
                  <p className="mt-1.5 line-clamp-3 flex-1 text-xs leading-relaxed text-neutral-600 dark:text-zinc-400">
                    {v.description}
                  </p>
                  <p className="mt-3 text-[11px] font-medium tabular-nums text-neutral-500">
                    {v.views.toLocaleString("pt-BR")} views ·{" "}
                    {formatDate(v.createdAt)}
                  </p>
                </div>
              </article>
            );

            if (locked) {
              return (
                <Link key={v.id} href="/pricing">
                  {Card}
                </Link>
              );
            }

            return (
              <button
                key={v.id}
                type="button"
                className="text-left"
                onClick={() => setPlaying(v)}
              >
                {Card}
              </button>
            );
          })}
        </div>
      )}

      {/* Player modal */}
      {playing && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal
          aria-label={playing.title}
          onClick={() => setPlaying(null)}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0c] shadow-[0_20px_50px_-16px_rgb(0_0_0/0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-white">
                  {playing.title}
                </p>
                <p className="truncate text-[12px] text-white/50">
                  {playing.category} · {playing.duration}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlaying(null)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Fechar"
              >
                <X size={16} weight="bold" />
              </button>
            </div>
            <div className="aspect-video bg-black">
              <VideoPlayer id={playing.id} title={playing.title} />
            </div>
            {playing.description && (
              <p className="px-4 py-3 text-[13px] leading-relaxed text-white/70">
                {playing.description}
              </p>
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
          Carregando vídeos…
        </div>
      }
    >
      <VideosPageInner />
    </Suspense>
  );
}

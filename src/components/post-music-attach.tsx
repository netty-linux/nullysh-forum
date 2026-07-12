"use client";

/**
 * Seletor de música no compose (estilo Instagram).
 * Cole link YouTube / Spotify / SoundCloud + define o início do trecho.
 */

import { MusicPlatformIcon } from "@/components/music-platform-icon";
import {
  MUSIC_PLATFORM_META,
  isValidMusicUrl,
  type MusicMetaResult,
} from "@/lib/music";
import {
  POST_MUSIC_CLIP_DEFAULT,
  POST_MUSIC_START_MAX,
  clampPostMusicClip,
  clampPostMusicStart,
} from "@/lib/post-music";
import type { PostMusic } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  MagnifyingGlass,
  MusicNotes,
  SpinnerGap,
  X,
} from "@phosphor-icons/react";
import { useState } from "react";

type Props = {
  value: PostMusic | null;
  onChange: (m: PostMusic | null) => void;
  className?: string;
};

export function PostMusicAttach({ value, onChange, className }: Props) {
  const [url, setUrl] = useState("");
  const [startAt, setStartAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function resolve() {
    setError("");
    const raw = url.trim();
    if (!raw) {
      setError("Cole o link da música.");
      return;
    }
    if (!isValidMusicUrl(raw)) {
      setError("Use Spotify, YouTube ou SoundCloud.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/music/meta?url=${encodeURIComponent(raw)}`
      );
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        data?: MusicMetaResult;
      };
      if (!res.ok || !data.ok || !data.data) {
        throw new Error(data.error || "Não foi possível ler a faixa.");
      }
      const meta = data.data;
      const music: PostMusic = {
        title: meta.title || "Faixa",
        artist: meta.artist || "",
        url: meta.canonicalUrl || raw,
        platform: meta.platform,
        thumbnailUrl: meta.thumbnailUrl,
        embedUrl: meta.embedUrl,
        startAtSec: clampPostMusicStart(startAt),
        clipDurationSec: POST_MUSIC_CLIP_DEFAULT,
      };
      onChange(music);
      setUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao buscar música.");
    } finally {
      setLoading(false);
    }
  }

  if (value) {
    return (
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-2xl border border-neutral-200 bg-neutral-50 p-2.5",
          "dark:border-zinc-700 dark:bg-zinc-900",
          className
        )}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#1f1f1f] text-white">
          {value.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <MusicNotes size={18} weight="fill" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-[#1f1f1f] dark:text-zinc-100">
            <MusicPlatformIcon platform={value.platform} size={12} />
            {value.title}
          </p>
          <p className="truncate text-[11px] text-neutral-500">
            {value.artist ||
              (MUSIC_PLATFORM_META[value.platform as keyof typeof MUSIC_PLATFORM_META]
                ?.label ?? "Música")}
            {" · "}
            trecho {value.startAtSec}s · {value.clipDurationSec}s
          </p>
          <label className="mt-1.5 flex items-center gap-2 text-[11px] text-neutral-500">
            Início
            <input
              type="range"
              min={0}
              max={POST_MUSIC_START_MAX}
              step={1}
              value={value.startAtSec}
              onChange={(e) => {
                const startAtSec = clampPostMusicStart(Number(e.target.value));
                onChange({
                  ...value,
                  startAtSec,
                  clipDurationSec: clampPostMusicClip(value.clipDurationSec),
                });
              }}
              className="h-1 flex-1 accent-[#1f1f1f]"
            />
            <span className="w-10 tabular-nums text-right">
              {value.startAtSec}s
            </span>
          </label>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-200 hover:text-[#1f1f1f] dark:hover:bg-zinc-800"
          aria-label="Remover música"
        >
          <X size={16} weight="bold" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-2 rounded-2xl border border-neutral-200 bg-white p-3",
        "dark:border-zinc-700 dark:bg-zinc-900",
        className
      )}
    >
      <p className="text-[12px] font-semibold text-[#1f1f1f] dark:text-zinc-100">
        Música do post
      </p>
      <p className="text-[11px] leading-snug text-neutral-500">
        Cole um link do YouTube (melhor autoplay), Spotify ou SoundCloud. O
        trecho toca quando o post está no centro da tela.
      </p>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://open.spotify.com/… ou YouTube"
          className="h-10 min-w-0 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[13px] outline-none focus:border-[#1f1f1f] dark:border-zinc-700 dark:bg-zinc-950"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void resolve();
            }
          }}
        />
        <button
          type="button"
          onClick={() => void resolve()}
          disabled={loading}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1f1f1f] px-3 text-[12px] font-semibold text-white disabled:opacity-50"
        >
          {loading ? (
            <SpinnerGap size={16} className="animate-spin" />
          ) : (
            <MagnifyingGlass size={16} weight="bold" />
          )}
          Buscar
        </button>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-neutral-500">
        Início do trecho
        <input
          type="range"
          min={0}
          max={180}
          step={1}
          value={startAt}
          onChange={(e) => setStartAt(Number(e.target.value))}
          className="h-1 flex-1 accent-[#1f1f1f]"
        />
        <span className="w-10 tabular-nums text-right">{startAt}s</span>
      </label>
      {error && (
        <p className="text-[12px] font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

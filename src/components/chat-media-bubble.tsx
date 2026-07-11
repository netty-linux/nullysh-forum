"use client";

import {
  formatMediaDuration,
} from "@/lib/chat-media";
import { isMediaRef, mediaGet } from "@/lib/media-storage";
import { getSticker } from "@/lib/stickers";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Pause, Play, SpeakerHigh } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

async function resolveUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (isMediaRef(url)) return (await mediaGet(url)) || null;
  return url;
}

export function ChatMediaBubble({
  message: m,
  mine,
}: {
  message: ChatMessage;
  mine?: boolean;
}) {
  const kind = m.mediaKind;
  const [src, setSrc] = useState<string | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, t] = await Promise.all([
        resolveUrl(m.mediaUrl),
        resolveUrl(m.mediaThumbUrl),
      ]);
      if (cancelled) return;
      setSrc(s);
      setThumb(t);
    })();
    return () => {
      cancelled = true;
    };
  }, [m.mediaUrl, m.mediaThumbUrl]);

  if (!kind || kind === "text") return null;

  if (kind === "sticker") {
    // unicode: `u:😀` | pack id | fallback content
    let emoji = m.content || "⭐";
    if (m.mediaUrl?.startsWith("u:")) {
      emoji = m.mediaUrl.slice(2) || emoji;
    } else if (m.mediaUrl) {
      const st = getSticker(m.mediaUrl);
      if (st) emoji = st.emoji;
    }
    return (
      <div
        className="inline-flex select-none text-[72px] leading-none drop-shadow-sm"
        title="Figurinha"
        role="img"
        aria-label="Figurinha"
      >
        {emoji}
      </div>
    );
  }

  if (kind === "gif" || kind === "image") {
    if (!src) {
      return (
        <div className="h-32 w-48 animate-pulse rounded-xl bg-neutral-200 dark:bg-zinc-800" />
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={kind === "gif" ? "GIF" : "Imagem"}
        className={cn(
          "max-h-72 max-w-[min(100%,16rem)] rounded-xl object-cover",
          "ring-1 ring-black/5 dark:ring-white/10"
        )}
        loading="lazy"
      />
    );
  }

  if (kind === "video") {
    if (!src) {
      return (
        <div className="flex h-40 w-56 items-center justify-center rounded-xl bg-neutral-900 text-xs text-white/60">
          Carregando vídeo…
        </div>
      );
    }
    return (
      <video
        src={src}
        poster={thumb || undefined}
        controls
        playsInline
        preload="metadata"
        className="max-h-72 max-w-[min(100%,16rem)] rounded-xl bg-black ring-1 ring-black/10"
      />
    );
  }

  if (kind === "audio") {
    return <AudioBubble src={src} duration={m.mediaDuration} mine={mine} />;
  }

  return null;
}

function AudioBubble({
  src,
  duration,
  mine,
}: {
  src: string | null;
  duration?: number | null;
  mine?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cur, setCur] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      setCur(a.currentTime);
      if (a.duration) setProgress(a.currentTime / a.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      setCur(0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, [src]);

  function toggle() {
    const a = audioRef.current;
    if (!a || !src) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      void a.play();
      setPlaying(true);
    }
  }

  return (
    <div
      className={cn(
        "flex min-w-[12rem] max-w-[16rem] items-center gap-2.5 rounded-2xl px-3 py-2.5",
        mine
          ? "bg-black text-white dark:bg-white dark:text-black"
          : "bg-neutral-100 text-neutral-800 dark:bg-zinc-800 dark:text-zinc-100"
      )}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={!src}
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          mine
            ? "bg-white/15 text-white dark:bg-black/10 dark:text-black"
            : "bg-white text-[#1f1f1f] shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
        )}
        aria-label={playing ? "Pausar áudio" : "Tocar áudio"}
      >
        {playing ? (
          <Pause size={16} weight="fill" />
        ) : (
          <Play size={16} weight="fill" className="ml-0.5" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "h-1 overflow-hidden rounded-full",
            mine ? "bg-white/25 dark:bg-black/15" : "bg-neutral-300 dark:bg-zinc-600"
          )}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              mine ? "bg-white dark:bg-black" : "bg-[#1f1f1f] dark:bg-zinc-200"
            )}
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
        <div className="mt-1 flex items-center gap-1 text-[10px] tabular-nums opacity-70">
          <SpeakerHigh size={11} weight="fill" />
          {formatMediaDuration(cur || 0)}
          <span className="opacity-50">/</span>
          {formatMediaDuration(duration || 0)}
        </div>
      </div>
      {src && (
        <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      )}
    </div>
  );
}

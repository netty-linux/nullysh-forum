"use client";

/**
 * GIF de feed ultra-leve:
 * - Só carrega quando ~200px perto do viewport
 * - Prefere MP4 (Giphy) → WebP leve → GIF
 * - Placeholder estático até entrar na tela
 * - decoding async + content-visibility
 */

import {
  gifMp4Url,
  gifTinyPreviewUrl,
  lightenGifUrl,
} from "@/lib/gif-optimize";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  alt?: string;
  className?: string;
  /** max height utility já no className; este é o box wrapper */
  maxHeightClass?: string;
};

export function LazyGif({
  src,
  alt = "GIF",
  className,
  maxHeightClass = "max-h-52",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [useVideo, setUseVideo] = useState(true);
  const [broken, setBroken] = useState(false);

  const light = lightenGifUrl(src);
  const mp4 = gifMp4Url(src);
  const tiny = gifTinyPreviewUrl(src);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    // Sem suporte a IntersectionObserver — ativa sem esperar viewport
    if (typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => setActive(true));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting || e.intersectionRatio > 0) {
            setActive(true);
            io.disconnect();
            break;
          }
        }
      },
      { root: null, rootMargin: "240px 0px", threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative overflow-hidden bg-neutral-100 dark:bg-zinc-900",
        "content-visibility-auto",
        maxHeightClass,
        className
      )}
      style={{ contentVisibility: "auto", containIntrinsicSize: "200px 200px" }}
    >
      {/* Placeholder estático barato (não anima) até o viewport */}
      {!active && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tiny}
          alt=""
          aria-hidden
          className={cn(
            "h-full w-full object-cover opacity-80 blur-[1px]",
            maxHeightClass
          )}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
        />
      )}

      {active && !broken && useVideo && mp4 ? (
        <video
          src={mp4}
          className={cn("h-full w-full object-cover", maxHeightClass)}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setUseVideo(false)}
          aria-label={alt}
        />
      ) : null}

      {active && (!useVideo || !mp4 || broken) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={light}
          alt={alt}
          className={cn("h-full w-full object-cover", maxHeightClass)}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          onError={() => {
            if (light !== src) {
              // último recurso: URL original
              setBroken(true);
            }
          }}
        />
      ) : null}

      {active && broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={cn("h-full w-full object-cover", maxHeightClass)}
          loading="lazy"
          decoding="async"
        />
      ) : null}

      <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        GIF
      </span>
    </div>
  );
}

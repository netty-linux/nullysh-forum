"use client";

import { Button } from "@/components/ui/button";
import {
  DEFAULT_BANNER_FIT,
  type BannerFit,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ArrowsOutCardinal,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  X,
} from "@phosphor-icons/react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Props = {
  open: boolean;
  imageSrc: string;
  initialFit?: BannerFit | null;
  onCancel: () => void;
  onConfirm: (fit: BannerFit) => void;
};

/**
 * Editor de posição para banner GIF (ou imagem).
 * Não re-encoda o arquivo — só grava x/y/zoom para object-position + scale,
 * preservando a animação do GIF.
 */
export function GifBannerEditor({
  open,
  imageSrc,
  initialFit,
  onCancel,
  onConfirm,
}: Props) {
  const [fit, setFit] = useState<BannerFit>(
    initialFit ?? DEFAULT_BANNER_FIT
  );
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setFit(initialFit ?? DEFAULT_BANNER_FIT);
  }, [open, imageSrc, initialFit]);

  if (!open) return null;

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: fit.x,
      origY: fit.y,
    };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    // arrastar a imagem no sentido do dedo → inverte no object-position
    const sens = 100 / Math.max(rect.width, 1);
    const nextX = Math.min(
      100,
      Math.max(0, dragRef.current.origX - dx * sens * fit.zoom)
    );
    const nextY = Math.min(
      100,
      Math.max(0, dragRef.current.origY - dy * sens * fit.zoom)
    );
    setFit((f) => ({ ...f, x: nextX, y: nextY }));
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragRef.current = null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gif-banner-editor-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#1f1f1f]/55 backdrop-blur-[2px]"
        aria-label="Fechar"
        onClick={onCancel}
      />

      <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-neutral-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-[#141414] sm:mx-4 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2
              id="gif-banner-editor-title"
              className="text-base font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-100"
            >
              Posicionar banner GIF
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
              Arraste para enquadrar e use o zoom. A animação do GIF é
              preservada.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-[#1f1f1f] dark:hover:bg-zinc-800"
            aria-label="Fechar"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Viewport 3:1 — mesmo ratio do banner do perfil */}
        <div className="bg-neutral-900 px-4 py-4">
          <div
            ref={frameRef}
            className="relative aspect-[3/1] w-full cursor-grab overflow-hidden rounded-xl active:cursor-grabbing ring-1 ring-white/10"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
              style={{
                objectPosition: `${fit.x}% ${fit.y}%`,
                transform: `scale(${fit.zoom})`,
                transformOrigin: `${fit.x}% ${fit.y}%`,
              }}
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
                <ArrowsOutCardinal size={12} weight="bold" />
                Arraste para mover
              </span>
            </div>
            {/* safe guides */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        </div>

        <div className="border-b border-neutral-100 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <MagnifyingGlassMinus
              size={18}
              className="shrink-0 text-neutral-400"
              weight="bold"
            />
            <input
              type="range"
              min={1}
              max={2.5}
              step={0.01}
              value={fit.zoom}
              onChange={(e) =>
                setFit((f) => ({ ...f, zoom: Number(e.target.value) }))
              }
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-[#1f1f1f] dark:bg-zinc-700"
              aria-label="Zoom do banner"
            />
            <MagnifyingGlassPlus
              size={18}
              className="shrink-0 text-neutral-400"
              weight="bold"
            />
          </div>
          <p className="mt-2 text-center text-[11px] text-neutral-400">
            Zoom {fit.zoom.toFixed(2)}× · posição {Math.round(fit.x)}% /{" "}
            {Math.round(fit.y)}%
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setFit(DEFAULT_BANNER_FIT)}
          >
            Centralizar
          </Button>
          <Button type="button" onClick={() => onConfirm(fit)}>
            Aplicar posição
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Estilo reutilizável p/ renderizar banner com fit */
export function bannerFitStyle(fit: BannerFit | null | undefined): CSSProperties {
  const f = fit ?? DEFAULT_BANNER_FIT;
  return {
    objectFit: "cover",
    objectPosition: `${f.x}% ${f.y}%`,
    transform: f.zoom > 1 ? `scale(${f.zoom})` : undefined,
    transformOrigin: `${f.x}% ${f.y}%`,
  };
}

export function BannerImage({
  src,
  fit,
  className,
  alt = "",
}: {
  src: string;
  fit?: BannerFit | null;
  className?: string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn(
        "absolute inset-0 h-full w-full object-cover object-center",
        className
      )}
      style={bannerFitStyle(fit)}
    />
  );
}

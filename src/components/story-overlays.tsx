"use client";

import type { StoryOverlay } from "@/lib/social-store";
import { cn } from "@/lib/utils";
import { MapPin, Trash } from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as REPointerEvent,
} from "react";

type Props = {
  overlays: StoryOverlay[];
  interactive?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onScale?: (id: string, scale: number) => void;
  onDelete?: (id: string) => void;
  /** notifica se está arrastando (para UI de lixeira) */
  onDragState?: (dragging: boolean, overTrash?: boolean) => void;
  className?: string;
};

type DragMode = "move" | "scale" | null;

/**
 * Overlays do story com interação fluida:
 * arrastar, redimensionar, selecionar, apagar.
 * Durante o drag atualiza o DOM direto (sem re-render a cada frame).
 */
export function StoryOverlays({
  overlays,
  interactive = false,
  selectedId,
  onSelect,
  onMove,
  onScale,
  onDelete,
  onDragState,
  className,
}: Props) {
  const layerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragRef = useRef<{
    id: string;
    mode: DragMode;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origScale: number;
    pointerId: number;
  } | null>(null);
  const [localDrag, setLocalDrag] = useState(false);

  const getScale = useCallback((ov: StoryOverlay) => {
    if (ov.type === "text" || ov.type === "emoji" || ov.type === "custom-emoji") {
      return ov.scale || 1;
    }
    return 1;
  }, []);

  const applyDomPos = useCallback((id: string, x: number, y: number, scale?: number) => {
    const el = nodeRefs.current.get(id);
    if (!el) return;
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    if (typeof scale === "number") {
      el.dataset.scale = String(scale);
      const base = el.dataset.baseTransform || "translate(-50%, -50%)";
      el.style.transform = `${base} scale(${scale})`;
    }
  }, []);

  const finishDrag = useCallback(
    (clientX: number, clientY: number, cancelled = false) => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      setLocalDrag(false);
      onDragState?.(false, false);

      const layer = layerRef.current;
      if (!layer) return;
      const rect = layer.getBoundingClientRect();

      // zona de lixeira: 22% inferior central
      const relY = (clientY - rect.top) / rect.height;
      const relX = (clientX - rect.left) / rect.width;
      const overTrash =
        !cancelled &&
        relY > 0.82 &&
        relX > 0.28 &&
        relX < 0.72;

      if (overTrash && onDelete) {
        onDelete(d.id);
        return;
      }

      const el = nodeRefs.current.get(d.id);
      if (!el) return;

      if (d.mode === "move") {
        const x = parseFloat(el.style.left) || d.origX;
        const y = parseFloat(el.style.top) || d.origY;
        onMove?.(d.id, x, y);
      } else if (d.mode === "scale") {
        const scale = parseFloat(el.dataset.scale || String(d.origScale));
        onScale?.(d.id, scale);
      }
    },
    [onDelete, onDragState, onMove, onScale]
  );

  useEffect(() => {
    if (!interactive) return;

    function onMoveWin(e: PointerEvent) {
      const d = dragRef.current;
      const layer = layerRef.current;
      if (!d || !layer) return;
      e.preventDefault();

      const rect = layer.getBoundingClientRect();
      if (d.mode === "move") {
        const dx = ((e.clientX - d.startX) / rect.width) * 100;
        const dy = ((e.clientY - d.startY) / rect.height) * 100;
        const x = Math.min(96, Math.max(4, d.origX + dx));
        const y = Math.min(96, Math.max(4, d.origY + dy));
        applyDomPos(d.id, x, y);

        const relY = (e.clientY - rect.top) / rect.height;
        const relX = (e.clientX - rect.left) / rect.width;
        const overTrash = relY > 0.82 && relX > 0.28 && relX < 0.72;
        onDragState?.(true, overTrash);
      } else if (d.mode === "scale") {
        const dy = d.startY - e.clientY;
        const next = Math.min(
          3,
          Math.max(0.45, d.origScale + dy / 120)
        );
        applyDomPos(d.id, d.origX, d.origY, next);
      }
    }

    function onUpWin(e: PointerEvent) {
      if (!dragRef.current) return;
      finishDrag(e.clientX, e.clientY);
    }

    window.addEventListener("pointermove", onMoveWin, { passive: false });
    window.addEventListener("pointerup", onUpWin);
    window.addEventListener("pointercancel", onUpWin);
    return () => {
      window.removeEventListener("pointermove", onMoveWin);
      window.removeEventListener("pointerup", onUpWin);
      window.removeEventListener("pointercancel", onUpWin);
    };
  }, [interactive, applyDomPos, finishDrag, onDragState]);

  function startDrag(
    e: REPointerEvent,
    ov: StoryOverlay,
    mode: DragMode
  ) {
    if (!interactive || !mode) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect?.(ov.id);

    dragRef.current = {
      id: ov.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: ov.x,
      origY: ov.y,
      origScale: getScale(ov),
      pointerId: e.pointerId,
    };
    setLocalDrag(true);
    onDragState?.(true, false);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  // sync DOM when props change (and not dragging this id)
  useEffect(() => {
    for (const ov of overlays) {
      if (dragRef.current?.id === ov.id) continue;
      const el = nodeRefs.current.get(ov.id);
      if (!el) continue;
      el.style.left = `${ov.x}%`;
      el.style.top = `${ov.y}%`;
      const scale = getScale(ov);
      el.dataset.scale = String(scale);
      const rot = ov.rotation || 0;
      const base = `translate(-50%, -50%) rotate(${rot}deg)`;
      el.dataset.baseTransform = base;
      el.style.transform =
        ov.type === "text" || ov.type === "emoji" || ov.type === "custom-emoji"
          ? `${base} scale(${scale})`
          : base;
    }
  }, [overlays, getScale, selectedId, localDrag]);

  if (!interactive) {
    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[5] overflow-hidden",
          className
        )}
      >
        {overlays.map((ov) => (
          <StaticOverlay key={ov.id} ov={ov} />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={layerRef}
      className={cn(
        "absolute inset-0 z-[5] overflow-hidden touch-none",
        className
      )}
      onPointerDown={(e) => {
        // clique no fundo desmarca
        if (e.target === e.currentTarget) {
          onSelect?.(null);
        }
      }}
    >
      {overlays.map((ov) => {
        const selected = selectedId === ov.id;
        const scale = getScale(ov);
        const rot = ov.rotation || 0;
        const base = `translate(-50%, -50%) rotate(${rot}deg)`;
        const canScale =
          ov.type === "text" ||
          ov.type === "emoji" ||
          ov.type === "custom-emoji";

        return (
          <div
            key={ov.id}
            ref={(el) => {
              if (el) nodeRefs.current.set(ov.id, el);
              else nodeRefs.current.delete(ov.id);
            }}
            data-overlay-id={ov.id}
            data-scale={String(scale)}
            data-base-transform={base}
            className={cn(
              "absolute z-[6] select-none touch-none",
              "cursor-grab active:cursor-grabbing",
              selected && "z-[8]"
            )}
            style={
              {
                left: `${ov.x}%`,
                top: `${ov.y}%`,
                transform:
                  canScale
                    ? `${base} scale(${scale})`
                    : base,
                willChange: "left, top, transform",
              } as CSSProperties
            }
            onPointerDown={(e) => startDrag(e, ov, "move")}
          >
            {/* selection chrome */}
            {selected && (
              <div
                className="pointer-events-none absolute inset-0 -m-2 rounded-xl ring-2 ring-white shadow-[0_0_0_1px_rgb(0_0_0/0.35),0_8px_24px_-8px_rgb(0_0_0/0.5)]"
                style={{ transform: `scale(${1 / (canScale ? scale : 1)})` }}
              />
            )}

            <div className="relative">
              <OverlayBody ov={ov} />
            </div>

            {/* floating controls — reverse-scale so they stay readable */}
            {selected && (
              <div
                className="pointer-events-auto absolute left-1/2 top-full z-20 mt-3 flex -translate-x-1/2 items-center gap-1.5"
                style={{
                  transform: `translateX(-50%) scale(${1 / (canScale ? Math.max(scale, 0.5) : 1)})`,
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {canScale && (
                  <button
                    type="button"
                    aria-label="Redimensionar"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#111] shadow-lg active:scale-95"
                    onPointerDown={(e) => startDrag(e, ov, "scale")}
                    title="Arraste para redimensionar"
                  >
                    <span className="text-[11px] font-black tracking-tight">
                      ⤢
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Apagar"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white shadow-lg active:scale-95"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(ov.id);
                  }}
                >
                  <Trash size={15} weight="bold" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OverlayBody({ ov }: { ov: StoryOverlay }) {
  if (ov.type === "text") {
    return (
      <div
        className={cn(
          "max-w-[min(85vw,280px)] px-3 py-1.5 text-center font-bold leading-snug",
          "whitespace-pre-wrap break-words drop-shadow-[0_2px_8px_rgb(0_0_0/0.55)]",
          ov.bg && "rounded-lg bg-black/55 backdrop-blur-[2px]"
        )}
        style={{ color: ov.color || "#fff", fontSize: 22 }}
      >
        {ov.text}
      </div>
    );
  }
  if (ov.type === "emoji") {
    return (
      <span
        className="block drop-shadow-[0_4px_12px_rgb(0_0_0/0.45)]"
        style={{ fontSize: 48, lineHeight: 1 }}
      >
        {ov.emoji}
      </span>
    );
  }
  if (ov.type === "custom-emoji") {
    return ov.imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={ov.imageUrl}
        alt={ov.shortcode}
        draggable={false}
        className="h-14 w-14 object-contain drop-shadow-[0_4px_12px_rgb(0_0_0/0.45)]"
      />
    ) : (
      <span className="rounded-md bg-black/50 px-2 py-1 text-xs font-bold text-white">
        :{ov.shortcode}:
      </span>
    );
  }
  if (ov.type === "location") {
    return (
      <div className="inline-flex max-w-[240px] items-center gap-1.5 rounded-full bg-black/55 px-3.5 py-2 text-[13px] font-semibold text-white shadow-lg backdrop-blur-md">
        <MapPin size={15} weight="fill" className="shrink-0 text-sky-300" />
        <span className="truncate">{ov.label}</span>
      </div>
    );
  }
  return null;
}

function StaticOverlay({ ov }: { ov: StoryOverlay }) {
  const scale =
    ov.type === "text" || ov.type === "emoji" || ov.type === "custom-emoji"
      ? ov.scale || 1
      : 1;
  const rot = ov.rotation || 0;
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${ov.x}%`,
        top: `${ov.y}%`,
        transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`,
      }}
    >
      <OverlayBody ov={ov} />
    </div>
  );
}

/** Zona de lixeira no rodapé do canvas (visível só ao arrastar) */
export function StoryTrashZone({
  active,
  hot,
}: {
  active: boolean;
  hot: boolean;
}) {
  if (!active) return null;
  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5 transition-all duration-200",
        hot ? "scale-110" : "scale-100"
      )}
    >
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full border-2 shadow-2xl transition-colors",
          hot
            ? "border-red-400 bg-red-500 text-white"
            : "border-white/40 bg-black/55 text-white backdrop-blur-md"
        )}
      >
        <Trash size={22} weight="bold" />
      </div>
      <span className="text-[11px] font-semibold text-white/80 drop-shadow">
        {hot ? "Solte para apagar" : "Arraste aqui"}
      </span>
    </div>
  );
}


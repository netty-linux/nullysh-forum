"use client";

import { StoryOverlays } from "@/components/story-overlays";
import { Avatar } from "@/components/ui/avatar";
import type { Story, StoryAuthorGroup } from "@/lib/social-store";
import { useSocialStore } from "@/lib/social-store";
import { cn, formatRelative } from "@/lib/utils";
import { X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const FALLBACK_IMAGE_MS = 5000;
const SWIPE_THRESHOLD = 60;

type Props = {
  open: boolean;
  groups: StoryAuthorGroup[];
  startGroupIndex: number;
  viewerId?: string | null;
  onClose: () => void;
};

/**
 * Viewer fullscreen Instagram-like:
 * multi-stories por autor · vídeo com progresso real · swipe entre pessoas.
 */
export function StoryViewer({
  open,
  groups,
  startGroupIndex,
  viewerId,
  onClose,
}: Props) {
  const markStoryViewed = useSocialStore((s) => s.markStoryViewed);
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [gIdx, setGIdx] = useState(0);
  const [sIdx, setSIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [slideX, setSlideX] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const leftRef = useRef(FALLBACK_IMAGE_MS);
  const durationRef = useRef(FALLBACK_IMAGE_MS);
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const group = groups[gIdx] ?? null;
  const story: Story | null = group?.stories[sIdx] ?? null;
  const isVideo = story?.mediaType === "video";

  const goNext = useCallback(() => {
    if (!group) {
      onClose();
      return;
    }
    if (sIdx < group.stories.length - 1) {
      setSIdx((i) => i + 1);
      setProgress(0);
      return;
    }
    if (gIdx < groups.length - 1) {
      setGIdx((i) => i + 1);
      setSIdx(0);
      setProgress(0);
      return;
    }
    onClose();
  }, [group, sIdx, gIdx, groups.length, onClose]);

  const goPrev = useCallback(() => {
    if (sIdx > 0) {
      setSIdx((i) => i - 1);
      setProgress(0);
      return;
    }
    if (gIdx > 0) {
      const prevG = groups[gIdx - 1];
      setGIdx((i) => i - 1);
      setSIdx(Math.max(0, (prevG?.stories.length ?? 1) - 1));
      setProgress(0);
    }
  }, [sIdx, gIdx, groups]);

  const goNextGroup = useCallback(() => {
    if (gIdx < groups.length - 1) {
      setGIdx((i) => i + 1);
      setSIdx(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [gIdx, groups.length, onClose]);

  const goPrevGroup = useCallback(() => {
    if (gIdx > 0) {
      setGIdx((i) => i - 1);
      setSIdx(0);
      setProgress(0);
    }
  }, [gIdx]);

  // reset ao abrir / trocar grupo inicial
  useEffect(() => {
    if (!open) return;
    setGIdx(Math.max(0, Math.min(startGroupIndex, groups.length - 1)));
    setSIdx(0);
    setProgress(0);
    setPaused(false);
    setSlideX(0);
  }, [open, startGroupIndex, groups.length]);

  // marca visualização
  useEffect(() => {
    if (!open || !story || !viewerId) return;
    markStoryViewed(story.id, viewerId);
  }, [open, story?.id, viewerId, markStoryViewed]);

  // prepara duração ao trocar story
  useEffect(() => {
    if (!story) return;
    const d =
      story.mediaType === "video"
        ? Math.max(story.durationMs || FALLBACK_IMAGE_MS, 1000)
        : story.durationMs || FALLBACK_IMAGE_MS;
    durationRef.current = d;
    leftRef.current = d;
    setProgress(0);
    startRef.current = performance.now();

    if (story.mediaType === "video" && videoRef.current) {
      const v = videoRef.current;
      v.currentTime = 0;
      void v.play().catch(() => {});
    }
  }, [story?.id, story?.mediaType, story?.durationMs]);

  // timer progresso (imagem) ou sync vídeo
  useEffect(() => {
    if (!open || !story || paused || reduce) return;

    if (isVideo) {
      const v = videoRef.current;
      if (!v) return;
      const onTime = () => {
        const dur = Math.min(
          durationRef.current / 1000,
          v.duration || durationRef.current / 1000
        );
        if (!dur || !Number.isFinite(dur)) return;
        const p = Math.min(1, v.currentTime / dur);
        setProgress(p);
        if (v.currentTime >= dur - 0.05) {
          goNext();
        }
      };
      const onEnded = () => goNext();
      v.addEventListener("timeupdate", onTime);
      v.addEventListener("ended", onEnded);
      if (v.paused) void v.play().catch(() => {});
      return () => {
        v.removeEventListener("timeupdate", onTime);
        v.removeEventListener("ended", onEnded);
      };
    }

    // imagem: rAF timer
    startRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const p = Math.min(1, elapsed / leftRef.current);
      setProgress(p);
      if (p >= 1) {
        goNext();
        return;
      }
      timerRef.current = requestAnimationFrame(tick);
    };
    timerRef.current = requestAnimationFrame(tick);
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [open, story?.id, paused, sIdx, gIdx, goNext, reduce, isVideo]);

  // pause/resume video
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isVideo) return;
    if (paused) v.pause();
    else void v.play().catch(() => {});
  }, [paused, isVideo, story?.id]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, goNext, goPrev]);

  function beginDrag(clientX: number, clientY: number) {
    touchStart.current = { x: clientX, y: clientY, t: Date.now() };
    dragging.current = false;
    setPaused(true);
  }

  function moveDrag(clientX: number, clientY: number) {
    const start = touchStart.current;
    if (!start) return;
    const dx = clientX - start.x;
    const dy = clientY - start.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
      dragging.current = true;
      setSlideX(dx);
    }
  }

  function endDrag(clientX: number) {
    const start = touchStart.current;
    touchStart.current = null;
    setPaused(false);
    const dx = slideX;
    setSlideX(0);

    if (dragging.current && Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx < 0) goNextGroup();
      else goPrevGroup();
      dragging.current = false;
      return true;
    }

    // tap: esquerda = anterior, direita = próximo
    if (!dragging.current && start) {
      const el = document.documentElement;
      const w = el.clientWidth || window.innerWidth;
      // usa posição relativa à viewport do viewer (centro)
      if (clientX < w * 0.35) goPrev();
      else goNext();
    }
    dragging.current = false;
    return false;
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (!t) return;
    beginDrag(t.clientX, t.clientY);
  }

  function onTouchMove(e: React.TouchEvent) {
    const t = e.touches[0];
    if (!t) return;
    moveDrag(t.clientX, t.clientY);
  }

  function onTouchEnd(e: React.TouchEvent) {
    const touch = e.changedTouches[0];
    endDrag(touch?.clientX ?? 0);
  }

  function onPointerDown(e: React.PointerEvent) {
    // só mouse/pen — touch já tratado
    if (e.pointerType === "touch") return;
    beginDrag(e.clientX, e.clientY);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    if (!touchStart.current) return;
    moveDrag(e.clientX, e.clientY);
  }

  function onPointerUp(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    if (!touchStart.current) return;
    endDrag(e.clientX);
  }

  if (!mounted) return null;

  const mediaSrc = story?.mediaUrl || story?.imageUrl || "";

  return createPortal(
    <AnimatePresence>
      {open && group && story && (
        <motion.div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={`Story de ${group.authorName}`}
        >
          <div
            className="relative h-full w-full max-w-md touch-pan-y sm:h-[min(92dvh,780px)] sm:max-w-[420px] sm:overflow-hidden sm:rounded-2xl"
            style={{
              transform: slideX
                ? `translateX(${slideX * 0.35}px)`
                : undefined,
              transition: slideX ? "none" : "transform 0.2s ease-out",
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* progress bars — um por story do autor */}
            <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 px-2 pt-2">
              {group.stories.map((st, i) => (
                <div
                  key={st.id}
                  className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30"
                >
                  <div
                    className="h-full bg-white ease-linear"
                    style={{
                      width:
                        i < sIdx
                          ? "100%"
                          : i === sIdx
                            ? `${progress * 100}%`
                            : "0%",
                      transition:
                        i === sIdx && isVideo
                          ? "none"
                          : "width 80ms linear",
                    }}
                  />
                </div>
              ))}
            </div>

            {/* header */}
            <div className="absolute left-0 right-0 top-3 z-20 flex items-center gap-2 px-3 pt-3">
              <Avatar
                name={group.authorName}
                src={group.authorAvatarUrl}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white drop-shadow">
                  {group.authorName}
                </p>
                <p className="text-[11px] text-white/70">
                  {formatRelative(story.createdAt)}
                  {group.stories.length > 1 && (
                    <span className="text-white/50">
                      {" "}
                      · {sIdx + 1}/{group.stories.length}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
                aria-label="Fechar"
              >
                <X size={22} weight="bold" />
              </button>
            </div>

            {/* media */}
            {isVideo ? (
              <video
                key={story.id}
                ref={videoRef}
                src={mediaSrc}
                className="h-full w-full object-cover"
                playsInline
                autoPlay
                // começa muted p/ autoplay; toque/arraste desbloqueia som
                muted
                controls={false}
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (v.duration && Number.isFinite(v.duration)) {
                    const ms = Math.min(
                      v.duration * 1000,
                      story.durationMs || FALLBACK_IMAGE_MS
                    );
                    durationRef.current = ms;
                    leftRef.current = ms;
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  const v = e.currentTarget;
                  v.muted = !v.muted;
                }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={story.id}
                src={mediaSrc}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            )}

            {/* stickers / texto / local */}
            <StoryOverlays overlays={story.overlays || []} />

            {story.caption && !(story.overlays || []).length && (
              <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-4 pb-8 pt-16">
                <p className="text-sm leading-relaxed text-white drop-shadow">
                  {story.caption}
                </p>
              </div>
            )}

            {/* hint */}
            {groups.length > 1 && (
              <p
                className={cn(
                  "pointer-events-none absolute bottom-4 left-0 right-0 z-20 text-center text-[10px] font-medium text-white/40"
                )}
              >
                deslize ou arraste para o lado · setas do teclado
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

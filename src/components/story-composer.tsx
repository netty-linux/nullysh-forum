"use client";

import { EmojiPicker } from "@/components/emoji-picker";
import {
  StoryOverlays,
  StoryTrashZone,
} from "@/components/story-overlays";
import { useAuth } from "@/hooks/use-auth";
import { useMounted } from "@/hooks/use-mounted";
import { useEmojiStore } from "@/lib/emoji-store";
import {
  reverseGeocode,
  searchPlaces,
  type PlaceSuggestion,
} from "@/lib/geocode";
import {
  MAX_VIDEO_MS,
  useSocialStore,
  type StoryAspect,
  type StoryMediaType,
  type StoryOverlay,
} from "@/lib/social-store";
import { cn, uid } from "@/lib/utils";
import {
  Image as ImageIcon,
  MapPin,
  Minus,
  NavigationArrow,
  Plus,
  Smiley,
  SpinnerGap,
  TextT,
  Trash,
  VideoCamera,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

const TEXT_COLORS = [
  "#ffffff",
  "#000000",
  "#facc15",
  "#f472b6",
  "#38bdf8",
  "#4ade80",
  "#fb923c",
  "#a78bfa",
  "#f43f5e",
];

type Props = {
  open: boolean;
  user: {
    id: string;
    name: string;
    avatar: string;
    avatarUrl?: string | null;
  };
  onClose: () => void;
  onCreated?: () => void;
};

type Tool = "none" | "text" | "emoji" | "location";

function detectAspect(w: number, h: number): StoryAspect {
  if (!w || !h) return "9:16";
  const r = w / h;
  if (r < 0.7) return "9:16";
  if (r > 1.4) return "16:9";
  if (Math.abs(r - 1) < 0.15) return "1:1";
  return r < 1 ? "9:16" : "16:9";
}

/**
 * Editor de story fluido estilo Instagram:
 * canvas full-bleed · stickers arrastáveis · lixeira · tools laterais.
 */
export function StoryComposer({ open, user, onClose, onCreated }: Props) {
  const addStory = useSocialStore((s) => s.addStory);
  const { isVip } = useAuth();
  const reduce = useReducedMotion();
  const fileRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const emojiPanelRef = useRef<HTMLDivElement>(null);

  const mounted = useMounted();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<StoryMediaType>("image");
  const [aspect, setAspect] = useState<StoryAspect>("9:16");
  const [durationMs, setDurationMs] = useState(5000);
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("none");
  const [textDraft, setTextDraft] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textBg, setTextBg] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceSuggestion[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [overTrash, setOverTrash] = useState(false);

  const selected = overlays.find((o) => o.id === selectedId) ?? null;
  const vipPlan = !!isVip;

  const reset = useCallback(() => {
    setMediaUrl(null);
    setMediaType("image");
    setAspect("9:16");
    setDurationMs(5000);
    setOverlays([]);
    setSelectedId(null);
    setTool("none");
    setTextDraft("");
    setTextColor("#ffffff");
    setTextBg(false);
    setEmojiOpen(false);
    setLocationQuery("");
    setPlaceResults([]);
    setError("");
    setSaving(false);
    setLoadingFile(false);
    setDragging(false);
    setOverTrash(false);
  }, []);

  // Reset ao fechar — durante a renderização, sem efeito.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) reset();
  }

  // Efeito colateral real de DOM (input file não-controlado) — mantém em effect.
  useEffect(() => {
    if (!open && fileRef.current) fileRef.current.value = "";
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // teclado: Delete / Backspace apaga selecionado; Esc desmarca/fecha tool
  useEffect(() => {
    if (!open || !mediaUrl) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable;

      if (e.key === "Escape") {
        if (tool !== "none" || emojiOpen) {
          setTool("none");
          setEmojiOpen(false);
          return;
        }
        if (selectedId) {
          setSelectedId(null);
          return;
        }
        onClose();
        return;
      }

      if (typing) return;

      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        setOverlays((list) => list.filter((o) => o.id !== selectedId));
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, mediaUrl, selectedId, tool, emojiOpen, onClose]);

  // foca input de texto ao abrir tool
  useEffect(() => {
    if (tool === "text") {
      const t = window.setTimeout(() => textInputRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    }
  }, [tool]);

  // busca local
  const locationQueryTrimmed = locationQuery.trim();
  const locationQueryTooShort =
    tool === "location" && locationQueryTrimmed.length < 2;
  useEffect(() => {
    if (tool !== "location" || locationQueryTooShort) return;
    const q = locationQueryTrimmed;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      if (cancelled) return;
      setPlaceLoading(true);
      try {
        const res = await searchPlaces(q);
        if (!cancelled) setPlaceResults(res);
      } catch {
        if (!cancelled) setPlaceResults([]);
      } finally {
        if (!cancelled) setPlaceLoading(false);
      }
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [locationQuery, tool, locationQueryTrimmed, locationQueryTooShort]);

  const visiblePlaceResults = locationQueryTooShort ? [] : placeResults;

  function onFile(file: File | null) {
    if (!file) return;
    setError("");
    setLoadingFile(true);
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      setError("Envie uma imagem ou vídeo.");
      setLoadingFile(false);
      return;
    }
    if (isImage && file.size > MAX_IMAGE_BYTES) {
      setError("Imagem no máximo 10 MB.");
      setLoadingFile(false);
      return;
    }
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      setError("Vídeo no máximo 40 MB.");
      setLoadingFile(false);
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = () => {
      const data = typeof reader.result === "string" ? reader.result : null;
      if (!data) {
        setError("Falha ao ler o arquivo.");
        setLoadingFile(false);
        URL.revokeObjectURL(blobUrl);
        return;
      }

      if (isVideo) {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.src = blobUrl;
        video.onloadedmetadata = () => {
          const dur = Math.min(
            Math.max((video.duration || 5) * 1000, 1000),
            MAX_VIDEO_MS
          );
          setMediaType("video");
          setMediaUrl(data);
          setDurationMs(dur);
          setAspect(detectAspect(video.videoWidth, video.videoHeight));
          setLoadingFile(false);
          URL.revokeObjectURL(blobUrl);
        };
        video.onerror = () => {
          setError("Não foi possível ler o vídeo.");
          setLoadingFile(false);
          URL.revokeObjectURL(blobUrl);
        };
      } else {
        const img = new Image();
        img.onload = () => {
          setMediaType("image");
          setMediaUrl(data);
          setDurationMs(5000);
          setAspect(detectAspect(img.naturalWidth, img.naturalHeight));
          setLoadingFile(false);
          URL.revokeObjectURL(blobUrl);
        };
        img.onerror = () => {
          setMediaType("image");
          setMediaUrl(data);
          setDurationMs(5000);
          setAspect("9:16");
          setLoadingFile(false);
          URL.revokeObjectURL(blobUrl);
        };
        img.src = blobUrl;
      }
    };
    reader.onerror = () => {
      setError("Falha ao ler o arquivo.");
      setLoadingFile(false);
      URL.revokeObjectURL(blobUrl);
    };
    reader.readAsDataURL(file);
  }

  function commitText() {
    const t = textDraft.trim();
    if (!t) {
      setTool("none");
      return;
    }
    const id = uid("ov");
    setOverlays((list) => [
      ...list,
      {
        id,
        type: "text",
        text: t.slice(0, 140),
        x: 50,
        y: 42,
        color: textColor,
        scale: 1,
        bg: textBg,
      },
    ]);
    setSelectedId(id);
    setTextDraft("");
    setTool("none");
  }

  function addEmoji(emoji: string) {
    const id = uid("ov");
    setOverlays((list) => [
      ...list,
      {
        id,
        type: "emoji",
        emoji,
        x: 50,
        y: 48,
        scale: 1.15,
      },
    ]);
    setSelectedId(id);
    setEmojiOpen(false);
    setTool("none");
  }

  function addCustomEmoji(shortcode: string, imageUrl: string) {
    const name = shortcode.replace(/^:|:$/g, "");
    const id = uid("ov");
    setOverlays((list) => [
      ...list,
      {
        id,
        type: "custom-emoji",
        shortcode: name,
        imageUrl,
        x: 50,
        y: 48,
        scale: 1.1,
      },
    ]);
    setSelectedId(id);
    setEmojiOpen(false);
    setTool("none");
  }

  function onPickCustom(shortcode: string) {
    const name = shortcode.replace(/^:|:$/g, "").toLowerCase();
    const found = useEmojiStore
      .getState()
      .emojis.find((e) => e.name.toLowerCase() === name);
    addCustomEmoji(name, found?.imageUrl || "");
  }

  function addLocation(label: string) {
    const id = uid("ov");
    setOverlays((list) => [
      ...list.filter((o) => o.type !== "location"),
      {
        id,
        type: "location",
        label: label.slice(0, 48),
        x: 50,
        y: 78,
      },
    ]);
    setSelectedId(id);
    setTool("none");
    setLocationQuery("");
    setPlaceResults([]);
  }

  async function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocalização indisponível.");
      return;
    }
    setGeoLoading(true);
    setError("");
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: false,
          timeout: 10000,
        })
      );
      const place = await reverseGeocode(
        pos.coords.latitude,
        pos.coords.longitude
      );
      addLocation(place?.label || "Minha localização");
    } catch {
      setError("Não foi possível obter a localização.");
    } finally {
      setGeoLoading(false);
    }
  }

  function moveOverlay(id: string, x: number, y: number) {
    setOverlays((list) =>
      list.map((o) => (o.id === id ? { ...o, x, y } : o))
    );
  }

  function scaleOverlay(id: string, scale: number) {
    setOverlays((list) =>
      list.map((o) => {
        if (o.id !== id) return o;
        if (
          o.type === "text" ||
          o.type === "emoji" ||
          o.type === "custom-emoji"
        ) {
          return { ...o, scale };
        }
        return o;
      })
    );
  }

  function deleteOverlay(id: string) {
    setOverlays((list) => list.filter((o) => o.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function nudgeScale(delta: number) {
    if (!selected) return;
    if (
      selected.type !== "text" &&
      selected.type !== "emoji" &&
      selected.type !== "custom-emoji"
    ) {
      return;
    }
    const next = Math.min(3, Math.max(0.45, (selected.scale || 1) + delta));
    scaleOverlay(selected.id, next);
  }

  function updateSelectedTextStyle(patch: {
    color?: string;
    bg?: boolean;
  }) {
    if (!selected || selected.type !== "text") return;
    if (patch.color) setTextColor(patch.color);
    if (typeof patch.bg === "boolean") setTextBg(patch.bg);
    setOverlays((list) =>
      list.map((o) => {
        if (o.id !== selected.id || o.type !== "text") return o;
        return {
          ...o,
          color: patch.color ?? o.color,
          bg: typeof patch.bg === "boolean" ? patch.bg : o.bg,
        };
      })
    );
  }

  function onDragState(isDragging: boolean, trash?: boolean) {
    setDragging(isDragging);
    setOverTrash(!!trash);
  }

  async function publish() {
    if (!mediaUrl || saving) return;
    // se está digitando texto, commita antes
    if (tool === "text" && textDraft.trim()) commitText();
    setSaving(true);
    setError("");
    try {
      const res = await addStory({
        authorId: user.id,
        authorName: user.name,
        authorAvatar: user.avatar,
        authorAvatarUrl: user.avatarUrl,
        mediaType,
        mediaUrl,
        aspect,
        durationMs,
        overlays,
      });
      if (!res.ok) {
        setError(res.error);
        setSaving(false);
        return;
      }
      onCreated?.();
      onClose();
    } catch {
      setError("Falha ao publicar. Tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  function openTool(next: Tool) {
    setSelectedId(null);
    if (next === "emoji") {
      setEmojiOpen(true);
      setTool("emoji");
      return;
    }
    setEmojiOpen(false);
    setTool((t) => (t === next ? "none" : next));
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[210] bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Criar story"
            className="relative mx-auto flex h-full w-full max-w-lg flex-col"
          >
            {/* ─── PICK MEDIA ─── */}
            {!mediaUrl && (
              <div className="flex h-full flex-col">
                <TopBar
                  onClose={onClose}
                  title="Novo story"
                  right={null}
                />
                <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-20">
                  <motion.button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    whileTap={reduce ? undefined : { scale: 0.98 }}
                    className={cn(
                      "group relative w-full max-w-sm overflow-hidden rounded-[1.75rem]",
                      "bg-gradient-to-b from-white/[0.12] to-white/[0.04]",
                      "ring-1 ring-white/15",
                      "px-6 py-16 text-center shadow-[0_24px_64px_-24px_rgb(0_0_0/0.8)]"
                    )}
                  >
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-lg transition group-hover:scale-105">
                      {loadingFile ? (
                        <SpinnerGap size={28} className="animate-spin" />
                      ) : (
                        <div className="flex items-center gap-0.5">
                          <ImageIcon size={22} weight="fill" />
                          <VideoCamera size={22} weight="fill" />
                        </div>
                      )}
                    </div>
                    <p className="text-lg font-semibold tracking-tight text-white">
                      {loadingFile ? "Carregando…" : "Toque para escolher"}
                    </p>
                    <p className="mt-2 text-sm text-white/50">
                      Foto · GIF · Vídeo vertical (9:16 / 16:9)
                    </p>
                    <p className="mt-1 text-xs text-white/35">
                      Até 30s · some em 24h
                    </p>
                  </motion.button>

                  {error && (
                    <p className="text-sm font-medium text-red-400">{error}</p>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/mp4,video/webm,video/quicktime,video/*"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
              </div>
            )}

            {/* ─── EDITOR ─── */}
            {mediaUrl && (
              <>
                {/* canvas full-bleed */}
                <div
                  className="absolute inset-0 overflow-hidden bg-neutral-950"
                  onPointerDown={(e) => {
                    // desmarca se tocou o fundo (não um overlay)
                    if (e.target === e.currentTarget) setSelectedId(null);
                  }}
                >
                  {mediaType === "video" ? (
                    <video
                      src={mediaUrl}
                      className="h-full w-full object-cover"
                      autoPlay
                      muted
                      loop
                      playsInline
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  )}

                  {/* vignette for depth */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/55" />

                  <StoryOverlays
                    overlays={overlays}
                    interactive
                    selectedId={selectedId}
                    onSelect={(id) => {
                      setSelectedId(id);
                      if (id) {
                        setTool("none");
                        setEmojiOpen(false);
                      }
                    }}
                    onMove={moveOverlay}
                    onScale={scaleOverlay}
                    onDelete={deleteOverlay}
                    onDragState={onDragState}
                  />

                  <StoryTrashZone active={dragging} hot={overTrash} />

                  {/* live text draft preview (before commit) */}
                  {tool === "text" && textDraft.trim() && (
                    <div className="pointer-events-none absolute left-1/2 top-[42%] z-[7] max-w-[85%] -translate-x-1/2 -translate-y-1/2 text-center">
                      <p
                        className={cn(
                          "px-3 py-1.5 text-[22px] font-bold leading-snug drop-shadow-lg",
                          textBg && "rounded-lg bg-black/55"
                        )}
                        style={{ color: textColor }}
                      >
                        {textDraft}
                      </p>
                    </div>
                  )}
                </div>

                {/* top chrome */}
                <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                  <button
                    type="button"
                    onClick={onClose}
                    className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur-md ring-1 ring-white/10 transition active:scale-95"
                    aria-label="Fechar"
                  >
                    <X size={20} weight="bold" />
                  </button>

                  <div className="pointer-events-none flex flex-col items-center pt-1.5">
                    <span className="rounded-full bg-black/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70 backdrop-blur-sm">
                      {aspect} · {mediaType === "video" ? "vídeo" : "foto"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={publish}
                    disabled={saving}
                    className={cn(
                      "pointer-events-auto inline-flex h-11 min-w-[6.5rem] items-center justify-center gap-1.5 rounded-full px-5",
                      "bg-white text-[13px] font-bold text-black shadow-lg",
                      "transition active:scale-95 disabled:opacity-50"
                    )}
                  >
                    {saving ? (
                      <SpinnerGap size={16} className="animate-spin" />
                    ) : (
                      "Publicar"
                    )}
                  </button>
                </div>

                {/* right tool rail — Instagram style */}
                <div
                  className={cn(
                    "absolute right-2.5 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-2.5 transition-opacity",
                    (dragging || tool === "text") && "pointer-events-none opacity-0"
                  )}
                >
                  <SideTool
                    active={tool === "text"}
                    label="Aa"
                    onClick={() => openTool("text")}
                    icon={<TextT size={22} weight="bold" />}
                  />
                  <SideTool
                    active={tool === "emoji" || emojiOpen}
                    label="Emoji"
                    onClick={() => openTool("emoji")}
                    icon={<Smiley size={22} weight="fill" />}
                  />
                  <SideTool
                    active={tool === "location"}
                    label="Local"
                    onClick={() => openTool("location")}
                    icon={<MapPin size={22} weight="fill" />}
                  />
                  <SideTool
                    active={false}
                    label="Mídia"
                    onClick={() => {
                      setOverlays([]);
                      setSelectedId(null);
                      setMediaUrl(null);
                      fileRef.current?.click();
                    }}
                    icon={
                      mediaType === "video" ? (
                        <VideoCamera size={22} weight="fill" />
                      ) : (
                        <ImageIcon size={22} weight="fill" />
                      )
                    }
                  />
                </div>

                {/* selection inspector (bottom floating) */}
                <AnimatePresence>
                  {selected && !dragging && tool === "none" && !emojiOpen && (
                    <motion.div
                      initial={
                        reduce ? { opacity: 0 } : { opacity: 0, y: 12 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-40 w-[min(100%-1.5rem,360px)] -translate-x-1/2"
                    >
                      <div className="flex items-center gap-2 rounded-2xl bg-black/70 p-2 shadow-2xl ring-1 ring-white/15 backdrop-blur-xl">
                        {(selected.type === "text" ||
                          selected.type === "emoji" ||
                          selected.type === "custom-emoji") && (
                          <>
                            <InspectorBtn
                              onClick={() => nudgeScale(-0.12)}
                              label="Menor"
                            >
                              <Minus size={16} weight="bold" />
                            </InspectorBtn>
                            <InspectorBtn
                              onClick={() => nudgeScale(0.12)}
                              label="Maior"
                            >
                              <Plus size={16} weight="bold" />
                            </InspectorBtn>
                          </>
                        )}

                        {selected.type === "text" && (
                          <>
                            <div className="mx-0.5 h-6 w-px bg-white/15" />
                            {TEXT_COLORS.slice(0, 5).map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() =>
                                  updateSelectedTextStyle({ color: c })
                                }
                                className={cn(
                                  "h-7 w-7 shrink-0 rounded-full ring-2 transition active:scale-90",
                                  selected.color === c
                                    ? "ring-white scale-110"
                                    : "ring-transparent"
                                )}
                                style={{ background: c }}
                                aria-label={`Cor ${c}`}
                              />
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedTextStyle({
                                  bg: !selected.bg,
                                })
                              }
                              className={cn(
                                "ml-0.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition",
                                selected.bg
                                  ? "bg-white text-black"
                                  : "bg-white/15 text-white"
                              )}
                            >
                              Fundo
                            </button>
                          </>
                        )}

                        <div className="flex-1" />
                        <button
                          type="button"
                          onClick={() => deleteOverlay(selected.id)}
                          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-red-500 px-3.5 text-[13px] font-bold text-white shadow-md transition active:scale-95"
                        >
                          <Trash size={15} weight="bold" />
                          Apagar
                        </button>
                      </div>
                      <p className="mt-1.5 text-center text-[10px] font-medium text-white/45">
                        Arraste para mover · solte na lixeira · Del apaga
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* TEXT sheet */}
                <AnimatePresence>
                  {tool === "text" && (
                    <Sheet onClose={() => setTool("none")} reduce={!!reduce}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                        Texto
                      </p>
                      <textarea
                        ref={textInputRef}
                        value={textDraft}
                        onChange={(e) =>
                          setTextDraft(e.target.value.slice(0, 140))
                        }
                        placeholder="Escreva algo…"
                        rows={3}
                        className="w-full resize-none rounded-2xl bg-white/10 px-4 py-3 text-base font-semibold text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-white/30"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            commitText();
                          }
                        }}
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {TEXT_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setTextColor(c)}
                            className={cn(
                              "h-8 w-8 rounded-full ring-2 transition active:scale-90",
                              textColor === c
                                ? "ring-white scale-110"
                                : "ring-transparent"
                            )}
                            style={{ background: c }}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setTextBg((v) => !v)}
                          className={cn(
                            "rounded-full px-3 py-1.5 text-xs font-bold",
                            textBg
                              ? "bg-white text-black"
                              : "bg-white/15 text-white"
                          )}
                        >
                          Fundo
                        </button>
                        <button
                          type="button"
                          onClick={commitText}
                          disabled={!textDraft.trim()}
                          className="ml-auto rounded-full bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-40"
                        >
                          Colocar
                        </button>
                      </div>
                    </Sheet>
                  )}
                </AnimatePresence>

                {/* LOCATION sheet */}
                <AnimatePresence>
                  {tool === "location" && (
                    <Sheet
                      onClose={() => setTool("none")}
                      reduce={!!reduce}
                    >
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                        Localização
                      </p>
                      <div className="flex gap-2">
                        <input
                          value={locationQuery}
                          onChange={(e) => setLocationQuery(e.target.value)}
                          placeholder="Buscar lugar…"
                          autoFocus
                          className="min-w-0 flex-1 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-white/30"
                        />
                        <button
                          type="button"
                          onClick={useMyLocation}
                          disabled={geoLoading}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-sky-500 px-3.5 text-sm font-bold text-white disabled:opacity-60"
                        >
                          <NavigationArrow size={16} weight="fill" />
                          {geoLoading ? "…" : "GPS"}
                        </button>
                      </div>
                      {placeLoading && (
                        <p className="mt-2 text-xs text-white/45">Buscando…</p>
                      )}
                      <ul className="mt-2 max-h-44 space-y-0.5 overflow-y-auto">
                        {visiblePlaceResults.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => addLocation(p.label)}
                              className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/10 active:bg-white/15"
                            >
                              <MapPin
                                size={16}
                                weight="fill"
                                className="mt-0.5 shrink-0 text-sky-300"
                              />
                              <span>
                                <span className="block text-sm font-semibold text-white">
                                  {p.label}
                                </span>
                                {p.secondary && (
                                  <span className="block text-xs text-white/45">
                                    {p.secondary}
                                  </span>
                                )}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </Sheet>
                  )}
                </AnimatePresence>

                {/* EMOJI sheet */}
                <AnimatePresence>
                  {emojiOpen && (
                    <Sheet
                      onClose={() => {
                        setEmojiOpen(false);
                        setTool("none");
                      }}
                      reduce={!!reduce}
                      tall
                    >
                      <EmojiPicker
                        open
                        onClose={() => {
                          setEmojiOpen(false);
                          setTool("none");
                        }}
                        onPickUnicode={addEmoji}
                        onPickCustom={onPickCustom}
                        isVip={vipPlan}
                        userId={user.id}
                        userName={user.name}
                        panelRef={emojiPanelRef}
                        className="!static !mt-0 !max-h-[min(50dvh,360px)] w-full border-0 bg-transparent shadow-none"
                      />
                    </Sheet>
                  )}
                </AnimatePresence>

                {error && (
                  <div className="absolute bottom-28 left-1/2 z-50 max-w-sm -translate-x-1/2 rounded-full bg-red-500/90 px-4 py-2 text-center text-xs font-semibold text-white shadow-lg">
                    {error}
                  </div>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/mp4,video/webm,video/quicktime,video/*"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function TopBar({
  onClose,
  title,
  right,
}: {
  onClose: () => void;
  title: string;
  right: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/10"
        aria-label="Fechar"
      >
        <X size={20} weight="bold" />
      </button>
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="min-w-[2.75rem]">{right}</div>
    </div>
  );
}

function SideTool({
  active,
  label,
  onClick,
  icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center gap-0.5",
        "transition active:scale-90"
      )}
      aria-label={label}
      aria-pressed={active}
    >
      <span
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full shadow-lg ring-1 backdrop-blur-md transition",
          active
            ? "bg-white text-black ring-white"
            : "bg-black/45 text-white ring-white/15 hover:bg-black/60"
        )}
      >
        {icon}
      </span>
      <span className="text-[9px] font-semibold text-white/70 drop-shadow">
        {label}
      </span>
    </button>
  );
}

function InspectorBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white transition active:scale-90"
    >
      {children}
    </button>
  );
}

function Sheet({
  children,
  onClose,
  reduce,
  tall,
}: {
  children: ReactNode;
  onClose: () => void;
  reduce: boolean;
  tall?: boolean;
}) {
  return (
    <motion.div
      className="absolute inset-x-0 bottom-0 z-50"
      initial={reduce ? { opacity: 0 } : { y: "100%" }}
      animate={reduce ? { opacity: 1 } : { y: 0 }}
      exit={reduce ? { opacity: 0 } : { y: "100%" }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
    >
      <button
        type="button"
        className="absolute inset-x-0 -top-[40dvh] bottom-full"
        aria-label="Fechar painel"
        onClick={onClose}
      />
      <div
        className={cn(
          "rounded-t-3xl bg-[#121212]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_48px_rgb(0_0_0/0.5)] ring-1 ring-white/10 backdrop-blur-xl",
          tall && "max-h-[min(58dvh,420px)] overflow-hidden"
        )}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        {children}
      </div>
    </motion.div>
  );
}

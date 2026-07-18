"use client";

import { EmojiPicker } from "@/components/emoji-picker";
import { HashtagSuggestMenu } from "@/components/hashtag-suggest-menu";
import { ImageCropEditor } from "@/components/image-crop-editor";
import { PostMusicAttach } from "@/components/post-music-attach";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useHashtagSuggest } from "@/hooks/use-hashtag-suggest";
import {
  reverseGeocode,
  searchPlaces,
  type PlaceSuggestion,
} from "@/lib/geocode";
import { validatePostHashtags } from "@/lib/community-hashtags";
import { useCommunityStore } from "@/lib/community-store";
import { useForumStore } from "@/lib/forum-store";
import {
  fetchTrendingGifs,
  pickGifPostUrl,
  searchGifs,
  type GifItem,
} from "@/lib/giphy";
import {
  fileToObjectUrl,
  getImageFileFromClipboard,
  revokeObjectUrl,
} from "@/lib/image";
import { maxPostChars } from "@/lib/post-limits";
import { consumeRateLimit } from "@/lib/rate-limit";
import type { PostMusic } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Crop as CropIcon,
  Gif,
  Image as ImageIcon,
  MagnifyingGlass,
  MapPin,
  MusicNotes,
  NavigationArrow,
  Smiley,
  SpinnerGap,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type ClipboardEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const PLACEHOLDERS = [
  "No que você está pensando?",
  "Como está o seu dia?",
  "O que rolou na sua rotina hoje?",
  "Compartilha um momento…",
  "Qual foi a melhor parte do seu dia?",
];

type Props = {
  open: boolean;
  onClose: () => void;
  /** Chamado após publicar com sucesso */
  onPublished?: () => void;
};

/**
 * Modal profissional de nova postagem (aberto pelo FAB +).
 * Não depende da página do feed — funciona em qualquer rota /app.
 */
export function ComposePostModal({ open, onClose, onPublished }: Props) {
  const { user, isVip } = useAuth();
  const createPost = useForumStore((s) => s.createPost);
  const communities = useCommunityStore((s) => s.communities);
  const reduce = useReducedMotion();
  const vipPlan = !!isVip || user?.role === "admin" || user?.role === "vip";
  const maxChars = maxPostChars(vipPlan);

  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [gifPreview, setGifPreview] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [showLocation, setShowLocation] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [music, setMusic] = useState<PostMusic | null>(null);
  const [gifQ, setGifQ] = useState("");
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [placeResults, setPlaceResults] = useState<PlaceSuggestion[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [placeholder] = useState(
    () => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const gifPanelRef = useRef<HTMLDivElement>(null);
  const gifBtnRef = useRef<HTMLButtonElement>(null);
  const cropSourceRef = useRef<string | null>(null);
  const searchAbort = useRef<AbortController | null>(null);

  const hashtagSuggest = useHashtagSuggest({
    content,
    setContent,
    communities,
    author: {
      role: user?.role,
      isVip: !!isVip || user?.role === "vip" || user?.role === "admin",
    },
    textareaRef,
    maxChars,
  });

  const reset = useCallback(() => {
    setContent("");
    setImageUrl(null);
    setGifUrl(null);
    setGifPreview(null);
    revokeObjectUrl(cropSourceRef.current);
    cropSourceRef.current = null;
    setCropSource(null);
    setCropOpen(false);
    setLocation("");
    setLocationQuery("");
    setShowLocation(false);
    setShowEmoji(false);
    setShowGif(false);
    setShowMusic(false);
    setMusic(null);
    setGifQ("");
    setGifs([]);
    setPlaceResults([]);
    setPlaceError("");
    setError("");
    setPublishing(false);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  // Reset + focus ao abrir
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      textareaRef.current?.focus({ preventScroll: true });
    }, 180);
    return () => window.clearTimeout(t);
  }, [open]);

  // Esc fecha
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !cropOpen) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, cropOpen, onClose]);

  // Lock scroll do body
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 88), 220)}px`;
  }, [content, open]);

  useEffect(() => {
    if (!showLocation || !open) return;
    const q = locationQuery.trim();
    if (q.length < 2) {
      setPlaceResults([]);
      setPlaceLoading(false);
      return;
    }
    setPlaceLoading(true);
    setPlaceError("");
    searchAbort.current?.abort();
    const ac = new AbortController();
    searchAbort.current = ac;
    const t = window.setTimeout(async () => {
      try {
        const results = await searchPlaces(q, ac.signal);
        if (!ac.signal.aborted) {
          setPlaceResults(results);
          setPlaceLoading(false);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (!ac.signal.aborted) {
          setPlaceResults([]);
          setPlaceLoading(false);
          setPlaceError("Falha ao buscar locais.");
        }
      }
    }, 380);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [locationQuery, showLocation, open]);

  // Busca / trending de GIFs
  useEffect(() => {
    if (!showGif || !open) return;
    let cancelled = false;
    setGifLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const list = gifQ.trim()
          ? await searchGifs(gifQ, 24)
          : await fetchTrendingGifs(24);
        if (!cancelled) setGifs(list);
      } catch {
        if (!cancelled) setGifs([]);
      } finally {
        if (!cancelled) setGifLoading(false);
      }
    }, gifQ.trim() ? 350 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [showGif, gifQ, open]);

  const insertAtCursor = useCallback(
    (chunk: string) => {
      const el = textareaRef.current;
      if (!el) {
        setContent((c) => (c + chunk).slice(0, maxChars));
        return;
      }
      const start = el.selectionStart ?? content.length;
      const end = el.selectionEnd ?? content.length;
      const next = (content.slice(0, start) + chunk + content.slice(end)).slice(
        0,
        maxChars
      );
      setContent(next);
      requestAnimationFrame(() => {
        el.focus({ preventScroll: true });
        const pos = Math.min(start + chunk.length, next.length);
        el.setSelectionRange(pos, pos);
      });
    },
    [content, maxChars]
  );

  useEffect(() => {
    setContent((c) => (c.length > maxChars ? c.slice(0, maxChars) : c));
  }, [maxChars]);

  function releaseCropSource() {
    revokeObjectUrl(cropSourceRef.current);
    cropSourceRef.current = null;
    setCropSource(null);
  }

  function clearGif() {
    setGifUrl(null);
    setGifPreview(null);
  }

  function pickGif(g: GifItem) {
    // GIF e imagem se excluem (uma mídia principal por post)
    setImageUrl(null);
    releaseCropSource();
    setCropOpen(false);
    if (fileRef.current) fileRef.current.value = "";
    // Sempre variante leve (WebP ~200w) — nunca original giphy.gif
    setGifUrl(pickGifPostUrl(g));
    setGifPreview(g.previewUrl || pickGifPostUrl(g));
    setShowGif(false);
    setShowEmoji(false);
    setError("");
  }

  function onPickImage(file: File | null) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Envie uma imagem (JPG, PNG ou WebP).");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("A imagem deve ter no máximo 4 MB.");
      return;
    }
    clearGif();
    releaseCropSource();
    const url = fileToObjectUrl(file);
    cropSourceRef.current = url;
    setCropSource(url);
    setCropOpen(true);
    setShowEmoji(false);
    setShowGif(false);
  }

  /** Desktop: Ctrl+V / colar print no modal de post */
  function onComposerPaste(e: ClipboardEvent) {
    const file = getImageFileFromClipboard(e.clipboardData);
    if (!file) return;
    e.preventDefault();
    onPickImage(file);
  }

  function clearImage() {
    setImageUrl(null);
    releaseCropSource();
    setCropOpen(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleCropConfirm(dataUrl: string) {
    setImageUrl(dataUrl);
    setCropOpen(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleCropCancel() {
    setCropOpen(false);
    if (!imageUrl) {
      releaseCropSource();
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function selectPlace(place: PlaceSuggestion) {
    setLocation(place.label);
    setLocationQuery(place.label);
    setPlaceResults([]);
    setPlaceError("");
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setPlaceError("Seu navegador não suporta geolocalização.");
      return;
    }
    setGeoLoading(true);
    setPlaceError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const place = await reverseGeocode(
            pos.coords.latitude,
            pos.coords.longitude
          );
          if (place) selectPlace(place);
          else setPlaceError("Não encontramos um endereço.");
        } catch {
          setPlaceError("Não foi possível obter o endereço.");
        } finally {
          setGeoLoading(false);
        }
      },
      () => {
        setGeoLoading(false);
        setPlaceError("Permissão de localização negada.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 }
    );
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || publishing) return;
    const text = content.trim();
    if (!text && !imageUrl && !gifUrl && !music) return;
    if (content.length > maxChars) {
      setError(
        vipPlan
          ? `Máximo de ${maxChars} caracteres no VIP.`
          : `Máximo de ${maxChars} caracteres no plano free. VIP: até 1.000.`
      );
      return;
    }

    const rl = consumeRateLimit(user.id, "post", {
      isVip: !!isVip || user.role === "vip",
      isAdmin: user.role === "admin",
    });
    if (!rl.ok) {
      setError(rl.error);
      return;
    }

    const tagCheck = validatePostHashtags(text || "", communities, {
      role: user.role,
      isVip: !!isVip || user.role === "vip",
    });
    if (!tagCheck.ok) {
      setError(tagCheck.error);
      return;
    }

    const matched = tagCheck.matched;
    // Primeiro assunto marcado; se algum for VIP, o post herda vipOnly no detalhe
    const primary = matched[0];
    const anyVipOnly = matched.some(
      (c) => c.access === "vip" || c.vipOnly
    );

    setPublishing(true);
    try {
      const hashtag =
        primary?.hashtag?.replace(/^#/, "").toLowerCase() || null;
      await createPost({
        authorId: user.id,
        authorName: user.name,
        authorAvatar: user.avatar,
        authorAvatarUrl: user.avatarUrl,
        content: text || " ",
        imageUrl: gifUrl ? null : imageUrl,
        gifUrl: gifUrl || null,
        location: location.trim() || null,
        music: music || null,
        type: "discussion",
        communityId: primary?.id,
        communityName: primary?.name,
        vipOnly: anyVipOnly,
        hashtag,
      });
      reset();
      onPublished?.();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível publicar. Tente de novo."
      );
      setPublishing(false);
    }
  }

  const canPost =
    !!user &&
    (content.trim().length > 0 || !!imageUrl || !!gifUrl || !!music) &&
    content.length <= maxChars &&
    !publishing;

  return (
    <>
      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="compose-modal-title"
          >
            {/* Backdrop com profundidade */}
            <motion.button
              type="button"
              aria-label="Fechar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-[3px]"
              onClick={handleClose}
            />

            <motion.div
              initial={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, y: 28, scale: 0.97 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, y: 16, scale: 0.98 }
              }
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className={cn(
                "pointer-events-auto relative z-10 flex w-full max-w-lg flex-col",
                "max-h-[min(92dvh,720px)] overflow-hidden",
                "rounded-t-3xl border-2 border-[#1f1f1f] bg-white sm:rounded-3xl",
                "shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_24px_64px_-12px_rgb(0_0_0/0.45),0_8px_24px_-8px_rgb(0_0_0/0.2)]",
                "dark:border-zinc-100 dark:bg-[#141414]",
                "dark:shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_24px_64px_-12px_rgb(0_0_0/0.7)]"
              )}
            >
              {/* Handle mobile */}
              <div className="flex justify-center pt-2 sm:hidden">
                <span className="h-1 w-10 rounded-full bg-neutral-300 dark:bg-zinc-600" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b-2 border-[#1f1f1f]/10 px-5 pb-3 pt-3 dark:border-zinc-700 sm:pt-4">
                <div className="min-w-0">
                  <h2
                    id="compose-modal-title"
                    className="text-base font-bold tracking-tight text-[#1f1f1f] dark:text-zinc-50"
                  >
                    Nova postagem
                  </h2>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Compartilhe com a comunidade Nullysh
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className={cn(
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    "border-2 border-[#1f1f1f] bg-white text-[#1f1f1f]",
                    "shadow-[0_2px_8px_-2px_rgb(0_0_0/0.2)]",
                    "transition hover:bg-neutral-50 active:scale-95",
                    "dark:border-zinc-100 dark:bg-zinc-900 dark:text-zinc-100"
                  )}
                  aria-label="Fechar"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>

              {/* Body */}
              <form
                onSubmit={onSubmit}
                onPaste={onComposerPaste}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                  <div className="flex gap-3">
                    <Avatar
                      name={user?.name || "U"}
                      src={user?.avatarUrl}
                      size="md"
                    />
                    <div className="relative min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#1f1f1f] dark:text-zinc-100">
                        {user?.name || "Você"}
                      </p>
                      <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => {
                          const el = e.target;
                          hashtagSuggest.onChangeText(
                            el.value,
                            el.selectionStart ?? el.value.length
                          );
                        }}
                        onKeyDown={hashtagSuggest.onKeyDown}
                        onPaste={onComposerPaste}
                        onClick={(e) => {
                          const el = e.currentTarget;
                          hashtagSuggest.refreshFromCaret(
                            el.value,
                            el.selectionStart ?? el.value.length
                          );
                        }}
                        onBlur={() => {
                          window.setTimeout(() => hashtagSuggest.close(), 120);
                        }}
                        placeholder={placeholder}
                        rows={3}
                        className={cn(
                          "composer-input mt-1 w-full resize-none border-0 bg-transparent",
                          "text-[16px] leading-relaxed text-[#0f1419]",
                          "placeholder:text-neutral-400 outline-none",
                          "dark:text-zinc-100 dark:placeholder:text-zinc-500",
                          "min-h-[88px]"
                        )}
                      />
                      {hashtagSuggest.open && (
                        <HashtagSuggestMenu
                          items={hashtagSuggest.items}
                          activeIndex={hashtagSuggest.activeIndex}
                          onSelect={hashtagSuggest.select}
                          onHover={hashtagSuggest.setActiveIndex}
                          className="absolute left-0 right-0 top-full z-40 mt-1"
                        />
                      )}
                    </div>
                  </div>

                  {imageUrl && !gifUrl && (
                    <div
                      className={cn(
                        "relative mt-3 overflow-hidden rounded-2xl",
                        "border-2 border-[#1f1f1f]/15 bg-neutral-100",
                        "shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_4px_16px_-6px_rgb(0_0_0/0.15)]",
                        "dark:border-zinc-600 dark:bg-zinc-900"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl}
                        alt="Prévia"
                        className="max-h-[min(280px,40vh)] w-full object-contain"
                      />
                      <div className="absolute right-2 top-2 z-10 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (cropSource) setCropOpen(true);
                            else if (imageUrl) {
                              setCropSource(imageUrl);
                              setCropOpen(true);
                            }
                          }}
                          className="inline-flex h-8 items-center gap-1 rounded-full border border-white/20 bg-black/75 px-2.5 text-[11px] font-semibold text-white shadow-md backdrop-blur-sm"
                        >
                          <CropIcon size={14} weight="bold" />
                          Ajustar
                        </button>
                        <button
                          type="button"
                          onClick={clearImage}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/75 text-white shadow-md backdrop-blur-sm"
                          aria-label="Remover imagem"
                        >
                          <X size={16} weight="bold" />
                        </button>
                      </div>
                    </div>
                  )}

                  {gifUrl && (
                    <div className="relative mt-3 inline-flex max-w-[min(100%,280px)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={gifPreview || gifUrl}
                        alt="GIF selecionado"
                        className="max-h-52 max-w-full rounded-2xl object-cover ring-1 ring-black/5 dark:ring-white/10"
                      />
                      <button
                        type="button"
                        onClick={clearGif}
                        className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition hover:bg-black"
                        aria-label="Remover GIF"
                      >
                        <X size={16} weight="bold" />
                      </button>
                    </div>
                  )}

                  {(showMusic || music) && (
                    <div className="mt-3">
                      <PostMusicAttach value={music} onChange={setMusic} />
                    </div>
                  )}

                  {/* Painéis no fluxo do body (para baixo) — evita recorte do overflow do modal */}
                  {showEmoji && (
                    <div className="mt-3">
                      <EmojiPicker
                        open={showEmoji}
                        onClose={() => setShowEmoji(false)}
                        onPickUnicode={(emoji) => {
                          insertAtCursor(emoji);
                        }}
                        onPickCustom={(shortcode) => {
                          insertAtCursor(shortcode);
                        }}
                        isVip={!!isVip}
                        userId={user?.id}
                        userName={user?.name}
                        isAdmin={user?.role === "admin"}
                        panelRef={emojiPanelRef}
                        variant="inline"
                      />
                    </div>
                  )}

                  {showGif && (
                    <div
                      ref={gifPanelRef}
                      className="mt-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-3 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.2)] dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <div className="relative min-w-0 flex-1">
                          <MagnifyingGlass
                            size={14}
                            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
                          />
                          <input
                            value={gifQ}
                            onChange={(e) => setGifQ(e.target.value)}
                            placeholder="Buscar GIF…"
                            className="h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-8 pr-3 text-[13px] dark:border-zinc-700 dark:bg-zinc-800"
                            autoFocus
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowGif(false)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-zinc-800"
                          aria-label="Fechar GIFs"
                        >
                          <X size={16} weight="bold" />
                        </button>
                      </div>
                      {gifLoading ? (
                        <p className="flex items-center justify-center gap-2 py-8 text-[12px] text-neutral-400">
                          <SpinnerGap size={16} className="animate-spin" />
                          Buscando GIFs…
                        </p>
                      ) : gifs.length === 0 ? (
                        <p className="py-6 text-center text-[12px] text-neutral-400">
                          Nenhum GIF encontrado. Tente outro termo.
                        </p>
                      ) : (
                        <div className="grid max-h-52 grid-cols-3 gap-1.5 overflow-y-auto thin-scroll sm:grid-cols-4">
                          {gifs.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              title={g.title}
                              onClick={() => pickGif(g)}
                              className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100 ring-1 ring-black/5 transition hover:ring-2 hover:ring-sky-400/50 dark:bg-zinc-800"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={g.previewUrl}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {showLocation && (
                    <div
                      className={cn(
                        "relative mt-3 rounded-xl border-2 border-[#1f1f1f]/12 bg-neutral-50",
                        "shadow-[0_2px_8px_-4px_rgb(0_0_0/0.12)]",
                        "dark:border-zinc-600 dark:bg-zinc-900"
                      )}
                    >
                      <div className="flex items-center gap-2 px-3 py-2">
                        <MagnifyingGlass
                          size={16}
                          className="shrink-0 text-neutral-400"
                        />
                        <input
                          value={locationQuery}
                          onChange={(e) => {
                            setLocationQuery(e.target.value);
                            if (location) setLocation("");
                          }}
                          placeholder="Buscar cidade, bairro…"
                          className="composer-input h-8 flex-1 border-0 bg-transparent text-sm outline-none dark:text-zinc-100"
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          onClick={useMyLocation}
                          disabled={geoLoading}
                          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-sky-600 hover:bg-sky-500/10 disabled:opacity-50"
                        >
                          {geoLoading ? (
                            <SpinnerGap size={14} className="animate-spin" />
                          ) : (
                            <NavigationArrow size={14} weight="fill" />
                          )}
                          GPS
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowLocation(false);
                            if (!location) {
                              setLocationQuery("");
                              setPlaceResults([]);
                            }
                          }}
                          className="text-neutral-400 hover:text-neutral-700"
                          aria-label="Fechar localização"
                        >
                          <X size={14} weight="bold" />
                        </button>
                      </div>
                      {location && (
                        <div className="flex items-center gap-2 border-t border-[#1f1f1f]/10 px-3 py-2 dark:border-zinc-700">
                          <MapPin
                            size={14}
                            weight="fill"
                            className="text-sky-500"
                          />
                          <span className="truncate text-xs font-semibold text-sky-700 dark:text-sky-400">
                            {location}
                          </span>
                        </div>
                      )}
                      {(placeLoading ||
                        placeResults.length > 0 ||
                        placeError) && (
                        <ul className="max-h-36 overflow-y-auto border-t border-[#1f1f1f]/10 dark:border-zinc-700">
                          {placeLoading && (
                            <li className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-500">
                              <SpinnerGap
                                size={14}
                                className="animate-spin"
                              />
                              Buscando…
                            </li>
                          )}
                          {placeError && !placeLoading && (
                            <li className="px-3 py-2 text-xs text-red-600">
                              {placeError}
                            </li>
                          )}
                          {placeResults.map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                onClick={() => selectPlace(p)}
                                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-white dark:hover:bg-zinc-800"
                              >
                                <MapPin
                                  size={14}
                                  weight="fill"
                                  className="mt-0.5 shrink-0 text-sky-500"
                                />
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold">
                                    {p.label}
                                  </span>
                                  {p.secondary && (
                                    <span className="block truncate text-[11px] text-neutral-400">
                                      {p.secondary}
                                    </span>
                                  )}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {error && (
                    <p className="mt-2 text-xs font-medium text-red-600">
                      {error}
                    </p>
                  )}
                </div>

                {/* Toolbar + publish — sticky footer com profundidade */}
                <div
                  className={cn(
                    "relative border-t-2 border-[#1f1f1f]/10 bg-white px-4 py-3",
                    "shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.12)]",
                    "dark:border-zinc-700 dark:bg-[#141414]"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex items-center gap-0.5">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          onPickImage(e.target.files?.[0] ?? null)
                        }
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowEmoji(false);
                          setShowGif(false);
                          fileRef.current?.click();
                        }}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-sky-500 transition hover:bg-sky-500/10"
                        title="Imagem (ou Ctrl+V)"
                        aria-label="Adicionar imagem. No desktop, cole com Ctrl+V."
                      >
                        <ImageIcon size={22} />
                      </button>
                      <button
                        ref={emojiBtnRef}
                        type="button"
                        onClick={() => {
                          setShowGif(false);
                          setShowEmoji((v) => !v);
                        }}
                        className={cn(
                          "inline-flex h-10 w-10 items-center justify-center rounded-full transition",
                          showEmoji
                            ? "bg-sky-500/10 text-sky-500"
                            : "text-sky-500 hover:bg-sky-500/10"
                        )}
                        title="Emoji"
                        aria-label="Emoji"
                        aria-expanded={showEmoji}
                      >
                        <Smiley size={22} />
                      </button>
                      <button
                        ref={gifBtnRef}
                        type="button"
                        onClick={() => {
                          setShowEmoji(false);
                          setShowGif((v) => !v);
                        }}
                        className={cn(
                          "inline-flex h-10 w-10 items-center justify-center rounded-full transition",
                          showGif || gifUrl
                            ? "bg-sky-500/10 text-sky-500"
                            : "text-sky-500 hover:bg-sky-500/10"
                        )}
                        title="GIF"
                        aria-label="Adicionar GIF"
                        aria-expanded={showGif}
                      >
                        <Gif size={22} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowEmoji(false);
                          setShowGif(false);
                          setShowMusic(false);
                          setShowLocation((v) => !v);
                        }}
                        className={cn(
                          "inline-flex h-10 w-10 items-center justify-center rounded-full transition",
                          showLocation || location
                            ? "bg-sky-500/10 text-sky-500"
                            : "text-sky-500 hover:bg-sky-500/10"
                        )}
                        title="Localização"
                        aria-label="Localização"
                      >
                        <MapPin size={22} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowEmoji(false);
                          setShowGif(false);
                          setShowLocation(false);
                          setShowMusic((v) => !v);
                        }}
                        className={cn(
                          "inline-flex h-10 w-10 items-center justify-center rounded-full transition",
                          showMusic || music
                            ? "bg-sky-500/10 text-sky-500"
                            : "text-sky-500 hover:bg-sky-500/10"
                        )}
                        title="Música (estilo Instagram)"
                        aria-label="Adicionar música"
                        aria-expanded={showMusic}
                      >
                        <MusicNotes size={22} weight={music ? "fill" : "regular"} />
                      </button>

                    </div>

                    <div className="flex items-center gap-3">
                      {content.length > 0 && (
                        <span
                          className={cn(
                            "text-xs tabular-nums",
                            content.length > maxChars * 0.9
                              ? "font-semibold text-amber-600"
                              : "text-neutral-400"
                          )}
                          title={
                            vipPlan
                              ? "Limite VIP: 1.000 caracteres"
                              : "Limite free: 200 · VIP: 1.000"
                          }
                        >
                          {content.length}/{maxChars}
                        </span>
                      )}
                      <Button
                        type="submit"
                        disabled={!canPost}
                        className={cn(
                          "min-w-[7.5rem] shadow-[0_4px_14px_-4px_rgb(0_0_0/0.45)]",
                          "border-2 border-[#1f1f1f]"
                        )}
                      >
                        {publishing ? "Publicando…" : "Publicar"}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {cropSource && (
        <ImageCropEditor
          open={cropOpen}
          imageSrc={cropSource}
          kind="post"
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      )}
    </>
  );
}

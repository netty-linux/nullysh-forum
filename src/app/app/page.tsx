"use client";

import { EmojiPicker } from "@/components/emoji-picker";
import { HashtagSuggestMenu } from "@/components/hashtag-suggest-menu";
import { ImageCropEditor } from "@/components/image-crop-editor";
import { PostCard } from "@/components/post-card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useHashtagSuggest } from "@/hooks/use-hashtag-suggest";
import { useBlockStore } from "@/lib/block-store";
import { validatePostHashtags } from "@/lib/community-hashtags";
import { useCommunityStore } from "@/lib/community-store";
import { rankFeedPosts } from "@/lib/feed-rank";
import {
  reverseGeocode,
  searchPlaces,
  type PlaceSuggestion,
} from "@/lib/geocode";
import { useForumStore } from "@/lib/forum-store";
import { fileToObjectUrl, revokeObjectUrl } from "@/lib/image";
import { maxPostChars } from "@/lib/post-limits";
import { consumeRateLimit } from "@/lib/rate-limit";
import { cn } from "@/lib/utils";
import {
  Crop as CropIcon,
  Image as ImageIcon,
  MagnifyingGlass,
  MapPin,
  NavigationArrow,
  Smiley,
  SpinnerGap,
  X,
} from "@phosphor-icons/react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const PLACEHOLDERS = [
  "No que você está pensando?",
  "Como está o seu dia?",
  "O que rolou na sua rotina hoje?",
  "Compartilha um momento do dia a dia…",
  "Qual foi a melhor parte do seu dia?",
  "Conta o que você está construindo agora…",
];

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export default function FeedPage() {
  const { user, isVip } = useAuth();
  const posts = useForumStore((s) => s.posts);
  const createPost = useForumStore((s) => s.createPost);
  const communities = useCommunityStore((s) => s.communities);
  const blocks = useBlockStore((s) => s.blocks);
  const isEitherBlocked = useBlockStore((s) => s.isEitherBlocked);
  const vipPlan = !!isVip || user?.role === "admin" || user?.role === "vip";
  const maxChars = maxPostChars(vipPlan);

  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  /** Original (blob) para reabrir o editor de proporção */
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [showLocation, setShowLocation] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [placeResults, setPlaceResults] = useState<PlaceSuggestion[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const [placeholder] = useState(
    () => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]
  );
  const [error, setError] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const locationPanelRef = useRef<HTMLDivElement>(null);
  const searchAbort = useRef<AbortController | null>(null);
  const cropSourceRef = useRef<string | null>(null);

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

  // Ranking: qualidade (like vs dislike) × volume × freshness
  // + esconde posts de quem bloqueou / foi bloqueado por mim
  const visible = useMemo(() => {
    const filtered = user
      ? posts.filter(
          (p) =>
            p.authorId === user.id || !isEitherBlocked(user.id, p.authorId)
        )
      : posts;
    return rankFeedPosts(filtered);
    // blocks força recompute quando a lista muda
  }, [posts, user, isEitherBlocked, blocks]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 52), 220)}px`;
  }, [content]);

  // Fecha painéis ao clicar fora
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (
        showEmoji &&
        emojiPanelRef.current &&
        !emojiPanelRef.current.contains(t) &&
        emojiBtnRef.current &&
        !emojiBtnRef.current.contains(t)
      ) {
        setShowEmoji(false);
      }
      if (
        showLocation &&
        locationPanelRef.current &&
        !locationPanelRef.current.contains(t)
      ) {
        // mantém aberto se já escolheu location e só clica fora do painel de busca
        // fecha só se não tem location fixada e está vazio? melhor: fechar sugestões mas manter se tem location
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showEmoji, showLocation]);

  // Busca de locais com debounce (Nominatim)
  useEffect(() => {
    if (!showLocation) return;
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
          setPlaceError("Falha ao buscar locais. Tente de novo.");
        }
      }
    }, 380);

    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [locationQuery, showLocation]);

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

  // Se o plano mudar (ou hidratar), corta texto acima do limite
  useEffect(() => {
    setContent((c) => (c.length > maxChars ? c.slice(0, maxChars) : c));
  }, [maxChars]);

  function releaseCropSource() {
    revokeObjectUrl(cropSourceRef.current);
    cropSourceRef.current = null;
    setCropSource(null);
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
    // Abre editor de proporção em vez de colar direto no post
    releaseCropSource();
    const url = fileToObjectUrl(file);
    cropSourceRef.current = url;
    setCropSource(url);
    setCropOpen(true);
    setShowEmoji(false);
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
    // Mantém cropSource para poder reabrir e reenquadrar
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleCropCancel() {
    setCropOpen(false);
    // Se ainda não aplicou nenhuma imagem, descarta a fonte
    if (!imageUrl) {
      releaseCropSource();
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function reopenCrop() {
    if (cropSource) {
      setCropOpen(true);
      return;
    }
    // Reabre a partir da imagem já aplicada (data URL)
    if (imageUrl) {
      setCropSource(imageUrl);
      setCropOpen(true);
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
          if (place) {
            selectPlace(place);
          } else {
            setPlaceError("Não encontramos um endereço para sua posição.");
          }
        } catch {
          setPlaceError("Não foi possível obter o endereço.");
        } finally {
          setGeoLoading(false);
        }
      },
      () => {
        setGeoLoading(false);
        setPlaceError(
          "Permissão de localização negada ou indisponível. Busque pelo nome da cidade."
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 }
    );
  }

  function clearLocation() {
    setLocation("");
    setLocationQuery("");
    setPlaceResults([]);
    setShowLocation(false);
    setPlaceError("");
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const text = content.trim();
    if (!text && !imageUrl) return;

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
    const primary = matched[0];
    const anyVipOnly = matched.some(
      (c) => c.access === "vip" || c.vipOnly
    );

    createPost({
      authorId: user.id,
      authorName: user.name,
      authorAvatar: user.avatar,
      authorAvatarUrl: user.avatarUrl,
      content: text || " ",
      imageUrl,
      location: location.trim() || null,
      type: "discussion",
      communityId: primary?.id,
      communityName: primary?.name,
      vipOnly: anyVipOnly,
    });

    setContent("");
    setImageUrl(null);
    releaseCropSource();
    setCropOpen(false);
    clearLocation();
    setShowEmoji(false);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const canPost =
    !!user &&
    (content.trim().length > 0 || !!imageUrl) &&
    content.length <= maxChars;

  return (
    <div className="app-page mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Feed
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Olá,{" "}
          <span className="font-semibold text-neutral-800 dark:text-zinc-200">
            {user?.name?.split(" ")[0]}
          </span>
          . O que está rolando?
        </p>
      </div>

      {/* Composer — overflow visível para o painel de emojis */}
      <form
        id="feed-composer"
        onSubmit={onCreate}
        className="relative z-10 mb-4 rounded-2xl border border-neutral-200/90 bg-white shadow-[0_1px_3px_rgb(0_0_0/0.04)] transition-[box-shadow] duration-300 dark:border-zinc-800 dark:bg-[#141414]"
      >
        <div className="flex gap-3 p-4 sm:p-5">
          <div className="shrink-0 pt-0.5">
            <Avatar
              name={user?.name || "U"}
              src={user?.avatarUrl}
              size="md"
              frame={user?.isVip ? user.avatarFrame : null}
            />
          </div>

          <div className="relative min-w-0 flex-1">
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
              onClick={(e) => {
                const el = e.currentTarget;
                hashtagSuggest.refreshFromCaret(
                  el.value,
                  el.selectionStart ?? el.value.length
                );
              }}
              onBlur={() => {
                // delay: permite mousedown no menu
                window.setTimeout(() => hashtagSuggest.close(), 120);
              }}
              placeholder={placeholder}
              rows={2}
              className={cn(
                "composer-input w-full resize-none border-0 bg-transparent text-[17px] leading-relaxed",
                "text-[#0f1419] placeholder:text-neutral-400",
                "outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none",
                "dark:text-zinc-100 dark:placeholder:text-zinc-500",
                "min-h-[52px]"
              )}
            />

            {hashtagSuggest.open && (
              <HashtagSuggestMenu
                items={hashtagSuggest.items}
                activeIndex={hashtagSuggest.activeIndex}
                onSelect={hashtagSuggest.select}
                onHover={hashtagSuggest.setActiveIndex}
                className="absolute left-0 right-0 top-full z-30 mt-1"
              />
            )}

            {/* Preview — proporção definida no editor de crop */}
            {imageUrl && (
              <div className="relative mt-2 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 dark:border-zinc-700 dark:bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Prévia do post"
                  className="max-h-[min(420px,55vh)] w-full object-contain object-center"
                />
                <div className="absolute right-2 top-2 z-10 flex gap-1.5">
                  <button
                    type="button"
                    onClick={reopenCrop}
                    className="inline-flex h-8 items-center gap-1 rounded-full bg-black/70 px-2.5 text-[11px] font-semibold text-white backdrop-blur-sm transition hover:bg-black"
                    aria-label="Ajustar proporção"
                    title="Ajustar proporção"
                  >
                    <CropIcon size={14} weight="bold" />
                    Ajustar
                  </button>
                  <button
                    type="button"
                    onClick={clearImage}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition hover:bg-black"
                    aria-label="Remover imagem"
                  >
                    <X size={16} weight="bold" />
                  </button>
                </div>
              </div>
            )}

            {/* Localização com busca real */}
            {showLocation && (
              <div
                ref={locationPanelRef}
                className="relative mt-3 rounded-xl border border-neutral-200 bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-900"
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
                    placeholder="Buscar cidade, bairro ou endereço…"
                    className="composer-input h-8 flex-1 border-0 bg-transparent text-sm text-[#0f1419] placeholder:text-neutral-400 outline-none focus:outline-none focus-visible:outline-none dark:text-zinc-100"
                    autoFocus
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={useMyLocation}
                    disabled={geoLoading}
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-sky-600 transition hover:bg-sky-500/10 disabled:opacity-50"
                    title="Usar minha localização"
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
                    onClick={clearLocation}
                    className="text-neutral-400 hover:text-neutral-700"
                    aria-label="Fechar localização"
                  >
                    <X size={14} weight="bold" />
                  </button>
                </div>

                {location && (
                  <div className="flex items-center gap-2 border-t border-neutral-200 px-3 py-2 dark:border-zinc-700">
                    <MapPin
                      size={14}
                      weight="fill"
                      className="shrink-0 text-sky-500"
                    />
                    <span className="truncate text-xs font-semibold text-sky-700 dark:text-sky-400">
                      {location}
                    </span>
                  </div>
                )}

                {(placeLoading ||
                  placeResults.length > 0 ||
                  placeError ||
                  (locationQuery.trim().length >= 2 &&
                    !placeLoading &&
                    placeResults.length === 0)) && (
                  <ul className="max-h-48 overflow-y-auto border-t border-neutral-200 dark:border-zinc-700">
                    {placeLoading && (
                      <li className="flex items-center gap-2 px-3 py-2.5 text-xs text-neutral-500">
                        <SpinnerGap size={14} className="animate-spin" />
                        Buscando locais reais…
                      </li>
                    )}
                    {placeError && !placeLoading && (
                      <li className="px-3 py-2.5 text-xs text-red-600">
                        {placeError}
                      </li>
                    )}
                    {!placeLoading &&
                      !placeError &&
                      locationQuery.trim().length >= 2 &&
                      placeResults.length === 0 && (
                        <li className="px-3 py-2.5 text-xs text-neutral-500">
                          Nenhum local encontrado. Tente outro termo.
                        </li>
                      )}
                    {placeResults.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => selectPlace(p)}
                          className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition hover:bg-white dark:hover:bg-zinc-800"
                        >
                          <MapPin
                            size={14}
                            weight="fill"
                            className="mt-0.5 shrink-0 text-sky-500"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-[#1f1f1f] dark:text-zinc-100">
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
              <p className="mt-2 text-xs font-medium text-red-600">{error}</p>
            )}

            {/* Toolbar */}
            <div className="relative mt-3 flex items-center justify-between gap-2 border-t border-neutral-100 pt-3 dark:border-zinc-800">
              <div className="flex items-center gap-0.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                />

                <button
                  type="button"
                  onClick={() => {
                    setShowEmoji(false);
                    fileRef.current?.click();
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sky-500 transition hover:bg-sky-500/10"
                  title="Adicionar imagem"
                  aria-label="Adicionar imagem"
                >
                  <ImageIcon size={20} />
                </button>

                <button
                  ref={emojiBtnRef}
                  type="button"
                  onClick={() => {
                    setShowEmoji((v) => !v);
                  }}
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-full transition",
                    showEmoji
                      ? "bg-sky-500/10 text-sky-500"
                      : "text-sky-500 hover:bg-sky-500/10"
                  )}
                  title="Emoji"
                  aria-label="Adicionar emoji"
                  aria-expanded={showEmoji}
                >
                  <Smiley size={20} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowEmoji(false);
                    setShowLocation((v) => {
                      if (v && !location) {
                        setLocationQuery("");
                        setPlaceResults([]);
                      }
                      return !v;
                    });
                  }}
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-full transition",
                    showLocation || location
                      ? "bg-sky-500/10 text-sky-500"
                      : "text-sky-500 hover:bg-sky-500/10"
                  )}
                  title="Localização"
                  aria-label="Adicionar localização"
                >
                  <MapPin size={20} />
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
                        : "Limite free: 200 caracteres · VIP: 1.000"
                    }
                  >
                    {content.length}/{maxChars}
                  </span>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={!canPost}
                  className="rounded-full px-5"
                >
                  Publicar
                </Button>
              </div>

              <EmojiPicker
                open={showEmoji}
                onClose={() => setShowEmoji(false)}
                panelRef={emojiPanelRef}
                isVip={isVip}
                userId={user?.id}
                userName={user?.name}
                isAdmin={user?.role === "admin"}
                onPickUnicode={(em) => insertAtCursor(em)}
                onPickCustom={(code) => {
                  if (!isVip) return;
                  insertAtCursor(code);
                }}
              />
            </div>
          </div>
        </div>
      </form>

      <div className="space-y-3">
        {visible.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
        {visible.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-12 text-center text-sm font-medium text-neutral-500 dark:border-zinc-700 dark:bg-[#141414]">
            Nenhum post ainda. Seja o primeiro a publicar.
          </div>
        )}
      </div>

      {/* Editor de proporção (abre ao subir imagem) */}
      {cropSource && (
        <ImageCropEditor
          open={cropOpen}
          imageSrc={cropSource}
          kind="post"
          initialPostAspect="16:9"
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}

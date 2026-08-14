"use client";

import { Button } from "@/components/ui/button";
import {
  compressChatImage,
  formatMediaDuration,
  prepareChatAudio,
  prepareChatVideo,
} from "@/lib/chat-media";
import {
  EMOJI_CATEGORIES,
  searchEmojis,
  type EmojiCategoryId,
} from "@/lib/emoji-data";
import {
  fetchTrendingGifs,
  pickGifPostUrl,
  searchGifs,
  type GifItem,
} from "@/lib/giphy";
import { chatMediaRef, mediaSet } from "@/lib/media-storage";
import {
  STICKER_CATEGORIES,
  STICKER_PACK,
  type StickerItem,
} from "@/lib/stickers";
import type { ChatMediaKind } from "@/lib/types";
import { cn, uid } from "@/lib/utils";
import {
  Camera,
  Gif,
  Image as ImageIcon,
  MagnifyingGlass,
  Microphone,
  PaperPlaneTilt,
  SmileySticker,
  SpinnerGap,
  Trash,
  VideoCamera,
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

export type ChatSendPayload = {
  content: string;
  mediaKind?: ChatMediaKind | null;
  mediaUrl?: string | null;
  mediaMime?: string | null;
  mediaDuration?: number | null;
  mediaThumbUrl?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
};

type Props = {
  placeholder: string;
  disabled?: boolean;
  onSend: (payload: ChatSendPayload) => void;
};

type Panel = "none" | "stickers" | "gifs" | "camera";
type StickerTab = "emojis" | "figurinhas";

/**
 * Composer do bate-papo: texto + áudio + imagem/vídeo (com compressão) +
 * câmera + emojis/figurinhas + GIFs (busca na internet).
 */
export function ChatComposer({ placeholder, disabled, onSend }: Props) {
  const [text, setText] = useState("");
  const [panel, setPanel] = useState<Panel>("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stickerTab, setStickerTab] = useState<StickerTab>("emojis");
  const [stickerCat, setStickerCat] =
    useState<(typeof STICKER_CATEGORIES)[number]>("reações");
  const [emojiCat, setEmojiCat] = useState<EmojiCategoryId>("smileys");
  const [emojiQ, setEmojiQ] = useState("");

  // Áudio
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const recChunks = useRef<Blob[]>([]);
  const recTimer = useRef<number | null>(null);
  const recStream = useRef<MediaStream | null>(null);
  const [recLevels, setRecLevels] = useState<number[]>(() =>
    Array.from({ length: 28 }, () => 0.15)
  );
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRaf = useRef<number | null>(null);

  // GIF
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [gifQ, setGifQ] = useState("");
  const [gifInput, setGifInput] = useState("");
  const [gifLoading, setGifLoading] = useState(false);
  const [gifEmpty, setGifEmpty] = useState(false);

  // Câmera
  const videoRef = useRef<HTMLVideoElement>(null);
  const camStream = useRef<MediaStream | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    camStream.current?.getTracks().forEach((t) => t.stop());
    camStream.current = null;
    setCamReady(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stopRecording = useCallback(() => {
    if (recTimer.current != null) {
      window.clearInterval(recTimer.current);
      recTimer.current = null;
    }
    if (analyserRaf.current != null) {
      cancelAnimationFrame(analyserRaf.current);
      analyserRaf.current = null;
    }
    try {
      void audioCtxRef.current?.close();
    } catch {
      /* ignore */
    }
    audioCtxRef.current = null;
    try {
      if (mediaRecRef.current?.state === "recording") {
        mediaRecRef.current.stop();
      }
    } catch {
      /* ignore */
    }
    recStream.current?.getTracks().forEach((t) => t.stop());
    recStream.current = null;
    setRecording(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      stopRecording();
    };
  }, [stopCamera, stopRecording]);

  function togglePanel(p: Panel) {
    setError("");
    setPanel((cur) => {
      const next = cur === p ? "none" : p;
      if (cur === "camera" && next !== "camera") stopCamera();
      return next;
    });
  }

  const emojiResults = useMemo(() => {
    if (!emojiQ.trim()) return null;
    return searchEmojis(emojiQ).slice(0, 120);
  }, [emojiQ]);

  // GIFs: trending ao abrir + debounce da busca por nome (internet)
  useEffect(() => {
    if (panel !== "gifs") return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      if (cancelled) return;
      setGifLoading(true);
      setGifEmpty(false);
      try {
        const list = gifQ.trim()
          ? await searchGifs(gifQ, 32)
          : await fetchTrendingGifs(32);
        if (cancelled) return;
        setGifs(list);
        setGifEmpty(list.length === 0);
      } catch {
        if (!cancelled) {
          setGifs([]);
          setGifEmpty(true);
        }
      } finally {
        if (!cancelled) setGifLoading(false);
      }
    }, gifQ.trim() ? 380 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [panel, gifQ]);

  // Câmera
  useEffect(() => {
    if (panel !== "camera") return;
    let cancelled = false;
    (async () => {
      try {
        stopCamera();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        camStream.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCamReady(true);
      } catch {
        setError(
          "Não foi possível acessar a câmera. Permita o acesso no navegador."
        );
        setPanel("none");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, facingMode]);

  async function persistMedia(
    dataUrl: string,
    part: "main" | "thumb" = "main"
  ): Promise<string> {
    // data URLs grandes → IndexedDB
    if (dataUrl.length < 80_000 && !dataUrl.startsWith("data:video")) {
      return dataUrl;
    }
    const key = chatMediaRef(uid("cm"), part);
    await mediaSet(key, dataUrl);
    return key;
  }

  function submitText(e: FormEvent) {
    e.preventDefault();
    if (disabled || busy) return;
    const t = text.trim();
    if (!t) return;
    onSend({ content: t, mediaKind: "text" });
    setText("");
    setPanel("none");
  }

  async function sendSticker(s: StickerItem) {
    if (disabled || busy) return;
    onSend({
      content: s.emoji,
      mediaKind: "sticker",
      mediaUrl: s.id,
    });
    setPanel("none");
  }

  function sendUnicodeEmoji(emoji: string) {
    if (disabled || busy) return;
    onSend({
      content: emoji,
      mediaKind: "sticker",
      mediaUrl: `u:${emoji}`,
    });
    setPanel("none");
  }

  function runGifSearch(e?: FormEvent) {
    e?.preventDefault();
    setGifQ(gifInput.trim());
  }

  async function sendGif(g: GifItem) {
    if (disabled || busy) return;
    onSend({
      // sem título/caption — só o GIF na bolha
      content: "",
      mediaKind: "gif",
      mediaUrl: pickGifPostUrl(g),
      mediaWidth: g.width,
      mediaHeight: g.height,
    });
    setPanel("none");
  }

  async function onPickFile(file: File | null) {
    if (!file || disabled) return;
    setBusy(true);
    setError("");
    try {
      if (file.type.startsWith("image/")) {
        const img = await compressChatImage(file);
        const url = await persistMedia(img.dataUrl);
        onSend({
          content: "",
          mediaKind: "image",
          mediaUrl: url,
          mediaMime: "image/jpeg",
          mediaWidth: img.width,
          mediaHeight: img.height,
        });
      } else if (file.type.startsWith("video/")) {
        const vid = await prepareChatVideo(file);
        const url = await persistMedia(vid.dataUrl);
        let thumb: string | null = null;
        if (vid.thumbDataUrl) {
          thumb = await persistMedia(vid.thumbDataUrl, "thumb");
        }
        onSend({
          content: "",
          mediaKind: "video",
          mediaUrl: url,
          mediaMime: vid.mime,
          mediaDuration: vid.duration,
          mediaThumbUrl: thumb,
        });
      } else {
        setError("Envie imagem (JPG/PNG/WebP) ou vídeo (MP4/WebM).");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao processar mídia");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || !camReady) return;
    setBusy(true);
    setError("");
    try {
      const maxW = 1280;
      const scale = Math.min(1, maxW / (video.videoWidth || maxW));
      const w = Math.max(1, Math.round((video.videoWidth || 640) * scale));
      const h = Math.max(1, Math.round((video.videoHeight || 480) * scale));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d")?.drawImage(video, 0, 0, w, h);
      const dataUrl = c.toDataURL("image/jpeg", 0.82);
      const url = await persistMedia(dataUrl);
      onSend({
        content: "",
        mediaKind: "image",
        mediaUrl: url,
        mediaMime: "image/jpeg",
        mediaWidth: w,
        mediaHeight: h,
      });
      stopCamera();
      setPanel("none");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na captura");
    } finally {
      setBusy(false);
    }
  }

  function stopAnalyser() {
    if (analyserRaf.current != null) {
      cancelAnimationFrame(analyserRaf.current);
      analyserRaf.current = null;
    }
    try {
      void audioCtxRef.current?.close();
    } catch {
      /* ignore */
    }
    audioCtxRef.current = null;
    setRecLevels(Array.from({ length: 28 }, () => 0.15));
  }

  function startAnalyser(stream: MediaStream) {
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const bars = 28;
        const step = Math.max(1, Math.floor(data.length / bars));
        const next: number[] = [];
        for (let i = 0; i < bars; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
          const avg = sum / step / 255;
          next.push(0.12 + avg * 0.88);
        }
        setRecLevels(next);
        analyserRaf.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* analyser opcional */
    }
  }

  async function startRecording() {
    if (disabled || recording) return;
    setError("");
    setPanel("none");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStream.current = stream;
      recChunks.current = [];
      startAnalyser(stream);
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const rec = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined
      );
      mediaRecRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) recChunks.current.push(e.data);
      };
      rec.onstop = async () => {
        stopAnalyser();
        try {
          const blob = new Blob(recChunks.current, {
            type: rec.mimeType || "audio/webm",
          });
          if (blob.size < 800) {
            setError("Áudio muito curto.");
            return;
          }
          setBusy(true);
          const prepared = await prepareChatAudio(blob);
          const url = await persistMedia(prepared.dataUrl);
          onSend({
            content: "",
            mediaKind: "audio",
            mediaUrl: url,
            mediaMime: prepared.mime,
            mediaDuration: prepared.duration,
          });
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Falha ao enviar áudio"
          );
        } finally {
          setBusy(false);
          setRecSeconds(0);
        }
      };
      rec.start(100);
      setRecording(true);
      setRecSeconds(0);
      recTimer.current = window.setInterval(() => {
        setRecSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setError("Permita o microfone para gravar áudio.");
    }
  }

  function finishRecording() {
    stopAnalyser();
    stopRecording();
  }

  function cancelRecording() {
    stopAnalyser();
    recChunks.current = [];
    const rec = mediaRecRef.current;
    if (rec) {
      rec.onstop = null;
      try {
        if (rec.state === "recording") rec.stop();
      } catch {
        /* ignore */
      }
    }
    stopRecording();
    setRecSeconds(0);
  }

  const canSendText = !!text.trim() && !busy && !disabled && !recording;

  return (
    <div className="border-t border-neutral-200/70 dark:border-zinc-800">
      {/* Painéis */}
      {panel === "stickers" && (
        <div className="border-b border-neutral-100 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-[#141414]">
          <div className="mb-2 flex gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-zinc-900">
            {(
              [
                ["emojis", "Emojis"],
                ["figurinhas", "Figurinhas"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setStickerTab(id)}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-[12px] font-semibold transition",
                  stickerTab === id
                    ? "bg-white text-[#1f1f1f] shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-neutral-500 hover:text-[#1f1f1f] dark:text-zinc-400"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {stickerTab === "emojis" ? (
            <>
              <div className="relative mb-2">
                <MagnifyingGlass
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  value={emojiQ}
                  onChange={(e) => setEmojiQ(e.target.value)}
                  placeholder="Buscar emoji (amor, fogo, brasil…)"
                  className="h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-8 pr-3 text-[13px] dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              {!emojiResults && (
                <div className="mb-2 flex gap-1 overflow-x-auto thin-scroll pb-0.5">
                  {EMOJI_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      title={c.label}
                      onClick={() => setEmojiCat(c.id)}
                      className={cn(
                        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[16px] transition",
                        emojiCat === c.id
                          ? "bg-[#1f1f1f] text-white ring-2 ring-[#1f1f1f]/20 dark:bg-white dark:text-black"
                          : "bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-800"
                      )}
                    >
                      {c.icon}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto thin-scroll sm:grid-cols-10">
                {(emojiResults
                  ? emojiResults.map((x) => x.e)
                  : EMOJI_CATEGORIES.find((c) => c.id === emojiCat)?.emojis.map(
                      (x) => x.e
                    ) || []
                ).map((emoji, i) => (
                  <button
                    key={`${emoji}-${i}`}
                    type="button"
                    title={emoji}
                    onClick={() => sendUnicodeEmoji(emoji)}
                    className="flex h-9 items-center justify-center rounded-lg text-[22px] transition hover:bg-neutral-100 active:scale-95 dark:hover:bg-zinc-800"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap gap-1">
                {STICKER_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setStickerCat(c)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
                      stickerCat === c
                        ? "bg-[#1f1f1f] text-white dark:bg-white dark:text-black"
                        : "bg-neutral-100 text-neutral-500 dark:bg-zinc-800"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="grid max-h-40 grid-cols-6 gap-1 overflow-y-auto sm:grid-cols-8">
                {STICKER_PACK.filter((s) => s.category === stickerCat).map(
                  (s) => (
                    <button
                      key={s.id}
                      type="button"
                      title={s.label}
                      onClick={() => sendSticker(s)}
                      className="flex h-12 items-center justify-center rounded-xl text-[28px] transition hover:bg-neutral-100 dark:hover:bg-zinc-800"
                    >
                      {s.emoji}
                    </button>
                  )
                )}
              </div>
            </>
          )}
        </div>
      )}

      {panel === "gifs" && (
        <div className="border-b border-neutral-100 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-[#141414]">
          <form onSubmit={runGifSearch} className="mb-2 flex gap-1.5">
            <div className="relative min-w-0 flex-1">
              <MagnifyingGlass
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                value={gifInput}
                onChange={(e) => {
                  setGifInput(e.target.value);
                  // busca ao digitar (debounce no effect via gifQ)
                  setGifQ(e.target.value);
                }}
                placeholder="Buscar qualquer GIF (ex.: gato, funny, success…)"
                className="h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-8 pr-3 text-[13px] dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <Button type="submit" size="sm" className="h-9 shrink-0 px-3">
              Buscar
            </Button>
          </form>
          <p className="mb-1.5 text-[11px] text-neutral-400">
            {gifQ.trim()
              ? `Resultados para “${gifQ.trim()}”`
              : "Em alta agora · digite para buscar na internet"}
          </p>
          {gifLoading ? (
            <p className="flex items-center justify-center gap-2 py-8 text-[12px] text-neutral-400">
              <SpinnerGap size={16} className="animate-spin" />
              Buscando GIFs…
            </p>
          ) : gifEmpty ? (
            <p className="py-8 text-center text-[12px] text-neutral-400">
              Nenhum GIF encontrado. Tente outro nome.
            </p>
          ) : (
            <div className="grid max-h-52 grid-cols-3 gap-1.5 overflow-y-auto thin-scroll sm:grid-cols-4">
              {gifs.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => sendGif(g)}
                  className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100 ring-1 ring-black/5 transition hover:ring-2 hover:ring-[#1f1f1f]/30 dark:bg-zinc-800"
                  title={g.title}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.previewUrl}
                    alt={g.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {panel === "camera" && (
        <div className="border-b border-neutral-100 bg-black px-3 py-3 dark:border-zinc-800">
          <div className="relative mx-auto max-w-sm overflow-hidden rounded-xl bg-neutral-900">
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-[3/4] w-full object-cover"
            />
            {!camReady && (
              <div className="absolute inset-0 flex items-center justify-center text-[12px] text-white/70">
                Abrindo câmera…
              </div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setFacingMode((f) =>
                  f === "user" ? "environment" : "user"
                )
              }
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              <VideoCamera size={14} />
              Alternar câmera
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={capturePhoto}
              disabled={!camReady || busy}
            >
              <Camera size={14} weight="fill" />
              Tirar foto
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                stopCamera();
                setPanel("none");
              }}
              className="border-white/20 bg-white/10 text-white"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="px-3 pt-2 text-[12px] font-medium text-red-600" role="alert">
          {error}
        </p>
      )}

      {/* Barra de gravação (clean) ou ferramentas + input */}
      {recording ? (
        <div className="flex items-center gap-2.5 px-3 py-3">
          <button
            type="button"
            onClick={cancelRecording}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-red-500 dark:hover:bg-zinc-800"
            aria-label="Descartar áudio"
            title="Descartar"
          >
            <Trash size={18} weight="bold" />
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-neutral-950 px-3.5 py-2.5 text-white dark:bg-zinc-900">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>

            {/* Waveform ao vivo */}
            <div
              className="flex h-7 min-w-0 flex-1 items-center gap-[2px]"
              aria-hidden
            >
              {recLevels.map((lv, i) => (
                <span
                  key={i}
                  className="w-[3px] shrink-0 rounded-full bg-white/85 transition-[height] duration-75"
                  style={{
                    height: `${Math.max(14, Math.min(100, lv * 100))}%`,
                    opacity: 0.45 + lv * 0.55,
                  }}
                />
              ))}
            </div>

            <span className="shrink-0 font-mono text-[13px] font-medium tabular-nums tracking-tight text-white/90">
              {formatMediaDuration(recSeconds)}
            </span>
          </div>

          <button
            type="button"
            onClick={finishRecording}
            disabled={busy}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1f1f1f] text-white shadow-md transition hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 dark:bg-white dark:text-black"
            aria-label="Enviar áudio"
            title="Enviar"
          >
            {busy ? (
              <SpinnerGap size={18} className="animate-spin" />
            ) : (
              <PaperPlaneTilt size={18} weight="fill" />
            )}
          </button>
        </div>
      ) : (
        <form
          onSubmit={submitText}
          className="flex flex-col gap-2 p-3 sm:flex-row sm:items-end"
        >
          <div className="flex shrink-0 items-center gap-0.5">
            <ToolBtn
              label="Emojis e figurinhas"
              active={panel === "stickers"}
              disabled={disabled || busy}
              onClick={() => togglePanel("stickers")}
            >
              <SmileySticker size={20} weight="regular" />
            </ToolBtn>
            <ToolBtn
              label="GIFs"
              active={panel === "gifs"}
              disabled={disabled || busy}
              onClick={() => togglePanel("gifs")}
            >
              <Gif size={20} weight="regular" />
            </ToolBtn>
            <ToolBtn
              label="Imagem ou vídeo"
              disabled={disabled || busy}
              onClick={() => fileRef.current?.click()}
            >
              <ImageIcon size={20} weight="regular" />
            </ToolBtn>
            <ToolBtn
              label="Câmera / selfie"
              active={panel === "camera"}
              disabled={disabled || busy}
              onClick={() => togglePanel("camera")}
            >
              <Camera size={20} weight="regular" />
            </ToolBtn>
            <ToolBtn
              label="Gravar áudio"
              disabled={disabled || busy}
              onClick={startRecording}
            >
              <Microphone size={20} weight="regular" />
            </ToolBtn>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,video/*"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0] || null)}
          />

          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            disabled={disabled || busy}
            className="h-11 flex-1 rounded-[10px] border border-neutral-200 bg-[var(--surface)] px-3.5 text-sm text-neutral-950 placeholder:text-neutral-400 transition-[border-color,background-color,box-shadow] hover:border-neutral-300 focus:border-neutral-950 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-neutral-950/8 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
          />

          <Button
            type="submit"
            size="icon"
            disabled={!canSendText}
            className="shrink-0"
            aria-label="Enviar"
          >
            {busy ? (
              <SpinnerGap size={18} className="animate-spin" />
            ) : (
              <PaperPlaneTilt size={18} weight="fill" />
            )}
          </Button>
        </form>
      )}
    </div>
  );
}

function ToolBtn({
  children,
  label,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full transition",
        active
          ? "bg-neutral-900 text-white dark:bg-white dark:text-black"
          : "text-neutral-500 hover:bg-neutral-100 hover:text-[#1f1f1f] dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      {children}
    </button>
  );
}

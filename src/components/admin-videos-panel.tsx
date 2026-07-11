"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteVideo,
  fetchVideoConfig,
  fetchVideos,
  uploadVideo,
  videoStreamUrl,
  type VideoConfigResponse,
} from "@/lib/videos/client";
import type { VideoPublic } from "@/lib/videos/types";
import { cn, formatDate } from "@/lib/utils";
import {
  CloudArrowUp,
  FilmStrip,
  Lock,
  Play,
  SpinnerGap,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  adminId: string;
  adminName: string;
  onToast: (msg: string) => void;
};

const CATEGORIES = [
  "Geral",
  "Metodologia",
  "Design",
  "IA",
  "Introdução",
  "Marketing",
  "Dev",
];

/**
 * Upload e gestão de vídeos via Telegram Bot API (storage).
 */
export function AdminVideosPanel({ adminId, adminName, onToast }: Props) {
  const [config, setConfig] = useState<VideoConfigResponse | null>(null);
  const [videos, setVideos] = useState<VideoPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Geral");
  const [vipOnly, setVipOnly] = useState(true);
  const [duration, setDuration] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [thumb, setThumb] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);

  const admin = { id: adminId, name: adminName, role: "admin" as const };

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, list] = await Promise.all([
        fetchVideoConfig(),
        fetchVideos(),
      ]);
      setConfig(cfg);
      setVideos(list.videos || []);
    } catch {
      setError("Falha ao carregar vídeos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setCategory("Geral");
    setVipOnly(true);
    setDuration("");
    setFile(null);
    setThumb(null);
    setError("");
    setProgress("");
    if (fileRef.current) fileRef.current.value = "";
    if (thumbRef.current) thumbRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!file) {
      setError("Selecione um arquivo de vídeo.");
      return;
    }
    if (!title.trim()) {
      setError("Informe o título.");
      return;
    }
    if (!config?.configured) {
      setError(
        "Telegram não configurado. Defina TELEGRAM_BOT_TOKEN e TELEGRAM_STORAGE_CHAT_ID no ambiente."
      );
      return;
    }

    setUploading(true);
    const originalBytes = file.size;
    let uploadFile = file;
    let clientCompressed = false;
    let durationSec = 0;

    try {
      // Alvo: 48 MB com R2; ~18 MB se playback for só Telegram getFile
      const targetBytes =
        config.compressTargetBytes ??
        (config.hasR2 ? 48 : 18) * 1024 * 1024;

      if (file.size > targetBytes) {
        setProgress("Carregando FFmpeg no navegador…");
        const { compressVideoInBrowser } = await import(
          "@/lib/videos/compress-client"
        );
        const compressed = await compressVideoInBrowser(file, {
          targetBytes,
          onProgress: (p) => {
            const pct = p.ratio != null ? ` ${p.ratio}%` : "";
            const step =
              p.attempt && p.attempts
                ? ` [${p.attempt}/${p.attempts}]`
                : "";
            setProgress(`${p.message}${step}${pct}`);
          },
        });
        uploadFile = compressed.file;
        clientCompressed = compressed.compressed;
        durationSec = compressed.durationSec;
      } else {
        clientCompressed = true;
      }

      setProgress("Enviando para o Telegram + storage de playback…");
      const result = await uploadVideo({
        file: uploadFile,
        title: title.trim(),
        description: description.trim(),
        category,
        vipOnly,
        duration: duration.trim() || undefined,
        thumb,
        admin,
        clientCompressed: true,
        originalBytes,
        durationSec: durationSec || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        setProgress("");
        return;
      }
      if (result.compressed && result.originalBytes && result.finalBytes) {
        const o = (result.originalBytes / (1024 * 1024)).toFixed(1);
        const f = (result.finalBytes / (1024 * 1024)).toFixed(1);
        onToast(`Vídeo “${result.video.title}” publicado (${o} → ${f} MB).`);
      } else {
        onToast(`Vídeo “${result.video.title}” publicado.`);
      }
      resetForm();
      setShowForm(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
      setProgress("");
    }
  }

  async function onDelete(v: VideoPublic) {
    if (!window.confirm(`Remover “${v.title}” do catálogo e do Telegram?`)) {
      return;
    }
    const result = await deleteVideo(v.id, admin);
    if (!result.ok) {
      onToast(result.error);
      return;
    }
    onToast("Vídeo removido.");
    setVideos((list) => list.filter((x) => x.id !== v.id));
  }

  return (
    <div className="space-y-4">
      {/* Status Telegram */}
      <div
        className={cn(
          "rounded-2xl border p-4",
          config?.configured && config.botOk
            ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30"
            : "border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30"
        )}
      >
        <div className="flex items-start gap-3">
          {config?.configured && config.botOk ? (
            <CloudArrowUp
              size={22}
              weight="fill"
              className="shrink-0 text-emerald-600 dark:text-emerald-400"
            />
          ) : (
            <WarningCircle
              size={22}
              weight="fill"
              className="shrink-0 text-amber-600 dark:text-amber-400"
            />
          )}
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#1f1f1f] dark:text-zinc-100">
              Storage Telegram
            </p>
            {config?.configured && config.botOk ? (
              <p className="mt-0.5 text-[13px] text-neutral-600 dark:text-zinc-400">
                Bot {config.botUsername || "conectado"} · ffmpeg.wasm mira{" "}
                {(config.compressTargetMb ?? 18).toFixed(0)} MB · originais até{" "}
                {config.maxOriginalMb ?? 500} MB · playback{" "}
                {config.playbackStorage || "telegram"} · {config.count} no
                catálogo
              </p>
            ) : (
              <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-600 dark:text-zinc-400">
                {config?.error ||
                  "Configure TELEGRAM_BOT_TOKEN e TELEGRAM_STORAGE_CHAT_ID (chat/canal privado onde o bot é admin)."}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-neutral-500">
          Vídeos publicados na aba{" "}
          <span className="font-medium text-[#1f1f1f] dark:text-zinc-200">
            /app/videos
          </span>
        </p>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setShowForm((v) => !v);
            setError("");
          }}
          disabled={uploading}
        >
          <FilmStrip size={16} weight="bold" />
          {showForm ? "Fechar" : "Novo vídeo"}
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:border-zinc-700 dark:bg-[#141414] sm:p-5"
        >
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-neutral-500">
              Arquivo de vídeo *
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-[13px] text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#1f1f1f] file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-white"
            />
            {file && (
              <p className="mt-1 text-[12px] text-neutral-400">
                {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
                {file.size >
                (config?.compressTargetBytes ?? 18 * 1024 * 1024)
                  ? ` · será compactado no navegador (≤ ${(config?.compressTargetMb ?? 18).toFixed(0)} MB)`
                  : " · já cabe no alvo de compactação"}
              </p>
            )}
          </div>

          <Input
            label="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Fundamentos do Nullysh Method"
            required
          />

          <Textarea
            label="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="O que o membro vai aprender neste vídeo…"
            className="min-h-[80px]"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-neutral-500">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-[var(--radius-md)] border border-neutral-200 bg-white px-3 text-[14px] text-[#1f1f1f] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Duração (opcional)"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Ex.: 12:40 — auto se o TG enviar"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-neutral-500">
              Thumbnail (opcional, JPG/PNG ≤ 2 MB)
            </label>
            <input
              ref={thumbRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setThumb(e.target.files?.[0] || null)}
              className="block w-full text-[13px] text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-[#1f1f1f]"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-neutral-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={vipOnly}
              onChange={(e) => setVipOnly(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300"
            />
            <Lock size={14} weight="bold" className="text-amber-600" />
            Somente VIP
          </label>

          {error && (
            <p className="field-error text-[13px] text-red-600" role="alert">
              {error}
            </p>
          )}
          {progress && (
            <p className="flex items-center gap-2 text-[13px] font-medium text-neutral-500">
              <SpinnerGap size={16} className="animate-spin" />
              {progress}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" disabled={uploading || !file}>
              {uploading ? (
                <>
                  <SpinnerGap size={16} className="animate-spin" />
                  Enviando…
                </>
              ) : (
                <>
                  <CloudArrowUp size={16} weight="bold" />
                  Publicar no Telegram
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-400">
          Carregando catálogo…
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center text-sm text-neutral-500 dark:border-zinc-700 dark:bg-[#141414]">
          Nenhum vídeo ainda. Publique o primeiro pelo formulário acima.
        </div>
      ) : (
        <ul className="space-y-2">
          {videos.map((v) => (
            <li
              key={v.id}
              className="flex flex-col gap-3 rounded-2xl border border-neutral-200/90 bg-white p-4 sm:flex-row sm:items-center dark:border-zinc-700 dark:bg-[#141414]"
            >
              <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-100 dark:bg-zinc-800">
                {v.hasThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/videos/${v.id}/thumb`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <FilmStrip size={22} className="text-neutral-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[14px] font-semibold text-[#1f1f1f] dark:text-zinc-100">
                    {v.title}
                  </p>
                  {v.vipOnly && (
                    <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                      VIP
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-1 text-[12px] text-neutral-500">
                  {v.category} · {v.duration} · {v.views} views ·{" "}
                  {formatDate(v.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href={videoStreamUrl(v.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 px-3 text-[12px] font-semibold text-neutral-600 hover:bg-neutral-50 dark:border-zinc-600 dark:text-zinc-300"
                >
                  <Play size={14} weight="fill" />
                  Abrir
                </a>
                <button
                  type="button"
                  onClick={() => onDelete(v)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-zinc-600"
                  aria-label="Remover vídeo"
                >
                  <Trash size={16} weight="bold" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

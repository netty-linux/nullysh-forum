"use client";

import { Button } from "@/components/ui/button";
import { getCroppedAndCompressedDataUrl } from "@/lib/image";
import { cn } from "@/lib/utils";
import {
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

export type CropKind = "avatar" | "banner" | "post";

export type PostAspectId = "16:9" | "1:1" | "4:5" | "3:4" | "9:16" | "4:3";

type Props = {
  open: boolean;
  imageSrc: string;
  kind: CropKind;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
  /** Aspecto inicial do post (default 16:9) */
  initialPostAspect?: PostAspectId;
};

const POST_ASPECTS: {
  id: PostAspectId;
  label: string;
  hint: string;
  aspect: number;
  outputWidth: number;
  outputHeight: number;
}[] = [
  {
    id: "16:9",
    label: "16:9",
    hint: "Paisagem · ideal pro feed",
    aspect: 16 / 9,
    outputWidth: 1280,
    outputHeight: 720,
  },
  {
    id: "1:1",
    label: "1:1",
    hint: "Quadrado",
    aspect: 1,
    outputWidth: 1080,
    outputHeight: 1080,
  },
  {
    id: "4:5",
    label: "4:5",
    hint: "Retrato",
    aspect: 4 / 5,
    outputWidth: 1080,
    outputHeight: 1350,
  },
  {
    id: "3:4",
    label: "3:4",
    hint: "Vertical",
    aspect: 3 / 4,
    outputWidth: 1080,
    outputHeight: 1440,
  },
  {
    id: "9:16",
    label: "9:16",
    hint: "Full · imagem vertical inteira",
    aspect: 9 / 16,
    outputWidth: 1080,
    outputHeight: 1920,
  },
  {
    id: "4:3",
    label: "4:3",
    hint: "Clássico",
    aspect: 4 / 3,
    outputWidth: 1200,
    outputHeight: 900,
  },
];

const FIXED_PRESETS: Record<
  "avatar" | "banner",
  {
    title: string;
    hint: string;
    aspect: number;
    cropShape: "rect" | "round";
    outputWidth: number;
    outputHeight: number;
    circular: boolean;
  }
> = {
  avatar: {
    title: "Ajustar foto de perfil",
    hint: "Arraste para posicionar. Use o zoom para redimensionar. A foto é comprimida em alta qualidade ao aplicar.",
    aspect: 1,
    cropShape: "round",
    // 1024px nítido em telas retina; compressão leva a ~200–450 KB
    outputWidth: 1024,
    outputHeight: 1024,
    circular: false,
  },
  banner: {
    title: "Ajustar banner",
    hint: "Arraste para posicionar. Use o zoom para redimensionar. Compressão automática ao aplicar.",
    aspect: 3,
    cropShape: "rect",
    outputWidth: 1920,
    outputHeight: 640,
    circular: false,
  },
};

export function ImageCropEditor({
  open,
  imageSrc,
  kind,
  onCancel,
  onConfirm,
  initialPostAspect = "16:9",
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [postAspectId, setPostAspectId] =
    useState<PostAspectId>(initialPostAspect);

  // Reset ao abrir nova imagem
  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setError("");
    setSaving(false);
    setPostAspectId(initialPostAspect);
  }, [open, imageSrc, initialPostAspect]);

  const postAspect = useMemo(
    () =>
      POST_ASPECTS.find((a) => a.id === postAspectId) ?? POST_ASPECTS[0],
    [postAspectId]
  );

  /** Zoom out liberado no post (0.3) para caber foto inteira no 9:16 */
  const minZoom = kind === "post" ? 0.3 : 1;
  const maxZoom = 3;

  const config = useMemo(() => {
    if (kind === "post") {
      const isTall =
        postAspect.id === "9:16" ||
        postAspect.id === "3:4" ||
        postAspect.id === "4:5";
      return {
        title: "Ajustar imagem do post",
        hint: "Escolha a proporção e enquadre. Use o zoom out para caber a foto inteira.",
        aspect: postAspect.aspect,
        cropShape: "rect" as const,
        outputWidth: postAspect.outputWidth,
        outputHeight: postAspect.outputHeight,
        circular: false,
        showGrid: true,
        // Área mais alta para proporções verticais (9:16)
        cropH: isTall
          ? "h-[min(52dvh,420px)] sm:h-[min(56dvh,460px)]"
          : "h-[240px] sm:h-[300px]",
        // contain + zoom out facilita encaixar a imagem completa
        objectFit: "contain" as const,
      };
    }
    const p = FIXED_PRESETS[kind];
    return {
      title: p.title,
      hint: p.hint,
      aspect: p.aspect,
      cropShape: p.cropShape,
      outputWidth: p.outputWidth,
      outputHeight: p.outputHeight,
      circular: p.circular,
      showGrid: kind === "banner",
      cropH:
        kind === "banner"
          ? "h-[220px] sm:h-[260px]"
          : "h-[280px] sm:h-[320px]",
      objectFit: "horizontal-cover" as const,
    };
  }, [kind, postAspect]);

  // Ao trocar proporção no post, recentraliza e volta a um zoom “seguro”
  useEffect(() => {
    if (kind !== "post") return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }, [postAspectId, kind]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setSaving(true);
    setError("");
    try {
      const compressKind =
        kind === "avatar" ? "avatar" : kind === "banner" ? "banner" : "post";
      const dataUrl = await getCroppedAndCompressedDataUrl(
        imageSrc,
        croppedAreaPixels,
        {
          kind: compressKind,
          outputWidth: config.outputWidth,
          outputHeight: config.outputHeight,
          circular: config.circular,
        }
      );
      onConfirm(dataUrl);
    } catch {
      setError("Não foi possível recortar a imagem. Tente outra.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-editor-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#1f1f1f]/55 backdrop-blur-[2px]"
        aria-label="Fechar"
        onClick={onCancel}
      />

      <div className="relative z-10 flex max-h-[min(94dvh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-neutral-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-[#141414] sm:mx-4 sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2
              id="crop-editor-title"
              className="text-base font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-100"
            >
              {config.title}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
              {config.hint}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-[#1f1f1f] dark:hover:bg-zinc-800"
            aria-label="Fechar editor"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Proporções do post */}
        {kind === "post" && (
          <div className="border-b border-neutral-100 px-4 py-3 dark:border-zinc-800">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
              Proporção
            </p>
            <div className="flex flex-wrap gap-1.5">
              {POST_ASPECTS.map((a) => {
                const active = a.id === postAspectId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setPostAspectId(a.id)}
                    className={cn(
                      "inline-flex flex-col items-center rounded-xl border px-3 py-1.5 transition",
                      active
                        ? "border-[#1f1f1f] bg-[#1f1f1f] text-white dark:border-white dark:bg-white dark:text-black"
                        : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                    )}
                    title={a.hint}
                  >
                    <span className="text-xs font-bold tabular-nums">
                      {a.label}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] font-medium",
                        active ? "text-white/70 dark:text-black/60" : "text-neutral-400"
                      )}
                    >
                      {a.hint.split("·")[0].trim()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Crop area */}
        <div className={cn("relative w-full bg-neutral-900", config.cropH)}>
          <Cropper
            key={kind === "post" ? postAspectId : kind}
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            minZoom={minZoom}
            maxZoom={maxZoom}
            aspect={config.aspect}
            cropShape={config.cropShape}
            showGrid={config.showGrid}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit={config.objectFit}
            // permite puxar a imagem com zoom out (encaixar foto inteira)
            restrictPosition={kind !== "post"}
            classes={{
              containerClassName: "rounded-none",
              mediaClassName: "max-w-none",
            }}
          />
        </div>

        {/* Zoom */}
        <div className="border-b border-neutral-100 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <MagnifyingGlassMinus
              size={18}
              className="shrink-0 text-neutral-400"
              weight="bold"
            />
            <input
              type="range"
              min={minZoom}
              max={maxZoom}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-[#1f1f1f] dark:bg-zinc-700"
              aria-label="Zoom"
            />
            <MagnifyingGlassPlus
              size={18}
              className="shrink-0 text-neutral-400"
              weight="bold"
            />
          </div>
          <p className="mt-2 text-center text-[11px] text-neutral-400">
            {kind === "avatar"
              ? "Prévia circular · o que está dentro do círculo será a foto"
              : kind === "banner"
                ? "Prévia 3:1 · o que está na área clara será o banner"
                : `Prévia ${postAspect.label} · arraste o zoom para longe para caber a foto inteira`}
          </p>
        </div>

        {error && (
          <p className="px-5 pt-3 text-sm text-red-600">{error}</p>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={saving}>
            {saving ? "Comprimindo…" : "Aplicar recorte"}
          </Button>
        </div>
      </div>
    </div>
  );
}

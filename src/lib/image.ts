/** Utilitários de imagem para perfil (upload + crop + compressão). */

import type { Area } from "react-easy-crop";

/** Limite de ACEITAÇÃO do arquivo original (antes do crop/compressão). */
export const MAX_AVATAR_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_BANNER_STATIC_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_GIF_BANNER_BYTES = 15 * 1024 * 1024; // 15 MB GIF VIP

/** Alvos de tamanho final (após compressão) — economiza Storage. */
const AVATAR_TARGET_BYTES = 450 * 1024; // ~450 KB
const BANNER_TARGET_BYTES = 900 * 1024; // ~900 KB
const POST_TARGET_BYTES = 700 * 1024; // ~700 KB

export type ImageCompressKind = "avatar" | "banner" | "post";

export function isGifFile(file: File): boolean {
  return (
    file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif")
  );
}

/** Data URL de GIF animado (preserva frames — não passar pelo canvas). */
export function isGifDataUrl(src: string | null | undefined): boolean {
  if (!src) return false;
  return (
    src.startsWith("data:image/gif") ||
    /\.gif(\?|$)/i.test(src) ||
    src.includes("image/gif")
  );
}

function formatMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb % 1 === 0 ? String(mb) : mb.toFixed(0);
}

export function validateImageFile(
  file: File
): { ok: true } | { ok: false; error: string } {
  if (!file.type.startsWith("image/")) {
    return {
      ok: false,
      error: "Envie um arquivo de imagem (JPG, PNG ou WebP).",
    };
  }
  // Avatar / crop estático: sem GIF (canvas congela animação)
  if (isGifFile(file)) {
    return {
      ok: false,
      error: "GIF animado só é permitido no banner (VIP). Use JPG, PNG ou WebP.",
    };
  }
  if (file.size > MAX_AVATAR_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `A imagem deve ter no máximo ${formatMb(MAX_AVATAR_UPLOAD_BYTES)} MB.`,
    };
  }
  return { ok: true };
}

/**
 * Validação de banner:
 * - VIP: JPG/PNG/WebP/GIF animado
 * - Free: só estático (sem GIF)
 */
export function validateBannerFile(
  file: File,
  isVip: boolean
): { ok: true } | { ok: false; error: string } {
  if (!file.type.startsWith("image/")) {
    return {
      ok: false,
      error: "Envie uma imagem de banner (JPG, PNG, WebP ou GIF).",
    };
  }

  if (isGifFile(file)) {
    if (!isVip) {
      return {
        ok: false,
        error:
          "Banners animados (GIF) são exclusivos do Plano VIP. Assine para liberar.",
      };
    }
    if (file.size > MAX_GIF_BANNER_BYTES) {
      return {
        ok: false,
        error: `GIF do banner deve ter no máximo ${formatMb(MAX_GIF_BANNER_BYTES)} MB.`,
      };
    }
    return { ok: true };
  }

  if (file.size > MAX_BANNER_STATIC_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `O banner deve ter no máximo ${formatMb(MAX_BANNER_STATIC_UPLOAD_BYTES)} MB.`,
    };
  }
  return { ok: true };
}

export function fileToObjectUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Falha ao ler o arquivo."));
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

export function revokeObjectUrl(url: string | null | undefined) {
  if (url && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return dataUrl.length;
  const b64 = dataUrl.slice(comma + 1);
  // base64 → bytes aproximados
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

let webpSupport: boolean | null = null;

/** Detecta suporte a WebP no canvas (menor e com boa qualidade). */
export function supportsWebP(): boolean {
  if (typeof document === "undefined") return false;
  if (webpSupport !== null) return webpSupport;
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    webpSupport = c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

function preferredMime(): "image/webp" | "image/jpeg" {
  return supportsWebP() ? "image/webp" : "image/jpeg";
}

function setupHighQualityCtx(ctx: CanvasRenderingContext2D) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
}

/**
 * Gera data URL a partir da área recortada (react-easy-crop).
 * Usa suavização de alta qualidade.
 */
export async function getCroppedDataUrl(
  imageSrc: string,
  pixelCrop: Area,
  options?: {
    outputWidth?: number;
    outputHeight?: number;
    mime?: string;
    quality?: number;
    circular?: boolean;
  }
): Promise<string> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const outW = options?.outputWidth ?? Math.round(pixelCrop.width);
  const outH = options?.outputHeight ?? Math.round(pixelCrop.height);
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não disponível");

  setupHighQualityCtx(ctx);

  // fundo opaco — letterbox quando zoom out encaixa a foto inteira no frame
  const mime = options?.mime ?? preferredMime();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);

  if (options?.circular) {
    ctx.beginPath();
    ctx.arc(outW / 2, outH / 2, Math.min(outW, outH) / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
  }

  // Crop pode ultrapassar a imagem (zoom out / restrictPosition false)
  const cropX = pixelCrop.x;
  const cropY = pixelCrop.y;
  const cropW = Math.max(1, pixelCrop.width);
  const cropH = Math.max(1, pixelCrop.height);

  const sx = Math.max(0, cropX);
  const sy = Math.max(0, cropY);
  const ex = Math.min(image.naturalWidth || image.width, cropX + cropW);
  const ey = Math.min(image.naturalHeight || image.height, cropY + cropH);
  const sw = ex - sx;
  const sh = ey - sy;

  if (sw > 0.5 && sh > 0.5) {
    const dx = ((sx - cropX) / cropW) * outW;
    const dy = ((sy - cropY) / cropH) * outH;
    const dw = (sw / cropW) * outW;
    const dh = (sh / cropH) * outH;
    ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  const quality = options?.quality ?? 0.92;
  return canvas.toDataURL(mime, quality);
}

/**
 * Compressão progressiva de alta qualidade:
 * 1) redimensiona se passar do máximo do preset
 * 2) exporta WebP (ou JPEG) com qualidade alta
 * 3) se ainda grande, baixa qualidade em passos suaves
 * 4) se necessário, reduz dimensões e repete
 *
 * GIFs animados NÃO devem passar por aqui.
 */
export async function compressImageDataUrl(
  dataUrl: string,
  kind: ImageCompressKind = "avatar"
): Promise<string> {
  if (isGifDataUrl(dataUrl)) return dataUrl;

  const preset =
    kind === "avatar"
      ? {
          maxW: 1024,
          maxH: 1024,
          targetBytes: AVATAR_TARGET_BYTES,
          startQ: 0.92,
          minQ: 0.74,
        }
      : kind === "banner"
        ? {
            maxW: 1920,
            maxH: 640,
            targetBytes: BANNER_TARGET_BYTES,
            startQ: 0.9,
            minQ: 0.72,
          }
        : {
            maxW: 1600,
            maxH: 1600,
            targetBytes: POST_TARGET_BYTES,
            startQ: 0.9,
            minQ: 0.72,
          };

  // Já está bem pequena — não reprocessa (evita perda extra)
  if (dataUrlByteLength(dataUrl) <= preset.targetBytes * 0.85) {
    return dataUrl;
  }

  const image = await loadImage(dataUrl);
  let width = image.naturalWidth || image.width;
  let height = image.naturalHeight || image.height;
  if (!width || !height) return dataUrl;

  // Encaixa no bounding box do preset
  const scale = Math.min(1, preset.maxW / width, preset.maxH / height);
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const mime = preferredMime();
  let best = dataUrl;
  let bestSize = dataUrlByteLength(dataUrl);

  for (let pass = 0; pass < 5; pass++) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    setupHighQualityCtx(ctx);
    if (mime === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(image, 0, 0, width, height);

    let quality = preset.startQ;
    while (quality >= preset.minQ - 0.001) {
      const out = canvas.toDataURL(mime, quality);
      const size = dataUrlByteLength(out);
      if (size < bestSize) {
        best = out;
        bestSize = size;
      }
      if (size <= preset.targetBytes) {
        return out;
      }
      quality = Math.round((quality - 0.05) * 100) / 100;
    }

    // ainda grande: reduz resolução ~12% e tenta de novo
    if (width <= 480 || height <= 480) break;
    width = Math.max(480, Math.round(width * 0.88));
    height = Math.max(
      kind === "banner" ? 160 : 480,
      Math.round(height * 0.88)
    );
  }

  return best;
}

/**
 * Crop + compressão em um passo (perfil / post).
 */
export async function getCroppedAndCompressedDataUrl(
  imageSrc: string,
  pixelCrop: Area,
  options: {
    kind: ImageCompressKind;
    outputWidth: number;
    outputHeight: number;
    circular?: boolean;
  }
): Promise<string> {
  const raw = await getCroppedDataUrl(imageSrc, pixelCrop, {
    outputWidth: options.outputWidth,
    outputHeight: options.outputHeight,
    mime: preferredMime(),
    quality: 0.94,
    circular: options.circular,
  });
  return compressImageDataUrl(raw, options.kind);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () =>
      reject(new Error("Não foi possível carregar a imagem."))
    );
    // data: e blob: não precisam de CORS; http(s) de Storage pode
    if (src.startsWith("http://") || src.startsWith("https://")) {
      img.crossOrigin = "anonymous";
    }
    img.src = src;
  });
}

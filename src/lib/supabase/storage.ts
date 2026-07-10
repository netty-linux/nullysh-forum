"use client";

import { requireSupabaseBrowser } from "./client";

export type MediaBucket = "avatars" | "banners" | "emojis" | "posts";

function extFromMime(mime: string, fallback = "bin"): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mime] || fallback;
}

/** Converte data URL em Blob de forma estável (inclui GIFs grandes). */
async function dataUrlToBlob(dataUrl: string): Promise<{ blob: Blob; mime: string }> {
  // fetch(data:) é o caminho mais confiável no browser para base64 grande
  try {
    const res = await fetch(dataUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const mime =
      blob.type ||
      /data:([^;]+)/i.exec(dataUrl)?.[1] ||
      "application/octet-stream";
    return {
      blob: blob.type ? blob : new Blob([blob], { type: mime }),
      mime,
    };
  } catch {
    // fallback atob em chunks
    const comma = dataUrl.indexOf(",");
    if (comma < 0) {
      throw new Error("Data URL inválida (sem payload base64).");
    }
    const header = dataUrl.slice(0, comma);
    const b64 = dataUrl.slice(comma + 1);
    const mime =
      /data:([^;]+);base64/i.exec(header)?.[1] || "application/octet-stream";
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    const chunk = 0x8000;
    for (let i = 0; i < len; i += chunk) {
      const end = Math.min(i + chunk, len);
      for (let j = i; j < end; j++) bytes[j] = binary.charCodeAt(j);
    }
    return { blob: new Blob([bytes], { type: mime }), mime };
  }
}

/**
 * Upload de data URL ou Blob para Storage.
 * Path: `{userId}/{filename}`
 * Retorna URL pública.
 */
export async function uploadUserMedia(opts: {
  bucket: MediaBucket;
  userId: string;
  dataUrlOrBlob: string | Blob;
  filename?: string;
}): Promise<{ ok: true; publicUrl: string } | { ok: false; error: string }> {
  try {
    const supabase = requireSupabaseBrowser();
    let blob: Blob;
    let mime: string;

    if (typeof opts.dataUrlOrBlob === "string") {
      if (!opts.dataUrlOrBlob.startsWith("data:")) {
        // já é URL remota (http/https) — não reenvia
        if (
          opts.dataUrlOrBlob.startsWith("http://") ||
          opts.dataUrlOrBlob.startsWith("https://")
        ) {
          return { ok: true, publicUrl: opts.dataUrlOrBlob };
        }
        return {
          ok: false,
          error: "URL de mídia inválida. Selecione a imagem novamente.",
        };
      }
      const parsed = await dataUrlToBlob(opts.dataUrlOrBlob);
      blob = parsed.blob;
      mime = parsed.mime;
    } else {
      blob = opts.dataUrlOrBlob;
      mime = blob.type || "application/octet-stream";
    }

    const ext = extFromMime(mime, "bin");
    const name =
      opts.filename ||
      `${opts.bucket}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `${opts.userId}/${name}`;

    const { error } = await supabase.storage
      .from(opts.bucket)
      .upload(path, blob, {
        contentType: mime,
        upsert: true,
        cacheControl: "3600",
      });

    if (error) {
      return { ok: false, error: error.message };
    }

    const { data } = supabase.storage.from(opts.bucket).getPublicUrl(path);
    return { ok: true, publicUrl: data.publicUrl };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha no upload",
    };
  }
}

/** Se valor for data URL, sobe para Storage; URLs http(s) passam; blob/idb falham com mensagem clara. */
export async function ensureRemoteMedia(
  userId: string,
  bucket: MediaBucket,
  value: string | null | undefined
): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (!value.startsWith("data:")) {
    throw new Error(
      "Imagem temporária inválida. Selecione a foto/GIF novamente e salve."
    );
  }
  const res = await uploadUserMedia({
    bucket,
    userId,
    dataUrlOrBlob: value,
  });
  if (!res.ok) {
    console.error("[storage]", res.error);
    throw new Error(res.error);
  }
  return res.publicUrl;
}

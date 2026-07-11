import { createReadStream, promises as fs } from "fs";
import path from "path";
import type { Readable } from "stream";
import {
  getVideosBucket,
  mediaObjectKey,
} from "@/lib/videos/cloud-bindings";

const MEDIA_DIR = path.join(process.cwd(), "data", "media", "videos");

export function videoFilePath(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(MEDIA_DIR, `${safe}.mp4`);
}

export async function ensureMediaDir(): Promise<void> {
  await fs.mkdir(MEDIA_DIR, { recursive: true });
}

/**
 * Grava cópia de playback:
 * - Cloudflare com R2: R2
 * - Local: data/media/videos (FS)
 * - Cloudflare sem R2: "none" (player usa Telegram getFile ≤ ~20 MB)
 */
export async function saveVideoFile(
  id: string,
  buffer: Buffer | Uint8Array
): Promise<"r2" | "fs" | "none"> {
  const bytes = Buffer.isBuffer(buffer)
    ? buffer
    : Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const bucket = await getVideosBucket();
  if (bucket) {
    await bucket.put(mediaObjectKey(id), bytes, {
      httpMetadata: { contentType: "video/mp4" },
    });
    return "r2";
  }

  try {
    await ensureMediaDir();
    const p = videoFilePath(id);
    const tmp = `${p}.${process.pid}.tmp`;
    await fs.writeFile(tmp, bytes);
    await fs.rename(tmp, p);
    return "fs";
  } catch (e) {
    console.warn(
      "[videos] sem R2/FS gravável — playback via Telegram getFile",
      e
    );
    return "none";
  }
}

export async function hasVideoFile(id: string): Promise<boolean> {
  const bucket = await getVideosBucket();
  if (bucket) {
    try {
      const head = await bucket.head(mediaObjectKey(id));
      return !!head && head.size > 0;
    } catch {
      return false;
    }
  }
  try {
    await fs.access(videoFilePath(id));
    return true;
  } catch {
    return false;
  }
}

export type VideoBlobSource =
  | { kind: "r2"; key: string; size: number }
  | { kind: "fs"; path: string; size: number };

export async function getVideoBlobSource(
  id: string
): Promise<VideoBlobSource | null> {
  const bucket = await getVideosBucket();
  if (bucket) {
    try {
      const head = await bucket.head(mediaObjectKey(id));
      if (head && head.size > 0) {
        return { kind: "r2", key: mediaObjectKey(id), size: head.size };
      }
    } catch {
      /* fallthrough */
    }
  }

  const p = videoFilePath(id);
  try {
    const st = await fs.stat(p);
    if (st.isFile() && st.size > 0) {
      return { kind: "fs", path: p, size: st.size };
    }
  } catch {
    /* none */
  }
  return null;
}

/** @deprecated use getVideoBlobSource */
export async function getVideoFileStat(
  id: string
): Promise<{ path: string; size: number } | null> {
  const src = await getVideoBlobSource(id);
  if (!src || src.kind !== "fs") return null;
  return { path: src.path, size: src.size };
}

export async function deleteVideoFile(id: string): Promise<void> {
  const bucket = await getVideosBucket();
  if (bucket) {
    try {
      await bucket.delete(mediaObjectKey(id));
    } catch {
      /* ignore */
    }
  }
  try {
    await fs.unlink(videoFilePath(id));
  } catch {
    /* ignore */
  }
}

export function openVideoReadStream(
  filePath: string,
  start?: number,
  end?: number
): Readable {
  if (start != null && end != null) {
    return createReadStream(filePath, { start, end });
  }
  if (start != null) {
    return createReadStream(filePath, { start });
  }
  return createReadStream(filePath);
}

export async function openR2VideoStream(
  key: string,
  rangeHeader: string | null
): Promise<{
  body: ReadableStream | null;
  status: number;
  size: number;
  contentRange?: string;
  contentLength: number;
} | null> {
  const bucket = await getVideosBucket();
  if (!bucket) return null;

  const obj = await bucket.get(key);
  if (!obj) return null;

  const size = obj.size;
  if (!rangeHeader) {
    return {
      body: obj.body,
      status: 200,
      size,
      contentLength: size,
    };
  }

  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!m) {
    return {
      body: obj.body,
      status: 200,
      size,
      contentLength: size,
    };
  }

  let start = m[1] === "" ? 0 : parseInt(m[1], 10);
  let end = m[2] === "" ? size - 1 : parseInt(m[2], 10);
  if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end >= size || start > end) {
    return {
      body: null,
      status: 416,
      size,
      contentLength: 0,
      contentRange: `bytes */${size}`,
    };
  }

  const maxChunk = 2 * 1024 * 1024;
  if (end - start + 1 > maxChunk) {
    end = start + maxChunk - 1;
  }

  // R2 get com range via headers não está tipado no nosso shim —
  // re-fetch com range se o binding suportar; senão stream full e slice não é ideal.
  // Workers R2: bucket.get(key, { range: { offset, length } })
  const length = end - start + 1;
  try {
    const ranged = await (
      bucket as VideosR2BucketWithRange
    ).get(key, { range: { offset: start, length } });
    if (ranged) {
      return {
        body: ranged.body,
        status: 206,
        size,
        contentLength: length,
        contentRange: `bytes ${start}-${end}/${size}`,
      };
    }
  } catch {
    /* fallback full body only for small files */
  }

  if (size <= 8 * 1024 * 1024) {
    const ab = await obj.arrayBuffer();
    const slice = ab.slice(start, end + 1);
    return {
      body: new Blob([slice]).stream(),
      status: 206,
      size,
      contentLength: slice.byteLength,
      contentRange: `bytes ${start}-${end}/${size}`,
    };
  }

  // Sem range nativo: devolve full (player ainda funciona, menos ideal)
  return {
    body: obj.body,
    status: 200,
    size,
    contentLength: size,
  };
}

type VideosR2BucketWithRange = {
  get(
    key: string,
    options?: { range?: { offset: number; length: number } }
  ): Promise<{
    body: ReadableStream | null;
    size: number;
    arrayBuffer(): Promise<ArrayBuffer>;
  } | null>;
};

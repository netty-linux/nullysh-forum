import { promises as fs } from "fs";
import path from "path";
import type { StoredVideo, VideoPublic } from "@/lib/videos/types";
import {
  CATALOG_KV_KEY,
  CATALOG_OBJECT_KEY,
  getDataKv,
  getVideosBucket,
} from "@/lib/videos/cloud-bindings";
import { uid } from "@/lib/utils";

const DATA_DIR = path.join(process.cwd(), "data");
const CATALOG_PATH = path.join(DATA_DIR, "videos.json");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function parseCatalog(raw: string): StoredVideo[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is StoredVideo => {
      if (!v || typeof v !== "object") return false;
      const row = v as StoredVideo;
      if (typeof row.id !== "string") return false;
      // Aceita Telegram vault e/ou R2 playback
      const hasTg = typeof row.telegramFileId === "string";
      const hasR2 =
        typeof row.r2ObjectKey === "string" && row.r2ObjectKey.length > 0;
      return hasTg || hasR2;
    });
  } catch {
    return [];
  }
}

/**
 * Ordem de leitura: R2 → KV → FS local
 */
export async function readVideoCatalog(): Promise<StoredVideo[]> {
  const bucket = await getVideosBucket();
  if (bucket) {
    try {
      const obj = await bucket.get(CATALOG_OBJECT_KEY);
      if (obj) return parseCatalog(await obj.text());
    } catch (e) {
      console.error("[videos] read catalog R2", e);
    }
  }

  const kv = await getDataKv();
  if (kv) {
    try {
      const raw = await kv.get(CATALOG_KV_KEY);
      if (raw) return parseCatalog(raw);
      return [];
    } catch (e) {
      console.error("[videos] read catalog KV", e);
      return [];
    }
  }

  try {
    await ensureDir();
    const raw = await fs.readFile(CATALOG_PATH, "utf8");
    return parseCatalog(raw);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err?.code === "ENOENT") return [];
    console.error("[videos] read catalog FS", e);
    return [];
  }
}

/**
 * Ordem de escrita: R2 (se houver) + KV (se houver) + FS (dev)
 */
export async function writeVideoCatalog(videos: StoredVideo[]): Promise<void> {
  const json = JSON.stringify(videos, null, 2);
  let persisted = false;

  const bucket = await getVideosBucket();
  if (bucket) {
    await bucket.put(CATALOG_OBJECT_KEY, json, {
      httpMetadata: { contentType: "application/json" },
    });
    persisted = true;
  }

  const kv = await getDataKv();
  if (kv) {
    await kv.put(CATALOG_KV_KEY, json);
    persisted = true;
  }

  if (!persisted) {
    await ensureDir();
    const tmp = `${CATALOG_PATH}.${process.pid}.tmp`;
    await fs.writeFile(tmp, json, "utf8");
    await fs.rename(tmp, CATALOG_PATH);
  }
}

export function toPublicVideo(v: StoredVideo): VideoPublic {
  const hasThumb = !!(v.r2ThumbKey || v.telegramThumbFileId);
  // Rev estável a partir da key — muda quando a capa é trocada (cache-bust no <img>)
  const thumbRev = v.r2ThumbKey
    ? v.r2ThumbKey.replace(/^thumbs\//, "").slice(0, 20)
    : v.telegramThumbFileId
      ? String(v.telegramThumbFileId).slice(-12)
      : undefined;
  return {
    id: v.id,
    title: v.title,
    description: v.description,
    duration: v.duration,
    category: v.category,
    thumbnail: v.thumbnail,
    vipOnly: v.vipOnly,
    views: v.views,
    createdAt: v.createdAt,
    hasStream: true,
    mimeType: v.mimeType,
    sizeBytes: v.sizeBytes,
    hasThumb,
    thumbRev,
  };
}

export async function listPublicVideos(): Promise<VideoPublic[]> {
  const all = await readVideoCatalog();
  return all
    .map(toPublicVideo)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export async function getStoredVideo(
  id: string
): Promise<StoredVideo | undefined> {
  const all = await readVideoCatalog();
  return all.find((v) => v.id === id);
}

export async function addStoredVideo(
  input: Omit<StoredVideo, "id" | "views" | "createdAt"> & {
    id?: string;
    views?: number;
    createdAt?: string;
  }
): Promise<StoredVideo> {
  const all = await readVideoCatalog();
  const video: StoredVideo = {
    id: input.id || uid("vid"),
    title: input.title,
    description: input.description,
    duration: input.duration,
    category: input.category,
    thumbnail: input.thumbnail,
    vipOnly: input.vipOnly,
    views: input.views ?? 0,
    createdAt: input.createdAt || new Date().toISOString(),
    telegramFileId: input.telegramFileId ?? (input.r2ObjectKey ? "r2" : ""),
    telegramMessageId: input.telegramMessageId,
    telegramChatId: input.telegramChatId,
    telegramThumbFileId: input.telegramThumbFileId ?? null,
    r2ObjectKey: input.r2ObjectKey ?? null,
    r2ThumbKey: input.r2ThumbKey ?? null,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    uploadedById: input.uploadedById,
    uploadedByName: input.uploadedByName,
  };
  all.unshift(video);
  await writeVideoCatalog(all);
  return video;
}

export async function updateStoredVideo(
  id: string,
  patch: Partial<
    Pick<
      StoredVideo,
      | "title"
      | "description"
      | "category"
      | "vipOnly"
      | "duration"
      | "thumbnail"
      | "views"
      | "r2ThumbKey"
      | "r2ObjectKey"
    >
  >
): Promise<StoredVideo | null> {
  const all = await readVideoCatalog();
  const idx = all.findIndex((v) => v.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch };
  await writeVideoCatalog(all);
  return all[idx];
}

export async function removeStoredVideo(
  id: string
): Promise<StoredVideo | null> {
  const all = await readVideoCatalog();
  const idx = all.findIndex((v) => v.id === id);
  if (idx < 0) return null;
  const [removed] = all.splice(idx, 1);
  await writeVideoCatalog(all);
  return removed;
}

export async function incrementViews(id: string): Promise<number> {
  const all = await readVideoCatalog();
  const idx = all.findIndex((v) => v.id === id);
  if (idx < 0) return 0;
  all[idx] = { ...all[idx], views: (all[idx].views || 0) + 1 };
  await writeVideoCatalog(all);
  return all[idx].views;
}

export function formatDuration(sec: number): string {
  if (!sec || sec < 0) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

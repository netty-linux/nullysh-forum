import { promises as fs } from "fs";
import path from "path";
import type { StoredVideo, VideoPublic } from "@/lib/videos/types";
import { uid } from "@/lib/utils";

const DATA_DIR = path.join(process.cwd(), "data");
const CATALOG_PATH = path.join(DATA_DIR, "videos.json");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readVideoCatalog(): Promise<StoredVideo[]> {
  try {
    await ensureDir();
    const raw = await fs.readFile(CATALOG_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is StoredVideo =>
        !!v &&
        typeof v === "object" &&
        typeof (v as StoredVideo).id === "string" &&
        typeof (v as StoredVideo).telegramFileId === "string"
    );
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err?.code === "ENOENT") return [];
    console.error("[videos] read catalog", e);
    return [];
  }
}

export async function writeVideoCatalog(videos: StoredVideo[]): Promise<void> {
  await ensureDir();
  const tmp = `${CATALOG_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(videos, null, 2), "utf8");
  await fs.rename(tmp, CATALOG_PATH);
}

export function toPublicVideo(v: StoredVideo): VideoPublic {
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
    hasThumb: !!v.telegramThumbFileId,
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
    telegramFileId: input.telegramFileId,
    telegramMessageId: input.telegramMessageId,
    telegramChatId: input.telegramChatId,
    telegramThumbFileId: input.telegramThumbFileId ?? null,
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

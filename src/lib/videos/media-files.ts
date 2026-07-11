import { createReadStream, promises as fs } from "fs";
import path from "path";
import type { Readable } from "stream";

const MEDIA_DIR = path.join(process.cwd(), "data", "media", "videos");

export function videoFilePath(id: string): string {
  // id seguro (sem path traversal)
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(MEDIA_DIR, `${safe}.mp4`);
}

export async function ensureMediaDir(): Promise<void> {
  await fs.mkdir(MEDIA_DIR, { recursive: true });
}

export async function saveVideoFile(
  id: string,
  buffer: Buffer
): Promise<string> {
  await ensureMediaDir();
  const p = videoFilePath(id);
  const tmp = `${p}.${process.pid}.tmp`;
  await fs.writeFile(tmp, buffer);
  await fs.rename(tmp, p);
  return p;
}

export async function hasVideoFile(id: string): Promise<boolean> {
  try {
    await fs.access(videoFilePath(id));
    return true;
  } catch {
    return false;
  }
}

export async function getVideoFileStat(
  id: string
): Promise<{ path: string; size: number } | null> {
  const p = videoFilePath(id);
  try {
    const st = await fs.stat(p);
    if (!st.isFile() || st.size <= 0) return null;
    return { path: p, size: st.size };
  } catch {
    return null;
  }
}

export async function deleteVideoFile(id: string): Promise<void> {
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

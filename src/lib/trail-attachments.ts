/**
 * Anexos de trilha em IndexedDB (via media-storage).
 */

import { mediaDelete, mediaGet, mediaSet } from "@/lib/media-storage";
import { uid } from "@/lib/utils";

export const MAX_TRAIL_ATTACHMENT_BYTES = 4 * 1024 * 1024; // 4 MB
export const MAX_TRAIL_ATTACHMENTS = 8;

export function trailAttachKey(id: string) {
  return `idb:trail-attach:${id}`;
}

export async function storeTrailFile(file: File): Promise<{
  id: string;
  name: string;
  size: number;
  mimeType: string;
  storageKey: string;
}> {
  if (file.size > MAX_TRAIL_ATTACHMENT_BYTES) {
    throw new Error(
      `Arquivo acima de ${(MAX_TRAIL_ATTACHMENT_BYTES / (1024 * 1024)).toFixed(0)} MB.`
    );
  }
  const id = uid("tfile");
  const storageKey = trailAttachKey(id);
  const dataUrl = await fileToDataUrl(file);
  await mediaSet(storageKey, dataUrl);
  return {
    id,
    name: file.name.slice(0, 120),
    size: file.size,
    mimeType: file.type || "application/octet-stream",
    storageKey,
  };
}

export async function loadTrailAttachmentDataUrl(
  storageKey: string
): Promise<string | null> {
  if (storageKey.startsWith("data:")) return storageKey;
  return mediaGet(storageKey);
}

export async function removeTrailAttachment(storageKey: string) {
  if (storageKey.startsWith("idb:")) {
    await mediaDelete(storageKey);
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Falha ao ler arquivo."));
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

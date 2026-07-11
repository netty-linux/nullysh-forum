/**
 * Bindings Cloudflare (R2 opcional + KV catálogo) via OpenNext.
 * Em `next dev` sem bindings → null → fallback FS.
 */

export type VideosR2Bucket = {
  get(
    key: string,
    options?: { range?: { offset: number; length: number } }
  ): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
    text(): Promise<string>;
    body: ReadableStream | null;
    size: number;
    httpMetadata?: { contentType?: string };
  } | null>;
  put(
    key: string,
    value:
      | ArrayBuffer
      | ArrayBufferView
      | string
      | ReadableStream
      | Blob
      | null,
    options?: { httpMetadata?: { contentType?: string } }
  ): Promise<unknown>;
  delete(key: string | string[]): Promise<void>;
  head(key: string): Promise<{ size: number } | null>;
};

export type NullyshKv = {
  get(key: string, type?: "text"): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void>;
  delete(key: string): Promise<void>;
};

type CloudflareEnv = {
  VIDEOS_BUCKET?: VideosR2Bucket;
  NULLYSH_DATA?: NullyshKv;
};

async function getEnv(): Promise<CloudflareEnv | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    return (ctx?.env as CloudflareEnv | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function getVideosBucket(): Promise<VideosR2Bucket | null> {
  const env = await getEnv();
  return env?.VIDEOS_BUCKET ?? null;
}

export async function getDataKv(): Promise<NullyshKv | null> {
  const env = await getEnv();
  return env?.NULLYSH_DATA ?? null;
}

export function mediaObjectKey(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `media/${safe}.mp4`;
}

export const CATALOG_OBJECT_KEY = "catalog/videos.json";
export const CATALOG_KV_KEY = "videos:catalog";

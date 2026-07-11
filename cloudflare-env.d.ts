/**
 * Tipos dos bindings Cloudflare (gerados/ajustados para o projeto).
 * Rode `npm run cf-typegen` para regenerar a partir do wrangler.jsonc.
 */

interface VideosR2Bucket {
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
}

interface NullyshKv {
  get(key: string, type?: "text"): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

interface CloudflareEnv {
  VIDEOS_BUCKET?: VideosR2Bucket;
  NULLYSH_DATA: NullyshKv;
  ASSETS: Fetcher;
  WORKER_SELF_REFERENCE: Fetcher;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
}

import type { VideoPublic } from "@/lib/videos/types";

export type VideosListResponse = {
  ok: boolean;
  videos?: VideoPublic[];
  telegramConfigured?: boolean;
  error?: string;
};

export type VideoConfigResponse = {
  ok: boolean;
  configured: boolean;
  botOk: boolean;
  botUsername: string | null;
  error: string | null;
  count: number;
  maxUploadMb: number;
  maxOriginalMb?: number;
  ffmpegAvailable?: boolean;
  autoCompress?: boolean;
  compressEngine?: string;
  playbackStorage?: string;
  compressTargetMb?: number;
  compressTargetBytes?: number;
  hasR2?: boolean;
  hasKv?: boolean;
};

export function adminHeaders(admin: {
  id: string;
  name: string;
  role?: string;
}): HeadersInit {
  const h: Record<string, string> = {
    "x-admin-id": admin.id,
    "x-admin-name": admin.name,
    "x-admin-role": admin.role || "admin",
  };
  // Opcional: secret em prod (definir no .env.local e espelhar só no server —
  // se NEXT_PUBLIC_ADMIN_API_SECRET existir, envia; caso contrário só dev headers)
  const pub = process.env.NEXT_PUBLIC_ADMIN_API_SECRET?.trim();
  if (pub) h["x-admin-secret"] = pub;
  return h;
}

export async function fetchVideos(): Promise<VideosListResponse> {
  const res = await fetch("/api/videos", { cache: "no-store" });
  return (await res.json()) as VideosListResponse;
}

export async function fetchVideoConfig(): Promise<VideoConfigResponse> {
  const res = await fetch("/api/videos/config", { cache: "no-store" });
  return (await res.json()) as VideoConfigResponse;
}

export async function uploadVideo(opts: {
  file: File;
  title: string;
  description: string;
  category: string;
  vipOnly: boolean;
  duration?: string;
  thumb?: File | null;
  admin: { id: string; name: string; role?: string };
  /** true se o file já passou pelo ffmpeg.wasm no browser */
  clientCompressed?: boolean;
  originalBytes?: number;
  durationSec?: number;
}): Promise<
  | {
      ok: true;
      video: VideoPublic;
      compressed?: boolean;
      originalBytes?: number;
      finalBytes?: number;
    }
  | { ok: false; error: string }
> {
  const form = new FormData();
  form.append("file", opts.file);
  form.append("title", opts.title);
  form.append("description", opts.description);
  form.append("category", opts.category);
  form.append("vipOnly", opts.vipOnly ? "true" : "false");
  if (opts.duration) form.append("duration", opts.duration);
  if (opts.thumb) form.append("thumb", opts.thumb);
  if (opts.clientCompressed) form.append("clientCompressed", "true");
  if (opts.originalBytes != null) {
    form.append("originalBytes", String(opts.originalBytes));
  }
  if (opts.durationSec != null && opts.durationSec > 0) {
    form.append("durationSec", String(opts.durationSec));
  }

  const res = await fetch("/api/videos", {
    method: "POST",
    headers: adminHeaders(opts.admin),
    body: form,
  });
  const data = (await res.json()) as {
    ok: boolean;
    video?: VideoPublic;
    error?: string;
    compressed?: boolean;
    originalBytes?: number;
    finalBytes?: number;
  };
  if (!data.ok || !data.video) {
    return { ok: false, error: data.error || `HTTP ${res.status}` };
  }
  return {
    ok: true,
    video: data.video,
    compressed: !!data.compressed,
    originalBytes: data.originalBytes,
    finalBytes: data.finalBytes,
  };
}

export async function deleteVideo(
  id: string,
  admin: { id: string; name: string; role?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/videos/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: adminHeaders(admin),
  });
  const data = (await res.json()) as { ok: boolean; error?: string };
  if (!data.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
  return { ok: true };
}

export function videoStreamUrl(id: string): string {
  return `/api/videos/${encodeURIComponent(id)}/stream`;
}

export function videoThumbUrl(id: string): string {
  return `/api/videos/${encodeURIComponent(id)}/thumb`;
}

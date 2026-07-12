"use client";

import { adminHeaders } from "@/lib/videos/client";
import type { VideoPublic } from "@/lib/videos/types";
import { useCallback, useState } from "react";

export type VideoUploadMeta = {
  title: string;
  description?: string;
  vipOnly?: boolean;
  category?: string;
  duration?: string;
  /** Capa/thumbnail (JPG/PNG/WebP) */
  thumb?: File | null;
};

export type VideoUploadResult = {
  videoId: string;
  streamUrl: string;
  video: VideoPublic;
};

type PresignResponse = {
  ok?: boolean;
  uploadUrl?: string;
  objectKey?: string;
  publicUrl?: string;
  mode?: "s3-presign" | "worker-put";
  error?: string;
};

type CompleteResponse = {
  ok?: boolean;
  success?: boolean;
  video?: VideoPublic;
  streamUrl?: string;
  error?: string;
};

function putWithProgress(
  uploadUrl: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    Object.entries(headers).forEach(([k, v]) => {
      if (v) xhr.setRequestHeader(k, v);
    });
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        onProgress(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      let msg = `Upload HTTP ${xhr.status}`;
      try {
        const j = JSON.parse(xhr.responseText) as { error?: string };
        if (j.error) msg = j.error;
      } catch {
        if (xhr.responseText) msg = xhr.responseText.slice(0, 200);
      }
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Falha de rede no PUT do arquivo"));
    xhr.onabort = () => reject(new Error("Upload cancelado"));
    xhr.send(file);
  });
}

async function presignAndPut(opts: {
  file: File;
  kind: "video" | "thumb";
  headers: Record<string, string>;
  onProgress: (pct: number) => void;
}): Promise<{ objectKey: string; mode?: string }> {
  const presignRes = await fetch("/api/videos/presign", {
    method: "POST",
    headers: {
      ...opts.headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: opts.file.name,
      contentType: opts.file.type || (opts.kind === "thumb" ? "image/jpeg" : "video/mp4"),
      size: opts.file.size,
      kind: opts.kind,
    }),
  });
  const presign = (await presignRes.json()) as PresignResponse;
  if (!presignRes.ok || !presign.ok || !presign.uploadUrl || !presign.objectKey) {
    throw new Error(
      presign.error || `Presign (${opts.kind}) falhou HTTP ${presignRes.status}`
    );
  }

  const putHeaders: Record<string, string> = {
    "Content-Type":
      opts.file.type || (opts.kind === "thumb" ? "image/jpeg" : "video/mp4"),
  };
  if (presign.mode === "worker-put" || presign.uploadUrl.startsWith("/")) {
    Object.assign(putHeaders, opts.headers);
  }

  await putWithProgress(
    presign.uploadUrl,
    opts.file,
    putHeaders,
    opts.onProgress
  );

  return { objectKey: presign.objectKey, mode: presign.mode };
}

/**
 * Pipeline R2: presign → PUT vídeo (+ thumb) → complete.
 */
export function useVideoUpload(admin: {
  id: string;
  name: string;
  role?: string;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (
      file: File,
      meta: VideoUploadMeta
    ): Promise<VideoUploadResult> => {
      setIsUploading(true);
      setProgress(0);
      setError(null);
      setPhase("Solicitando URL de upload…");

      // AppSec: NÃO enviar NEXT_PUBLIC_* secret (visível no bundle).
      // Auth admin = sessão Supabase (cookies) no server assertVideoAdmin.
      const headers = adminHeaders(admin) as Record<string, string>;

      try {
        setPhase("Enviando vídeo ao R2…");
        const videoPut = await presignAndPut({
          file,
          kind: "video",
          headers,
          onProgress: (pct) => setProgress(Math.min(90, Math.round(pct * 0.9))),
        });

        let thumbObjectKey: string | undefined;
        if (meta.thumb && meta.thumb.size > 0) {
          if (!meta.thumb.type.startsWith("image/")) {
            throw new Error("Thumbnail deve ser imagem (JPG, PNG ou WebP).");
          }
          if (meta.thumb.size > 5 * 1024 * 1024) {
            throw new Error("Thumbnail deve ter no máximo 5 MB.");
          }
          setPhase("Enviando thumbnail…");
          const thumbPut = await presignAndPut({
            file: meta.thumb,
            kind: "thumb",
            headers,
            onProgress: (pct) =>
              setProgress(90 + Math.min(8, Math.round(pct * 0.08))),
          });
          thumbObjectKey = thumbPut.objectKey;
        }

        setPhase("Registrando no catálogo…");
        setProgress(98);
        const completeRes = await fetch("/api/videos/complete", {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            objectKey: videoPut.objectKey,
            thumbObjectKey: thumbObjectKey || undefined,
            title: meta.title,
            description: meta.description || "",
            vipOnly: !!meta.vipOnly,
            sizeBytes: file.size,
            category: meta.category || "Geral",
            duration: meta.duration || "",
            mimeType: file.type || "video/mp4",
            fileName: file.name,
          }),
        });
        const complete = (await completeRes.json()) as CompleteResponse;
        if (!completeRes.ok || !complete.ok || !complete.video) {
          throw new Error(
            complete.error || `Complete falhou (HTTP ${completeRes.status})`
          );
        }

        const streamUrl =
          complete.streamUrl ||
          `/api/videos/${encodeURIComponent(complete.video.id)}/stream`;

        setPhase("Concluído");
        setProgress(100);
        return {
          videoId: complete.video.id,
          streamUrl,
          video: complete.video,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e instanceof Error ? e : new Error(msg);
      } finally {
        setIsUploading(false);
      }
    },
    [admin]
  );

  return {
    upload,
    isUploading,
    progress,
    phase,
    error,
    setError,
  };
}

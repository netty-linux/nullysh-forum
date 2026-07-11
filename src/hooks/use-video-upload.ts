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
    xhr.onerror = () => reject(new Error("Falha de rede no PUT do vídeo"));
    xhr.onabort = () => reject(new Error("Upload cancelado"));
    xhr.send(file);
  });
}

/**
 * Pipeline R2: presign → PUT (S3 ou Worker) → complete.
 * Não usa ffmpeg.wasm no path padrão (opcional separado).
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

      const headers = adminHeaders(admin) as Record<string, string>;
      // Alias pedido no brief do architect
      const pub =
        process.env.NEXT_PUBLIC_ADMIN_API_SECRET?.trim() ||
        process.env.NEXT_PUBLIC_ADMIN_SECRET?.trim();
      if (pub) headers["x-admin-secret"] = pub;

      try {
        const presignRes = await fetch("/api/videos/presign", {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || "video/mp4",
            size: file.size,
          }),
        });
        const presign = (await presignRes.json()) as PresignResponse;
        if (!presignRes.ok || !presign.ok || !presign.uploadUrl || !presign.objectKey) {
          throw new Error(
            presign.error || `Presign falhou (HTTP ${presignRes.status})`
          );
        }

        setPhase(
          presign.mode === "s3-presign"
            ? "Enviando direto ao R2…"
            : "Enviando ao storage (Worker → R2)…"
        );

        const putHeaders: Record<string, string> = {
          "Content-Type": file.type || "video/mp4",
        };
        // worker-put exige admin headers no mesmo origin
        if (presign.mode === "worker-put" || presign.uploadUrl.startsWith("/")) {
          Object.assign(putHeaders, headers);
        }

        await putWithProgress(
          presign.uploadUrl,
          file,
          putHeaders,
          setProgress
        );

        setPhase("Registrando no catálogo…");
        const completeRes = await fetch("/api/videos/complete", {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            objectKey: presign.objectKey,
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

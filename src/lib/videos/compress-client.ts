/**
 * Compactação de vídeo no browser via ffmpeg.wasm.
 * Roda no PC do admin — não usa CPU do Worker Cloudflare.
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import {
  COMPRESS_TARGET_BYTES,
  MAX_ORIGINAL_BYTES,
  TELEGRAM_GETFILE_MAX_BYTES,
  TELEGRAM_MAX_BYTES,
} from "@/lib/videos/limits";

export type ClientCompressProgress = {
  phase: "loading" | "probing" | "compressing" | "done";
  /** 0–100 durante compressão */
  ratio?: number;
  message: string;
  attempt?: number;
  attempts?: number;
};

export type ClientCompressResult = {
  file: File;
  compressed: boolean;
  originalBytes: number;
  finalBytes: number;
  durationSec: number;
};

let ffmpegSingleton: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

const CORE_VERSION = "0.12.10";
const CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`;

async function getFfmpeg(
  onProgress?: (p: ClientCompressProgress) => void
): Promise<FFmpeg> {
  if (ffmpegSingleton?.loaded) return ffmpegSingleton;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    onProgress?.({
      phase: "loading",
      message: "Baixando motor FFmpeg (1ª vez pode levar ~30s)…",
    });
    const ffmpeg = new FFmpeg();
    ffmpeg.on("log", () => {
      /* silencioso — logs poluem UI */
    });
    await ffmpeg.load({
      coreURL: await toBlobURL(
        `${CORE_BASE}/ffmpeg-core.js`,
        "text/javascript"
      ),
      wasmURL: await toBlobURL(
        `${CORE_BASE}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });
    ffmpegSingleton = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await loadPromise;
  } catch (e) {
    loadPromise = null;
    throw e;
  }
}

function stemFromName(name: string): string {
  const base = (name || "video.mp4").replace(/[^\w.\-]+/g, "_");
  return base.replace(/\.[^.]+$/, "") || "video";
}

function probeDurationFromFile(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const d = video.duration;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) && d > 0 ? d : 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    video.src = url;
  });
}

function toMp4File(data: Uint8Array, name: string): File {
  // Cópia do buffer para evitar SharedArrayBuffer / offset issues
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return new File([copy], name, { type: "video/mp4" });
}

/**
 * Compacta o vídeo no browser.
 * @param targetBytes default 48 MB (Telegram upload). Use ~18 MB se playback for só via getFile.
 */
export async function compressVideoInBrowser(
  input: File,
  opts?: {
    onProgress?: (p: ClientCompressProgress) => void;
    signal?: AbortSignal;
    /** Alvo em bytes (default COMPRESS_TARGET_BYTES ≈ 48 MB) */
    targetBytes?: number;
  }
): Promise<ClientCompressResult> {
  const onProgress = opts?.onProgress;
  const originalBytes = input.size;
  const targetBytes = opts?.targetBytes ?? COMPRESS_TARGET_BYTES;
  const hardMax = Math.min(TELEGRAM_MAX_BYTES, Math.max(targetBytes, TELEGRAM_GETFILE_MAX_BYTES));

  if (originalBytes > MAX_ORIGINAL_BYTES) {
    throw new Error(
      `Arquivo maior que ${MAX_ORIGINAL_BYTES / (1024 * 1024)} MB. Envie um arquivo menor.`
    );
  }

  if (originalBytes <= targetBytes) {
    onProgress?.({
      phase: "done",
      ratio: 100,
      message: `Arquivo já cabe no alvo (${(targetBytes / (1024 * 1024)).toFixed(0)} MB) — sem compactar.`,
    });
    const durationSec = await probeDurationFromFile(input);
    return {
      file: input,
      compressed: false,
      originalBytes,
      finalBytes: originalBytes,
      durationSec,
    };
  }

  const ffmpeg = await getFfmpeg(onProgress);
  if (opts?.signal?.aborted) throw new Error("Compactação cancelada");

  const stem = stemFromName(input.name);
  const inName = `in-${Date.now()}.${(input.name.split(".").pop() || "mp4").toLowerCase()}`;
  const outName = `${stem}-tg.mp4`;

  onProgress?.({
    phase: "probing",
    message: "Analisando vídeo…",
  });

  const durationSec = await probeDurationFromFile(input);
  await ffmpeg.writeFile(inName, await fetchFile(input));

  const targetBitsPerSec =
    durationSec > 1
      ? Math.floor((targetBytes * 8 * 0.9) / durationSec)
      : 1_200_000;
  const audioBitrate = 96_000;
  const videoBitrate = Math.max(200_000, targetBitsPerSec - audioBitrate);

  const attempts: Array<{ crf?: number; vb?: number; scale: string }> = [
    { vb: videoBitrate, scale: "scale='min(1280,iw)':-2" },
    { vb: Math.floor(videoBitrate * 0.7), scale: "scale='min(1280,iw)':-2" },
    { crf: 30, scale: "scale='min(1280,iw)':-2" },
    { crf: 32, scale: "scale='min(960,iw)':-2" },
    { crf: 34, scale: "scale='min(854,iw)':-2" },
    { crf: 36, scale: "scale='min(640,iw)':-2" },
    // Passos extras se o alvo for o getFile (~18 MB)
    { crf: 38, scale: "scale='min(640,iw)':-2" },
    { crf: 40, scale: "scale='min(480,iw)':-2" },
  ];

  const onFfmpegProgress = ({ progress }: { progress: number }) => {
    onProgress?.({
      phase: "compressing",
      ratio: Math.min(99, Math.round((progress || 0) * 100)),
      message: "Compactando no seu navegador…",
    });
  };
  ffmpeg.on("progress", onFfmpegProgress);

  let lastErr = "";
  let best: Uint8Array | null = null;

  try {
    for (let i = 0; i < attempts.length; i++) {
      if (opts?.signal?.aborted) throw new Error("Compactação cancelada");
      const a = attempts[i];
      onProgress?.({
        phase: "compressing",
        ratio: 0,
        attempt: i + 1,
        attempts: attempts.length,
        message: `Compactando (passo ${i + 1}/${attempts.length})…`,
      });

      try {
        await ffmpeg.deleteFile(outName);
      } catch {
        /* ok */
      }

      const args = [
        "-y",
        "-i",
        inName,
        "-vf",
        a.scale,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast", // wasm: prioriza tempo; quality vem do CRF/bitrate
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        "-ac",
        "2",
        "-ar",
        "44100",
        "-movflags",
        "+faststart",
      ];

      if (a.crf != null) {
        args.push("-crf", String(a.crf));
      } else if (a.vb != null) {
        const k = Math.max(200, Math.floor(a.vb / 1000));
        args.push("-b:v", `${k}k`, "-maxrate", `${k}k`, "-bufsize", `${k * 2}k`);
      }
      args.push(outName);

      try {
        await ffmpeg.exec(args);
      } catch (e) {
        lastErr = e instanceof Error ? e.message : "ffmpeg falhou";
        continue;
      }

      const data = await ffmpeg.readFile(outName);
      if (typeof data === "string") {
        lastErr = "saída inesperada";
        continue;
      }
      const out = data as Uint8Array;
      best = out;

      if (out.byteLength <= targetBytes) {
        const file = toMp4File(out, `${stem}-compressed.mp4`);
        onProgress?.({
          phase: "done",
          ratio: 100,
          message: `Pronto: ${(originalBytes / (1024 * 1024)).toFixed(1)} → ${(out.byteLength / (1024 * 1024)).toFixed(1)} MB`,
        });
        return {
          file,
          compressed: true,
          originalBytes,
          finalBytes: out.byteLength,
          durationSec,
        };
      }
      lastErr = `ainda ${(out.byteLength / (1024 * 1024)).toFixed(1)} MB no passo ${i + 1}`;
    }
  } finally {
    ffmpeg.off("progress", onFfmpegProgress);
    try {
      await ffmpeg.deleteFile(inName);
    } catch {
      /* ok */
    }
    try {
      await ffmpeg.deleteFile(outName);
    } catch {
      /* ok */
    }
  }

  if (best && best.byteLength <= hardMax) {
    const file = toMp4File(best, `${stem}-compressed.mp4`);
    onProgress?.({
      phase: "done",
      ratio: 100,
      message: `Compactado para ${(best.byteLength / (1024 * 1024)).toFixed(1)} MB`,
    });
    return {
      file,
      compressed: true,
      originalBytes,
      finalBytes: best.byteLength,
      durationSec,
    };
  }

  throw new Error(
    `Não foi possível compactar abaixo de ${(targetBytes / (1024 * 1024)).toFixed(0)} MB (${lastErr}). Tente um trecho menor.`
  );
}

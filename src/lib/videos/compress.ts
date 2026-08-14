/**
 * Compactação server-side (FFmpeg no PATH) — só para `next dev` local.
 * Em Cloudflare / produção o admin usa ffmpeg.wasm no browser
 * (`compress-client.ts`) e a API só valida o tamanho final.
 */

import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { randomBytes } from "crypto";
import {
  COMPRESS_TARGET_BYTES,
  MAX_UPLOAD_BYTES,
  TELEGRAM_MAX_BYTES,
} from "@/lib/videos/limits";

export {
  COMPRESS_TARGET_BYTES,
  MAX_UPLOAD_BYTES,
  TELEGRAM_MAX_BYTES,
} from "@/lib/videos/limits";

export type CompressResult = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  compressed: boolean;
  originalBytes: number;
  finalBytes: number;
  durationSec: number;
};

function run(
  cmd: string,
  args: string[],
  timeoutMs = 10 * 60 * 1000
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
      if (stderr.length > 80_000) stderr = stderr.slice(-40_000);
    });
    const t = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} excedeu o tempo limite`));
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(t);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(t);
      resolve({ code: code ?? 1, stderr });
    });
  });
}

export async function hasFfmpeg(): Promise<boolean> {
  // Workers / edge: nunca há binário local
  if (process.env.NEXT_RUNTIME === "edge") return false;
  if (process.env.CF_PAGES || process.env.CLOUDFLARE_WORKER) return false;
  try {
    const r = await run("ffmpeg", ["-version"], 15_000);
    return r.code === 0;
  } catch {
    return false;
  }
}

async function probeDurationSec(inputPath: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        inputPath,
      ],
      { windowsHide: true }
    );
    let out = "";
    child.stdout?.on("data", (d: Buffer) => {
      out += d.toString("utf8");
    });
    child.on("close", () => {
      const n = parseFloat(out.trim());
      resolve(Number.isFinite(n) && n > 0 ? n : 0);
    });
    child.on("error", () => resolve(0));
  });
}

/**
 * Compacta o vídeo para caber em ~48 MB (limite prático Telegram Bot API).
 * Preferir compress-client no browser; isto é fallback local.
 */
export async function compressVideoForTelegram(
  input: Buffer,
  originalName: string
): Promise<CompressResult> {
  const originalBytes = input.length;
  const base = path
    .basename(originalName || "video.mp4")
    .replace(/[^\w.\-]+/g, "_");
  const stem = base.replace(/\.[^.]+$/, "") || "video";
  const tmp = path.join(
    os.tmpdir(),
    `nullysh-vid-${randomBytes(6).toString("hex")}`
  );
  await fs.mkdir(tmp, { recursive: true });

  const inPath = path.join(tmp, `in-${base}`);
  const outPath = path.join(tmp, `${stem}-tg.mp4`);

  try {
    await fs.writeFile(inPath, input);

    if (originalBytes <= COMPRESS_TARGET_BYTES) {
      return {
        buffer: input,
        filename: originalName.endsWith(".mp4")
          ? originalName
          : `${stem}.mp4`,
        mimeType: "video/mp4",
        compressed: false,
        originalBytes,
        finalBytes: originalBytes,
        durationSec: await probeDurationSec(inPath),
      };
    }

    if (!(await hasFfmpeg())) {
      throw new Error(
        `Arquivo tem ${(originalBytes / (1024 * 1024)).toFixed(1)} MB (limite Telegram 50 MB). Compacte no navegador (ffmpeg.wasm) ou instale FFmpeg local.`
      );
    }

    const durationSec = await probeDurationSec(inPath);
    const targetBitsPerSec =
      durationSec > 1
        ? Math.floor((COMPRESS_TARGET_BYTES * 8 * 0.92) / durationSec)
        : 1_200_000;
    const audioBitrate = 96_000;
    const videoBitrate = Math.max(250_000, targetBitsPerSec - audioBitrate);

    const attempts: Array<{ crf?: number; vb?: number; scale: string }> = [
      { vb: videoBitrate, scale: "scale='min(1280,iw)':-2" },
      { vb: Math.floor(videoBitrate * 0.7), scale: "scale='min(1280,iw)':-2" },
      { crf: 30, scale: "scale='min(1280,iw)':-2" },
      { crf: 32, scale: "scale='min(960,iw)':-2" },
      { crf: 34, scale: "scale='min(854,iw)':-2" },
      { crf: 36, scale: "scale='min(640,iw)':-2" },
    ];

    let lastErr = "";
    for (let i = 0; i < attempts.length; i++) {
      const a = attempts[i];
      try {
        await fs.unlink(outPath).catch(() => undefined);
      } catch {
        /* ignore */
      }

      const args = [
        "-y",
        "-i",
        inPath,
        "-vf",
        a.scale,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
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

      args.push(outPath);

      const r = await run("ffmpeg", args, 12 * 60 * 1000);
      if (r.code !== 0) {
        lastErr = r.stderr.slice(-500) || "ffmpeg falhou";
        continue;
      }

      const out = await fs.readFile(outPath);
      if (out.length <= COMPRESS_TARGET_BYTES) {
        return {
          buffer: out,
          filename: `${stem}-compressed.mp4`,
          mimeType: "video/mp4",
          compressed: true,
          originalBytes,
          finalBytes: out.length,
          durationSec: durationSec || (await probeDurationSec(outPath)),
        };
      }

      lastErr = `ainda ${(out.length / (1024 * 1024)).toFixed(1)} MB após passo ${i + 1}`;
    }

    try {
      const out = await fs.readFile(outPath);
      if (out.length <= TELEGRAM_MAX_BYTES) {
        return {
          buffer: out,
          filename: `${stem}-compressed.mp4`,
          mimeType: "video/mp4",
          compressed: true,
          originalBytes,
          finalBytes: out.length,
          durationSec: durationSec || 0,
        };
      }
    } catch {
      /* ignore */
    }

    throw new Error(
      `Não foi possível compactar abaixo de 50 MB (${lastErr}). Tente um trecho menor ou resolução menor.`
    );
  } finally {
    try {
      const files = await fs.readdir(tmp);
      await Promise.all(
        files.map((f) => fs.unlink(path.join(tmp, f)).catch(() => undefined))
      );
      await fs.rmdir(tmp).catch(() => undefined);
    } catch {
      /* ignore */
    }
  }
}

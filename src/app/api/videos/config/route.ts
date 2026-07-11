import { isTelegramConfigured, telegramGetMe } from "@/lib/telegram/bot";
import { listPublicVideos } from "@/lib/videos/catalog";
import {
  getDataKv,
  getVideosBucket,
} from "@/lib/videos/cloud-bindings";
import {
  COMPRESS_TARGET_BYTES,
  MAX_ORIGINAL_BYTES,
  TELEGRAM_GETFILE_MAX_BYTES,
  TELEGRAM_MAX_BYTES,
} from "@/lib/videos/limits";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Status da integração Telegram + compressão client-side (sem expor o token). */
export async function GET() {
  const configured = isTelegramConfigured();
  let botUsername: string | null = null;
  let botOk = false;
  let error: string | null = null;

  if (configured) {
    try {
      const me = await telegramGetMe();
      botUsername = me.username ? `@${me.username}` : me.first_name || null;
      botOk = true;
    } catch (e) {
      error = e instanceof Error ? e.message : "Falha ao contatar Telegram";
    }
  }

  const videos = await listPublicVideos();
  const r2 = !!(await getVideosBucket());
  const kv = !!(await getDataKv());
  const hasS3 =
    !!(
      process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim()
    );
  // Com R2: não força compressão 18 MB. Sem R2: legado Telegram getFile.
  const compressTargetBytes = r2
    ? COMPRESS_TARGET_BYTES
    : TELEGRAM_GETFILE_MAX_BYTES;

  return NextResponse.json({
    ok: true,
    configured,
    botOk,
    botUsername,
    error,
    count: videos.length,
    maxUploadMb: TELEGRAM_MAX_BYTES / (1024 * 1024),
    maxOriginalMb: MAX_ORIGINAL_BYTES / (1024 * 1024),
    compressTargetMb: compressTargetBytes / (1024 * 1024),
    compressTargetBytes,
    ffmpegAvailable: true,
    autoCompress: !r2,
    compressEngine: r2 ? "optional-ffmpeg.wasm" : "ffmpeg.wasm",
    playbackStorage: r2
      ? hasS3
        ? "r2-presign"
        : "r2-worker-put"
      : kv
        ? "telegram+kv"
        : "local-or-telegram",
    hasR2: r2,
    hasKv: kv,
    hasR2S3Credentials: hasS3,
    uploadPipeline: r2 ? "r2" : "telegram-legacy",
  });
}

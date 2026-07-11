import { isTelegramConfigured, telegramGetMe } from "@/lib/telegram/bot";
import { listPublicVideos } from "@/lib/videos/catalog";
import {
  hasFfmpeg,
  MAX_UPLOAD_BYTES,
  TELEGRAM_MAX_BYTES,
} from "@/lib/videos/compress";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Status da integração Telegram (sem expor o token). */
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
  const ffmpeg = await hasFfmpeg();

  return NextResponse.json({
    ok: true,
    configured,
    botOk,
    botUsername,
    error,
    count: videos.length,
    /** Limite do Telegram após compactar */
    maxUploadMb: TELEGRAM_MAX_BYTES / (1024 * 1024),
    /** Original aceito no formulário (compacta no server) */
    maxOriginalMb: MAX_UPLOAD_BYTES / (1024 * 1024),
    ffmpegAvailable: ffmpeg,
    autoCompress: ffmpeg,
  });
}

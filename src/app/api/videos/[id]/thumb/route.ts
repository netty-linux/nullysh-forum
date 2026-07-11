import { getStoredVideo } from "@/lib/videos/catalog";
import {
  isTelegramConfigured,
  telegramFileUrl,
  telegramGetFile,
} from "@/lib/telegram/bot";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Thumbnail do Telegram (se existir). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!isTelegramConfigured()) {
    return new NextResponse(null, { status: 404 });
  }

  const video = await getStoredVideo(id);
  if (!video?.telegramThumbFileId) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const file = await telegramGetFile(video.telegramThumbFileId);
    if (!file.filePath) {
      return new NextResponse(null, { status: 404 });
    }
    const upstream = await fetch(telegramFileUrl(file.filePath));
    if (!upstream.ok || !upstream.body) {
      return new NextResponse(null, { status: 502 });
    }
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}

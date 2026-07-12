import { getStoredVideo } from "@/lib/videos/catalog";
import { getVideosBucket } from "@/lib/videos/cloud-bindings";
import {
  isTelegramConfigured,
  telegramFileUrl,
  telegramGetFile,
} from "@/lib/telegram/bot";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Thumbnail do vídeo:
 * 1) R2 (r2ThumbKey) — path R2-first
 * 2) Telegram (telegramThumbFileId) — legado
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const video = await getStoredVideo(id);
  if (!video) {
    return new NextResponse(null, { status: 404 });
  }

  // ── R2 ────────────────────────────────────────────────────────
  if (video.r2ThumbKey) {
    const bucket = await getVideosBucket();
    if (bucket) {
      try {
        const obj = await bucket.get(video.r2ThumbKey);
        if (obj?.body) {
          return new NextResponse(obj.body, {
            status: 200,
            headers: {
              "Content-Type":
                obj.httpMetadata?.contentType || "image/jpeg",
              // max-age curto + query ?v= rev no client evita capa antiga
              "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
            },
          });
        }
      } catch (e) {
        console.error("[thumb] R2 failed", e);
      }
    }
  }

  // ── Telegram legado ───────────────────────────────────────────
  if (!video.telegramThumbFileId || !isTelegramConfigured()) {
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

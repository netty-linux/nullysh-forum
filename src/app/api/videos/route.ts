import { assertVideoAdmin } from "@/lib/videos/admin-auth";
import {
  addStoredVideo,
  formatDuration,
  listPublicVideos,
} from "@/lib/videos/catalog";
import {
  compressVideoForTelegram,
  MAX_UPLOAD_BYTES,
  TELEGRAM_MAX_BYTES,
} from "@/lib/videos/compress";
import { saveVideoFile } from "@/lib/videos/media-files";
import {
  getTelegramConfig,
  isTelegramConfigured,
  telegramSendDocument,
  telegramSendVideo,
} from "@/lib/telegram/bot";
import { uid } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
/** Compactação + upload podem demorar */
export const maxDuration = 300;

const VIDEO_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "application/octet-stream",
]);

/** Lista vídeos (metadados públicos). */
export async function GET() {
  try {
    const videos = await listPublicVideos();
    return NextResponse.json({
      ok: true,
      videos,
      telegramConfigured: isTelegramConfigured(),
    });
  } catch (e) {
    console.error("[api/videos GET]", e);
    return NextResponse.json(
      { ok: false, error: "Falha ao listar vídeos" },
      { status: 500 }
    );
  }
}

/**
 * Upload de vídeo (admin) → compacta se > ~48 MB → Telegram + catálogo.
 * multipart/form-data:
 *  - file (required)
 *  - title, description, category, vipOnly, duration (opcional override)
 *  - thumb (opcional, image/jpeg|png)
 */
export async function POST(req: NextRequest) {
  const auth = await assertVideoAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  if (!isTelegramConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Telegram não configurado. Defina TELEGRAM_BOT_TOKEN e TELEGRAM_STORAGE_CHAT_ID no .env.local",
      },
      { status: 503 }
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Envie o campo file (vídeo)" },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: `Arquivo maior que ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB. Envie um arquivo menor.`,
        },
        { status: 413 }
      );
    }

    const mime = file.type || "video/mp4";
    if (!VIDEO_MIME.has(mime) && !mime.startsWith("video/")) {
      return NextResponse.json(
        { ok: false, error: "Tipo de arquivo inválido. Use vídeo (mp4, webm…)." },
        { status: 400 }
      );
    }

    const title = String(form.get("title") || "").trim();
    if (!title || title.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Título obrigatório (mín. 2 caracteres)." },
        { status: 400 }
      );
    }

    const description = String(form.get("description") || "").trim();
    const category =
      String(form.get("category") || "").trim() || "Geral";
    const vipOnly =
      String(form.get("vipOnly") || "false") === "true" ||
      form.get("vipOnly") === "on";
    const durationOverride = String(form.get("duration") || "").trim();

    const ab = await file.arrayBuffer();
    const rawBuffer = Buffer.from(ab);
    const originalName = file.name || `video-${Date.now()}.mp4`;

    // Compacta se necessário (FFmpeg → ≤ ~48 MB)
    const compressed = await compressVideoForTelegram(
      rawBuffer,
      originalName
    );

    if (compressed.finalBytes > TELEGRAM_MAX_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: `Mesmo após compactar ficou com ${(compressed.finalBytes / (1024 * 1024)).toFixed(1)} MB (limite 50 MB).`,
        },
        { status: 413 }
      );
    }

    const buffer = compressed.buffer;
    const filename = compressed.filename;
    const outMime = compressed.mimeType || mime;

    let thumb:
      | { buffer: Buffer; filename: string }
      | null = null;
    const thumbFile = form.get("thumb");
    if (thumbFile && thumbFile instanceof File && thumbFile.size > 0) {
      if (thumbFile.size <= 2 * 1024 * 1024) {
        thumb = {
          buffer: Buffer.from(await thumbFile.arrayBuffer()),
          filename: thumbFile.name || "thumb.jpg",
        };
      }
    }

    const sizeNote = compressed.compressed
      ? ` · ${(compressed.originalBytes / (1024 * 1024)).toFixed(0)}→${(compressed.finalBytes / (1024 * 1024)).toFixed(1)}MB`
      : "";

    const caption = [
      `🎬 ${title}`,
      category ? `#${category.replace(/\s+/g, "")}` : "",
      vipOnly ? "VIP" : "Free",
      sizeNote,
    ]
      .filter(Boolean)
      .join(" · ");

    // id antes do Telegram para gravar cópia local (player usa isso —
    // getFile do Telegram falha acima de ~20 MB)
    const videoId = uid("vid");
    await saveVideoFile(videoId, buffer);

    let tg;
    try {
      tg = await telegramSendVideo({
        buffer,
        filename,
        mimeType: outMime,
        caption,
        thumb,
      });
    } catch (sendErr) {
      console.warn("[api/videos] sendVideo falhou, tentando document", sendErr);
      try {
        tg = await telegramSendDocument({
          buffer,
          filename,
          mimeType: outMime,
          caption,
        });
      } catch (docErr) {
        // Cópia local já salva — ainda publica no catálogo com file_id dummy?
        // Melhor falhar o TG mas manter playable local se o user quiser.
        console.error("[api/videos] Telegram upload falhou", docErr);
        throw docErr;
      }
    }

    const cfg = getTelegramConfig()!;
    const durationFromProbe =
      compressed.durationSec > 0
        ? formatDuration(compressed.durationSec)
        : null;
    const duration =
      durationOverride ||
      (tg.durationSec > 0
        ? formatDuration(tg.durationSec)
        : durationFromProbe) ||
      "—";

    const stored = await addStoredVideo({
      id: videoId,
      title,
      description,
      duration,
      category,
      thumbnail: "TG",
      vipOnly,
      telegramFileId: tg.fileId,
      telegramMessageId: tg.messageId,
      telegramChatId: cfg.chatId,
      telegramThumbFileId: tg.thumbFileId ?? null,
      fileName: tg.fileName || filename,
      mimeType: tg.mimeType || outMime,
      sizeBytes: tg.fileSize || buffer.length,
      uploadedById: auth.adminId,
      uploadedByName: auth.adminName,
    });

    return NextResponse.json({
      ok: true,
      compressed: compressed.compressed,
      originalBytes: compressed.originalBytes,
      finalBytes: compressed.finalBytes,
      localPlayback: true,
      video: {
        id: stored.id,
        title: stored.title,
        description: stored.description,
        duration: stored.duration,
        category: stored.category,
        thumbnail: stored.thumbnail,
        vipOnly: stored.vipOnly,
        views: stored.views,
        createdAt: stored.createdAt,
        hasStream: true,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        hasThumb: !!stored.telegramThumbFileId,
      },
    });
  } catch (e) {
    console.error("[api/videos POST]", e);
    const msg = e instanceof Error ? e.message : "Falha no upload";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

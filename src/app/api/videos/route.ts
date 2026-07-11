import { assertVideoAdmin } from "@/lib/videos/admin-auth";
import {
  addStoredVideo,
  formatDuration,
  listPublicVideos,
} from "@/lib/videos/catalog";
import {
  compressVideoForTelegram,
  hasFfmpeg,
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

/** Node compat via OpenNext; não usar edge (Telegram + R2 + Buffer). */
export const runtime = "nodejs";
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
 * Upload de vídeo (admin) → Telegram + cópia de playback (R2 ou FS).
 *
 * Preferência: arquivo já compactado no browser (ffmpeg.wasm).
 * Campo form `clientCompressed=true` + opcional originalBytes/durationSec.
 * Fallback local: se arquivo > 48 MB e houver FFmpeg no PATH, compacta no server.
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
          "Telegram não configurado. Defina TELEGRAM_BOT_TOKEN e TELEGRAM_STORAGE_CHAT_ID.",
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
          error: `Arquivo maior que ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
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
    const category = String(form.get("category") || "").trim() || "Geral";
    const vipOnly =
      String(form.get("vipOnly") || "false") === "true" ||
      form.get("vipOnly") === "on";
    const durationOverride = String(form.get("duration") || "").trim();
    const clientCompressed =
      String(form.get("clientCompressed") || "") === "true";
    const clientOriginalBytes = Number(form.get("originalBytes") || 0);
    const clientDurationSec = Number(form.get("durationSec") || 0);

    const ab = await file.arrayBuffer();
    const rawBuffer = Buffer.from(ab);
    const originalName = file.name || `video-${Date.now()}.mp4`;

    let buffer: Buffer;
    let filename: string;
    let outMime: string;
    let compressed: boolean;
    let originalBytes: number;
    let finalBytes: number;
    let durationSec: number;

    if (clientCompressed || rawBuffer.length <= TELEGRAM_MAX_BYTES) {
      // Client já compactou (ou já cabe) — não roda FFmpeg no server
      if (rawBuffer.length > TELEGRAM_MAX_BYTES) {
        return NextResponse.json(
          {
            ok: false,
            error: `Arquivo com ${(rawBuffer.length / (1024 * 1024)).toFixed(1)} MB. Compacte no navegador antes de enviar (limite Telegram 50 MB).`,
          },
          { status: 413 }
        );
      }
      buffer = rawBuffer;
      filename = originalName.endsWith(".mp4")
        ? originalName
        : originalName.replace(/\.[^.]+$/, "") + ".mp4";
      outMime = mime.startsWith("video/") ? mime : "video/mp4";
      compressed = clientCompressed;
      originalBytes =
        clientOriginalBytes > 0 ? clientOriginalBytes : rawBuffer.length;
      finalBytes = rawBuffer.length;
      durationSec =
        Number.isFinite(clientDurationSec) && clientDurationSec > 0
          ? clientDurationSec
          : 0;
    } else {
      // Fallback local com FFmpeg nativo
      if (!(await hasFfmpeg())) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Arquivo grande e sem compactação no navegador. Atualize a página e tente de novo (ffmpeg.wasm), ou use um vídeo ≤ 50 MB.",
          },
          { status: 413 }
        );
      }
      const result = await compressVideoForTelegram(rawBuffer, originalName);
      buffer = result.buffer;
      filename = result.filename;
      outMime = result.mimeType || mime;
      compressed = result.compressed;
      originalBytes = result.originalBytes;
      finalBytes = result.finalBytes;
      durationSec = result.durationSec;
    }

    if (finalBytes > TELEGRAM_MAX_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: `Arquivo final ${(finalBytes / (1024 * 1024)).toFixed(1)} MB (limite 50 MB).`,
        },
        { status: 413 }
      );
    }

    let thumb: { buffer: Buffer; filename: string } | null = null;
    const thumbFile = form.get("thumb");
    if (thumbFile && thumbFile instanceof File && thumbFile.size > 0) {
      if (thumbFile.size <= 2 * 1024 * 1024) {
        thumb = {
          buffer: Buffer.from(await thumbFile.arrayBuffer()),
          filename: thumbFile.name || "thumb.jpg",
        };
      }
    }

    const sizeNote = compressed
      ? ` · ${(originalBytes / (1024 * 1024)).toFixed(0)}→${(finalBytes / (1024 * 1024)).toFixed(1)}MB`
      : "";

    const caption = [
      `🎬 ${title}`,
      category ? `#${category.replace(/\s+/g, "")}` : "",
      vipOnly ? "VIP" : "Free",
      sizeNote,
    ]
      .filter(Boolean)
      .join(" · ");

    const videoId = uid("vid");
    // Playback: R2 (cloud) ou FS (local). Sem ambos → só Telegram getFile.
    const storage = await saveVideoFile(videoId, buffer);

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
      tg = await telegramSendDocument({
        buffer,
        filename,
        mimeType: outMime,
        caption,
      });
    }

    const cfg = getTelegramConfig()!;
    const durationFromProbe =
      durationSec > 0 ? formatDuration(durationSec) : null;
    const duration =
      durationOverride ||
      (tg.durationSec > 0 ? formatDuration(tg.durationSec) : durationFromProbe) ||
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
      compressed,
      originalBytes,
      finalBytes,
      localPlayback: storage === "fs",
      r2Playback: storage === "r2",
      telegramOnlyPlayback: storage === "none",
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

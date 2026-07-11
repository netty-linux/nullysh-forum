import {
  getStoredVideo,
  incrementViews,
} from "@/lib/videos/catalog";
import {
  getVideoFileStat,
  openVideoReadStream,
} from "@/lib/videos/media-files";
import {
  isTelegramConfigured,
  telegramFileUrl,
  telegramGetFile,
} from "@/lib/telegram/bot";
import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

function nodeToWebStream(nodeStream: Readable): ReadableStream {
  return Readable.toWeb(nodeStream) as ReadableStream;
}

/**
 * Stream do vídeo para o player HTML5.
 * Preferência: cópia local (data/media/videos) — contorna o limite de
 * download de 20 MB do getFile da Bot API.
 * Fallback: Telegram getFile (só funciona se o arquivo ≤ ~20 MB).
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  const video = await getStoredVideo(id);
  if (!video) {
    return NextResponse.json(
      { ok: false, error: "Vídeo não encontrado" },
      { status: 404 }
    );
  }

  const rangeHeader = req.headers.get("range");

  // ── 1) Disco local (principal) ─────────────────────────────────
  const local = await getVideoFileStat(id);
  if (local) {
    try {
      return streamLocal(local.path, local.size, video.mimeType || "video/mp4", rangeHeader, id);
    } catch (e) {
      console.error("[stream] local failed", e);
    }
  }

  // ── 2) Telegram (só se ≤ ~20 MB) ───────────────────────────────
  if (!isTelegramConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Arquivo local ausente e Telegram não configurado. Reenvie o vídeo pelo Painel ADM.",
      },
      { status: 503 }
    );
  }

  try {
    const file = await telegramGetFile(video.telegramFileId);
    if (!file.filePath) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Telegram não liberou o download (limite ~20 MB do getFile). Reenvie o vídeo — a nova versão grava cópia local para o player.",
        },
        { status: 502 }
      );
    }

    const upstreamUrl = telegramFileUrl(file.filePath);
    const upstream = await fetch(upstreamUrl, {
      headers: rangeHeader ? { Range: rangeHeader } : undefined,
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        {
          ok: false,
          error:
            upstream.status === 400 || upstream.status === 404
              ? "Telegram recusou o download (arquivo grande). Reenvie o vídeo no Painel ADM."
              : `Telegram file HTTP ${upstream.status}`,
        },
        { status: 502 }
      );
    }

    if (!rangeHeader || rangeHeader === "bytes=0-") {
      void incrementViews(id);
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      video.mimeType ||
        upstream.headers.get("content-type") ||
        "video/mp4"
    );
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "private, max-age=3600");
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);
    const contentRange = upstream.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (e) {
    console.error("[api/videos stream]", e);
    const msg = e instanceof Error ? e.message : "Falha no stream";
    // Mensagem amigável para "file is too big"
    if (/too big/i.test(msg)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Este vídeo foi enviado só ao Telegram e passa do limite de download (20 MB). Abra o Painel ADM e publique de novo — o sistema grava cópia local para reprodução.",
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

function streamLocal(
  filePath: string,
  size: number,
  mimeType: string,
  rangeHeader: string | null,
  videoId: string
): NextResponse {
  const headers = new Headers();
  headers.set("Content-Type", mimeType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=3600");

  // Sem Range → arquivo inteiro
  if (!rangeHeader) {
    void incrementViews(videoId);
    headers.set("Content-Length", String(size));
    const stream = openVideoReadStream(filePath);
    return new NextResponse(nodeToWebStream(stream), {
      status: 200,
      headers,
    });
  }

  // Range: bytes=start-end
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!m) {
    headers.set("Content-Length", String(size));
    const stream = openVideoReadStream(filePath);
    return new NextResponse(nodeToWebStream(stream), {
      status: 200,
      headers,
    });
  }

  let start = m[1] === "" ? 0 : parseInt(m[1], 10);
  let end = m[2] === "" ? size - 1 : parseInt(m[2], 10);

  if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end >= size) {
    // range inválido
    headers.set("Content-Range", `bytes */${size}`);
    return new NextResponse(null, { status: 416, headers });
  }

  if (start > end) {
    headers.set("Content-Range", `bytes */${size}`);
    return new NextResponse(null, { status: 416, headers });
  }

  // Cap chunk size a ~2MB para o player não travar em arquivos grandes
  const maxChunk = 2 * 1024 * 1024;
  if (end - start + 1 > maxChunk) {
    end = start + maxChunk - 1;
  }

  const chunkSize = end - start + 1;
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(chunkSize));

  if (start === 0) {
    void incrementViews(videoId);
  }

  const stream = openVideoReadStream(filePath, start, end);
  return new NextResponse(nodeToWebStream(stream), {
    status: 206,
    headers,
  });
}

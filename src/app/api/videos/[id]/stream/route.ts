import {
  getStoredVideo,
  incrementViews,
} from "@/lib/videos/catalog";
import {
  getVideoBlobSource,
  openR2VideoStream,
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
 * Ordem: R2 (cloud) → FS local (dev) → Telegram getFile (≤ ~20 MB).
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
  const mime = video.mimeType || "video/mp4";

  // ── 1) R2 por objectKey do catálogo (presign pipeline) ─────────
  if (video.r2ObjectKey) {
    try {
      const ranged = await openR2VideoStream(video.r2ObjectKey, rangeHeader);
      if (ranged) {
        if (ranged.status === 416) {
          const headers = new Headers();
          headers.set(
            "Content-Range",
            ranged.contentRange || `bytes */0`
          );
          return new NextResponse(null, { status: 416, headers });
        }
        if (!rangeHeader || rangeHeader === "bytes=0-") {
          void incrementViews(id);
        } else if (ranged.contentRange?.startsWith("bytes 0-")) {
          void incrementViews(id);
        }
        const headers = new Headers();
        headers.set("Content-Type", mime);
        headers.set("Accept-Ranges", "bytes");
        headers.set("Cache-Control", "private, max-age=3600");
        headers.set("Content-Length", String(ranged.contentLength));
        if (ranged.contentRange) {
          headers.set("Content-Range", ranged.contentRange);
        }
        return new NextResponse(ranged.body, {
          status: ranged.status,
          headers,
        });
      }
    } catch (e) {
      console.error("[stream] R2 objectKey failed", e);
    }
  }

  // ── 2) R2 / FS legado (media/{id}.mp4) ─────────────────────────
  const blob = await getVideoBlobSource(id);
  if (blob?.kind === "r2") {
    try {
      const ranged = await openR2VideoStream(blob.key, rangeHeader);
      if (ranged) {
        if (ranged.status === 416) {
          const headers = new Headers();
          headers.set("Content-Range", ranged.contentRange || `bytes */${blob.size}`);
          return new NextResponse(null, { status: 416, headers });
        }
        if (!rangeHeader || rangeHeader === "bytes=0-" || ranged.status === 200) {
          if (!rangeHeader || rangeHeader === "bytes=0-") {
            void incrementViews(id);
          }
        } else if (ranged.contentRange?.startsWith("bytes 0-")) {
          void incrementViews(id);
        }

        const headers = new Headers();
        headers.set("Content-Type", mime);
        headers.set("Accept-Ranges", "bytes");
        headers.set("Cache-Control", "private, max-age=3600");
        headers.set("Content-Length", String(ranged.contentLength));
        if (ranged.contentRange) {
          headers.set("Content-Range", ranged.contentRange);
        }
        return new NextResponse(ranged.body, {
          status: ranged.status,
          headers,
        });
      }
    } catch (e) {
      console.error("[stream] R2 failed", e);
    }
  }

  if (blob?.kind === "fs") {
    try {
      return streamLocal(blob.path, blob.size, mime, rangeHeader, id);
    } catch (e) {
      console.error("[stream] local failed", e);
    }
  }

  // ── 3) Telegram vault (só se ≤ ~20 MB e file_id real) ──────────
  if (!video.telegramFileId || video.telegramFileId === "r2") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Playback indisponível (sem R2/FS e sem arquivo Telegram). Reenvie o vídeo.",
      },
      { status: 502 }
    );
  }

  if (!isTelegramConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Arquivo de playback ausente e Telegram não configurado. Reenvie o vídeo pelo Painel ADM.",
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
            "Telegram não liberou o download (limite ~20 MB do getFile). Reenvie o vídeo — a nova versão grava cópia em R2/local para o player.",
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
      mime || upstream.headers.get("content-type") || "video/mp4"
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
    if (/too big/i.test(msg)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Este vídeo só está no Telegram e passa do limite de download (20 MB). Publique de novo — o sistema grava cópia R2/local para reprodução.",
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

  if (!rangeHeader) {
    void incrementViews(videoId);
    headers.set("Content-Length", String(size));
    const stream = openVideoReadStream(filePath);
    return new NextResponse(nodeToWebStream(stream), {
      status: 200,
      headers,
    });
  }

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
    headers.set("Content-Range", `bytes */${size}`);
    return new NextResponse(null, { status: 416, headers });
  }

  if (start > end) {
    headers.set("Content-Range", `bytes */${size}`);
    return new NextResponse(null, { status: 416, headers });
  }

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

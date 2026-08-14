import { getVideosBucket } from "@/lib/videos/cloud-bindings";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: Promise<{ key: string[] }> };

/**
 * GET /api/videos/stream/videos/uuid.mp4
 * Stream direto do R2 por objectKey (Range-aware).
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { key: parts } = await ctx.params;
  const objectKey = (parts || []).map(decodeURIComponent).join("/");
  if (!objectKey || objectKey.includes("..")) {
    return NextResponse.json(
      { ok: false, error: "key inválida" },
      { status: 400 }
    );
  }

  const bucket = await getVideosBucket();
  if (!bucket) {
    return NextResponse.json(
      { ok: false, error: "R2 binding indisponível" },
      { status: 503 }
    );
  }

  const rangeHeader = req.headers.get("range");

  try {
    if (rangeHeader) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
      if (m) {
        const head = await bucket.head(objectKey);
        if (!head || head.size <= 0) {
          return NextResponse.json(
            { ok: false, error: "Vídeo não encontrado" },
            { status: 404 }
          );
        }
        const size = head.size;
        const start = m[1] === "" ? 0 : parseInt(m[1], 10);
        let end = m[2] === "" ? size - 1 : parseInt(m[2], 10);
        if (
          Number.isNaN(start) ||
          Number.isNaN(end) ||
          start < 0 ||
          end >= size ||
          start > end
        ) {
          return new NextResponse(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${size}` },
          });
        }
        // Cap ~2MB por chunk (player HTML5)
        const maxChunk = 2 * 1024 * 1024;
        if (end - start + 1 > maxChunk) {
          end = start + maxChunk - 1;
        }
        const length = end - start + 1;
        const obj = await bucket.get(objectKey, {
          range: { offset: start, length },
        });
        if (!obj) {
          return NextResponse.json(
            { ok: false, error: "Vídeo não encontrado" },
            { status: 404 }
          );
        }
        const contentType =
          obj.httpMetadata?.contentType || "video/mp4";
        return new NextResponse(obj.body, {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Accept-Ranges": "bytes",
            "Content-Range": `bytes ${start}-${end}/${size}`,
            "Content-Length": String(length),
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    }

    const obj = await bucket.get(objectKey);
    if (!obj) {
      return NextResponse.json(
        { ok: false, error: "Vídeo não encontrado" },
        { status: 404 }
      );
    }
    const contentType = obj.httpMetadata?.contentType || "video/mp4";
    return new NextResponse(obj.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Content-Length": String(obj.size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("[stream key]", e);
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Falha no stream R2",
      },
      { status: 500 }
    );
  }
}

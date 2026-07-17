import {
  coverObjectKey,
  isSafeCoverFilename,
} from "@/lib/nullpass/cover-url";
import { getVideosBucket } from "@/lib/videos/cloud-bindings";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ filename: string }> };

/**
 * GET /api/nullpass/cover/:filename
 * Proxy público same-origin → R2 nullpass/covers/*
 * (sem CORS especial; img carrega de nullysh.com)
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { filename: raw } = await ctx.params;
  const filename = decodeURIComponent(raw || "").trim();
  if (!filename || !isSafeCoverFilename(filename) || filename.includes("..")) {
    return NextResponse.json(
      { ok: false, error: "filename inválido" },
      { status: 400 }
    );
  }

  const bucket = await getVideosBucket();
  if (!bucket) {
    return NextResponse.json(
      { ok: false, error: "R2 indisponível" },
      { status: 503 }
    );
  }

  const objectKey = coverObjectKey(filename);
  try {
    const obj = await bucket.get(objectKey);
    if (!obj) {
      return NextResponse.json(
        { ok: false, error: "Capa não encontrada" },
        { status: 404 }
      );
    }
    const contentType =
      obj.httpMetadata?.contentType ||
      (filename.endsWith(".png")
        ? "image/png"
        : filename.endsWith(".webp")
          ? "image/webp"
          : "image/jpeg");

    return new NextResponse(obj.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[nullpass cover GET]", e);
    return NextResponse.json(
      { ok: false, error: "Falha ao ler capa" },
      { status: 500 }
    );
  }
}

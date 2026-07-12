import { assertVideoAdmin } from "@/lib/videos/admin-auth";
import {
  getStoredVideo,
  toPublicVideo,
  updateStoredVideo,
} from "@/lib/videos/catalog";
import { getDataKv, getVideosBucket } from "@/lib/videos/cloud-bindings";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Anexa / troca thumbnail R2 de um vídeo já publicado.
 * Body: { thumbObjectKey: "thumbs/…" }
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await assertVideoAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  const { id } = await ctx.params;
  const video = await getStoredVideo(id);
  if (!video) {
    return NextResponse.json(
      { ok: false, error: "Vídeo não encontrado" },
      { status: 404 }
    );
  }

  let body: { thumbObjectKey?: string };
  try {
    body = (await req.json()) as { thumbObjectKey?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido" },
      { status: 400 }
    );
  }

  const thumbObjectKey = String(body.thumbObjectKey || "").trim();
  if (!thumbObjectKey.startsWith("thumbs/") || thumbObjectKey.includes("..")) {
    return NextResponse.json(
      { ok: false, error: "thumbObjectKey inválido" },
      { status: 400 }
    );
  }

  const bucket = await getVideosBucket();
  if (bucket) {
    try {
      const head = await bucket.head(thumbObjectKey);
      if (!head || head.size <= 0) {
        return NextResponse.json(
          { ok: false, error: "Thumbnail não encontrada no R2" },
          { status: 400 }
        );
      }
    } catch {
      /* segue */
    }
  }

  const updated = await updateStoredVideo(id, {
    r2ThumbKey: thumbObjectKey,
    thumbnail: "R2",
  });
  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "Falha ao atualizar" },
      { status: 500 }
    );
  }

  const kv = await getDataKv();
  if (kv) {
    try {
      await kv.put(`videos:${id}`, JSON.stringify(updated));
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({
    ok: true,
    video: toPublicVideo(updated),
  });
}

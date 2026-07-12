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
 * Exige que o objeto exista no R2 (não grava key órfã).
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
  if (!bucket) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "VIDEOS_BUCKET ausente. Habilite o binding R2 e faça redeploy.",
      },
      { status: 503 }
    );
  }

  // Confirma que o PUT da capa realmente gravou bytes no R2
  try {
    const obj = await bucket.get(thumbObjectKey);
    if (!obj) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Capa não encontrada no R2. O upload (PUT) falhou — tente de novo.",
        },
        { status: 400 }
      );
    }
    // Alguns bindings expõem size no body; tenta head se disponível
    const head = await bucket.head(thumbObjectKey).catch(() => null);
    if (head && head.size <= 0) {
      return NextResponse.json(
        { ok: false, error: "Capa vazia no R2 (0 bytes)." },
        { status: 400 }
      );
    }
  } catch (e) {
    console.error("[attach-thumb] R2 verify", e);
    return NextResponse.json(
      {
        ok: false,
        error:
          e instanceof Error
            ? `Falha ao verificar capa no R2: ${e.message}`
            : "Falha ao verificar capa no R2",
      },
      { status: 500 }
    );
  }

  const updated = await updateStoredVideo(id, {
    r2ThumbKey: thumbObjectKey,
    thumbnail: "R2",
  });
  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "Falha ao atualizar catálogo" },
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

  const pub = toPublicVideo(updated);
  return NextResponse.json({
    ok: true,
    video: pub,
    // debug útil no painel
    thumbUrl: `/api/videos/${encodeURIComponent(id)}/thumb?v=${encodeURIComponent(pub.thumbRev || "1")}`,
  });
}

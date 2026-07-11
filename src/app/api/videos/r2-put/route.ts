import { assertVideoAdmin } from "@/lib/videos/admin-auth";
import { getVideosBucket } from "@/lib/videos/cloud-bindings";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
/** Upload via Worker → R2 binding (fallback sem S3 credentials). */
export const maxDuration = 300;

/**
 * PUT /api/videos/r2-put?key=videos/uuid.mp4
 * Body = bytes do vídeo (stream). Admin headers obrigatórios.
 */
export async function PUT(req: NextRequest) {
  const auth = await assertVideoAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  const key = req.nextUrl.searchParams.get("key")?.trim() || "";
  if (!key.startsWith("videos/") || key.includes("..")) {
    return NextResponse.json(
      { ok: false, error: "objectKey inválido" },
      { status: 400 }
    );
  }

  const bucket = await getVideosBucket();
  if (!bucket) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "VIDEOS_BUCKET binding ausente. Habilite R2 e faça redeploy com wrangler.jsonc.",
      },
      { status: 503 }
    );
  }

  if (!req.body) {
    return NextResponse.json(
      { ok: false, error: "Body vazio" },
      { status: 400 }
    );
  }

  const contentType =
    req.headers.get("content-type")?.trim() || "video/mp4";

  try {
    // Stream direto do request para o R2 (sem Buffer intermediário gigante)
    await bucket.put(key, req.body, {
      httpMetadata: { contentType },
    });
    return NextResponse.json({ ok: true, objectKey: key });
  } catch (e) {
    console.error("[r2-put]", e);
    return NextResponse.json(
      {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : "Falha ao gravar no R2. Confirme se o bucket nullysh-videos existe.",
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "PUT, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, x-admin-id, x-admin-name, x-admin-role, x-admin-secret",
    },
  });
}

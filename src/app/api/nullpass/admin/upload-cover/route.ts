import {
  coverObjectKey,
  coverPublicPath,
  isSafeCoverFilename,
} from "@/lib/nullpass/cover-url";
import { assertVideoAdmin } from "@/lib/videos/admin-auth";
import { getVideosBucket } from "@/lib/videos/cloud-bindings";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB (já comprimida no client)
const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function extFrom(file: File, contentType: string): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName === "jpg" || fromName === "jpeg") return "jpg";
  if (fromName === "png") return "png";
  if (fromName === "webp") return "webp";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

/**
 * POST /api/nullpass/admin/upload-cover
 * FormData: file (image/jpeg|png|webp)
 * → { ok, publicUrl, objectKey }
 *
 * Grava em R2 (VIDEOS_BUCKET) sob nullpass/covers/ e serve via
 * GET /api/nullpass/cover/:filename (same-origin).
 */
export async function POST(req: NextRequest) {
  const auth = await assertVideoAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  const bucket = await getVideosBucket();
  if (!bucket) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "R2 indisponível (VIDEOS_BUCKET). Habilite o binding e faça redeploy.",
        code: "r2_unavailable",
      },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "FormData inválido." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json(
      { ok: false, error: "Envie o campo file (imagem)." },
      { status: 400 }
    );
  }

  const contentType = (file.type || "image/jpeg").toLowerCase();
  if (!ALLOWED.has(contentType) && !contentType.startsWith("image/")) {
    return NextResponse.json(
      { ok: false, error: "Use JPG, PNG ou WebP." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: `Arquivo maior que ${MAX_BYTES / (1024 * 1024)} MB. Comprima antes de enviar.`,
      },
      { status: 413 }
    );
  }

  const ext = extFrom(file, contentType);
  const filename = `${randomUUID().replace(/-/g, "").slice(0, 24)}.${ext}`;
  if (!isSafeCoverFilename(filename)) {
    return NextResponse.json(
      { ok: false, error: "Nome de arquivo inválido." },
      { status: 500 }
    );
  }

  const objectKey = coverObjectKey(filename);
  const mime =
    contentType === "image/jpg" ? "image/jpeg" : contentType || "image/jpeg";

  try {
    const buf = await file.arrayBuffer();
    await bucket.put(objectKey, buf, {
      httpMetadata: { contentType: mime },
    });
  } catch (e) {
    console.error("[nullpass upload-cover]", e);
    return NextResponse.json(
      {
        ok: false,
        error:
          e instanceof Error ? e.message : "Falha ao gravar capa no R2.",
      },
      { status: 500 }
    );
  }

  const publicUrl = coverPublicPath(filename);
  return NextResponse.json({
    ok: true,
    publicUrl,
    objectKey,
    contentType: mime,
    bytes: file.size,
  });
}

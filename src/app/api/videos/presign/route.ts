import { assertVideoAdmin } from "@/lib/videos/admin-auth";
import { getVideosBucket } from "@/lib/videos/cloud-bindings";
import {
  createR2PresignedPut,
  hasR2S3Credentials,
} from "@/lib/videos/r2-s3";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * OpenNext/Cloudflare: usar nodejs_compat (não edge).
 * @see https://opennext.js.org/cloudflare/get-started
 */
export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB
const MAX_THUMB_BYTES = 5 * 1024 * 1024; // 5 MB

type PresignBody = {
  filename?: string;
  contentType?: string;
  size?: number;
  /** "video" (default) | "thumb" */
  kind?: string;
};

function extensionFrom(filename: string, contentType: string): string {
  const fromName = filename.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("quicktime")) return "mov";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.startsWith("image/")) return "jpg";
  return "mp4";
}

/**
 * POST /api/videos/presign
 * Body: { filename, contentType, size }
 * → { uploadUrl, objectKey, publicUrl, mode: "s3-presign" | "worker-put" }
 */
export async function POST(req: NextRequest) {
  const auth = await assertVideoAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  let body: PresignBody;
  try {
    body = (await req.json()) as PresignBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido" },
      { status: 400 }
    );
  }

  const kind =
    String(body.kind || "video").trim().toLowerCase() === "thumb"
      ? "thumb"
      : "video";
  const filename =
    String(body.filename || (kind === "thumb" ? "thumb.jpg" : "video.mp4")).trim() ||
    (kind === "thumb" ? "thumb.jpg" : "video.mp4");
  const contentType = String(
    body.contentType || (kind === "thumb" ? "image/jpeg" : "video/mp4")
  ).trim();
  const size = Number(body.size || 0);

  if (kind === "video") {
    if (
      !contentType.startsWith("video/") &&
      contentType !== "application/octet-stream"
    ) {
      return NextResponse.json(
        { ok: false, error: "contentType deve ser vídeo" },
        { status: 400 }
      );
    }
  } else {
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { ok: false, error: "Thumbnail deve ser imagem (JPG/PNG/WebP)" },
        { status: 400 }
      );
    }
  }
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json(
      { ok: false, error: "size inválido" },
      { status: 400 }
    );
  }
  const maxBytes = kind === "thumb" ? MAX_THUMB_BYTES : MAX_VIDEO_BYTES;
  if (size > maxBytes) {
    return NextResponse.json(
      {
        ok: false,
        error: `Arquivo maior que ${maxBytes / (1024 * 1024)} MB`,
      },
      { status: 413 }
    );
  }

  const ext = extensionFrom(filename, contentType);
  const objectKey =
    kind === "thumb"
      ? `thumbs/${randomUUID()}.${ext}`
      : `videos/${randomUUID()}.${ext}`;
  const publicUrl =
    kind === "thumb"
      ? `/api/videos/thumb-asset/${objectKey
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`
      : `/api/videos/stream/${objectKey
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`;

  // 1) Ideal: PUT direto no R2 via S3 API (não passa body pelo Worker)
  if (hasR2S3Credentials()) {
    try {
      const uploadUrl = await createR2PresignedPut({
        objectKey,
        contentType,
        expiresIn: 600,
      });
      return NextResponse.json({
        ok: true,
        uploadUrl,
        objectKey,
        publicUrl,
        mode: "s3-presign" as const,
        expiresIn: 600,
      });
    } catch (e) {
      console.error("[presign] s3 failed", e);
      return NextResponse.json(
        {
          ok: false,
          error:
            e instanceof Error
              ? e.message
              : "Falha ao gerar URL assinada do R2",
        },
        { status: 500 }
      );
    }
  }

  // 2) Fallback: binding R2 no Worker (PUT same-origin)
  //    Requer bucket habilitado + binding VIDEOS_BUCKET.
  const bucket = await getVideosBucket();
  if (!bucket) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "R2 indisponível. Habilite R2 no dashboard Cloudflare, crie o bucket nullysh-videos, faça deploy com binding VIDEOS_BUCKET. Opcional: R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ACCOUNT_ID para presign S3.",
      },
      { status: 503 }
    );
  }

  // Token opaco curto embutido no path (admin headers ainda exigidos no put)
  const uploadUrl = `/api/videos/r2-put?key=${encodeURIComponent(objectKey)}`;
  return NextResponse.json({
    ok: true,
    uploadUrl,
    objectKey,
    publicUrl,
    mode: "worker-put" as const,
    expiresIn: 600,
  });
}

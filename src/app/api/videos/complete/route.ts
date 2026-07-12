import { assertVideoAdmin } from "@/lib/videos/admin-auth";
import { addStoredVideo, toPublicVideo } from "@/lib/videos/catalog";
import { getDataKv, getVideosBucket } from "@/lib/videos/cloud-bindings";
import type { StoredVideo } from "@/lib/videos/types";
import { uid } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type CompleteBody = {
  objectKey?: string;
  /** R2 key da thumbnail (thumbs/…) */
  thumbObjectKey?: string;
  title?: string;
  description?: string;
  vipOnly?: boolean;
  sizeBytes?: number;
  category?: string;
  duration?: string;
  mimeType?: string;
  fileName?: string;
};

/**
 * POST /api/videos/complete
 * Após o PUT no R2, registra metadados no catálogo (KV / R2 catalog / FS).
 */
export async function POST(req: NextRequest) {
  const auth = await assertVideoAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  let body: CompleteBody;
  try {
    body = (await req.json()) as CompleteBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido" },
      { status: 400 }
    );
  }

  const objectKey = String(body.objectKey || "").trim();
  const title = String(body.title || "").trim();
  if (!objectKey.startsWith("videos/") || objectKey.includes("..")) {
    return NextResponse.json(
      { ok: false, error: "objectKey inválido" },
      { status: 400 }
    );
  }
  if (title.length < 2) {
    return NextResponse.json(
      { ok: false, error: "Título obrigatório (mín. 2 caracteres)" },
      { status: 400 }
    );
  }

  // Confirma objeto no R2 quando o binding existe
  const bucket = await getVideosBucket();
  if (bucket) {
    try {
      const head = await bucket.head(objectKey);
      if (!head || head.size <= 0) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Objeto não encontrado no R2. Faça o PUT/presign de novo antes do complete.",
          },
          { status: 400 }
        );
      }
    } catch {
      /* head pode falhar em env local sem R2 real — segue se size informado */
    }
  }

  const videoId = uid("vid");
  const sizeBytes =
    typeof body.sizeBytes === "number" && body.sizeBytes > 0
      ? body.sizeBytes
      : 0;
  const vipOnly = !!body.vipOnly;
  const description = String(body.description || "").trim();
  const category = String(body.category || "Geral").trim() || "Geral";
  const duration = String(body.duration || "").trim() || "—";
  const mimeType = String(body.mimeType || "video/mp4").trim();
  const fileName =
    String(body.fileName || "").trim() || objectKey.split("/").pop() || "video.mp4";
  const thumbObjectKey = String(body.thumbObjectKey || "").trim();
  if (
    thumbObjectKey &&
    (!thumbObjectKey.startsWith("thumbs/") || thumbObjectKey.includes(".."))
  ) {
    return NextResponse.json(
      { ok: false, error: "thumbObjectKey inválido" },
      { status: 400 }
    );
  }

  const stored = await addStoredVideo({
    id: videoId,
    title,
    description,
    duration,
    category,
    thumbnail: thumbObjectKey ? "R2" : "R2",
    vipOnly,
    // Telegram opcional (vault); R2 é playback
    telegramFileId: "r2",
    r2ObjectKey: objectKey,
    r2ThumbKey: thumbObjectKey || null,
    fileName,
    mimeType,
    sizeBytes,
    uploadedById: auth.adminId,
    uploadedByName: auth.adminName,
  });

  // Metadados individuais no KV (além do catálogo)
  const kv = await getDataKv();
  if (kv) {
    try {
      await kv.put(`videos:${videoId}`, JSON.stringify(stored));
    } catch (e) {
      console.warn("[complete] kv individual put failed", e);
    }
  }

  return NextResponse.json({
    ok: true,
    success: true,
    video: toPublicVideo(stored),
    streamUrl: `/api/videos/${encodeURIComponent(videoId)}/stream`,
    objectStreamUrl: `/api/videos/stream/${objectKey
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
  });
}

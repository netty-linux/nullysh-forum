import { assertVideoAdmin } from "@/lib/videos/admin-auth";
import {
  getStoredVideo,
  removeStoredVideo,
  toPublicVideo,
  updateStoredVideo,
} from "@/lib/videos/catalog";
import { deleteVideoFile } from "@/lib/videos/media-files";
import { telegramDeleteMessage } from "@/lib/telegram/bot";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const video = await getStoredVideo(id);
  if (!video) {
    return NextResponse.json(
      { ok: false, error: "Vídeo não encontrado" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, video: toPublicVideo(video) });
}

/** Atualiza metadados (admin). */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await assertVideoAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as {
      title?: string;
      description?: string;
      category?: string;
      vipOnly?: boolean;
      duration?: string;
    };

    const patch: Parameters<typeof updateStoredVideo>[1] = {};
    if (typeof body.title === "string" && body.title.trim()) {
      patch.title = body.title.trim();
    }
    if (typeof body.description === "string") {
      patch.description = body.description.trim();
    }
    if (typeof body.category === "string" && body.category.trim()) {
      patch.category = body.category.trim();
    }
    if (typeof body.vipOnly === "boolean") {
      patch.vipOnly = body.vipOnly;
    }
    if (typeof body.duration === "string" && body.duration.trim()) {
      patch.duration = body.duration.trim();
    }

    const updated = await updateStoredVideo(id, patch);
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Vídeo não encontrado" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, video: toPublicVideo(updated) });
  } catch (e) {
    console.error("[api/videos PATCH]", e);
    return NextResponse.json(
      { ok: false, error: "Falha ao atualizar" },
      { status: 500 }
    );
  }
}

/**
 * Remove vídeo de ponta a ponta (best-effort):
 * 1) Catálogo (KV / FS / R2 catalog)
 * 2) Objetos R2: videos/… + thumbs/… (+ legado media/{id}.mp4)
 * 3) FS local (dev)
 * 4) Mensagem no Telegram (só se telegramMessageId existir — path legado)
 *
 * Notas:
 * - Vídeos só-R2 (telegramFileId === "r2") não têm mensagem TG → skip TG.
 * - deleteMessage no Telegram não apaga o file_id do CDN do bot de forma
 *   garantida; remove a mensagem do chat de storage. É o máximo da Bot API.
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await assertVideoAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  const { id } = await ctx.params;
  const removed = await removeStoredVideo(id);
  if (!removed) {
    return NextResponse.json(
      { ok: false, error: "Vídeo não encontrado" },
      { status: 404 }
    );
  }

  // Limpa blobs R2 (keys reais do pipeline novo) + legado
  await deleteVideoFile(id, {
    r2ObjectKey: removed.r2ObjectKey,
    r2ThumbKey: removed.r2ThumbKey,
  });

  // KV individual (se existir)
  try {
    const { getDataKv } = await import("@/lib/videos/cloud-bindings");
    const kv = await getDataKv();
    if (kv) await kv.delete(`videos:${id}`);
  } catch {
    /* ignore */
  }

  // Telegram vault (só path legado com messageId)
  let telegramDeleted = false;
  if (
    removed.telegramMessageId &&
    removed.telegramFileId &&
    removed.telegramFileId !== "r2"
  ) {
    await telegramDeleteMessage(removed.telegramMessageId);
    telegramDeleted = true;
  }

  return NextResponse.json({
    ok: true,
    id,
    cleaned: {
      catalog: true,
      r2Video: !!removed.r2ObjectKey,
      r2Thumb: !!removed.r2ThumbKey,
      telegram: telegramDeleted,
    },
  });
}

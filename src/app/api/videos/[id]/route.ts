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

/** Remove do catálogo e tenta apagar a mensagem no Telegram. */
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

  await deleteVideoFile(id);

  if (removed.telegramMessageId) {
    await telegramDeleteMessage(removed.telegramMessageId);
  }

  return NextResponse.json({ ok: true, id });
}

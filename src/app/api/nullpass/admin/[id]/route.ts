import { getNullpassDb } from "@/lib/nullpass/d1";
import { deleteProduct, updateProduct } from "@/lib/nullpass/repository";
import type { NullpassUpsertInput } from "@/lib/nullpass/validate";
import { assertVideoAdmin } from "@/lib/videos/admin-auth";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function requireDb() {
  const db = await getNullpassDb();
  if (!db) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          error: "D1 indisponível neste ambiente.",
          code: "d1_unavailable",
        },
        { status: 503 }
      ),
      db: null as null,
    };
  }
  return { error: null, db };
}

/** Atualiza produto. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await assertVideoAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { ok: false, error: "ID inválido." },
      { status: 400 }
    );
  }

  try {
    const { error, db } = await requireDb();
    if (error || !db) return error!;

    const body = (await req.json()) as NullpassUpsertInput;
    const res = await updateProduct(db, id, body);
    if (!res.ok) {
      const status = res.error.includes("não encontrado") ? 404 : 400;
      return NextResponse.json(
        { ok: false, error: res.error },
        { status }
      );
    }
    return NextResponse.json({ ok: true, product: res.product });
  } catch (e) {
    console.error("[api/nullpass/admin PATCH]", e);
    return NextResponse.json(
      { ok: false, error: "Falha ao atualizar produto NullPass" },
      { status: 500 }
    );
  }
}

/** Remove produto. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await assertVideoAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { ok: false, error: "ID inválido." },
      { status: 400 }
    );
  }

  try {
    const { error, db } = await requireDb();
    if (error || !db) return error!;

    const res = await deleteProduct(db, id);
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: res.error },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/nullpass/admin DELETE]", e);
    return NextResponse.json(
      { ok: false, error: "Falha ao remover produto NullPass" },
      { status: 500 }
    );
  }
}

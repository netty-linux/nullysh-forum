import { getNullpassDb } from "@/lib/nullpass/d1";
import {
  createProduct,
  listAllProducts,
} from "@/lib/nullpass/repository";
import type { NullpassUpsertInput } from "@/lib/nullpass/validate";
import { assertVideoAdmin } from "@/lib/videos/admin-auth";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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

/** Lista completa (admin). */
export async function GET(req: NextRequest) {
  const auth = await assertVideoAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const { error, db } = await requireDb();
    if (error || !db) return error!;
    const products = await listAllProducts(db);
    return NextResponse.json({
      ok: true,
      products,
      source: "d1" as const,
    });
  } catch (e) {
    console.error("[api/nullpass/admin GET]", e);
    return NextResponse.json(
      { ok: false, error: "Falha ao listar NullPass (admin)" },
      { status: 500 }
    );
  }
}

/** Cria produto. */
export async function POST(req: NextRequest) {
  const auth = await assertVideoAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const { error, db } = await requireDb();
    if (error || !db) return error!;

    const body = (await req.json()) as NullpassUpsertInput;
    const res = await createProduct(db, body);
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: res.error },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, product: res.product });
  } catch (e) {
    console.error("[api/nullpass/admin POST]", e);
    return NextResponse.json(
      { ok: false, error: "Falha ao criar produto NullPass" },
      { status: 500 }
    );
  }
}

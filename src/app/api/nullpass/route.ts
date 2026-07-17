import { getNullpassDb } from "@/lib/nullpass/d1";
import { listPublicProducts } from "@/lib/nullpass/repository";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Catálogo público (só active). */
export async function GET() {
  try {
    const db = await getNullpassDb();
    if (!db) {
      return NextResponse.json(
        {
          ok: false,
          error: "D1 indisponível neste ambiente.",
          code: "d1_unavailable",
        },
        { status: 503 }
      );
    }
    const products = await listPublicProducts(db);
    return NextResponse.json({
      ok: true,
      products,
      source: "d1" as const,
    });
  } catch (e) {
    console.error("[api/nullpass GET]", e);
    return NextResponse.json(
      { ok: false, error: "Falha ao listar NullPass" },
      { status: 500 }
    );
  }
}

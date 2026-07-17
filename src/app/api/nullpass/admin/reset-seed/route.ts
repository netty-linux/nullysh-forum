import { getNullpassDb } from "@/lib/nullpass/d1";
import { resetToSeed } from "@/lib/nullpass/repository";
import { assertVideoAdmin } from "@/lib/videos/admin-auth";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Substitui catálogo pelo seed padrão (admin). */
export async function POST(req: NextRequest) {
  const auth = await assertVideoAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

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
    const res = await resetToSeed(db);
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: res.error },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, count: res.count });
  } catch (e) {
    console.error("[api/nullpass/admin/reset-seed]", e);
    return NextResponse.json(
      { ok: false, error: "Falha ao restaurar seed NullPass" },
      { status: 500 }
    );
  }
}

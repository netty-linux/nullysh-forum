/**
 * Pay → Forum: resolve preço/título de productKey nullpass_* no D1.
 * Auth: Bearer NULLYSH_MATRIX_HMAC_SECRET + HMAC obrigatório.
 */

import { verifyMatrixRequest } from "@/lib/nullysh-pay/matrix-auth";
import { getNullpassDb } from "@/lib/nullpass/d1";
import { resolveNullpassProduct } from "@/lib/nullpass/resolve-product";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const auth = await verifyMatrixRequest(req, rawBody);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  let body: { productKey?: string };
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const productKey = String(body.productKey || "").trim();
  if (!productKey) {
    return NextResponse.json(
      { ok: false, error: "productKey obrigatório" },
      { status: 400 }
    );
  }

  const db = await getNullpassDb();
  if (!db) {
    return NextResponse.json(
      { ok: false, error: "D1 nullysh-forum-db indisponível" },
      { status: 503 }
    );
  }

  const result = await resolveNullpassProduct(db, productKey);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({
    ok: true,
    product: result.product,
  });
}

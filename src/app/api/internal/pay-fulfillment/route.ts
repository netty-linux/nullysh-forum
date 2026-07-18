/**
 * Pay → Forum: grant VIP / NullPass após pagamento confirmado.
 * Auth: Bearer NULLYSH_MATRIX_HMAC_SECRET + HMAC obrigatório (ts.body).
 */

import { verifyMatrixRequest } from "@/lib/nullysh-pay/matrix-auth";
import { getNullpassDb } from "@/lib/nullpass/d1";
import {
  grantNullpassEntitlement,
  productIdFromNullpassKey,
} from "@/lib/nullpass/entitlements";
import { getProductById } from "@/lib/nullpass/repository";
import { logSecurityEvent } from "@/lib/security-log";
import { getSupabaseAdmin, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isVipProduct(productKey: string): boolean {
  const k = productKey.toLowerCase();
  return k.startsWith("vip") || k.includes("vip_");
}

function isNullpassProduct(productKey: string): boolean {
  return productKey.toLowerCase().startsWith("nullpass_");
}

async function fulfillVip(forumUserId: string, productKey: string, checkoutToken: string | null) {
  if (!isServiceRoleConfigured()) {
    console.error("[pay-fulfillment] SUPABASE_SERVICE_ROLE_KEY ausente");
    return NextResponse.json(
      {
        ok: false,
        error:
          "SUPABASE_SERVICE_ROLE_KEY não configurada no Forum — VIP não liberado.",
      },
      { status: 503 }
    );
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Admin client indisponível" },
      { status: 503 }
    );
  }

  const { data: profile, error: fetchErr } = await admin
    .from("profiles")
    .select("id, role, is_vip")
    .eq("id", forumUserId)
    .maybeSingle();

  if (fetchErr) {
    console.error("[pay-fulfillment] fetch", fetchErr);
    return NextResponse.json(
      { ok: false, error: fetchErr.message },
      { status: 502 }
    );
  }
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "Perfil não encontrado" },
      { status: 404 }
    );
  }

  const role = String((profile as { role?: string }).role || "member");
  const isVip = !!(profile as { is_vip?: boolean }).is_vip;

  if (role === "admin") {
    return NextResponse.json({
      ok: true,
      already: true,
      reason: "admin",
      forumUserId,
    });
  }

  if (isVip && (role === "vip" || role === "admin")) {
    return NextResponse.json({
      ok: true,
      already: true,
      forumUserId,
    });
  }

  const { error: upErr } = await admin
    .from("profiles")
    .update({
      is_vip: true,
      role: "vip",
      updated_at: new Date().toISOString(),
    })
    .eq("id", forumUserId);

  if (upErr) {
    console.error("[pay-fulfillment] update", upErr);
    return NextResponse.json(
      { ok: false, error: upErr.message },
      { status: 502 }
    );
  }

  logSecurityEvent("vip_fulfillment", {
    forumUserId,
    productKey,
    granted: "vip",
  });

  return NextResponse.json({
    ok: true,
    granted: "vip",
    forumUserId,
    productKey,
    checkoutToken,
  });
}

async function fulfillNullpass(input: {
  forumUserId: string;
  productKey: string;
  checkoutToken: string | null;
  checkoutId: string | null;
  amountCents: number | null;
}) {
  const db = await getNullpassDb();
  if (!db) {
    return NextResponse.json(
      {
        ok: false,
        error: "D1 nullysh-forum-db indisponível — NullPass não liberado.",
      },
      { status: 503 }
    );
  }

  let productId = productIdFromNullpassKey(input.productKey);
  if (!productId) {
    return NextResponse.json(
      { ok: false, error: "productKey nullpass inválido" },
      { status: 400 }
    );
  }

  // Normaliza id se catálogo usa hífens
  let product = await getProductById(db, productId);
  if (!product && productId.includes("_")) {
    const alt = productId.replace(/_/g, "-");
    product = await getProductById(db, alt);
    if (product) productId = alt;
  }
  if (!product && productId.includes("-")) {
    const alt = productId.replace(/-/g, "_");
    product = await getProductById(db, alt);
    if (product) productId = alt;
  }

  // Ainda grava entitlement mesmo se produto sumiu do catálogo (histórico)
  const notes = product
    ? `paid:${product.title}`
    : "product_not_in_catalog_at_fulfill";

  const result = await grantNullpassEntitlement(db, {
    forumUserId: input.forumUserId,
    productId,
    productKey: input.productKey,
    checkoutToken: input.checkoutToken,
    checkoutId: input.checkoutId,
    amountCents: input.amountCents,
    notes,
  });

  if (!result.ok) {
    console.error("[pay-fulfillment] nullpass grant", result.error);
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 502 }
    );
  }

  logSecurityEvent("vip_fulfillment", {
    forumUserId: input.forumUserId,
    productKey: input.productKey,
    granted: "nullpass",
    already: result.already,
  });

  return NextResponse.json({
    ok: true,
    granted: "nullpass",
    already: result.already,
    forumUserId: input.forumUserId,
    productKey: input.productKey,
    productId: result.entitlement.productId,
    entitlementId: result.entitlement.id,
    checkoutToken: input.checkoutToken,
    checkoutId: input.checkoutId,
  });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const auth = await verifyMatrixRequest(req, rawBody);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  let body: {
    forumUserId?: string;
    productKey?: string;
    status?: string;
    checkoutToken?: string;
    checkoutId?: string;
    amountCents?: number;
  };
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const forumUserId = String(body.forumUserId || "").trim();
  const productKey = String(body.productKey || "").trim();
  const status = String(body.status || "").toLowerCase();
  const checkoutToken = body.checkoutToken
    ? String(body.checkoutToken).trim()
    : null;
  const checkoutId = body.checkoutId ? String(body.checkoutId).trim() : null;
  const amountCents =
    typeof body.amountCents === "number" && Number.isFinite(body.amountCents)
      ? Math.round(body.amountCents)
      : null;

  if (!forumUserId || !productKey) {
    return NextResponse.json(
      { ok: false, error: "forumUserId e productKey obrigatórios" },
      { status: 400 }
    );
  }
  if (status !== "paid") {
    return NextResponse.json(
      { ok: false, error: "status deve ser paid" },
      { status: 400 }
    );
  }

  if (isVipProduct(productKey)) {
    return fulfillVip(forumUserId, productKey, checkoutToken);
  }

  if (isNullpassProduct(productKey)) {
    return fulfillNullpass({
      forumUserId,
      productKey,
      checkoutToken,
      checkoutId,
      amountCents,
    });
  }

  return NextResponse.json({
    ok: true,
    skipped: "unknown_product_kind",
    productKey,
  });
}

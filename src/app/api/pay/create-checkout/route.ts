/**
 * Bridge Forum → Pay (produtos oficiais Matriz).
 * Browser nunca vê secrets.
 * C2: não envia amountCents — preço só no catálogo do Pay / NullPass D1.
 * Auth outbound: NULLYSH_MATRIX_HMAC_SECRET (não SSO).
 */

import {
  getNullyshPayUrl,
} from "@/lib/nullysh-pay/config";
import { matrixSignedHeaders } from "@/lib/nullysh-pay/matrix-auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseFromRequest } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });
  }

  const supabase = getSupabaseFromRequest(req);
  if (!supabase) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const productKey = String(body.productKey || "").trim();
  const billingType = String(body.billingType || "PIX").toUpperCase();

  if (!productKey) {
    return NextResponse.json({ error: "productKey obrigatório" }, { status: 400 });
  }
  if (billingType !== "PIX" && billingType !== "BTC") {
    return NextResponse.json(
      { error: "billingType deve ser PIX ou BTC" },
      { status: 400 }
    );
  }

  const documentDigits = body.document
    ? String(body.document).replace(/\D/g, "")
    : "";
  if (
    billingType === "PIX" &&
    documentDigits.length !== 11 &&
    documentDigits.length !== 14
  ) {
    return NextResponse.json(
      { error: "CPF ou CNPJ válido é obrigatório para PIX." },
      { status: 400 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email")
    .eq("id", user.id)
    .maybeSingle();

  // C2: sem amountCents — Pay resolve pelo catálogo (VIP static / NullPass D1)
  const payload = JSON.stringify({
    productKey,
    billingType,
    buyer: {
      forumUserId: user.id,
      email: (profile as { email?: string } | null)?.email || user.email,
      name:
        (profile as { name?: string } | null)?.name ||
        user.email?.split("@")[0] ||
        "Membro",
      document: documentDigits || undefined,
    },
    metadata: body.metadata || { source: "nullysh-forum" },
  });

  const signed = await matrixSignedHeaders(payload);
  if (!signed.ok) {
    return NextResponse.json({ error: signed.error }, { status: 503 });
  }

  const payUrl = getNullyshPayUrl();

  try {
    const res = await fetch(`${payUrl}/api/platform/checkout`, {
      method: "POST",
      headers: signed.headers,
      body: payload,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: (data as { error?: string }).error || `Pay HTTP ${res.status}` },
        { status: res.status >= 400 ? res.status : 502 }
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Falha ao contatar Nullysh Pay",
      },
      { status: 502 }
    );
  }
}

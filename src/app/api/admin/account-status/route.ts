/**
 * Admin: altera account_status e notifica Nullysh Pay (ban sync).
 */

import { notifyPayUserStatus } from "@/lib/nullysh-pay/notify-status";
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

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if ((me as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Acesso admin" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const targetUserId = String(body.userId || "").trim();
  const status = String(body.status || "").toLowerCase();
  const reason = body.reason ? String(body.reason) : undefined;

  if (!targetUserId) {
    return NextResponse.json({ error: "userId obrigatório" }, { status: 400 });
  }
  if (!["active", "suspended", "banned"].includes(status)) {
    return NextResponse.json(
      { error: "status: active | suspended | banned" },
      { status: 400 }
    );
  }

  const { error: upErr } = await supabase
    .from("profiles")
    .update({
      account_status: status,
      status_reason: reason || null,
      status_updated_at: new Date().toISOString(),
    })
    .eq("id", targetUserId);

  if (upErr) {
    // Coluna pode não existir até migration — ainda notifica Pay
    console.warn("[account-status] profiles update", upErr.message);
  }

  const pay = await notifyPayUserStatus({
    forumUserId: targetUserId,
    status: status as "active" | "suspended" | "banned",
    reason,
  });

  return NextResponse.json({
    ok: true,
    profileUpdated: !upErr,
    payNotified: pay.ok,
    payError: pay.error || null,
  });
}

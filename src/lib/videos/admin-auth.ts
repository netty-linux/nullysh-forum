import { getSupabaseServer } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export type AdminAuthResult =
  | { ok: true; adminId: string; adminName: string }
  | { ok: false; error: string; status: number };

/**
 * Autoriza mutações admin (vídeos, etc.).
 *
 * Ordem segura:
 * 1. Sessão Supabase + role admin em public.profiles (fonte da verdade)
 * 2. Header x-admin-secret === ADMIN_API_SECRET (server-only, NUNCA NEXT_PUBLIC_)
 *
 * NÃO confia em x-admin-role do client em produção.
 * ALLOW_HEADER_ADMIN só em NODE_ENV=development e sem secret configurado.
 */
export async function assertVideoAdmin(
  req: NextRequest
): Promise<AdminAuthResult> {
  const secret = process.env.ADMIN_API_SECRET?.trim();
  const headerSecret = req.headers.get("x-admin-secret")?.trim();

  // 1) Sessão real + profiles.role (não confia em user_metadata spoofable)
  try {
    const supabase = await getSupabaseServer();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, name, role, is_vip")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.role === "admin") {
          return {
            ok: true,
            adminId: profile.id,
            adminName: profile.name || user.email || "Admin",
          };
        }
      }
    }
  } catch {
    /* ignore */
  }

  // 2) Shared secret server-side (automation / CI). Nunca expor no NEXT_PUBLIC_*
  if (secret && headerSecret && headerSecret === secret) {
    return {
      ok: true,
      adminId: req.headers.get("x-admin-id")?.trim() || "admin-service",
      adminName: req.headers.get("x-admin-name")?.trim() || "Admin Service",
    };
  }

  // 3) Dev local only — headers spoofáveis, nunca em produção
  if (process.env.NODE_ENV === "development" && !secret) {
    const role = req.headers.get("x-admin-role")?.trim();
    const adminId = req.headers.get("x-admin-id")?.trim();
    if (role === "admin" && adminId) {
      return {
        ok: true,
        adminId,
        adminName: req.headers.get("x-admin-name")?.trim() || "Admin",
      };
    }
  }

  if (secret) {
    return {
      ok: false,
      error:
        "Não autorizado. Faça login como admin ou envie x-admin-secret (ADMIN_API_SECRET).",
      status: 401,
    };
  }

  return {
    ok: false,
    error:
      "Não autorizado. Entre com uma conta admin (profiles.role = admin).",
    status: 401,
  };
}

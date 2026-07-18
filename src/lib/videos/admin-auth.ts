import { logSecurityEvent } from "@/lib/security-log";
import { timingSafeEqualStr } from "@/lib/nullysh-pay/matrix-auth";
import {
  getSupabaseFromRequest,
  getSupabaseServer,
  getSupabaseWithAccessToken,
} from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

export type AdminAuthResult =
  | { ok: true; adminId: string; adminName: string }
  | { ok: false; error: string; status: number };

async function profileIsAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<{ id: string; name: string } | null> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, name, role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile || profile.role !== "admin") return null;
  return {
    id: profile.id,
    name: profile.name || "Admin",
  };
}

function fail(
  error: string,
  status: number,
  reason: string
): AdminAuthResult {
  logSecurityEvent("admin_auth_failed", { reason, status });
  return { ok: false, error, status };
}

function success(adminId: string, adminName: string): AdminAuthResult {
  logSecurityEvent("admin_auth_success", {
    adminId,
    via: "session_or_secret",
  });
  return { ok: true, adminId, adminName };
}

/**
 * Autoriza mutações admin (vídeos, etc.).
 *
 * 1. Authorization: Bearer <access_token> Supabase
 * 2. Cookies de sessão no Request (OpenNext/Workers)
 * 3. cookies() via next/headers
 * 4. x-admin-secret === ADMIN_API_SECRET (CI / automação)
 * 5. Dev: exige ADMIN_API_SECRET + header (sem bypass irrestrito)
 *
 * FIX #7 — OWASP A01
 */
export async function assertVideoAdmin(
  req: NextRequest
): Promise<AdminAuthResult> {
  const secret = process.env.ADMIN_API_SECRET?.trim();
  const headerSecret = req.headers.get("x-admin-secret")?.trim();

  // ── 1) Bearer JWT da sessão do browser ─────────────────────────
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.match(/^Bearer\s+(\S+)/i)?.[1]?.trim();
  if (bearer) {
    try {
      const supabase = getSupabaseWithAccessToken(bearer);
      if (supabase) {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser(bearer);
        if (!error && user) {
          const admin = await profileIsAdmin(supabase, user.id);
          if (admin) {
            return success(
              admin.id,
              admin.name || user.email || "Admin"
            );
          }
          return fail(
            "Sessão válida, mas o perfil não é admin (profiles.role).",
            403,
            "not_admin_role"
          );
        }
      }
    } catch {
      /* tenta cookie */
    }
  }

  // ── 2) Cookies no NextRequest (melhor no Workers) ──────────────
  try {
    const supabase = getSupabaseFromRequest(req);
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const admin = await profileIsAdmin(supabase, user.id);
        if (admin) {
          return success(
            admin.id,
            admin.name || user.email || "Admin"
          );
        }
        return fail(
          "Sessão válida, mas o perfil não é admin (profiles.role).",
          403,
          "not_admin_role"
        );
      }
    }
  } catch {
    /* tenta next/headers */
  }

  // ── 3) next/headers cookies() ──────────────────────────────────
  try {
    const supabase = await getSupabaseServer();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const admin = await profileIsAdmin(supabase, user.id);
        if (admin) {
          return success(
            admin.id,
            admin.name || user.email || "Admin"
          );
        }
      }
    }
  } catch {
    /* ignore */
  }

  // ── 4) Secret server-side (CI / automação) ─────────────────────
  if (secret && headerSecret && timingSafeEqualStr(headerSecret, secret)) {
    return success(
      req.headers.get("x-admin-id")?.trim() || "admin-service",
      req.headers.get("x-admin-name")?.trim() || "Admin Service"
    );
  }

  // ── 5) Dev local: exige ADMIN_API_SECRET (sem bypass irrestrito)
  if (process.env.NODE_ENV === "development") {
    if (!secret) {
      return fail(
        "DEV: Configure ADMIN_API_SECRET no .env.local para testar rotas admin.",
        503,
        "dev_missing_admin_secret"
      );
    }
    if (!headerSecret || !timingSafeEqualStr(headerSecret, secret)) {
      return fail("DEV: x-admin-secret inválido.", 401, "dev_bad_secret");
    }
  }

  return fail(
    "Não autorizado. Faça login como admin (profiles.role = admin). A API usa a sessão Supabase (Bearer/cookies).",
    401,
    "unauthorized"
  );
}

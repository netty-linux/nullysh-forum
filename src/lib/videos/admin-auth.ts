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

/**
 * Autoriza mutações admin (vídeos, etc.).
 *
 * Produção (Cloudflare):
 * 1. Authorization: Bearer <access_token> da sessão Supabase (preferido)
 * 2. Cookies de sessão no Request (OpenNext/Workers)
 * 3. cookies() via next/headers (fallback)
 * 4. x-admin-secret === ADMIN_API_SECRET (só server / CI — nunca no browser)
 *
 * Dev local (sem secret): headers x-admin-* apenas se NODE_ENV=development.
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
            return {
              ok: true,
              adminId: admin.id,
              adminName: admin.name || user.email || "Admin",
            };
          }
          return {
            ok: false,
            error:
              "Sessão válida, mas o perfil não é admin (profiles.role).",
            status: 403,
          };
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
          return {
            ok: true,
            adminId: admin.id,
            adminName: admin.name || user.email || "Admin",
          };
        }
        return {
          ok: false,
          error:
            "Sessão válida, mas o perfil não é admin (profiles.role).",
          status: 403,
        };
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
          return {
            ok: true,
            adminId: admin.id,
            adminName: admin.name || user.email || "Admin",
          };
        }
      }
    }
  } catch {
    /* ignore */
  }

  // ── 4) Secret server-side (CI / automação) ─────────────────────
  if (secret && headerSecret && headerSecret === secret) {
    return {
      ok: true,
      adminId: req.headers.get("x-admin-id")?.trim() || "admin-service",
      adminName: req.headers.get("x-admin-name")?.trim() || "Admin Service",
    };
  }

  // ── 5) Dev local ONLY ──────────────────────────────────────────
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

  return {
    ok: false,
    error:
      "Não autorizado. Faça login como admin (profiles.role = admin). A API usa a sessão Supabase (Bearer/cookies).",
    status: 401,
  };
}

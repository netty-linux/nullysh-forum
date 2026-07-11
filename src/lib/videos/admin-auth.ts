import { getSupabaseServer } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export type AdminAuthResult =
  | { ok: true; adminId: string; adminName: string }
  | { ok: false; error: string; status: number };

/**
 * Autoriza mutações de vídeos (upload/delete).
 * Ordem:
 * 1. Header x-admin-secret === ADMIN_API_SECRET (recomendado em prod)
 * 2. Sessão Supabase com role admin no user_metadata / app_metadata
 * 3. Dev only: x-admin-role: admin + x-admin-id
 */
export async function assertVideoAdmin(
  req: NextRequest
): Promise<AdminAuthResult> {
  const secret = process.env.ADMIN_API_SECRET?.trim();
  const headerSecret = req.headers.get("x-admin-secret")?.trim();
  if (secret && headerSecret && headerSecret === secret) {
    return {
      ok: true,
      adminId: req.headers.get("x-admin-id")?.trim() || "admin",
      adminName: req.headers.get("x-admin-name")?.trim() || "Admin",
    };
  }

  try {
    const supabase = await getSupabaseServer();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const role =
          (user.app_metadata?.role as string | undefined) ||
          (user.user_metadata?.role as string | undefined);
        if (role === "admin") {
          return {
            ok: true,
            adminId: user.id,
            adminName:
              (user.user_metadata?.name as string) ||
              user.email ||
              "Admin",
          };
        }
      }
    }
  } catch {
    /* ignore */
  }

  // Dev local OU preview cloud com mock auth (ALLOW_HEADER_ADMIN=1)
  const allowHeaderAdmin =
    process.env.NODE_ENV === "development" ||
    process.env.ALLOW_HEADER_ADMIN === "1" ||
    process.env.ALLOW_HEADER_ADMIN === "true";
  if (allowHeaderAdmin) {
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

  // Se tem secret configurado e falhou, 401 explícito
  if (secret) {
    return {
      ok: false,
      error: "Não autorizado. Configure x-admin-secret (ADMIN_API_SECRET).",
      status: 401,
    };
  }

  return {
    ok: false,
    error:
      "Não autorizado. Em dev, entre como admin. Em prod, defina ADMIN_API_SECRET.",
    status: 401,
  };
}

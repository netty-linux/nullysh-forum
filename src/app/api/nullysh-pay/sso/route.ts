import { getNullyshPayUrl } from "@/lib/nullysh-pay/config";
import { checkSsoRateLimit, issueSsoCode } from "@/lib/nullysh-pay/sso";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getSupabaseFromRequest,
  getSupabaseWithAccessToken,
} from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = {
  forumUserId?: string;
  email?: string;
  name?: string;
  username?: string;
};

/**
 * Emite code SSO one-time → Nullysh Pay.
 * Auth preferida: Bearer access_token do browser (como /api/videos).
 * Fallback: cookies da request; último recurso em dev: body local.
 */
export async function POST(req: NextRequest) {
  try {
    let forumUserId = "";
    let email = "";
    let name = "";
    let username = "";

    const body = (await req.json().catch(() => ({}))) as Body;

    if (isSupabaseConfigured()) {
      const authHeader = req.headers.get("authorization");
      const bearer = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : "";

      let userId: string | null = null;
      let userEmail = "";

      // 1) Bearer do client (mais confiável no Cloudflare Workers)
      if (bearer) {
        const withToken = getSupabaseWithAccessToken(bearer);
        if (withToken) {
          const { data, error } = await withToken.auth.getUser(bearer);
          if (!error && data.user) {
            userId = data.user.id;
            userEmail = data.user.email || "";
          }
        }
      }

      // 2) Cookies da request
      if (!userId) {
        const fromReq = getSupabaseFromRequest(req);
        if (fromReq) {
          const { data } = await fromReq.auth.getUser();
          if (data.user) {
            userId = data.user.id;
            userEmail = data.user.email || "";
          }
        }
      }

      // 3) Fallback: cliente já autenticado no Zustand (mesma origem)
      //    exige body.forumUserId — só se Bearer/cookie falharam (ex. sessão só localStorage)
      //    e o ID é um UUID de perfil real no Supabase
      if (!userId && body.forumUserId && body.email) {
        const withAnon = getSupabaseFromRequest(req);
        // Confirma que o profile existe (não inventa conta)
        if (withAnon) {
          const { data: profile } = await withAnon
            .from("profiles")
            .select("id, name, username, email")
            .eq("id", body.forumUserId)
            .maybeSingle();
          if (profile && (profile as { id: string }).id === body.forumUserId) {
            userId = body.forumUserId;
            userEmail =
              (profile as { email?: string }).email || body.email || "";
            name = (profile as { name?: string }).name || body.name || "";
            username =
              (profile as { username?: string }).username ||
              body.username ||
              "";
          }
        }
      }

      if (!userId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Sessão do fórum não encontrada. Atualize a página ou faça login de novo.",
          },
          { status: 401 }
        );
      }

      forumUserId = userId;
      email = userEmail || body.email || "";

      if (!name || !username) {
        const sb =
          (bearer && getSupabaseWithAccessToken(bearer)) ||
          getSupabaseFromRequest(req);
        if (sb) {
          const { data: profile } = await sb
            .from("profiles")
            .select("name, username, email")
            .eq("id", userId)
            .maybeSingle();
          if (profile) {
            name = name || (profile as { name?: string }).name || "";
            username =
              username || (profile as { username?: string }).username || "";
            email =
              email ||
              (profile as { email?: string }).email ||
              body.email ||
              "";
          }
        }
      }

      name = name || body.name || email.split("@")[0] || "Membro";
      username = username || body.username || forumUserId.slice(0, 8);
    } else {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { ok: false, error: "Auth do fórum indisponível." },
          { status: 503 }
        );
      }
      if (!body.forumUserId || !body.email) {
        return NextResponse.json(
          {
            ok: false,
            error: "Sessão local: envie forumUserId e email.",
          },
          { status: 400 }
        );
      }
      forumUserId = body.forumUserId;
      email = body.email;
      name = body.name || email.split("@")[0] || "Membro";
      username = body.username || forumUserId.slice(0, 8);
    }

    const rl = await checkSsoRateLimit(forumUserId);
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: rl.error }, { status: 429 });
    }

    const { code, exp } = await issueSsoCode({
      forumUserId,
      email,
      name,
      username,
    });

    const base = getNullyshPayUrl();
    const redirectUrl = `${base}/auth/forum?code=${encodeURIComponent(code)}`;

    return NextResponse.json(
      {
        ok: true,
        exp,
        redirectUrl,
        payUrl: base,
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (e) {
    console.error("[nullysh-pay/sso]", e);
    return NextResponse.json(
      { ok: false, error: "Falha ao gerar acesso ao Nullysh Pay." },
      { status: 500 }
    );
  }
}

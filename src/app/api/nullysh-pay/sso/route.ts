import { getNullyshPayUrl } from "@/lib/nullysh-pay/config";
import { checkSsoRateLimit, issueSsoCode } from "@/lib/nullysh-pay/sso";
import { checkServerRateLimit } from "@/lib/rate-limit-server";
import { logSecurityEvent } from "@/lib/security-log";
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
 * C3: só JWT Supabase (Bearer) ou cookies de sessão — zero impersonation via body.
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

      // C3: sem fallback body.forumUserId — impede takeover de conta Pay

      if (!userId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Não autorizado. Faça login no Forum e tente novamente.",
          },
          { status: 401 }
        );
      }

      forumUserId = userId;
      email = userEmail;

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
          name = (profile as { name?: string }).name || "";
          username = (profile as { username?: string }).username || "";
          email =
            email ||
            (profile as { email?: string }).email ||
            "";
        }
      }

      name = name || email.split("@")[0] || "Membro";
      username = username || forumUserId.slice(0, 8);
    } else {
      // Sem Supabase: só dev local explícito (nunca produção)
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
            error: "Sessão local: envie forumUserId e email (dev only).",
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
      logSecurityEvent("rate_limit_triggered", {
        action: "sso",
        forumUserId,
        layer: "kv",
      });
      return NextResponse.json({ ok: false, error: rl.error }, { status: 429 });
    }

    // FIX #2 — D1 rate limit server-side (defense in depth)
    const rlServer = await checkServerRateLimit(forumUserId, "sso");
    if (!rlServer.ok) {
      logSecurityEvent("rate_limit_triggered", {
        action: "sso",
        forumUserId,
        layer: "d1",
      });
      return NextResponse.json(
        { ok: false, error: rlServer.error },
        {
          status: 429,
          headers: { "Retry-After": String(rlServer.retryAfterSec) },
        }
      );
    }

    const { code, exp } = await issueSsoCode({
      forumUserId,
      email,
      name,
      username,
    });

    const base = getNullyshPayUrl();
    const redirectUrl = `${base}/auth/forum?code=${encodeURIComponent(code)}`;

    logSecurityEvent("sso_code_issued", { forumUserId });

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

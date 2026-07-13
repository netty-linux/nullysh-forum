import { getNullyshPayUrl } from "@/lib/nullysh-pay/config";
import { issueSsoCode } from "@/lib/nullysh-pay/sso";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseFromRequest } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = {
  forumUserId?: string;
  email?: string;
  name?: string;
  username?: string;
};

/**
 * Emite code SSO one-time e retorna URL do Nullysh Pay.
 * Auth: sessão Supabase (cookie/Bearer) ou body em modo local (sem Supabase).
 */
export async function POST(req: NextRequest) {
  try {
    let forumUserId = "";
    let email = "";
    let name = "";
    let username = "";

    if (isSupabaseConfigured()) {
      const authHeader = req.headers.get("authorization");
      const bearer = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : "";
      const supabase = getSupabaseFromRequest(req);
      let userId: string | null = null;

      if (supabase) {
        if (bearer) {
          const { data } = await supabase.auth.getUser(bearer);
          userId = data.user?.id ?? null;
          email = data.user?.email ?? "";
        } else {
          const { data } = await supabase.auth.getUser();
          userId = data.user?.id ?? null;
          email = data.user?.email ?? "";
        }
      }

      if (!userId) {
        return NextResponse.json(
          { ok: false, error: "Faça login no Nullysh Forum." },
          { status: 401 }
        );
      }

      forumUserId = userId;
      // perfil público
      if (supabase) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, username, email")
          .eq("id", userId)
          .maybeSingle();
        if (profile) {
          name = (profile as { name?: string }).name || "";
          username = (profile as { username?: string }).username || "";
          email =
            (profile as { email?: string }).email || email || "";
        }
      }
      name = name || email.split("@")[0] || "Membro";
      username = username || forumUserId.slice(0, 8);
    } else {
      const body = (await req.json().catch(() => ({}))) as Body;
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

    const { code, exp } = await issueSsoCode({
      forumUserId,
      email,
      name,
      username,
    });

    const base = getNullyshPayUrl();
    const redirectUrl = `${base}/auth/forum?code=${encodeURIComponent(code)}`;

    return NextResponse.json({
      ok: true,
      code,
      exp,
      redirectUrl,
      payUrl: base,
    });
  } catch (e) {
    console.error("[nullysh-pay/sso]", e);
    return NextResponse.json(
      { ok: false, error: "Falha ao gerar acesso ao Nullysh Pay." },
      { status: 500 }
    );
  }
}

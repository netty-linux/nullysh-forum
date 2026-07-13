import { assertSsoSecret, exchangeSsoCode } from "@/lib/nullysh-pay/sso";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Server-to-server: app Nullysh Pay troca o code por perfil do fórum.
 * Header: Authorization: Bearer <NULLYSH_PAY_SSO_SECRET>
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!assertSsoSecret(auth)) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { code?: string };
  if (!body.code) {
    return NextResponse.json(
      { ok: false, error: "Informe o code." },
      { status: 400 }
    );
  }

  const result = await exchangeSsoCode(body.code);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({
    ok: true,
    user: result.payload,
  });
}

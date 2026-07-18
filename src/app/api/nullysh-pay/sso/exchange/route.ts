import { verifyMatrixRequest } from "@/lib/nullysh-pay/matrix-auth";
import { assertSsoSecret, exchangeSsoCode } from "@/lib/nullysh-pay/sso";
import { logSecurityEvent } from "@/lib/security-log";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Server-to-server: app Nullysh Pay troca o code por perfil do fórum.
 *
 * FIX #9 — migração gradual:
 * 1) HMAC Matriz (preferido)
 * 2) Bearer SSO legacy (remover após Pay enviar HMAC)
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const hmacAuth = await verifyMatrixRequest(req, rawBody);
  if (!hmacAuth.ok) {
    const auth = req.headers.get("authorization");
    if (!assertSsoSecret(auth)) {
      logSecurityEvent("hmac_verification_failed", {
        route: "sso/exchange",
        hmacStatus: hmacAuth.status,
      });
      return NextResponse.json(
        { ok: false, error: "Não autorizado." },
        { status: 401 }
      );
    }
    console.warn(
      "[sso/exchange] Usando Bearer legacy — migrar Pay para HMAC"
    );
  }

  let body: { code?: string };
  try {
    body = JSON.parse(rawBody || "{}") as { code?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido" },
      { status: 400 }
    );
  }

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

  logSecurityEvent("sso_code_exchanged", {
    forumUserId: result.payload.forumUserId,
    viaHmac: hmacAuth.ok,
  });

  return NextResponse.json({
    ok: true,
    user: result.payload,
  });
}

import { getAsaasServerConfig, NULLYSH_PAY_BRAND } from "@/lib/nullysh-pay/config";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Status público/admin-safe do gateway (sem expor a API key).
 */
export async function GET() {
  const cfg = getAsaasServerConfig();
  return NextResponse.json({
    ok: true,
    brand: NULLYSH_PAY_BRAND.name,
    processor: NULLYSH_PAY_BRAND.processor,
    configured: cfg.configured,
    sandbox: cfg.sandbox,
    apiKeyPresent: cfg.apiKeyPresent,
    apiKeyHint: cfg.apiKeyHint,
    message: cfg.configured
      ? "Nullysh Pay pronto (Asaas configurado no servidor)."
      : "Aguardando ASAAS_API_KEY no ambiente do Worker.",
  });
}

/**
 * Nullysh Pay — camada de marca sobre o Asaas.
 * Chaves NUNCA vão no client. Só server (Worker env / wrangler secrets).
 */

export const NULLYSH_PAY_BRAND = {
  name: "Nullysh Pay",
  processor: "Asaas",
  processorUrl: "https://www.asaas.com",
  docsUrl: "https://docs.asaas.com",
} as const;

/** Base URL da API Asaas (sandbox vs produção) */
export function asaasApiBase(sandbox: boolean) {
  return sandbox
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3";
}

/**
 * Lê config server-side (Cloudflare / Node).
 * Secrets:
 *  - ASAAS_API_KEY
 *  - ASAAS_SANDBOX = "true" | "1" (opcional)
 *  - ASAAS_WEBHOOK_TOKEN (opcional, validação futura)
 */
export function getAsaasServerConfig(): {
  configured: boolean;
  sandbox: boolean;
  apiKeyPresent: boolean;
  /** Nunca retornar a key completa ao client */
  apiKeyHint: string | null;
} {
  const key =
    (typeof process !== "undefined" &&
      (process.env.ASAAS_API_KEY || process.env.NULLYSH_PAY_ASAAS_KEY)?.trim()) ||
    "";
  const sandboxRaw =
    (typeof process !== "undefined" &&
      (process.env.ASAAS_SANDBOX || process.env.NULLYSH_PAY_SANDBOX)?.trim()) ||
    "";
  const sandbox =
    sandboxRaw === "1" ||
    sandboxRaw.toLowerCase() === "true" ||
    sandboxRaw.toLowerCase() === "yes";

  let apiKeyHint: string | null = null;
  if (key.length >= 8) {
    apiKeyHint = `${key.slice(0, 4)}…${key.slice(-4)}`;
  } else if (key.length > 0) {
    apiKeyHint = "••••";
  }

  return {
    configured: key.length >= 10,
    sandbox,
    apiKeyPresent: key.length > 0,
    apiKeyHint,
  };
}

export function getAsaasApiKey(): string | null {
  const key =
    (typeof process !== "undefined" &&
      (process.env.ASAAS_API_KEY || process.env.NULLYSH_PAY_ASAAS_KEY)?.trim()) ||
    "";
  return key.length >= 10 ? key : null;
}

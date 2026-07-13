/**
 * Nullysh Pay — ponte no Forum (marca + URL externa).
 * O gateway em si vive no app irmão; Asaas/secrets ficam lá.
 */

export const NULLYSH_PAY_BRAND = {
  name: "Nullysh Pay",
  processor: "Asaas",
  processorUrl: "https://www.asaas.com",
  docsUrl: "https://docs.asaas.com",
} as const;

/** URL canônica de produção (fallback — nunca localhost em prod) */
export const NULLYSH_PAY_DEFAULT_URL =
  "https://nullysh-pay.ngdigitalsuporte.workers.dev";

/** URL pública da plataforma externa (sem trailing slash) */
export function getNullyshPayUrl(): string {
  const raw =
    (typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_NULLYSH_PAY_URL?.trim()) ||
    (typeof process !== "undefined" && process.env.NULLYSH_PAY_URL?.trim()) ||
    "";
  return raw.replace(/\/+$/, "") || NULLYSH_PAY_DEFAULT_URL;
}

/** Secret compartilhado Forum ↔ Pay (server only) */
export function getNullyshPaySsoSecret(): string {
  return (
    (typeof process !== "undefined" &&
      process.env.NULLYSH_PAY_SSO_SECRET?.trim()) ||
    ""
  );
}

export const SSO_CODE_TTL_SEC = 300;
export const SSO_KV_PREFIX = "nullysh-pay:sso:";

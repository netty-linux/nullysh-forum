/**
 * Nullysh Pay — ponte no Forum (marca + URL externa).
 * O gateway em si vive no app irmão; Asaas/secrets ficam lá.
 *
 * Secrets (blast radius separado):
 * - NULLYSH_PAY_SSO_SECRET → só login unificado (issue/exchange de code)
 * - NULLYSH_MATRIX_HMAC_SECRET → checkout Matriz, fulfillment, catalog resolve,
 *   status de conta Forum→Pay
 */

export const NULLYSH_PAY_BRAND = {
  name: "Nullysh Pay",
  processor: "Asaas",
  processorUrl: "https://www.asaas.com",
  docsUrl: "https://docs.asaas.com",
} as const;

/** URL canônica de produção (fallback — nunca localhost em prod) */
export const NULLYSH_PAY_DEFAULT_URL = "https://pay.nullysh.com";

/** URL pública da plataforma externa (sem trailing slash) */
export function getNullyshPayUrl(): string {
  const raw =
    (typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_NULLYSH_PAY_URL?.trim()) ||
    (typeof process !== "undefined" && process.env.NULLYSH_PAY_URL?.trim()) ||
    "";
  return raw.replace(/\/+$/, "") || NULLYSH_PAY_DEFAULT_URL;
}

/**
 * Secret de SSO (login unificado Forum → Pay).
 * NÃO usar para HMAC de checkout/fulfillment.
 */
export function getNullyshPaySsoSecret(): string {
  return (
    (typeof process !== "undefined" &&
      process.env.NULLYSH_PAY_SSO_SECRET?.trim()) ||
    ""
  );
}

/**
 * Secret HMAC Matriz (APIs internas Forum ↔ Pay).
 * Fail-closed: sem fallback para SSO (blast radius separado).
 * FIX #5 — OWASP A02
 */
export function getMatrixHmacSecret(): string {
  const matrix =
    (typeof process !== "undefined" &&
      process.env.NULLYSH_MATRIX_HMAC_SECRET?.trim()) ||
    "";
  if (matrix.length >= 16) return matrix;
  return "";
}

export const SSO_CODE_TTL_SEC = 300;
export const SSO_KV_PREFIX = "nullysh-pay:sso:";

/** Janela de replay para HMAC (segundos) */
export const MATRIX_HMAC_MAX_SKEW_SEC = 300;

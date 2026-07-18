/**
 * Logging de eventos de segurança (OWASP A09).
 * Não incluir PII sensível (senha, tokens completos, etc.).
 */

export type SecurityEvent =
  | "admin_auth_failed"
  | "admin_auth_success"
  | "account_status_changed"
  | "vip_fulfillment"
  | "sso_code_issued"
  | "sso_code_exchanged"
  | "rate_limit_triggered"
  | "hmac_verification_failed"
  | "checkout_created";

export function logSecurityEvent(
  event: SecurityEvent,
  details: Record<string, unknown>
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ...details,
  };

  // Em produção: ideal Sentry / Logflare / Cloudflare Logpush
  if (process.env.NODE_ENV === "production") {
    // TODO: Integrar com Sentry ou Logflare
    console.error("[SECURITY]", JSON.stringify(logEntry));
  } else {
    console.warn("[SECURITY]", JSON.stringify(logEntry));
  }
}

/**
 * Rate limiting server-side via Cloudflare D1.
 * OWASP A04 — camada real (client sessionStorage é só UX).
 */

import { getNullpassDb } from "@/lib/nullpass/d1";

export type RateAction = "post" | "comment" | "sso";

const WINDOW_SEC = 60;
const LIMITS: Record<RateAction, number> = {
  post: 8,
  comment: 25,
  sso: 5,
};

export type ServerRateLimitResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      retryAfterSec: number;
      remaining: number;
    };

export async function checkServerRateLimit(
  userId: string,
  action: RateAction,
  opts?: { isVip?: boolean; isAdmin?: boolean }
): Promise<ServerRateLimitResult> {
  if (!userId) {
    return {
      ok: false,
      error: "Faça login para continuar.",
      retryAfterSec: 0,
      remaining: 0,
    };
  }
  if (opts?.isVip || opts?.isAdmin) return { ok: true };

  const db = await getNullpassDb();
  if (!db) {
    // Sem D1: fallback permissivo (não bloqueia)
    return { ok: true };
  }

  const now = Math.floor(Date.now() / 1000);
  // Bucket por minuto (alinha janela com PRIMARY KEY estável)
  const windowStart = Math.floor(now / WINDOW_SEC) * WINDOW_SEC;
  const limit = LIMITS[action];

  try {
    await db
      .prepare(
        `INSERT INTO rate_limits (action, user_id, window_start, count)
         VALUES (?, ?, ?, 1)
         ON CONFLICT (action, user_id, window_start)
         DO UPDATE SET count = count + 1`
      )
      .bind(action, userId, windowStart)
      .run();

    const result = await db
      .prepare(
        `SELECT count as total FROM rate_limits
         WHERE action = ? AND user_id = ? AND window_start = ?`
      )
      .bind(action, userId, windowStart)
      .first<{ total: number }>();

    const count = Number(result?.total ?? 0);
    if (count > limit) {
      const retryAfterSec = Math.max(1, windowStart + WINDOW_SEC - now);
      return {
        ok: false,
        error: `Muitas ações em pouco tempo. Aguarde ${retryAfterSec}s e tente novamente.`,
        retryAfterSec,
        remaining: 0,
      };
    }

    return { ok: true };
  } catch {
    // D1 indisponível ou tabela não existe: permissivo
    return { ok: true };
  }
}

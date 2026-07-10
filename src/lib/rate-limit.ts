/**
 * Anti-spam no cliente (MVP).
 * Free: limite por janela de 1 minuto.
 * VIP / Admin: bypass total.
 *
 * Limites bem abaixo de padrões de bot (ex.: 20 posts/min, 50 comentários/min).
 */

export type RateAction = "post" | "comment";

const WINDOW_MS = 60_000;

/** Free / member: tetos por minuto */
const FREE_LIMITS: Record<RateAction, number> = {
  post: 8,
  comment: 25,
};

type Bucket = number[]; // timestamps ms

function storageKey(userId: string, action: RateAction) {
  return `nullysh-rl-v1:${action}:${userId}`;
}

function readBucket(userId: string, action: RateAction): Bucket {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(storageKey(userId, action));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is number => typeof t === "number");
  } catch {
    return [];
  }
}

function writeBucket(userId: string, action: RateAction, bucket: Bucket) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(userId, action), JSON.stringify(bucket));
  } catch {
    /* ignore quota */
  }
}

function prune(bucket: Bucket, now: number): Bucket {
  return bucket.filter((t) => now - t < WINDOW_MS);
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; error: string; retryAfterSec: number; remaining: number };

/**
 * Consulta se a ação é permitida (sem registrar).
 */
export function peekRateLimit(
  userId: string,
  action: RateAction,
  opts?: { isVip?: boolean; isAdmin?: boolean }
): RateLimitResult {
  if (!userId) {
    return { ok: false, error: "Faça login para continuar.", retryAfterSec: 0, remaining: 0 };
  }
  if (opts?.isVip || opts?.isAdmin) {
    return { ok: true };
  }

  const now = Date.now();
  const bucket = prune(readBucket(userId, action), now);
  const limit = FREE_LIMITS[action];
  const remaining = Math.max(0, limit - bucket.length);

  if (bucket.length >= limit) {
    const oldest = Math.min(...bucket);
    const retryAfterSec = Math.max(
      1,
      Math.ceil((WINDOW_MS - (now - oldest)) / 1000)
    );
    const label =
      action === "post"
        ? "postagens"
        : "comentários";
    return {
      ok: false,
      error:
        `Muitas ${label} em pouco tempo. Aguarde ${retryAfterSec}s e tente de novo. ` +
        `Membros VIP não têm esse limite.`,
      retryAfterSec,
      remaining: 0,
    };
  }

  return { ok: true };
}

/**
 * Registra a ação se permitida; caso contrário devolve erro.
 */
export function consumeRateLimit(
  userId: string,
  action: RateAction,
  opts?: { isVip?: boolean; isAdmin?: boolean }
): RateLimitResult {
  const peek = peekRateLimit(userId, action, opts);
  if (!peek.ok) return peek;
  if (opts?.isVip || opts?.isAdmin) return { ok: true };

  const now = Date.now();
  const bucket = prune(readBucket(userId, action), now);
  bucket.push(now);
  writeBucket(userId, action, bucket);
  return { ok: true };
}

export function freeRateLimitLabel(action: RateAction): string {
  const n = FREE_LIMITS[action];
  return action === "post"
    ? `até ${n} posts por minuto (free)`
    : `até ${n} comentários por minuto (free)`;
}

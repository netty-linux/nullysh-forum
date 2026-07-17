/**
 * Auth HMAC Matriz (Forum ↔ Pay): Bearer + X-Nullysh-Timestamp + X-Nullysh-Signature.
 * Fail-closed: assinatura e timestamp obrigatórios.
 */

import {
  getMatrixHmacSecret,
  MATRIX_HMAC_MAX_SKEW_SEC,
} from "./config";

export async function hmacSha256Hex(
  secret: string,
  message: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require("crypto") as typeof import("crypto");
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) {
      nodeCrypto.timingSafeEqual(ba, ba);
      return false;
    }
    return nodeCrypto.timingSafeEqual(ba, bb);
  } catch {
    if (a.length !== b.length) return false;
    let out = 0;
    for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return out === 0;
  }
}

export type MatrixAuthFail = {
  ok: false;
  status: number;
  error: string;
};

export type MatrixAuthOk = { ok: true };

/**
 * Valida Bearer (secret Matriz) + HMAC obrigatório sobre `${ts}.${rawBody}`.
 */
export async function verifyMatrixRequest(
  req: Request,
  rawBody: string
): Promise<MatrixAuthOk | MatrixAuthFail> {
  const secret = getMatrixHmacSecret();
  if (secret.length < 16) {
    return {
      ok: false,
      status: 503,
      error: "NULLYSH_MATRIX_HMAC_SECRET não configurado no Forum.",
    };
  }

  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!bearer || !timingSafeEqualStr(bearer, secret)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const tsHeader = req.headers.get("x-nullysh-timestamp") || "";
  const sigHeader = (req.headers.get("x-nullysh-signature") || "").toLowerCase();

  if (!tsHeader || !sigHeader) {
    return {
      ok: false,
      status: 401,
      error: "HMAC obrigatório (X-Nullysh-Timestamp + X-Nullysh-Signature)",
    };
  }

  const ts = Number(tsHeader);
  if (
    !Number.isFinite(ts) ||
    Math.abs(Date.now() / 1000 - ts) > MATRIX_HMAC_MAX_SKEW_SEC
  ) {
    return { ok: false, status: 401, error: "Timestamp inválido" };
  }

  const expected = await hmacSha256Hex(secret, `${tsHeader}.${rawBody}`);
  if (!timingSafeEqualStr(expected, sigHeader)) {
    return { ok: false, status: 401, error: "Assinatura inválida" };
  }

  return { ok: true };
}

/** Headers assinados para o Forum chamar o Pay (ou outbound interno). */
export async function matrixSignedHeaders(
  rawBody: string
): Promise<
  | { ok: true; headers: Record<string, string> }
  | { ok: false; error: string }
> {
  const secret = getMatrixHmacSecret();
  if (secret.length < 16) {
    return {
      ok: false,
      error: "NULLYSH_MATRIX_HMAC_SECRET não configurado no Forum.",
    };
  }
  const ts = String(Math.floor(Date.now() / 1000));
  const signature = await hmacSha256Hex(secret, `${ts}.${rawBody}`);
  return {
    ok: true,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
      "X-Nullysh-Timestamp": ts,
      "X-Nullysh-Signature": signature,
    },
  };
}

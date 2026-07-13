/**
 * SSO one-time codes: Forum emite, Pay troca via exchange.
 * Produção: apenas Cloudflare KV (sem fallback memória).
 */

import { getDataKv } from "@/lib/videos/cloud-bindings";
import {
  getNullyshPaySsoSecret,
  SSO_CODE_TTL_SEC,
  SSO_KV_PREFIX,
} from "./config";

export type ForumSsoPayload = {
  forumUserId: string;
  email: string;
  name: string;
  username: string;
  exp: number;
};

type StoredCode = ForumSsoPayload & {
  used?: boolean;
};

function randomCode() {
  const a = crypto.randomUUID().replace(/-/g, "");
  const b = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${a}${b}`;
}

function isProd() {
  return process.env.NODE_ENV === "production";
}

async function requireKv() {
  const kv = await getDataKv();
  if (!kv) {
    if (isProd()) {
      throw new Error("KV indisponível para SSO (obrigatório em produção).");
    }
    return null;
  }
  return kv;
}

/** Memory só em dev sem KV */
const memory = new Map<string, StoredCode>();

async function putCode(code: string, value: StoredCode) {
  const key = `${SSO_KV_PREFIX}${code}`;
  const raw = JSON.stringify(value);
  const kv = await requireKv();
  if (kv) {
    await kv.put(key, raw, { expirationTtl: SSO_CODE_TTL_SEC });
    return;
  }
  memory.set(code, value);
  const t = setTimeout(() => memory.delete(code), SSO_CODE_TTL_SEC * 1000);
  if (typeof t === "object" && t && "unref" in t) {
    (t as NodeJS.Timeout).unref();
  }
}

async function takeCode(code: string): Promise<StoredCode | null> {
  const key = `${SSO_KV_PREFIX}${code}`;
  const kv = await requireKv();
  if (kv) {
    const raw = await kv.get(key);
    if (!raw) return null;
    // one-shot: delete before parse consume
    await kv.delete(key);
    try {
      return JSON.parse(raw) as StoredCode;
    } catch {
      return null;
    }
  }
  const stored = memory.get(code) ?? null;
  if (stored) memory.delete(code);
  return stored;
}

export async function issueSsoCode(
  payload: Omit<ForumSsoPayload, "exp">
): Promise<{ code: string; exp: number }> {
  const exp = Math.floor(Date.now() / 1000) + SSO_CODE_TTL_SEC;
  const code = randomCode();
  await putCode(code, { ...payload, exp, used: false });
  return { code, exp };
}

/**
 * Consome o code (one-shot).
 */
export async function exchangeSsoCode(
  code: string
): Promise<
  | { ok: true; payload: ForumSsoPayload }
  | { ok: false; error: string; status: number }
> {
  if (!code || code.length < 16) {
    return { ok: false, error: "Código inválido.", status: 400 };
  }
  let stored: StoredCode | null;
  try {
    stored = await takeCode(code);
  } catch {
    return {
      ok: false,
      error: "Serviço SSO temporariamente indisponível.",
      status: 503,
    };
  }
  if (!stored) {
    return { ok: false, error: "Código expirado ou inexistente.", status: 404 };
  }
  if (stored.used) {
    return { ok: false, error: "Código já utilizado.", status: 410 };
  }
  if (stored.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, error: "Código expirado.", status: 410 };
  }
  const { forumUserId, email, name, username, exp } = stored;
  return {
    ok: true,
    payload: { forumUserId, email, name, username, exp },
  };
}

function timingSafeEqualStr(a: string, b: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require("crypto") as typeof import("crypto");
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) {
      // constant-ish work
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

export function assertSsoSecret(header: string | null): boolean {
  const secret = getNullyshPaySsoSecret();
  if (!secret || secret.length < 16) {
    // fail closed — sem secret fraco em dev "dev"
    return false;
  }
  if (!header) return false;
  const token = header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : header.trim();
  return timingSafeEqualStr(token, secret);
}

/** Rate limit simples por userId via KV (max 10 codes / 60s) */
export async function checkSsoRateLimit(
  forumUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const kv = await getDataKv();
  if (!kv) return { ok: true }; // se sem KV em dev
  const key = `nullysh-pay:sso-rl:${forumUserId}`;
  const raw = await kv.get(key);
  const count = raw ? Number(raw) : 0;
  if (Number.isFinite(count) && count >= 10) {
    return {
      ok: false,
      error: "Muitas tentativas de acesso. Aguarde um minuto.",
    };
  }
  await kv.put(key, String((count || 0) + 1), { expirationTtl: 60 });
  return { ok: true };
}

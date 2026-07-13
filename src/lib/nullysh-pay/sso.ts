/**
 * SSO one-time codes: Forum emite, Pay troca via exchange.
 * Preferência: Cloudflare KV; fallback memória (dev).
 */

import { getDataKv } from "@/lib/videos/cloud-bindings";
import { getNullyshPaySsoSecret, SSO_CODE_TTL_SEC, SSO_KV_PREFIX } from "./config";

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

const memory = new Map<string, StoredCode>();

function randomCode() {
  const a = crypto.randomUUID().replace(/-/g, "");
  const b = Math.random().toString(36).slice(2, 10);
  return `${a}${b}`;
}

async function putCode(code: string, value: StoredCode) {
  const key = `${SSO_KV_PREFIX}${code}`;
  const raw = JSON.stringify(value);
  const kv = await getDataKv();
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

async function getCode(code: string): Promise<StoredCode | null> {
  const key = `${SSO_KV_PREFIX}${code}`;
  const kv = await getDataKv();
  if (kv) {
    const raw = await kv.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredCode;
    } catch {
      return null;
    }
  }
  return memory.get(code) ?? null;
}

async function deleteCode(code: string) {
  const key = `${SSO_KV_PREFIX}${code}`;
  const kv = await getDataKv();
  if (kv) {
    await kv.delete(key);
    return;
  }
  memory.delete(code);
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
 * Consome o code (one-shot). Requer Authorization: Bearer SSO_SECRET.
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
  const stored = await getCode(code);
  if (!stored) {
    return { ok: false, error: "Código expirado ou inexistente.", status: 404 };
  }
  if (stored.used) {
    return { ok: false, error: "Código já utilizado.", status: 410 };
  }
  if (stored.exp < Math.floor(Date.now() / 1000)) {
    await deleteCode(code);
    return { ok: false, error: "Código expirado.", status: 410 };
  }
  await deleteCode(code);
  const { forumUserId, email, name, username, exp } = stored;
  return {
    ok: true,
    payload: { forumUserId, email, name, username, exp },
  };
}

export function assertSsoSecret(header: string | null): boolean {
  const secret = getNullyshPaySsoSecret();
  if (!secret) {
    // Dev sem secret: aceita se NODE_ENV development e header "dev"
    if (process.env.NODE_ENV === "development" && header === "dev") return true;
    return false;
  }
  if (!header) return false;
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
  return token === secret;
}

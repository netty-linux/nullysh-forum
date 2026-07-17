/**
 * Notifica o Nullysh Pay quando account_status muda no Forum.
 * Protegido por NULLYSH_MATRIX_HMAC_SECRET + HMAC.
 */

import { getNullyshPayUrl } from "./config";
import { matrixSignedHeaders } from "./matrix-auth";

export async function notifyPayUserStatus(input: {
  forumUserId: string;
  status: "active" | "suspended" | "banned";
  reason?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const base = getNullyshPayUrl();
  const body = JSON.stringify({
    forumUserId: input.forumUserId,
    status: input.status,
    reason: input.reason || null,
    at: new Date().toISOString(),
  });

  const signed = await matrixSignedHeaders(body);
  if (!signed.ok) {
    console.warn("[notifyPayUserStatus]", signed.error);
    return { ok: false, error: signed.error };
  }

  try {
    const res = await fetch(`${base}/api/internal/forum-user-status`, {
      method: "POST",
      headers: signed.headers,
      body,
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha de rede",
    };
  }
}

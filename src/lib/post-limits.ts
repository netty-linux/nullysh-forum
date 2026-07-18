/**
 * Limites de postagem por plano.
 * Free: 200 chars · VIP / Admin: 1000 chars
 * Download de anexos de posts: exclusivo VIP / Admin
 *
 * FIX #11 — allowlist de domínios no download (SSRF / OWASP A10)
 */

export const MAX_POST_CHARS_FREE = 200;
export const MAX_POST_CHARS_VIP = 1000;

const ALLOWED_ATTACHMENT_DOMAINS = [
  "rijnjymmivsftkjnhnup.supabase.co",
  "nullysh.com",
  "pay.nullysh.com",
];

function isAllowedAttachmentUrl(url: string): boolean {
  if (url.startsWith("data:") || url.startsWith("blob:")) return true;
  try {
    const parsed = new URL(url);
    return ALLOWED_ATTACHMENT_DOMAINS.some(
      (d) => parsed.hostname === d || parsed.hostname.endsWith("." + d)
    );
  } catch {
    return false;
  }
}

export function maxPostChars(isVip: boolean): number {
  return isVip ? MAX_POST_CHARS_VIP : MAX_POST_CHARS_FREE;
}

export function canDownloadPostAttachments(isVip: boolean): boolean {
  return isVip;
}

/** Baixa anexo de post (data URL, blob ou http). */
export async function downloadPostAttachment(
  url: string,
  filename = "nullysh-anexo"
): Promise<void> {
  if (!url) throw new Error("Anexo indisponível.");

  if (!isAllowedAttachmentUrl(url)) {
    throw new Error("URL de anexo não permitida.");
  }

  // data: / blob: — download direto
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    const a = document.createElement("a");
    a.href = url;
    a.download = guessFilename(url, filename);
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  // http(s) — tenta blob (melhor nome/arquivo); fallback abre em nova aba
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("Falha no download");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = guessFilename(url, filename, blob.type);
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function guessFilename(
  url: string,
  base: string,
  mime?: string
): string {
  const fromMime =
    mime === "image/png"
      ? "png"
      : mime === "image/webp"
        ? "webp"
        : mime === "image/gif"
          ? "gif"
          : mime === "image/jpeg" || mime === "image/jpg"
            ? "jpg"
            : null;

  if (url.startsWith("data:image/")) {
    const m = /^data:image\/([a-z0-9+.-]+)/i.exec(url);
    const ext = (m?.[1] || "jpg").replace("jpeg", "jpg").split("+")[0];
    return `${base}.${ext}`;
  }

  try {
    const path = new URL(url, window.location.origin).pathname;
    const last = path.split("/").pop() || "";
    if (last.includes(".")) return last;
  } catch {
    /* ignore */
  }

  return `${base}.${fromMime || "jpg"}`;
}

/**
 * URLs de capa NullPass — R2 via proxy same-origin (preferido)
 * ou https externos; data: só legado.
 */

export const NULLPASS_COVER_PREFIX = "nullpass/covers";

/** Filename seguro: uuid.ext */
export function isSafeCoverFilename(name: string): boolean {
  return /^[a-zA-Z0-9_-]{8,64}\.(jpe?g|png|webp)$/i.test(name);
}

export function coverObjectKey(filename: string): string {
  return `${NULLPASS_COVER_PREFIX}/${filename}`;
}

/** Path público servido pelo Worker (same-origin em nullysh.com). */
export function coverPublicPath(filename: string): string {
  return `/api/nullpass/cover/${encodeURIComponent(filename)}`;
}

export function isAllowedCoverUrl(raw: string): boolean {
  const u = raw.trim();
  if (!u) return false;
  if (u.startsWith("data:image/")) return true;
  if (/^https?:\/\//i.test(u)) return true;
  if (u.startsWith("/api/nullpass/cover/")) return true;
  return false;
}

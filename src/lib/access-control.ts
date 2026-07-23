/**
 * Controles de acesso client-side (defesa em profundidade).
 * Nunca substituem checagens no servidor / RLS.
 */

import type { Material } from "@/lib/types";

/**
 * Remove URLs de download de materiais VIP para free.
 * O free não deve ver o link real no DOM / React props / Network do app.
 */
export function redactMaterialForViewer(
  material: Material,
  opts: { isVip: boolean; isAdmin?: boolean }
): Material {
  if (!material.vipOnly) return material;
  if (opts.isVip || opts.isAdmin) return material;
  return { ...material, url: null };
}

export function redactMaterialsForViewer(
  materials: Material[],
  opts: { isVip: boolean; isAdmin?: boolean }
): Material[] {
  return materials.map((m) => redactMaterialForViewer(m, opts));
}

/** True se o viewer pode acessar conteúdo VIP-only */
export function canAccessVipContent(opts: {
  isVip?: boolean;
  role?: string;
}): boolean {
  return !!opts.isVip || opts.role === "admin";
}

/**
 * Lista VIP de e-mails permitidos durante o período de desenvolvimento privado.
 */
export const ALLOWED_EMAILS = [
  "elevateiamedusax@gmail.com",
  "contatodilon7@gmail.com",
  "playandogamer150@gmail.com",
] as const;

export const DEVELOPMENT_BLOCKED_MESSAGE =
  "Estamos em Desenvolvimento. O Nullysh Forum está em acesso privado restrito no momento.";

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return ALLOWED_EMAILS.some((e) => e.toLowerCase() === normalized);
}

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

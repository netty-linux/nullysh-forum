/**
 * Validação/normalização compartilhada (client store + API D1).
 */

import {
  NULLPASS_GRADIENTS,
  monogramFromTitle,
  type NullpassBadge,
  type NullpassProduct,
  type NullpassProductKind,
} from "@/lib/nullpass-catalog";
import { isAllowedCoverUrl } from "./cover-url";

/** Capas data: legado no D1 — ~200KB. Preferir R2 (/api/nullpass/cover/…). */
export const NULLPASS_COVER_DATA_MAX = 200_000;

export type NullpassUpsertInput = {
  title: string;
  tagline: string;
  category: string;
  badge?: NullpassBadge;
  kind?: NullpassProductKind;
  bundleIds?: string[];
  orderBumpIds?: string[];
  isOrderBump?: boolean;
  posterGradient: string;
  coverUrl?: string | null;
  monogram?: string;
  description: string;
  price?: number | null;
  promoPrice?: number | null;
  promoActive?: boolean;
  priceLabel: string;
  priceHint?: string;
  features: string[];
  vipFulfillmentNote: string;
  active?: boolean;
  sortOrder?: number;
  isPinned?: boolean;
};

export function normalizeBadge(raw: unknown): NullpassBadge {
  if (raw === "novo" || raw === "custo-membro" || raw === "limitado") {
    return raw;
  }
  return null;
}

export function normalizeKind(raw: unknown): NullpassProductKind {
  return raw === "combo" ? "combo" : "single";
}

export function normalizeIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}

export function normalizeMoney(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, raw);
  }
  return null;
}

export function normalizeProduct(
  raw: Partial<NullpassProduct> & { id: string }
): NullpassProduct | null {
  if (!raw.id) return null;
  const title = (raw.title || "").trim();
  if (!title) return null;

  return {
    id: raw.id,
    title,
    tagline: (raw.tagline || "").trim(),
    category: (raw.category || "").trim() || "Outros",
    badge: normalizeBadge(raw.badge),
    kind: normalizeKind(raw.kind),
    bundleIds: normalizeIdList(raw.bundleIds),
    orderBumpIds: normalizeIdList(raw.orderBumpIds),
    isOrderBump: !!raw.isOrderBump,
    posterGradient:
      (raw.posterGradient || "").trim() || NULLPASS_GRADIENTS[0],
    coverUrl: raw.coverUrl?.trim() || null,
    monogram: (raw.monogram || "").trim() || monogramFromTitle(title),
    description: (raw.description || "").trim(),
    price: normalizeMoney(raw.price),
    promoPrice: normalizeMoney(raw.promoPrice),
    promoActive: !!raw.promoActive,
    priceLabel: (raw.priceLabel || "").trim() || "Custo membro",
    priceHint: raw.priceHint?.trim() || undefined,
    features: Array.isArray(raw.features)
      ? raw.features.map((f) => String(f).trim()).filter(Boolean)
      : [],
    vipFulfillmentNote: (raw.vipFulfillmentNote || "").trim(),
    active: raw.active !== false,
    sortOrder:
      typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder)
        ? raw.sortOrder
        : 100,
    isPinned: !!raw.isPinned,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
  };
}

/**
 * @param strictCoverLimit true = API D1 (200KB data URL); false = store local legado
 */
export function validateNullpassInput(
  input: NullpassUpsertInput,
  selfId?: string,
  opts?: { strictCoverLimit?: boolean }
): { ok: true } | { ok: false; error: string } {
  const title = input.title.trim();
  if (title.length < 2) {
    return { ok: false, error: "Título deve ter pelo menos 2 caracteres." };
  }
  if (title.length > 80) {
    return { ok: false, error: "Título muito longo (máx. 80)." };
  }
  if (input.description.trim().length < 8) {
    return { ok: false, error: "Descrição deve ter pelo menos 8 caracteres." };
  }
  if (!input.category.trim()) {
    return { ok: false, error: "Informe a categoria." };
  }
  if (
    input.price != null &&
    (!Number.isFinite(input.price) || input.price < 0)
  ) {
    return { ok: false, error: "Preço inválido." };
  }
  if (
    input.promoPrice != null &&
    (!Number.isFinite(input.promoPrice) || input.promoPrice < 0)
  ) {
    return { ok: false, error: "Preço promocional inválido." };
  }
  if (
    input.promoActive &&
    input.promoPrice != null &&
    input.price != null &&
    input.promoPrice > input.price
  ) {
    return {
      ok: false,
      error: "Preço promocional deve ser menor ou igual ao preço cheio.",
    };
  }
  if (input.kind === "combo") {
    const ids = (input.bundleIds || []).filter((id) => id !== selfId);
    if (ids.length < 2) {
      return {
        ok: false,
        error: "Combo precisa de pelo menos 2 produtos inclusos.",
      };
    }
  }
  if (input.coverUrl) {
    const u = input.coverUrl.trim();
    if (!isAllowedCoverUrl(u)) {
      return {
        ok: false,
        error:
          "Capa deve ser upload R2 (/api/nullpass/cover/…), URL https, ou data URL legada.",
      };
    }
    // Novas capas: preferir R2. Data URL ainda aceita (legado) com teto.
    const max = opts?.strictCoverLimit
      ? NULLPASS_COVER_DATA_MAX
      : 1_600_000;
    if (u.startsWith("data:") && u.length > max) {
      return {
        ok: false,
        error: opts?.strictCoverLimit
          ? "Capa em Base64 muito grande. Use «Enviar capa» (R2) em vez de data URL."
          : "Imagem da capa muito grande. Comprima.",
      };
    }
  }
  return { ok: true };
}

export function inputToProduct(
  id: string,
  input: NullpassUpsertInput,
  prev?: NullpassProduct
): NullpassProduct | null {
  const now = new Date().toISOString();
  return normalizeProduct({
    id,
    title: input.title,
    tagline: input.tagline,
    category: input.category,
    badge: input.badge ?? null,
    kind: input.kind || "single",
    bundleIds: (input.bundleIds || []).filter((x) => x !== id),
    orderBumpIds: (input.orderBumpIds || []).filter((x) => x !== id),
    isOrderBump: !!input.isOrderBump,
    posterGradient: input.posterGradient,
    coverUrl: input.coverUrl ?? null,
    monogram: input.monogram || monogramFromTitle(input.title),
    description: input.description,
    price: input.price ?? null,
    promoPrice: input.promoPrice ?? null,
    promoActive: !!input.promoActive,
    priceLabel: input.priceLabel,
    priceHint: input.priceHint,
    features: input.features,
    vipFulfillmentNote: input.vipFulfillmentNote,
    active: input.active !== false,
    sortOrder: input.sortOrder ?? prev?.sortOrder ?? 100,
    isPinned:
      input.isPinned !== undefined ? !!input.isPinned : !!prev?.isPinned,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  });
}

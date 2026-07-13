"use client";

/**
 * Catálogo NullPass editável pelo admin (persist local).
 * Seed = NULLPASS_SEED na primeira hidratação se a lista estiver vazia.
 */

import {
  NULLPASS_GRADIENTS,
  NULLPASS_SEED,
  monogramFromTitle,
  type NullpassBadge,
  type NullpassProduct,
  type NullpassProductKind,
} from "./nullpass-catalog";
import { uid } from "./utils";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const STORAGE_VERSION = 2;

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
};

function normalizeBadge(raw: unknown): NullpassBadge {
  if (raw === "novo" || raw === "custo-membro" || raw === "limitado") {
    return raw;
  }
  return null;
}

function normalizeKind(raw: unknown): NullpassProductKind {
  return raw === "combo" ? "combo" : "single";
}

function normalizeIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}

function normalizeMoney(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, raw);
  }
  return null;
}

function normalizeProduct(
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
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
  };
}

interface NullpassState {
  products: NullpassProduct[];
  seeded: boolean;
  ensureSeed: () => void;
  listPublic: () => NullpassProduct[];
  listAll: () => NullpassProduct[];
  getById: (id: string) => NullpassProduct | undefined;
  createProduct: (
    input: NullpassUpsertInput
  ) => { ok: true; product: NullpassProduct } | { ok: false; error: string };
  updateProduct: (
    id: string,
    input: NullpassUpsertInput
  ) => { ok: true; product: NullpassProduct } | { ok: false; error: string };
  deleteProduct: (id: string) => { ok: true } | { ok: false; error: string };
  resetToSeed: () => void;
}

function validateInput(
  input: NullpassUpsertInput,
  selfId?: string
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
    if (!u.startsWith("data:image/") && !/^https?:\/\//i.test(u)) {
      return {
        ok: false,
        error: "Capa deve ser URL https ou imagem enviada.",
      };
    }
    if (u.startsWith("data:") && u.length > 1_600_000) {
      return { ok: false, error: "Imagem da capa muito grande. Comprima." };
    }
  }
  return { ok: true };
}

function toProduct(
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
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  });
}

export const useNullpassStore = create<NullpassState>()(
  persist(
    (set, get) => ({
      products: [],
      seeded: false,

      ensureSeed: () => {
        const { products, seeded } = get();
        if (seeded && products.length > 0) return;
        if (products.length > 0) {
          set({ seeded: true });
          return;
        }
        const seed = NULLPASS_SEED.map((p) =>
          normalizeProduct({
            ...p,
            kind: "single",
            bundleIds: [],
            orderBumpIds: [],
            isOrderBump: false,
            promoPrice: null,
            promoActive: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        ).filter(Boolean) as NullpassProduct[];
        set({ products: seed, seeded: true });
      },

      listPublic: () =>
        get()
          .products.filter((p) => p.active !== false)
          .slice()
          .sort(
            (a, b) =>
              (a.sortOrder ?? 100) - (b.sortOrder ?? 100) ||
              a.title.localeCompare(b.title, "pt-BR")
          ),

      listAll: () =>
        get()
          .products.slice()
          .sort(
            (a, b) =>
              (a.sortOrder ?? 100) - (b.sortOrder ?? 100) ||
              a.title.localeCompare(b.title, "pt-BR")
          ),

      getById: (id) => get().products.find((p) => p.id === id),

      createProduct: (input) => {
        const v = validateInput(input);
        if (!v.ok) return v;
        const product = toProduct(uid("np"), input);
        if (!product) {
          return { ok: false, error: "Não foi possível criar o produto." };
        }
        set((s) => ({ products: [...s.products, product], seeded: true }));
        return { ok: true, product };
      },

      updateProduct: (id, input) => {
        const v = validateInput(input, id);
        if (!v.ok) return v;
        const prev = get().products.find((p) => p.id === id);
        if (!prev) return { ok: false, error: "Produto não encontrado." };
        const product = toProduct(id, input, prev);
        if (!product) {
          return { ok: false, error: "Dados inválidos." };
        }
        set((s) => ({
          products: s.products.map((p) => (p.id === id ? product : p)),
        }));
        return { ok: true, product };
      },

      deleteProduct: (id) => {
        if (!get().products.some((p) => p.id === id)) {
          return { ok: false, error: "Produto não encontrado." };
        }
        // limpa referências em combos/bumps
        set((s) => ({
          products: s.products
            .filter((p) => p.id !== id)
            .map((p) => ({
              ...p,
              bundleIds: (p.bundleIds || []).filter((x) => x !== id),
              orderBumpIds: (p.orderBumpIds || []).filter((x) => x !== id),
            })),
        }));
        return { ok: true };
      },

      resetToSeed: () => {
        const seed = NULLPASS_SEED.map((p) =>
          normalizeProduct({
            ...p,
            kind: "single",
            bundleIds: [],
            orderBumpIds: [],
            isOrderBump: false,
            promoPrice: null,
            promoActive: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        ).filter(Boolean) as NullpassProduct[];
        set({ products: seed, seeded: true });
      },
    }),
    {
      name: "nullysh-nullpass-v1",
      version: STORAGE_VERSION,
      migrate: (persisted) => {
        const p = persisted as {
          products?: Partial<NullpassProduct>[];
          seeded?: boolean;
        } | null;
        if (!p) return { products: [], seeded: false };
        const products = (p.products || [])
          .map((raw) =>
            raw?.id
              ? normalizeProduct(raw as Partial<NullpassProduct> & { id: string })
              : null
          )
          .filter(Boolean) as NullpassProduct[];
        return { products, seeded: !!p.seeded };
      },
      partialize: (s) => ({
        products: s.products,
        seeded: s.seeded,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && (!state.products || state.products.length === 0)) {
          state.ensureSeed();
        }
      },
    }
  )
);

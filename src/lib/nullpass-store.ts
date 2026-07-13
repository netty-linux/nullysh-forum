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
} from "./nullpass-catalog";
import { uid } from "./utils";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const STORAGE_VERSION = 1;

export type NullpassUpsertInput = {
  title: string;
  tagline: string;
  category: string;
  badge?: NullpassBadge;
  posterGradient: string;
  coverUrl?: string | null;
  monogram?: string;
  description: string;
  price?: number | null;
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

function normalizeProduct(
  raw: Partial<NullpassProduct> & { id: string }
): NullpassProduct | null {
  if (!raw.id) return null;
  const title = (raw.title || "").trim();
  if (!title) return null;
  const price =
    typeof raw.price === "number" && Number.isFinite(raw.price)
      ? Math.max(0, raw.price)
      : raw.price === null
        ? null
        : null;

  return {
    id: raw.id,
    title,
    tagline: (raw.tagline || "").trim(),
    category: (raw.category || "").trim() || "Outros",
    badge: normalizeBadge(raw.badge),
    posterGradient:
      (raw.posterGradient || "").trim() || NULLPASS_GRADIENTS[0],
    coverUrl: raw.coverUrl?.trim() || null,
    monogram:
      (raw.monogram || "").trim() || monogramFromTitle(title),
    description: (raw.description || "").trim(),
    price,
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
  input: NullpassUpsertInput
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
  if (input.coverUrl) {
    const u = input.coverUrl.trim();
    if (
      !u.startsWith("data:image/") &&
      !/^https?:\/\//i.test(u)
    ) {
      return {
        ok: false,
        error: "Capa deve ser URL https ou imagem enviada.",
      };
    }
    // limita data URL (~1.2MB chars ~)
    if (u.startsWith("data:") && u.length > 1_600_000) {
      return { ok: false, error: "Imagem da capa muito grande. Comprima." };
    }
  }
  return { ok: true };
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
        const now = new Date().toISOString();
        const product = normalizeProduct({
          id: uid("np"),
          title: input.title,
          tagline: input.tagline,
          category: input.category,
          badge: input.badge ?? null,
          posterGradient: input.posterGradient,
          coverUrl: input.coverUrl ?? null,
          monogram: input.monogram || monogramFromTitle(input.title),
          description: input.description,
          price: input.price ?? null,
          priceLabel: input.priceLabel,
          priceHint: input.priceHint,
          features: input.features,
          vipFulfillmentNote: input.vipFulfillmentNote,
          active: input.active !== false,
          sortOrder: input.sortOrder ?? 100,
          createdAt: now,
          updatedAt: now,
        });
        if (!product) {
          return { ok: false, error: "Não foi possível criar o produto." };
        }
        set((s) => ({ products: [...s.products, product], seeded: true }));
        return { ok: true, product };
      },

      updateProduct: (id, input) => {
        const v = validateInput(input);
        if (!v.ok) return v;
        const prev = get().products.find((p) => p.id === id);
        if (!prev) return { ok: false, error: "Produto não encontrado." };
        const product = normalizeProduct({
          ...prev,
          title: input.title,
          tagline: input.tagline,
          category: input.category,
          badge: input.badge ?? null,
          posterGradient: input.posterGradient,
          coverUrl: input.coverUrl ?? null,
          monogram: input.monogram || monogramFromTitle(input.title),
          description: input.description,
          price: input.price ?? null,
          priceLabel: input.priceLabel,
          priceHint: input.priceHint,
          features: input.features,
          vipFulfillmentNote: input.vipFulfillmentNote,
          active: input.active !== false,
          sortOrder: input.sortOrder ?? prev.sortOrder ?? 100,
          updatedAt: new Date().toISOString(),
        });
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
        set((s) => ({
          products: s.products.filter((p) => p.id !== id),
        }));
        return { ok: true };
      },

      resetToSeed: () => {
        const seed = NULLPASS_SEED.map((p) =>
          normalizeProduct({
            ...p,
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
      partialize: (s) => ({
        products: s.products,
        seeded: s.seeded,
      }),
      onRehydrateStorage: () => (state) => {
        // Se store vazio após rehydrate, seed
        if (state && (!state.products || state.products.length === 0)) {
          state.ensureSeed();
        }
      },
    }
  )
);

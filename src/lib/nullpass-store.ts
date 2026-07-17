"use client";

/**
 * Catálogo NullPass — cache de UI + fallback local.
 *
 * Produção: fonte da verdade = D1 via /api/nullpass*.
 * Dev sem D1 (503): seed/localStorage (comportamento Fase A).
 */

import {
  NULLPASS_SEED,
  compareNullpassProducts,
  type NullpassProduct,
} from "./nullpass-catalog";
import {
  apiCreateNullpass,
  apiDeleteNullpass,
  apiResetNullpassSeed,
  apiUpdateNullpass,
  fetchNullpassAdmin,
  fetchNullpassPublic,
} from "./nullpass/client";
import {
  inputToProduct,
  normalizeProduct,
  validateNullpassInput,
  type NullpassUpsertInput,
} from "./nullpass/validate";
import { uid } from "./utils";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type { NullpassUpsertInput };

/** v4: source D1; products local só como fallback offline/dev */
const STORAGE_VERSION = 4;

export type NullpassSource = "d1" | "local" | "unknown";

function buildSeedProducts(): NullpassProduct[] {
  const now = new Date().toISOString();
  return NULLPASS_SEED.map((p) =>
    normalizeProduct({
      ...p,
      kind: "single",
      bundleIds: [],
      orderBumpIds: [],
      isOrderBump: false,
      promoPrice: null,
      promoActive: false,
      createdAt: now,
      updatedAt: now,
    })
  ).filter(Boolean) as NullpassProduct[];
}

interface NullpassState {
  products: NullpassProduct[];
  seeded: boolean;
  hasHydrated: boolean;
  source: NullpassSource;
  /** última mensagem de erro de rede/API (UI admin) */
  lastError: string | null;
  setHasHydrated: (v: boolean) => void;
  ensureSeed: () => void;
  /** Carrega vitrine pública (D1 → fallback local) */
  loadPublic: () => Promise<void>;
  /** Carrega lista admin completa */
  loadAdmin: () => Promise<void>;
  listPublic: () => NullpassProduct[];
  listAll: () => NullpassProduct[];
  getById: (id: string) => NullpassProduct | undefined;
  createProduct: (
    input: NullpassUpsertInput
  ) => Promise<
    { ok: true; product: NullpassProduct } | { ok: false; error: string }
  >;
  updateProduct: (
    id: string,
    input: NullpassUpsertInput
  ) => Promise<
    { ok: true; product: NullpassProduct } | { ok: false; error: string }
  >;
  deleteProduct: (
    id: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  resetToSeed: () => Promise<{ ok: true } | { ok: false; error: string }>;
}

function localCreate(
  products: NullpassProduct[],
  input: NullpassUpsertInput
):
  | { ok: true; product: NullpassProduct; products: NullpassProduct[] }
  | { ok: false; error: string } {
  const v = validateNullpassInput(input);
  if (!v.ok) return v;
  const product = inputToProduct(uid("np"), input);
  if (!product) return { ok: false, error: "Não foi possível criar o produto." };
  return { ok: true, product, products: [...products, product] };
}

function localUpdate(
  products: NullpassProduct[],
  id: string,
  input: NullpassUpsertInput
):
  | { ok: true; product: NullpassProduct; products: NullpassProduct[] }
  | { ok: false; error: string } {
  const v = validateNullpassInput(input, id);
  if (!v.ok) return v;
  const prev = products.find((p) => p.id === id);
  if (!prev) return { ok: false, error: "Produto não encontrado." };
  const product = inputToProduct(id, input, prev);
  if (!product) return { ok: false, error: "Dados inválidos." };
  return {
    ok: true,
    product,
    products: products.map((p) => (p.id === id ? product : p)),
  };
}

export const useNullpassStore = create<NullpassState>()(
  persist(
    (set, get) => ({
      products: [],
      seeded: false,
      hasHydrated: false,
      source: "unknown",
      lastError: null,

      setHasHydrated: (v) => set({ hasHydrated: v }),

      ensureSeed: () => {
        const { products, seeded, source } = get();
        if (source === "d1") return;
        if (seeded && products.length > 0) return;
        if (products.length > 0) {
          set({ seeded: true });
          return;
        }
        set({
          products: buildSeedProducts(),
          seeded: true,
          source: "local",
        });
      },

      loadPublic: async () => {
        const res = await fetchNullpassPublic();
        if (res.ok && Array.isArray(res.products)) {
          set({
            products: res.products,
            seeded: true,
            source: "d1",
            hasHydrated: true,
            lastError: null,
          });
          return;
        }
        // Fallback local (dev / D1 down)
        const { products } = get();
        if (products.length === 0) {
          set({
            products: buildSeedProducts(),
            seeded: true,
            source: "local",
            hasHydrated: true,
            lastError: res.error || res.code || "API indisponível",
          });
        } else {
          set({
            source: "local",
            hasHydrated: true,
            lastError: res.error || res.code || "API indisponível",
          });
        }
      },

      loadAdmin: async () => {
        const res = await fetchNullpassAdmin();
        if (res.ok && Array.isArray(res.products)) {
          set({
            products: res.products,
            seeded: true,
            source: "d1",
            hasHydrated: true,
            lastError: null,
          });
          return;
        }
        // 401/403 → não sobrescreve com seed falso se já tem d1 em memória
        if (res.code === "d1_unavailable" || res.error?.includes("D1")) {
          get().ensureSeed();
          set({
            source: "local",
            hasHydrated: true,
            lastError:
              res.error ||
              "D1 indisponível — editando só neste navegador (dev).",
          });
          return;
        }
        set({
          hasHydrated: true,
          lastError: res.error || "Falha ao carregar catálogo admin",
        });
        // se vazio e erro de rede, seed local
        if (get().products.length === 0) {
          get().ensureSeed();
          set({ source: "local" });
        }
      },

      listPublic: () =>
        get()
          .products.filter((p) => p.active !== false)
          .slice()
          .sort(compareNullpassProducts),

      listAll: () => get().products.slice().sort(compareNullpassProducts),

      getById: (id) => get().products.find((p) => p.id === id),

      createProduct: async (input) => {
        if (get().source === "d1") {
          const res = await apiCreateNullpass(input);
          if (!res.ok || !res.product) {
            return { ok: false, error: res.error || "Falha ao criar." };
          }
          set((s) => ({
            products: [...s.products, res.product!],
            lastError: null,
          }));
          return { ok: true, product: res.product };
        }
        const local = localCreate(get().products, input);
        if (!local.ok) return local;
        set({ products: local.products, seeded: true, source: "local" });
        return { ok: true, product: local.product };
      },

      updateProduct: async (id, input) => {
        if (get().source === "d1") {
          const res = await apiUpdateNullpass(id, input);
          if (!res.ok || !res.product) {
            return { ok: false, error: res.error || "Falha ao atualizar." };
          }
          set((s) => ({
            products: s.products.map((p) =>
              p.id === id ? res.product! : p
            ),
            lastError: null,
          }));
          return { ok: true, product: res.product };
        }
        const local = localUpdate(get().products, id, input);
        if (!local.ok) return local;
        set({ products: local.products });
        return { ok: true, product: local.product };
      },

      deleteProduct: async (id) => {
        if (get().source === "d1") {
          const res = await apiDeleteNullpass(id);
          if (!res.ok) {
            return { ok: false, error: res.error || "Falha ao remover." };
          }
          set((s) => ({
            products: s.products
              .filter((p) => p.id !== id)
              .map((p) => ({
                ...p,
                bundleIds: (p.bundleIds || []).filter((x) => x !== id),
                orderBumpIds: (p.orderBumpIds || []).filter((x) => x !== id),
              })),
            lastError: null,
          }));
          return { ok: true };
        }
        if (!get().products.some((p) => p.id === id)) {
          return { ok: false, error: "Produto não encontrado." };
        }
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

      resetToSeed: async () => {
        if (get().source === "d1") {
          const res = await apiResetNullpassSeed();
          if (!res.ok) {
            return { ok: false, error: res.error || "Falha ao restaurar seed." };
          }
          await get().loadAdmin();
          return { ok: true };
        }
        set({
          products: buildSeedProducts(),
          seeded: true,
          source: "local",
        });
        return { ok: true };
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
              ? normalizeProduct(
                  raw as Partial<NullpassProduct> & { id: string }
                )
              : null
          )
          .filter(Boolean) as NullpassProduct[];
        return { products, seeded: !!p.seeded };
      },
      partialize: (s) => ({
        // Cache local só útil no fallback; D1 é a verdade em prod
        products: s.source === "d1" ? [] : s.products,
        seeded: s.seeded,
      }),
      onRehydrateStorage: () => (state) => {
        // hasHydrated final vem de loadPublic/loadAdmin
        if (state && state.products?.length === 0) {
          // não seedar ainda — espera loadPublic
        }
      },
    }
  )
);

"use client";

/**
 * Catálogo e vendas Nullysh Pay por usuário (local persist).
 * Quando Asaas estiver com API key, cobranças reais entram via API server.
 */

import { uid } from "@/lib/utils";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  NullyshPayOffer,
  NullyshPayOfferStatus,
  NullyshPayProduct,
  NullyshPayProductStatus,
  NullyshPayProductType,
  NullyshPaySale,
  NullyshPaySaleStatus,
} from "./types";

const STORAGE_VERSION = 1;

export type ProductInput = {
  title: string;
  description: string;
  type: NullyshPayProductType;
  price: number;
  promoPrice?: number | null;
  promoActive?: boolean;
  coverUrl?: string | null;
  deliveryUrl?: string | null;
  status: NullyshPayProductStatus;
};

export type OfferInput = {
  productId: string;
  name: string;
  headline: string;
  price: number;
  promoPrice?: number | null;
  promoActive?: boolean;
  status: NullyshPayOfferStatus;
};

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function money(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.round(v * 100) / 100;
}

interface MerchantState {
  products: NullyshPayProduct[];
  offers: NullyshPayOffer[];
  sales: NullyshPaySale[];
  productsOf: (ownerId: string) => NullyshPayProduct[];
  offersOf: (ownerId: string) => NullyshPayOffer[];
  salesOf: (ownerId: string) => NullyshPaySale[];
  createProduct: (
    ownerId: string,
    input: ProductInput
  ) => { ok: true; product: NullyshPayProduct } | { ok: false; error: string };
  updateProduct: (
    ownerId: string,
    id: string,
    input: ProductInput
  ) => { ok: true; product: NullyshPayProduct } | { ok: false; error: string };
  deleteProduct: (
    ownerId: string,
    id: string
  ) => { ok: true } | { ok: false; error: string };
  createOffer: (
    ownerId: string,
    input: OfferInput
  ) => { ok: true; offer: NullyshPayOffer } | { ok: false; error: string };
  updateOffer: (
    ownerId: string,
    id: string,
    input: OfferInput
  ) => { ok: true; offer: NullyshPayOffer } | { ok: false; error: string };
  deleteOffer: (
    ownerId: string,
    id: string
  ) => { ok: true } | { ok: false; error: string };
  /** Venda de demonstração (até Asaas gerar real) */
  addDemoSale: (
    ownerId: string,
    productId: string,
    amount: number
  ) => { ok: true; sale: NullyshPaySale } | { ok: false; error: string };
}

function validateProduct(
  input: ProductInput
): { ok: true } | { ok: false; error: string } {
  if (input.title.trim().length < 2) {
    return { ok: false, error: "Título muito curto." };
  }
  if (input.price < 0 || !Number.isFinite(input.price)) {
    return { ok: false, error: "Preço inválido." };
  }
  if (
    input.promoActive &&
    input.promoPrice != null &&
    input.promoPrice > input.price
  ) {
    return {
      ok: false,
      error: "Preço promo deve ser ≤ preço cheio.",
    };
  }
  return { ok: true };
}

export const useNullyshPayMerchantStore = create<MerchantState>()(
  persist(
    (set, get) => ({
      products: [],
      offers: [],
      sales: [],

      productsOf: (ownerId) =>
        get()
          .products.filter((p) => p.ownerId === ownerId)
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          ),

      offersOf: (ownerId) =>
        get()
          .offers.filter((o) => o.ownerId === ownerId)
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          ),

      salesOf: (ownerId) =>
        get()
          .sales.filter((s) => s.ownerId === ownerId)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ),

      createProduct: (ownerId, input) => {
        const v = validateProduct(input);
        if (!v.ok) return v;
        const now = new Date().toISOString();
        const product: NullyshPayProduct = {
          id: uid("npp"),
          ownerId,
          title: input.title.trim(),
          description: input.description.trim(),
          type: input.type,
          price: money(input.price),
          promoPrice:
            input.promoPrice != null ? money(input.promoPrice) : null,
          promoActive: !!input.promoActive,
          coverUrl: input.coverUrl || null,
          deliveryUrl: input.deliveryUrl?.trim() || null,
          status: input.status,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ products: [product, ...s.products] }));
        return { ok: true, product };
      },

      updateProduct: (ownerId, id, input) => {
        const v = validateProduct(input);
        if (!v.ok) return v;
        const prev = get().products.find(
          (p) => p.id === id && p.ownerId === ownerId
        );
        if (!prev) return { ok: false, error: "Produto não encontrado." };
        const product: NullyshPayProduct = {
          ...prev,
          title: input.title.trim(),
          description: input.description.trim(),
          type: input.type,
          price: money(input.price),
          promoPrice:
            input.promoPrice != null ? money(input.promoPrice) : null,
          promoActive: !!input.promoActive,
          coverUrl: input.coverUrl || null,
          deliveryUrl: input.deliveryUrl?.trim() || null,
          status: input.status,
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({
          products: s.products.map((p) => (p.id === id ? product : p)),
        }));
        return { ok: true, product };
      },

      deleteProduct: (ownerId, id) => {
        const prev = get().products.find(
          (p) => p.id === id && p.ownerId === ownerId
        );
        if (!prev) return { ok: false, error: "Produto não encontrado." };
        set((s) => ({
          products: s.products.filter((p) => p.id !== id),
          offers: s.offers.filter((o) => o.productId !== id),
        }));
        return { ok: true };
      },

      createOffer: (ownerId, input) => {
        const product = get().products.find(
          (p) => p.id === input.productId && p.ownerId === ownerId
        );
        if (!product) {
          return { ok: false, error: "Produto da oferta não encontrado." };
        }
        if (input.name.trim().length < 2) {
          return { ok: false, error: "Nome da oferta muito curto." };
        }
        const now = new Date().toISOString();
        const offer: NullyshPayOffer = {
          id: uid("npo"),
          ownerId,
          productId: input.productId,
          name: input.name.trim(),
          headline: input.headline.trim(),
          price: money(input.price),
          promoPrice:
            input.promoPrice != null ? money(input.promoPrice) : null,
          promoActive: !!input.promoActive,
          checkoutSlug: `${slugify(input.name) || "oferta"}-${uid("").slice(-6)}`,
          status: input.status,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ offers: [offer, ...s.offers] }));
        return { ok: true, offer };
      },

      updateOffer: (ownerId, id, input) => {
        const prev = get().offers.find(
          (o) => o.id === id && o.ownerId === ownerId
        );
        if (!prev) return { ok: false, error: "Oferta não encontrada." };
        const product = get().products.find(
          (p) => p.id === input.productId && p.ownerId === ownerId
        );
        if (!product) {
          return { ok: false, error: "Produto da oferta não encontrado." };
        }
        const offer: NullyshPayOffer = {
          ...prev,
          productId: input.productId,
          name: input.name.trim(),
          headline: input.headline.trim(),
          price: money(input.price),
          promoPrice:
            input.promoPrice != null ? money(input.promoPrice) : null,
          promoActive: !!input.promoActive,
          status: input.status,
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({
          offers: s.offers.map((o) => (o.id === id ? offer : o)),
        }));
        return { ok: true, offer };
      },

      deleteOffer: (ownerId, id) => {
        if (!get().offers.some((o) => o.id === id && o.ownerId === ownerId)) {
          return { ok: false, error: "Oferta não encontrada." };
        }
        set((s) => ({ offers: s.offers.filter((o) => o.id !== id) }));
        return { ok: true };
      },

      addDemoSale: (ownerId, productId, amount) => {
        const product = get().products.find(
          (p) => p.id === productId && p.ownerId === ownerId
        );
        if (!product) {
          return { ok: false, error: "Produto não encontrado." };
        }
        const now = new Date().toISOString();
        const sale: NullyshPaySale = {
          id: uid("nps"),
          ownerId,
          productId,
          offerId: null,
          buyerName: "Cliente demo",
          buyerEmail: "demo@nullysh.local",
          amount: money(amount),
          status: "paid" as NullyshPaySaleStatus,
          externalId: null,
          createdAt: now,
          paidAt: now,
        };
        set((s) => ({ sales: [sale, ...s.sales] }));
        return { ok: true, sale };
      },
    }),
    {
      name: "nullysh-pay-merchant-v1",
      version: STORAGE_VERSION,
      partialize: (s) => ({
        products: s.products,
        offers: s.offers,
        sales: s.sales,
      }),
    }
  )
);

export function formatPayBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

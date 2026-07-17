/**
 * Resolve productKey nullpass_* → produto D1 + preço em centavos.
 */

import {
  effectiveNullpassPrice,
  type NullpassProduct,
} from "@/lib/nullpass-catalog";
import type { NullpassD1 } from "./d1";
import { getProductById, listAllProducts } from "./repository";
import { productIdFromNullpassKey } from "./entitlements";

export type ResolvedNullpassProduct = {
  productKey: string;
  productId: string;
  kind: "nullpass";
  title: string;
  amountCents: number;
  active: boolean;
  description?: string;
};

/** Aliases legados usados no static catalog do Pay */
const LEGACY_KEY_TO_ID: Record<string, string> = {
  nullpass_canva_pro: "canva-pro",
  nullpass_supergrok: "supergrok",
  nullpass_email_temp: "email-temp",
};

function candidateIds(productKey: string): string[] {
  const key = productKey.trim().toLowerCase();
  const ids: string[] = [];

  if (LEGACY_KEY_TO_ID[key]) ids.push(LEGACY_KEY_TO_ID[key]);

  const rest = productIdFromNullpassKey(productKey);
  if (rest) {
    ids.push(rest);
    if (rest.includes("_")) ids.push(rest.replace(/_/g, "-"));
    if (rest.includes("-")) ids.push(rest.replace(/-/g, "_"));
  }

  // dedupe preservando ordem
  return [...new Set(ids.filter(Boolean))];
}

export async function resolveNullpassProduct(
  db: NullpassD1,
  productKey: string
): Promise<
  | { ok: true; product: ResolvedNullpassProduct; raw: NullpassProduct }
  | { ok: false; error: string; status: number }
> {
  const key = productKey.trim();
  if (!key.toLowerCase().startsWith("nullpass_")) {
    return {
      ok: false,
      error: "productKey deve começar com nullpass_",
      status: 400,
    };
  }

  let found: NullpassProduct | null = null;
  for (const id of candidateIds(key)) {
    found = await getProductById(db, id);
    if (found) break;
  }

  // fallback: match por id case-insensitive no catálogo
  if (!found) {
    const all = await listAllProducts(db);
    const rest = productIdFromNullpassKey(key)?.toLowerCase();
    if (rest) {
      found =
        all.find(
          (p) =>
            p.id.toLowerCase() === rest ||
            p.id.toLowerCase() === rest.replace(/_/g, "-") ||
            p.id.toLowerCase() === rest.replace(/-/g, "_")
        ) || null;
    }
  }

  if (!found) {
    return { ok: false, error: "Produto NullPass não encontrado", status: 404 };
  }

  if (found.active === false) {
    return {
      ok: false,
      error: "Produto NullPass inativo",
      status: 410,
    };
  }

  const priceBrl = effectiveNullpassPrice(found);
  if (priceBrl == null || priceBrl <= 0) {
    return {
      ok: false,
      error:
        "Produto sem preço cobrável (somente solicitação via staff / priceLabel).",
      status: 422,
    };
  }

  const amountCents = Math.round(priceBrl * 100);
  if (!Number.isFinite(amountCents) || amountCents < 1) {
    return {
      ok: false,
      error: "Preço inválido no catálogo",
      status: 422,
    };
  }

  return {
    ok: true,
    raw: found,
    product: {
      productKey: key,
      productId: found.id,
      kind: "nullpass",
      title: found.title,
      amountCents,
      active: true,
      description: found.tagline || found.description || undefined,
    },
  };
}

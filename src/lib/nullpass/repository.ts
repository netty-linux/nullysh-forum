/**
 * Repositório NullPass sobre D1.
 */

import {
  NULLPASS_GRADIENTS,
  NULLPASS_SEED,
  type NullpassProduct,
} from "@/lib/nullpass-catalog";
import { uid } from "@/lib/utils";
import type { NullpassD1, NullpassD1Prepared } from "./d1";
import {
  inputToProduct,
  normalizeProduct,
  validateNullpassInput,
  type NullpassUpsertInput,
} from "./validate";

export type NullpassRow = {
  id: string;
  title: string;
  tagline: string;
  category: string;
  badge: string | null;
  kind: string;
  bundle_ids: string;
  order_bump_ids: string;
  is_order_bump: number;
  poster_gradient: string;
  cover_url: string | null;
  monogram: string;
  description: string;
  price: number | null;
  promo_price: number | null;
  promo_active: number;
  price_label: string;
  price_hint: string | null;
  features: string;
  vip_fulfillment_note: string;
  active: number;
  sort_order: number;
  is_pinned: number;
  created_at: string;
  updated_at: string;
};

const ORDER_SQL =
  "ORDER BY is_pinned DESC, sort_order ASC, title COLLATE NOCASE ASC";

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.map(String).filter(Boolean);
  } catch {
    return [];
  }
}

export function rowToProduct(row: NullpassRow): NullpassProduct | null {
  return normalizeProduct({
    id: row.id,
    title: row.title,
    tagline: row.tagline,
    category: row.category,
    badge: row.badge as NullpassProduct["badge"],
    kind: row.kind === "combo" ? "combo" : "single",
    bundleIds: parseJsonArray(row.bundle_ids),
    orderBumpIds: parseJsonArray(row.order_bump_ids),
    isOrderBump: row.is_order_bump === 1,
    posterGradient: row.poster_gradient || NULLPASS_GRADIENTS[0],
    coverUrl: row.cover_url,
    monogram: row.monogram,
    description: row.description,
    price: row.price,
    promoPrice: row.promo_price,
    promoActive: row.promo_active === 1,
    priceLabel: row.price_label,
    priceHint: row.price_hint || undefined,
    features: parseJsonArray(row.features),
    vipFulfillmentNote: row.vip_fulfillment_note,
    active: row.active === 1,
    sortOrder: row.sort_order,
    isPinned: row.is_pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function productToBind(p: NullpassProduct) {
  return {
    id: p.id,
    title: p.title,
    tagline: p.tagline || "",
    category: p.category || "Outros",
    badge: p.badge ?? null,
    kind: p.kind === "combo" ? "combo" : "single",
    bundle_ids: JSON.stringify(p.bundleIds || []),
    order_bump_ids: JSON.stringify(p.orderBumpIds || []),
    is_order_bump: p.isOrderBump ? 1 : 0,
    poster_gradient: p.posterGradient || NULLPASS_GRADIENTS[0],
    cover_url: p.coverUrl || null,
    monogram: p.monogram || "?",
    description: p.description || "",
    price: p.price ?? null,
    promo_price: p.promoPrice ?? null,
    promo_active: p.promoActive ? 1 : 0,
    price_label: p.priceLabel || "Custo membro",
    price_hint: p.priceHint || null,
    features: JSON.stringify(p.features || []),
    vip_fulfillment_note: p.vipFulfillmentNote || "",
    active: p.active === false ? 0 : 1,
    sort_order: p.sortOrder ?? 100,
    is_pinned: p.isPinned ? 1 : 0,
    created_at: p.createdAt || new Date().toISOString(),
    updated_at: p.updatedAt || new Date().toISOString(),
  };
}

const UPSERT_SQL = `
INSERT INTO nullpass_products (
  id, title, tagline, category, badge, kind,
  bundle_ids, order_bump_ids, is_order_bump,
  poster_gradient, cover_url, monogram, description,
  price, promo_price, promo_active, price_label, price_hint,
  features, vip_fulfillment_note, active, sort_order, is_pinned,
  created_at, updated_at
) VALUES (
  ?1, ?2, ?3, ?4, ?5, ?6,
  ?7, ?8, ?9,
  ?10, ?11, ?12, ?13,
  ?14, ?15, ?16, ?17, ?18,
  ?19, ?20, ?21, ?22, ?23,
  ?24, ?25
)
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  tagline = excluded.tagline,
  category = excluded.category,
  badge = excluded.badge,
  kind = excluded.kind,
  bundle_ids = excluded.bundle_ids,
  order_bump_ids = excluded.order_bump_ids,
  is_order_bump = excluded.is_order_bump,
  poster_gradient = excluded.poster_gradient,
  cover_url = excluded.cover_url,
  monogram = excluded.monogram,
  description = excluded.description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  promo_active = excluded.promo_active,
  price_label = excluded.price_label,
  price_hint = excluded.price_hint,
  features = excluded.features,
  vip_fulfillment_note = excluded.vip_fulfillment_note,
  active = excluded.active,
  sort_order = excluded.sort_order,
  is_pinned = excluded.is_pinned,
  updated_at = excluded.updated_at
`;

function bindProduct(stmt: NullpassD1Prepared, p: NullpassProduct) {
  const b = productToBind(p);
  return stmt.bind(
    b.id,
    b.title,
    b.tagline,
    b.category,
    b.badge,
    b.kind,
    b.bundle_ids,
    b.order_bump_ids,
    b.is_order_bump,
    b.poster_gradient,
    b.cover_url,
    b.monogram,
    b.description,
    b.price,
    b.promo_price,
    b.promo_active,
    b.price_label,
    b.price_hint,
    b.features,
    b.vip_fulfillment_note,
    b.active,
    b.sort_order,
    b.is_pinned,
    b.created_at,
    b.updated_at
  );
}

export async function countProducts(db: NullpassD1): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS c FROM nullpass_products")
    .first<{ c: number }>();
  return Number(row?.c ?? 0);
}

export async function seedIfEmpty(db: NullpassD1): Promise<number> {
  const n = await countProducts(db);
  if (n > 0) return 0;

  const now = new Date().toISOString();
  const products = NULLPASS_SEED.map((p) =>
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

  if (!products.length) return 0;

  const stmts = products.map((p) =>
    bindProduct(db.prepare(UPSERT_SQL), p)
  );
  await db.batch(stmts);
  return products.length;
}

export async function listPublicProducts(
  db: NullpassD1
): Promise<NullpassProduct[]> {
  await seedIfEmpty(db);
  const { results } = await db
    .prepare(`SELECT * FROM nullpass_products WHERE active = 1 ${ORDER_SQL}`)
    .all<NullpassRow>();
  return (results || [])
    .map(rowToProduct)
    .filter(Boolean) as NullpassProduct[];
}

export async function listAllProducts(
  db: NullpassD1
): Promise<NullpassProduct[]> {
  await seedIfEmpty(db);
  const { results } = await db
    .prepare(`SELECT * FROM nullpass_products ${ORDER_SQL}`)
    .all<NullpassRow>();
  return (results || [])
    .map(rowToProduct)
    .filter(Boolean) as NullpassProduct[];
}

export async function getProductById(
  db: NullpassD1,
  id: string
): Promise<NullpassProduct | null> {
  const row = await db
    .prepare("SELECT * FROM nullpass_products WHERE id = ?1")
    .bind(id)
    .first<NullpassRow>();
  if (!row) return null;
  return rowToProduct(row);
}

export async function createProduct(
  db: NullpassD1,
  input: NullpassUpsertInput
): Promise<
  { ok: true; product: NullpassProduct } | { ok: false; error: string }
> {
  const v = validateNullpassInput(input, undefined, { strictCoverLimit: true });
  if (!v.ok) return v;
  const product = inputToProduct(uid("np"), input);
  if (!product) return { ok: false, error: "Não foi possível criar o produto." };
  await bindProduct(db.prepare(UPSERT_SQL), product).run();
  return { ok: true, product };
}

export async function updateProduct(
  db: NullpassD1,
  id: string,
  input: NullpassUpsertInput
): Promise<
  { ok: true; product: NullpassProduct } | { ok: false; error: string }
> {
  const v = validateNullpassInput(input, id, { strictCoverLimit: true });
  if (!v.ok) return v;
  const prev = await getProductById(db, id);
  if (!prev) return { ok: false, error: "Produto não encontrado." };
  const product = inputToProduct(id, input, prev);
  if (!product) return { ok: false, error: "Dados inválidos." };
  await bindProduct(db.prepare(UPSERT_SQL), product).run();
  return { ok: true, product };
}

export async function deleteProduct(
  db: NullpassD1,
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const prev = await getProductById(db, id);
  if (!prev) return { ok: false, error: "Produto não encontrado." };

  await db.prepare("DELETE FROM nullpass_products WHERE id = ?1").bind(id).run();

  // Limpa refs em combos/bumps (JSON arrays — reescreve linhas afetadas)
  const all = await listAllProducts(db);
  const updates: NullpassD1Prepared[] = [];
  for (const p of all) {
    const nextBundle = (p.bundleIds || []).filter((x) => x !== id);
    const nextBump = (p.orderBumpIds || []).filter((x) => x !== id);
    if (
      nextBundle.length !== (p.bundleIds || []).length ||
      nextBump.length !== (p.orderBumpIds || []).length
    ) {
      const cleaned = {
        ...p,
        bundleIds: nextBundle,
        orderBumpIds: nextBump,
        updatedAt: new Date().toISOString(),
      };
      updates.push(bindProduct(db.prepare(UPSERT_SQL), cleaned));
    }
  }
  if (updates.length) await db.batch(updates);
  return { ok: true };
}

export async function resetToSeed(
  db: NullpassD1
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await db.prepare("DELETE FROM nullpass_products").run();
  const count = await seedIfEmpty(db);
  return { ok: true, count };
}

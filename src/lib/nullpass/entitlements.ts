/**
 * Entitlements NullPass no D1 (nullysh-forum-db).
 * Liberação server-side após pay-fulfillment.
 */

import { uid } from "@/lib/utils";
import type { NullpassD1 } from "./d1";

export type NullpassEntitlement = {
  id: string;
  forumUserId: string;
  productId: string;
  productKey: string;
  checkoutToken: string | null;
  checkoutId: string | null;
  status: "granted" | "revoked" | "pending_staff";
  amountCents: number | null;
  grantedAt: string;
  updatedAt: string;
  notes: string | null;
};

type EntitlementRow = {
  id: string;
  forum_user_id: string;
  product_id: string;
  product_key: string;
  checkout_token: string | null;
  checkout_id: string | null;
  status: string;
  amount_cents: number | null;
  granted_at: string;
  updated_at: string;
  notes: string | null;
};

const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS nullpass_entitlements (
  id TEXT PRIMARY KEY NOT NULL,
  forum_user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_key TEXT NOT NULL,
  checkout_token TEXT,
  checkout_id TEXT,
  status TEXT NOT NULL DEFAULT 'granted',
  amount_cents INTEGER,
  granted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  notes TEXT
);
`;

let ensured = false;

export async function ensureEntitlementsTable(db: NullpassD1): Promise<void> {
  if (ensured) return;
  await db.prepare(ENSURE_SQL).run();
  // índices best-effort (ignore se já existem / D1 sem batch)
  try {
    await db
      .prepare(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_nullpass_ent_checkout
         ON nullpass_entitlements (checkout_id)
         WHERE checkout_id IS NOT NULL AND checkout_id != ''`
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_nullpass_ent_user
         ON nullpass_entitlements (forum_user_id, status)`
      )
      .run();
  } catch {
    /* index may already exist */
  }
  ensured = true;
}

function rowToEntitlement(row: EntitlementRow): NullpassEntitlement {
  const status = row.status as NullpassEntitlement["status"];
  return {
    id: row.id,
    forumUserId: row.forum_user_id,
    productId: row.product_id,
    productKey: row.product_key,
    checkoutToken: row.checkout_token,
    checkoutId: row.checkout_id,
    status:
      status === "revoked" || status === "pending_staff" ? status : "granted",
    amountCents: row.amount_cents,
    grantedAt: row.granted_at,
    updatedAt: row.updated_at,
    notes: row.notes,
  };
}

/**
 * Extrai product_id de productKey:
 * - nullpass_canva-pro → canva-pro
 * - nullpass_canva_pro → tenta canva_pro e canva-pro
 */
export function productIdFromNullpassKey(productKey: string): string | null {
  const k = productKey.trim();
  if (!k.toLowerCase().startsWith("nullpass_")) return null;
  const rest = k.slice("nullpass_".length).trim();
  return rest || null;
}

export async function findEntitlementByCheckout(
  db: NullpassD1,
  checkoutId: string
): Promise<NullpassEntitlement | null> {
  if (!checkoutId) return null;
  await ensureEntitlementsTable(db);
  const row = await db
    .prepare(
      `SELECT * FROM nullpass_entitlements WHERE checkout_id = ?1 LIMIT 1`
    )
    .bind(checkoutId)
    .first<EntitlementRow>();
  return row ? rowToEntitlement(row) : null;
}

export async function grantNullpassEntitlement(
  db: NullpassD1,
  input: {
    forumUserId: string;
    productId: string;
    productKey: string;
    checkoutToken?: string | null;
    checkoutId?: string | null;
    amountCents?: number | null;
    notes?: string | null;
  }
): Promise<
  | { ok: true; entitlement: NullpassEntitlement; already: boolean }
  | { ok: false; error: string }
> {
  const forumUserId = input.forumUserId.trim();
  const productId = input.productId.trim();
  const productKey = input.productKey.trim();
  if (!forumUserId || !productId || !productKey) {
    return { ok: false, error: "forumUserId, productId e productKey obrigatórios" };
  }

  await ensureEntitlementsTable(db);

  const checkoutId = (input.checkoutId || "").trim() || null;
  if (checkoutId) {
    const existing = await findEntitlementByCheckout(db, checkoutId);
    if (existing) {
      return { ok: true, entitlement: existing, already: true };
    }
  }

  const now = new Date().toISOString();
  const id = uid("npe");
  const status: NullpassEntitlement["status"] = "granted";

  try {
    await db
      .prepare(
        `INSERT INTO nullpass_entitlements (
          id, forum_user_id, product_id, product_key,
          checkout_token, checkout_id, status, amount_cents,
          granted_at, updated_at, notes
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
      )
      .bind(
        id,
        forumUserId,
        productId,
        productKey,
        input.checkoutToken || null,
        checkoutId,
        status,
        input.amountCents ?? null,
        now,
        now,
        input.notes || null
      )
      .run();
  } catch (e) {
    // race: unique checkout_id
    if (checkoutId) {
      const existing = await findEntitlementByCheckout(db, checkoutId);
      if (existing) {
        return { ok: true, entitlement: existing, already: true };
      }
    }
    const msg = e instanceof Error ? e.message : "Falha ao gravar entitlement";
    return { ok: false, error: msg };
  }

  return {
    ok: true,
    already: false,
    entitlement: {
      id,
      forumUserId,
      productId,
      productKey,
      checkoutToken: input.checkoutToken || null,
      checkoutId,
      status,
      amountCents: input.amountCents ?? null,
      grantedAt: now,
      updatedAt: now,
      notes: input.notes || null,
    },
  };
}

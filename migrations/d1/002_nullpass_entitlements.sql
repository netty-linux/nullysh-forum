-- NullPass entitlements — liberação pós-pagamento (Pay → Forum fulfill)
-- Banco: nullysh-forum-db
--
--   wrangler d1 execute nullysh-forum-db --remote --file=migrations/d1/002_nullpass_entitlements.sql

CREATE TABLE IF NOT EXISTS nullpass_entitlements (
  id TEXT PRIMARY KEY NOT NULL,
  forum_user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_key TEXT NOT NULL,
  checkout_token TEXT,
  checkout_id TEXT,
  -- granted | revoked | pending_staff
  status TEXT NOT NULL DEFAULT 'granted'
    CHECK (status IN ('granted', 'revoked', 'pending_staff')),
  amount_cents INTEGER,
  granted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  notes TEXT
);

-- Idempotência por checkout (um fulfill por cobrança)
CREATE UNIQUE INDEX IF NOT EXISTS idx_nullpass_ent_checkout
  ON nullpass_entitlements (checkout_id)
  WHERE checkout_id IS NOT NULL AND checkout_id != '';

CREATE INDEX IF NOT EXISTS idx_nullpass_ent_user
  ON nullpass_entitlements (forum_user_id, status);

CREATE INDEX IF NOT EXISTS idx_nullpass_ent_product
  ON nullpass_entitlements (product_id, status);

CREATE INDEX IF NOT EXISTS idx_nullpass_ent_user_product
  ON nullpass_entitlements (forum_user_id, product_id);

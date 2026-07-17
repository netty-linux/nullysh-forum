-- NullPass · D1 migration (Fase B — preparação)
-- Banco: criar/binding D1 no wrangler quando for conectar a API.
--
-- Cloudflare Dashboard → Workers & Pages → D1 → Console, ou:
--   wrangler d1 execute <DB_NAME> --remote --file=migrations/d1/001_nullpass_products.sql
--
-- Ordem canônica de leitura (vitrine pública):
--   WHERE active = 1
--   ORDER BY is_pinned DESC, sort_order ASC, title COLLATE NOCASE ASC

CREATE TABLE IF NOT EXISTS nullpass_products (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Outros',
  -- 'novo' | 'custo-membro' | 'limitado' | NULL
  badge TEXT,
  -- 'single' | 'combo'
  kind TEXT NOT NULL DEFAULT 'single',
  -- JSON arrays de product ids
  bundle_ids TEXT NOT NULL DEFAULT '[]',
  order_bump_ids TEXT NOT NULL DEFAULT '[]',
  is_order_bump INTEGER NOT NULL DEFAULT 0 CHECK (is_order_bump IN (0, 1)),
  poster_gradient TEXT NOT NULL,
  cover_url TEXT,
  monogram TEXT NOT NULL DEFAULT '?',
  description TEXT NOT NULL DEFAULT '',
  -- Preços em BRL (REAL). NULL = só price_label
  price REAL,
  promo_price REAL,
  promo_active INTEGER NOT NULL DEFAULT 0 CHECK (promo_active IN (0, 1)),
  price_label TEXT NOT NULL DEFAULT 'Custo membro',
  price_hint TEXT,
  -- JSON array de strings
  features TEXT NOT NULL DEFAULT '[]',
  vip_fulfillment_note TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_nullpass_public
  ON nullpass_products (active, is_pinned DESC, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_nullpass_category
  ON nullpass_products (category, active, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_nullpass_pinned
  ON nullpass_products (is_pinned, sort_order ASC)
  WHERE is_pinned = 1 AND active = 1;

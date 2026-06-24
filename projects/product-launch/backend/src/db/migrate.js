import { db } from './pool.js';

const sql = `
-- ── Products (replaces single-row launch_config) ──────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT        NOT NULL,
  tagline      TEXT        NOT NULL DEFAULT 'Something big is coming.',
  launch_at    TIMESTAMPTZ,
  is_launched  BOOLEAN     NOT NULL DEFAULT false,
  hero_image   TEXT        DEFAULT '',
  flash_slots  INT         NOT NULL DEFAULT 100,
  sort_order   INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_sort ON products (sort_order ASC, created_at DESC);

-- ── Waitlist registrations (per product) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS registrations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  source      TEXT        DEFAULT 'organic',
  UNIQUE (product_id, email)
);

CREATE INDEX IF NOT EXISTS idx_registrations_product ON registrations (product_id, created_at DESC);

-- ── Flash sale orders (per product) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  email          TEXT        NOT NULL,
  reservation_id TEXT        NOT NULL UNIQUE,
  status         TEXT        NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_product ON orders (product_id, created_at DESC);
`;

async function migrate() {
  console.log('[migrate] Running migrations...');
  try {
    await db.query(sql);
    console.log('[migrate] Done.');
  } catch (err) {
    console.error('[migrate] Failed:', err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

migrate();

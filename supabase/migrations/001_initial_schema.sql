-- ============================================================
-- HXD Quick-Commerce Platform — Initial Schema
-- Supabase / PostgreSQL
-- Generated: 2026-02-24
-- ============================================================

-- ── EXTENSIONS ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ── ENUMS ────────────────────────────────────────────────────

CREATE TYPE order_status AS ENUM (
  'pending',        -- just placed, awaiting confirmation
  'confirmed',      -- vendor / ops confirmed
  'preparing',      -- being packed / baked
  'out_for_delivery',
  'delivered',
  'cancelled',
  'refunded'
);

CREATE TYPE payment_method AS ENUM (
  'cash_on_delivery',
  'online_transfer',   -- screenshot upload flow
  'card',
  'wallet'
);

CREATE TYPE product_category AS ENUM (
  'snacks',
  'noodles',
  'cakes',
  'flowers',
  'beverages',
  'other'
);


-- ── TABLE: products ──────────────────────────────────────────
-- "We act as the middleman. No vendor logins."
-- All products are managed internally (admin-only writes).

CREATE TABLE products (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT          NOT NULL,
  description           TEXT,
  category              product_category NOT NULL,
  price                 NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  image_url             TEXT,

  -- Manual on/off toggle (ops-controlled)
  is_available          BOOLEAN       NOT NULL DEFAULT TRUE,

  -- Time-gating: NULL = available 24 hours
  -- Stored as TIME WITH TIME ZONE to respect local business hours
  available_from        TIME WITHOUT TIME ZONE,
  available_until       TIME WITHOUT TIME ZONE,

  -- Triggers extra delivery fee (Cakes, Flowers)
  is_fragile            BOOLEAN       NOT NULL DEFAULT FALSE,

  -- Requires a personalised note at order time
  requires_custom_text  BOOLEAN       NOT NULL DEFAULT FALSE,

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN products.available_from    IS 'Start of availability window (NULL = always). E.g. 10:00 for cakes.';
COMMENT ON COLUMN products.available_until   IS 'End of availability window (NULL = always). E.g. 23:00 for cakes.';
COMMENT ON COLUMN products.is_fragile        IS 'When TRUE an extra fragile_item_fee is added at checkout.';
COMMENT ON COLUMN products.requires_custom_text IS 'Surfaces a text input during checkout (cake message, card note, etc.).';


-- ── TABLE: orders ────────────────────────────────────────────

CREATE TABLE orders (
  id                      UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Customer info (no auth required for quick-commerce UX)
  customer_name           TEXT          NOT NULL,
  customer_phone          TEXT          NOT NULL,

  -- Delivery address stored as a JSONB blob for flexibility
  -- Expected shape: { line1, line2?, city, postal_code?, lat?, lng? }
  address                 JSONB         NOT NULL,

  status                  order_status  NOT NULL DEFAULT 'pending',
  payment_method          payment_method NOT NULL,

  -- Proof of payment (online_transfer / card screenshot URL)
  payment_receipt_url     TEXT,

  -- ── Fee breakdown (denormalised for receipt/audit trail) ──
  subtotal                NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  base_delivery_fee       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (base_delivery_fee >= 0),
  fragile_item_fee        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (fragile_item_fee >= 0),
  total_amount            NUMERIC(10,2) NOT NULL GENERATED ALWAYS AS
                            (subtotal + base_delivery_fee + fragile_item_fee) STORED,

  -- ── Pre-order fields ──────────────────────────────────────
  -- TRUE when the customer orders outside the product's time window
  is_preorder             BOOLEAN       NOT NULL DEFAULT FALSE,
  -- The slot the customer wants delivery (required when is_preorder = TRUE)
  requested_delivery_time TIMESTAMPTZ,

  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Business rule: pre-orders MUST have a requested_delivery_time
  CONSTRAINT preorder_requires_delivery_time
    CHECK (
      (is_preorder = FALSE)
      OR
      (is_preorder = TRUE AND requested_delivery_time IS NOT NULL)
    )
);

COMMENT ON COLUMN orders.address                 IS 'JSONB: { line1, line2?, city, postal_code?, lat?, lng? }';
COMMENT ON COLUMN orders.fragile_item_fee        IS 'Extra fee charged when basket contains ≥1 fragile product.';
COMMENT ON COLUMN orders.total_amount            IS 'Auto-computed: subtotal + base_delivery_fee + fragile_item_fee.';
COMMENT ON COLUMN orders.is_preorder             IS 'TRUE when ordered outside the products time window.';
COMMENT ON COLUMN orders.requested_delivery_time IS 'Required for pre-orders. The customer-chosen delivery slot.';


-- ── TABLE: order_items ───────────────────────────────────────

CREATE TABLE order_items (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id          UUID          NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
  product_id        UUID          NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity          INT           NOT NULL DEFAULT 1 CHECK (quantity > 0),

  -- Snapshot of price at the moment of purchase (price can change later)
  price_at_purchase NUMERIC(10,2) NOT NULL CHECK (price_at_purchase >= 0),

  -- Personalised note (cake message, card text, etc.) — nullable
  custom_message    TEXT,

  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN order_items.price_at_purchase IS 'Denormalised snapshot. Never recalculate from products.price.';
COMMENT ON COLUMN order_items.custom_message    IS 'Required when the linked product.requires_custom_text = TRUE. Enforced at app layer.';


-- ── INDEXES ──────────────────────────────────────────────────

-- Products: fast lookups for the storefront
CREATE INDEX idx_products_category        ON products (category);
CREATE INDEX idx_products_is_available    ON products (is_available);
CREATE INDEX idx_products_is_fragile      ON products (is_fragile);

-- Orders: ops dashboard + customer order-tracking
CREATE INDEX idx_orders_status            ON orders (status);
CREATE INDEX idx_orders_customer_phone    ON orders (customer_phone);
CREATE INDEX idx_orders_created_at        ON orders (created_at DESC);
CREATE INDEX idx_orders_is_preorder       ON orders (is_preorder) WHERE is_preorder = TRUE;

-- Order items: joining back to an order
CREATE INDEX idx_order_items_order_id     ON order_items (order_id);
CREATE INDEX idx_order_items_product_id   ON order_items (product_id);


-- ── AUTO-UPDATE updated_at ───────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_products
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_orders
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ══════════════════════════════════════════════════════════════

-- ── products ─────────────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can read products
CREATE POLICY "products_public_select"
  ON products
  FOR SELECT
  USING (TRUE);

-- Only the service_role key (used by your Next.js server-side
-- admin routes / Supabase Edge Functions) can mutate products.
-- No vendor portal → no authenticated user mutations.
CREATE POLICY "products_service_role_all"
  ON products
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);


-- ── orders ───────────────────────────────────────────────────
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Anonymous customers may INSERT their own order.
CREATE POLICY "orders_anon_insert"
  ON orders
  FOR INSERT
  TO anon
  WITH CHECK (TRUE);

-- Authenticated users (ops staff / admin) can read all orders.
CREATE POLICY "orders_authenticated_select"
  ON orders
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- Service role can do everything (webhooks, status updates, etc.)
CREATE POLICY "orders_service_role_all"
  ON orders
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);


-- ── order_items ──────────────────────────────────────────────
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Anonymous customers may insert items alongside their order.
CREATE POLICY "order_items_anon_insert"
  ON order_items
  FOR INSERT
  TO anon
  WITH CHECK (TRUE);

-- Authenticated ops staff can read all items.
CREATE POLICY "order_items_authenticated_select"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- Service role full access.
CREATE POLICY "order_items_service_role_all"
  ON order_items
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

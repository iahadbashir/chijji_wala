-- ============================================================
-- HXD — Migration 002: Settings Table
-- supabase/migrations/002_settings_table.sql
--
-- Introduces a singleton `settings` table that lets the admin
-- control dynamic business fees directly from the dashboard
-- without a code deploy.
--
-- Singleton pattern: enforced by a partial unique index on a
-- constant boolean column (always TRUE). This guarantees there
-- is exactly one settings row in the system at all times.
-- ============================================================

-- ── TABLE: settings ──────────────────────────────────────────

CREATE TABLE settings (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Singleton lock column — always TRUE, unique index below
  -- ensures only one row can ever exist.
  is_singleton          BOOLEAN       NOT NULL DEFAULT TRUE,

  -- The base delivery charge applied to every order
  current_delivery_fee  NUMERIC(10,2) NOT NULL DEFAULT 150.00
                          CHECK (current_delivery_fee >= 0),

  -- Extra surcharge for orders containing fragile items
  -- (cakes, flowers). Admin-controlled from the dashboard.
  current_fragile_fee   NUMERIC(10,2) NOT NULL DEFAULT 100.00
                          CHECK (current_fragile_fee >= 0),

  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  settings                        IS 'Singleton table — exactly one row. Controls dynamic business fees.';
COMMENT ON COLUMN settings.is_singleton           IS 'Always TRUE. The unique index below enforces the singleton.';
COMMENT ON COLUMN settings.current_delivery_fee   IS 'Flat delivery fee (PKR) applied to every order at checkout.';
COMMENT ON COLUMN settings.current_fragile_fee    IS 'Extra surcharge (PKR) added when basket has ≥1 fragile item (cakes/flowers).';

-- Singleton enforcement: only one row where is_singleton = TRUE can exist.
CREATE UNIQUE INDEX idx_settings_singleton
  ON settings (is_singleton)
  WHERE is_singleton = TRUE;

-- Auto-update updated_at on every write
CREATE TRIGGER set_updated_at_settings
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ── SEED: default singleton row ───────────────────────────────
-- Insert exactly once. On re-runs this is a no-op due to the
-- unique index conflict being handled by ON CONFLICT DO NOTHING.

INSERT INTO settings (current_delivery_fee, current_fragile_fee)
VALUES (150.00, 100.00)
ON CONFLICT (is_singleton) WHERE is_singleton = TRUE DO NOTHING;


-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Authenticated ops staff can read the current fee values
-- (useful for rendering fee amounts on the admin dashboard).
CREATE POLICY "settings_authenticated_select"
  ON settings
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- Only the service_role key (used by Server Actions) may write.
-- No unauthenticated or regular-user mutations.
CREATE POLICY "settings_service_role_all"
  ON settings
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

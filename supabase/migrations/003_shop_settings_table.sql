-- ============================================================
-- HXD — Migration 003: Shop Settings Table
-- supabase/migrations/003_shop_settings_table.sql
--
-- Introduces a singleton `shop_settings` table for managing:
--   - Shop open/closed status
--   - Homepage banner announcements
--
-- Singleton pattern: enforced by a unique constraint to ensure
-- exactly one row exists at all times.
-- ============================================================

-- ── TABLE: shop_settings ──────────────────────────────────────

CREATE TABLE shop_settings (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Shop availability toggle
  is_open               BOOLEAN       NOT NULL DEFAULT TRUE,

  -- Optional banner message displayed at top of storefront
  banner_message        TEXT          NULL,

  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Singleton lock column
  is_singleton          BOOLEAN       NOT NULL DEFAULT TRUE,

  -- Enforce singleton: only one row
  CONSTRAINT shop_settings_singleton UNIQUE (is_singleton)
);

COMMENT ON TABLE  shop_settings                   IS 'Singleton table — exactly one row. Controls shop status and announcements.';
COMMENT ON COLUMN shop_settings.is_open           IS 'TRUE = shop accepting orders, FALSE = shop temporarily closed.';
COMMENT ON COLUMN shop_settings.banner_message    IS 'Optional promotional message shown on homepage (NULL = hidden).';

-- Auto-update updated_at on every write
CREATE TRIGGER set_updated_at_shop_settings
  BEFORE UPDATE ON shop_settings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ── SEED: default singleton row ───────────────────────────────

INSERT INTO shop_settings (is_open, banner_message)
VALUES (TRUE, NULL)
ON CONFLICT (is_singleton) WHERE is_singleton = TRUE DO NOTHING;


-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;

-- Public read access (customers need to see shop status and banner)
CREATE POLICY "shop_settings_public_select"
  ON shop_settings
  FOR SELECT
  TO public
  USING (TRUE);

-- Only service_role can modify settings (admin dashboard via server actions)
CREATE POLICY "shop_settings_service_role_all"
  ON shop_settings
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

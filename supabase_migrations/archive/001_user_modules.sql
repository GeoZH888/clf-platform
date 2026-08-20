-- ============================================================
-- Per-user module access control — minimal version
-- ============================================================

-- Optional cleanup: if you ran the previous (overbuilt) modules-acl SQL,
-- uncomment these lines to drop those tables. Otherwise skip this block.
--
--   DROP TABLE IF EXISTS clf_user_module_overrides CASCADE;
--   DROP TABLE IF EXISTS clf_user_roles            CASCADE;
--   DROP TABLE IF EXISTS clf_roles                 CASCADE;
--   DROP TABLE IF EXISTS clf_modules               CASCADE;
--   DROP FUNCTION IF EXISTS clf_acl_set_updated_at();

-- The one table we actually need ────────────────────────────────────
CREATE TABLE IF NOT EXISTS clf_user_modules (
  user_id    uuid    NOT NULL,
  module_id  text    NOT NULL,
  enabled    boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_user_modules_user ON clf_user_modules (user_id);

-- updated_at trigger ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION clf_user_modules_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_user_modules_updated ON clf_user_modules;
CREATE TRIGGER trg_user_modules_updated
  BEFORE UPDATE ON clf_user_modules
  FOR EACH ROW EXECUTE FUNCTION clf_user_modules_set_updated_at();

-- RLS ───────────────────────────────────────────────────────────────
ALTER TABLE clf_user_modules ENABLE ROW LEVEL SECURITY;

-- Anyone can read (clients fetch their own; row-level filter happens in app code)
DROP POLICY IF EXISTS "public read user_modules" ON clf_user_modules;
CREATE POLICY "public read user_modules" ON clf_user_modules
  FOR SELECT USING (true);

-- Authenticated (admin) can manage
DROP POLICY IF EXISTS "auth manage user_modules" ON clf_user_modules;
CREATE POLICY "auth manage user_modules" ON clf_user_modules
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

NOTIFY pgrst, 'reload schema';

-- That's it. Module list lives in JS (src/config/modules.js).
-- Resolution: if (user_id, module_id) row exists → use enabled.
--             else → fall back to default in the JS config.

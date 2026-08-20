-- ════════════════════════════════════════════════════════════════════
-- STAGE 1A v2 ROLLBACK
-- ════════════════════════════════════════════════════════════════════
-- Run ONLY if v2 migration caused problems. Reverts everything.

BEGIN;

-- Drop dwxz_user_profile (FK ON DELETE CASCADE handles cleanup)
DROP TABLE IF EXISTS public.dwxz_user_profile;

-- Remove CHECK constraint
ALTER TABLE jgw_registrations
  DROP CONSTRAINT IF EXISTS jgw_registrations_role_check;

-- Remove added columns
ALTER TABLE jgw_registrations
  DROP COLUMN IF EXISTS role,
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS name_zh,
  DROP COLUMN IF EXISTS gender,
  DROP COLUMN IF EXISTS birth_year,
  DROP COLUMN IF EXISTS phone;

-- Remove UNIQUE constraint (was added in v2)
ALTER TABLE jgw_registrations
  DROP CONSTRAINT IF EXISTS jgw_registrations_approved_user_id_unique;

COMMIT;

-- Verify rollback
SELECT column_name FROM information_schema.columns
WHERE table_name = 'jgw_registrations' AND table_schema = 'public'
ORDER BY ordinal_position;
-- Expected: original 15 columns

SELECT count(*) FROM information_schema.tables
WHERE table_name = 'dwxz_user_profile';
-- Expected: 0

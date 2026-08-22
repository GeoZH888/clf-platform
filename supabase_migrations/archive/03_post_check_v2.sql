-- ════════════════════════════════════════════════════════════════════
-- STAGE 1A v2 POST-CHECK — FIXED
-- ════════════════════════════════════════════════════════════════════
-- Run AFTER 02_migration_v2.sql. READ-ONLY.
-- Fixed: removed the count(role) line that errored if migration failed.

-- 1. UNIQUE constraint on approved_user_id exists
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'jgw_registrations_approved_user_id_unique';
-- Expected: 1 row, "UNIQUE (approved_user_id)"

-- 2. New columns exist on jgw_registrations
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'jgw_registrations'
  AND table_schema = 'public'
  AND column_name IN ('role', 'is_active', 'name_zh', 'gender', 'birth_year', 'phone')
ORDER BY column_name;
-- Expected: 6 rows

-- 3. Role CHECK constraint exists
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'jgw_registrations_role_check';
-- Expected: 1 row showing CHECK on role values

-- 4. dwxz_user_profile table exists with all columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'dwxz_user_profile' AND table_schema = 'public'
ORDER BY ordinal_position;
-- Expected: 18 rows (user_id PK + 17 fields)

-- 5. FK from dwxz_user_profile to jgw_registrations
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'dwxz_user_profile_user_fk';
-- Expected: 1 row showing FOREIGN KEY (user_id) REFERENCES jgw_registrations(approved_user_id) ON DELETE CASCADE

-- 6. Existing data is intact, no data corruption
SELECT
  count(*) AS total_registrations,
  count(*) FILTER (WHERE status = 'approved') AS approved
FROM jgw_registrations;
-- Expected: 4, 4

-- 7. dwxz_user_profile is empty
SELECT count(*) AS profile_rows FROM dwxz_user_profile;
-- Expected: 0

-- 8. Existing 4 CLF users still queryable, role IS NULL (not yet set)
SELECT id, username, status, role, is_active
FROM jgw_registrations
ORDER BY created_at DESC NULLS LAST
LIMIT 10;
-- Expected: 4 rows, role=NULL, is_active=true (from new column default)

-- ════════════════════════════════════════════════════════════════════
-- STAGE 3A.1 — Create dwxz_users_view
-- ════════════════════════════════════════════════════════════════════
-- David's React code expects a 'users' table with specific columns.
-- This view exposes jgw_registrations data with the column names David
-- expects, so David's React code keeps working without code changes
-- to user-related queries.
--
-- The view is READ-ONLY for now. If David needs to UPDATE/INSERT users,
-- we'll add INSTEAD OF triggers later.
--
-- Run on CLF's Supabase.

BEGIN;

CREATE OR REPLACE VIEW public.dwxz_users_view AS
SELECT
  approved_user_id   AS id,                    -- David expects 'id', CLF stores as approved_user_id
  username,
  password_hash,
  name,
  name_zh,
  email,
  phone,
  gender,
  birth_year,
  role,
  is_active,
  created_at
FROM jgw_registrations
WHERE approved_user_id IS NOT NULL;
-- Filter out registration-only rows (no approved user yet)

COMMENT ON VIEW public.dwxz_users_view IS
  'David UI compatibility view. Maps jgw_registrations to the column shape
   David''s React code expects (id, username, password_hash, name, etc.).
   Used in place of David''s old public.users table during Pattern A integration.';

COMMIT;

-- ────────────────────────────────────────────────────────────────────
-- Verification
-- ────────────────────────────────────────────────────────────────────

-- 1. View exists with expected columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'dwxz_users_view' AND table_schema = 'public'
ORDER BY ordinal_position;
-- Expected: 12 rows (id, username, password_hash, name, name_zh, email,
-- phone, gender, birth_year, role, is_active, created_at)

-- 2. View returns CLF's existing users
SELECT id, username, role, is_active
FROM dwxz_users_view
ORDER BY username;
-- Expected: 4 rows (xiaomi, wenping, zhang, marco)
-- All with role=NULL (we haven't assigned roles yet)
-- All with is_active=true

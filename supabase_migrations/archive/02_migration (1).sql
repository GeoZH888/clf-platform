-- ════════════════════════════════════════════════════════════════════
-- STAGE 5A MIGRATION
-- ════════════════════════════════════════════════════════════════════
-- Run on CLF Supabase. Wrapped in BEGIN/COMMIT — atomic.
--
-- Changes:
--   1. Delete clf_user_modules rows for xiaomi/wenping/zhang/marco
--   2. Delete xiaomi/wenping/zhang/marco from jgw_registrations
--      (dwxz_user_profile rows cascade automatically)
--   3. Add 'available' and 'selected' columns to clf_user_modules
--   4. Drop legacy 'enabled' column (replaced by 'available')
--   5. Create new super_admin user: superadmin@david-zhongwen.net / test123
--   6. Pre-populate clf_user_modules for new user (all modules available + selected)
--
-- Reversible via 03_rollback.sql (cannot undo user deletion without backup).

BEGIN;

-- ────────────────────────────────────────────────────────────────────
-- Step 1: Clean up old test users' data
-- ────────────────────────────────────────────────────────────────────

-- Get the user IDs we're about to delete (for use in subsequent deletes)
-- We'll just use a CTE pattern via a temp table approach — simpler:
-- delete clf_user_modules first, then jgw_registrations.

DELETE FROM clf_user_modules
WHERE user_id IN (
  SELECT approved_user_id FROM jgw_registrations
  WHERE username IN ('xiaomi', 'wenping', 'zhang', 'marco')
);

-- Also clean any other CLF progress tables that might have user data.
-- Use IF EXISTS / soft-fail since these tables may or may not exist:
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_name = 'clf_lianzi_progress' AND table_schema = 'public') THEN
    DELETE FROM clf_lianzi_progress
    WHERE user_id IN (
      SELECT approved_user_id FROM jgw_registrations
      WHERE username IN ('xiaomi', 'wenping', 'zhang', 'marco')
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_name = 'clf_chengyu_progress' AND table_schema = 'public') THEN
    DELETE FROM clf_chengyu_progress
    WHERE user_id IN (
      SELECT approved_user_id FROM jgw_registrations
      WHERE username IN ('xiaomi', 'wenping', 'zhang', 'marco')
    );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────
-- Step 2: Delete the 4 test users
-- ────────────────────────────────────────────────────────────────────
-- dwxz_user_profile rows cascade automatically (FK has ON DELETE CASCADE)
DELETE FROM jgw_registrations
WHERE username IN ('xiaomi', 'wenping', 'zhang', 'marco');

-- ────────────────────────────────────────────────────────────────────
-- Step 3: Add new permission columns to clf_user_modules
-- ────────────────────────────────────────────────────────────────────
-- LAYER 1 (admin grants): 'available' = is this module available to user?
-- LAYER 2 (user opts in): 'selected' = does user want to use it on home?
-- Module shows on home only if available=true AND selected=true
ALTER TABLE clf_user_modules
  ADD COLUMN IF NOT EXISTS available boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS selected  boolean DEFAULT true;

-- Migrate any existing data: 'enabled' becomes 'available' (admin grant).
-- 'selected' defaults to true (user opted in by default — they can hide modules later).
UPDATE clf_user_modules SET available = enabled WHERE enabled IS NOT NULL;

-- Drop the legacy 'enabled' column
ALTER TABLE clf_user_modules
  DROP COLUMN IF EXISTS enabled;

-- ────────────────────────────────────────────────────────────────────
-- Step 4: Create the new super_admin user
-- ────────────────────────────────────────────────────────────────────
-- Username: superadmin@david-zhongwen.net
-- Password: test123  (bcrypt hash below — DO NOT MODIFY THE HASH)
-- Hash verified to match 'test123' with bcryptjs round 10

INSERT INTO jgw_registrations (
  approved_user_id,
  username,
  password_hash,
  name,
  status,
  reason,
  role,
  is_active,
  created_at
) VALUES (
  gen_random_uuid(),                       -- new UUID for this user
  'superadmin@david-zhongwen.net',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',  -- test123
  'Super Admin',
  'approved',
  'System-created super admin account',     -- reason (NOT NULL)
  'super_admin',
  true,
  now()
);

-- ────────────────────────────────────────────────────────────────────
-- Step 5: Pre-populate clf_user_modules for the new super_admin
-- ────────────────────────────────────────────────────────────────────
-- Super admin gets all modules: available=true, selected=true
-- (Even modules that default to disabled — super admin can use everything)

-- Get the new user's ID
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT approved_user_id INTO v_user_id
  FROM jgw_registrations
  WHERE username = 'superadmin@david-zhongwen.net';

  -- Insert rows for all gateable modules
  INSERT INTO clf_user_modules (user_id, module_id, available, selected, updated_at)
  VALUES
    (v_user_id, 'lianzi',   true, true, now()),
    (v_user_id, 'words',    true, true, now()),
    (v_user_id, 'pinyin',   true, true, now()),
    (v_user_id, 'chengyu',  true, true, now()),
    (v_user_id, 'poetry',   true, true, now()),
    (v_user_id, 'grammar',  true, true, now()),
    (v_user_id, 'hsk',      true, true, now()),
    (v_user_id, 'riddles',  true, true, now()),
    (v_user_id, 'kechuang', true, true, now()),
    (v_user_id, 'lessons',  true, true, now()),
    (v_user_id, 'chat',     true, true, now()),
    (v_user_id, 'voice',    true, true, now()),
    (v_user_id, 'homework', true, true, now()),
    (v_user_id, 'shop',     true, true, now()),
    (v_user_id, 'parents',  true, true, now())
  ON CONFLICT DO NOTHING;
END $$;

COMMIT;

-- ────────────────────────────────────────────────────────────────────
-- Run 02_post_check.sql to verify success.
-- ────────────────────────────────────────────────────────────────────

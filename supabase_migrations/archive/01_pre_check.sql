-- ════════════════════════════════════════════════════════════════════
-- STAGE 5A PRE-CHECK
-- ════════════════════════════════════════════════════════════════════
-- Run on CLF Supabase BEFORE migration. READ-ONLY.
-- Identifies what dependent data exists for the 4 test users.

-- 1. Confirm the 4 test users exist
SELECT username, approved_user_id, status, role
FROM jgw_registrations
WHERE username IN ('xiaomi', 'wenping', 'zhang', 'marco')
ORDER BY username;
-- Expected: 4 rows

-- 2. Check clf_user_modules dependents
SELECT count(*) AS clf_user_modules_rows
FROM clf_user_modules um
JOIN jgw_registrations r ON r.approved_user_id = um.user_id
WHERE r.username IN ('xiaomi', 'wenping', 'zhang', 'marco');
-- Expected: ~32 rows (8 modules × 4 users from earlier diagnostic)

-- 3. Check clf_user_modules schema (verify enabled column exists)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'clf_user_modules' AND table_schema = 'public'
ORDER BY ordinal_position;
-- Expected: user_id, module_id, enabled, updated_at, updated_by

-- 4. Check for other CLF tables that might reference users
SELECT
  tc.table_name,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_name = 'jgw_registrations'
  AND tc.table_name != 'dwxz_user_profile'  -- has CASCADE, no manual cleanup needed
ORDER BY tc.table_name;
-- Expected: list of FKs we need to handle

-- 5. Check if username already exists for the new super_admin
SELECT count(*) AS exists_already
FROM jgw_registrations
WHERE username = 'superadmin@david-zhongwen.net';
-- Expected: 0 (would be an error if 1)

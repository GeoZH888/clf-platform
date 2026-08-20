-- ════════════════════════════════════════════════════════════════════
-- STAGE 5A POST-CHECK
-- ════════════════════════════════════════════════════════════════════
-- Run on CLF Supabase AFTER migration. READ-ONLY.

-- 1. Old test users gone
SELECT count(*) AS old_users_remaining
FROM jgw_registrations
WHERE username IN ('xiaomi', 'wenping', 'zhang', 'marco');
-- Expected: 0

-- 2. New super_admin exists
SELECT username, name, role, status, is_active,
       LEFT(password_hash, 7) AS pw_prefix
FROM jgw_registrations
WHERE username = 'superadmin@david-zhongwen.net';
-- Expected: 1 row, role='super_admin', status='approved', is_active=true,
-- pw_prefix='$2a$10$' (bcrypt format)

-- 3. clf_user_modules schema updated
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'clf_user_modules' AND table_schema = 'public'
ORDER BY ordinal_position;
-- Expected:
--   user_id     uuid       (no default)
--   module_id   text       (no default)
--   updated_at  timestamptz (now())
--   updated_by  uuid        (no default)
--   available   boolean    DEFAULT true   ← NEW
--   selected    boolean    DEFAULT true   ← NEW
-- (no 'enabled' column)

-- 4. Old test users' modules cleaned up
SELECT count(*) AS orphan_modules
FROM clf_user_modules um
WHERE NOT EXISTS (
  SELECT 1 FROM jgw_registrations r WHERE r.approved_user_id = um.user_id
);
-- Expected: 0 (no orphan rows)

-- 5. New super_admin's modules pre-populated (15 rows)
SELECT um.module_id, um.available, um.selected
FROM clf_user_modules um
JOIN jgw_registrations r ON r.approved_user_id = um.user_id
WHERE r.username = 'superadmin@david-zhongwen.net'
ORDER BY um.module_id;
-- Expected: 15 rows, all available=true, selected=true
-- (chat, chengyu, grammar, homework, hsk, kechuang, lessons,
--  lianzi, parents, pinyin, poetry, riddles, shop, voice, words)

-- 6. Total user count in CLF
SELECT count(*) AS total_users, role, count(*) AS by_role
FROM jgw_registrations
GROUP BY role
ORDER BY role NULLS LAST;
-- Expected: 1 user, role='super_admin'

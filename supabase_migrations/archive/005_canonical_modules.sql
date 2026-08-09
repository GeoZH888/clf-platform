-- ============================================================
-- DAY 1 STAGE A: CANONICAL MODULE ID MIGRATION
-- ============================================================
-- This migration:
--   1. Renames English module IDs to Pinyin canonical IDs
--   2. Drops sub-mode IDs (flashcards, dictation, completion) that aren't
--      separately gateable in student-facing code
--   3. Leaves jgw_invites.modules untouched (handled in Phase 2)
--
-- Reversible via 005_canonical_modules_rollback.sql
-- Run 000_pre_migration_check.sql BEFORE this to capture state.
-- Run 999_post_migration_check.sql AFTER this to verify.
--
-- Affected rows: ALL clf_user_modules rows (re-key) + ~30% deletions
-- Affected users: zhang and any other Path B (auth.users-backed) users
-- Legacy users (panda, stefano, wenping): NOT affected — they read from
--                                          jgw_invites.modules, untouched here

BEGIN;

-- Step 1: Rename 'characters' → 'lianzi'
-- This is the canonical Pinyin ID for 练字 (character writing)
UPDATE clf_user_modules
SET module_id = 'lianzi',
    updated_at = now()
WHERE module_id = 'characters';

-- Step 2: Drop sub-mode rows that aren't gateable as standalone modules.
-- These were leftovers from a more granular permission model that
-- student-facing code never honored. Their gating happens within their
-- parent module (lianzi or words).
DELETE FROM clf_user_modules
WHERE module_id IN ('flashcards', 'dictation', 'completion');

-- Step 3: Verify no unknown module_ids remain
-- (informational — if this returns rows, investigate before deploying)
DO $$
DECLARE
  unknown_count int;
  canonical_ids text[] := ARRAY[
    'lianzi', 'pinyin', 'words', 'chengyu', 'poetry', 'grammar',
    'hsk', 'riddles', 'lessons', 'chat', 'voice', 'homework',
    'shop', 'parents'
  ];
BEGIN
  SELECT count(*) INTO unknown_count
  FROM clf_user_modules
  WHERE module_id != ALL(canonical_ids);

  IF unknown_count > 0 THEN
    RAISE NOTICE 'Warning: % rows have non-canonical module_id values. Investigate before committing.', unknown_count;
    -- We don't fail — just warn. If this is a problem you'll see it
    -- in the post-migration check.
  END IF;
END $$;

COMMIT;

-- After running, immediately run 999_post_migration_check.sql
-- to verify state. If anything looks wrong, run rollback.

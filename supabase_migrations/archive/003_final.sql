-- ═══════════════════════════════════════════════════════════════════════
--  大卫学中文 — Migration 003 FINAL
--
--  The previous seed failed because your existing jgw_point_rules has a
--  NOT NULL `module` column that the seed didn't provide.
--
--  Good news: lingua-learn's src/hooks/usePoints.js has a DEFAULT_RULES
--  fallback baked into the JS. If jgw_point_rules is empty, the app uses
--  those hardcoded values. So NO SEED IS NEEDED.
--
--  This file just:
--   1. Confirms the migration is complete
--   2. (Optional) Seeds the rules WITH the module column filled in
--
--  Run either Option A (skip seed, fastest) OR Option B (seed with module).
-- ═══════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════
-- OPTION A — skip the seed entirely, confirm we're done
-- ════════════════════════════════════════════════════════════════════════

-- Verify everything is in place
SELECT 'Tables' AS kind, COUNT(*) AS n
FROM information_schema.tables
WHERE table_schema='public' AND (table_name LIKE 'jgw_%' OR table_name LIKE 'clf_%')
UNION ALL
SELECT 'Policies', COUNT(*)
FROM pg_policies WHERE schemaname='public'
UNION ALL
SELECT 'Point rules (existing)', COUNT(*)
FROM jgw_point_rules;

-- If Tables >= 25 and Policies >= 20, you're done. Stop here.

-- ════════════════════════════════════════════════════════════════════════
-- OPTION B — seed WITH module column (uncomment to run)
-- ════════════════════════════════════════════════════════════════════════
-- Your existing schema has a NOT NULL `module` column. Re-run with module:

/*
INSERT INTO jgw_point_rules (action, module, points, description, active) VALUES
  ('character_practiced',  'lianzi',   2, 'Practiced a character',         true),
  ('character_perfect',    'lianzi',   5, 'Perfect character practice',    true),
  ('lianzi_practiced',     'lianzi',   3, 'Character practice',            true),
  ('lianzi_quiz_done',     'lianzi',  10, 'Completed character quiz',      true),
  ('lianzi_perfect',       'lianzi',  20, 'Perfect character quiz',        true),
  ('pinyin_table_tap',     'pinyin',   1, 'Tapped a pinyin tile',          true),
  ('pinyin_listen_right',  'pinyin',   5, 'Correct pinyin listen',         true),
  ('pinyin_type_right',    'pinyin',   8, 'Correct pinyin typing',         true),
  ('words_flash',          'words',    1, 'Flashed a word',                true),
  ('words_listen_right',   'words',    5, 'Correct word listen',           true),
  ('words_fill_right',     'words',    8, 'Correct word fill',             true),
  ('word_learned',         'words',    2, 'Learned a word',                true),
  ('chengyu_flash',        'chengyu',  1, 'Viewed an idiom',               true),
  ('chengyu_quiz_right',   'chengyu',  5, 'Correct idiom quiz',            true),
  ('chengyu_fill_right',   'chengyu', 10, 'Correct idiom fill',            true),
  ('chengyu_match_all',    'chengyu', 20, 'Matched all idioms',            true),
  ('chengyu_chain',        'chengyu', 15, 'Idiom chain',                   true),
  ('chengyu_story',        'chengyu',  5, 'Read idiom story',              true),
  ('chengyu_theme_done',   'chengyu', 50, 'Completed theme',               true),
  ('hsk_quiz_right',       'hsk',      2, 'Correct HSK quiz',              true),
  ('poetry_read',          'poetry',   1, 'Read a poem',                   true),
  ('grammar_quiz_right',   'grammar',  3, 'Correct grammar quiz',          true),
  ('daily_login',          'system',  10, 'Daily login bonus',             true),
  ('streak_7',             'system',  50, '7-day streak',                  true),
  ('streak_30',            'system', 200, '30-day streak',                 true)
ON CONFLICT (action) DO NOTHING;
*/

-- ════════════════════════════════════════════════════════════════════════
-- Migration 003 complete either way.
--
-- You can now proceed to Step 2 of MIGRATION_GUIDE.md
-- (copy lingua-learn/src → clf-platform/src in PowerShell).
-- ════════════════════════════════════════════════════════════════════════

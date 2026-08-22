-- ============================================================
-- CLF Migration Scripts
-- Copy existing jgw_* data → clf_* tables
-- Run AFTER clf_schema.sql
-- Each migration is IDEMPOTENT (safe to run multiple times)
-- ============================================================

-- ============================================================
-- MIGRATION 1: Characters  jgw_characters → clf_characters
-- ============================================================
INSERT INTO clf_characters (
  character, pinyin, strokes,
  meaning_zh, meaning_en,
  level
)
SELECT
  glyph_modern  AS character,
  pinyin,
  stroke_count  AS strokes,
  meaning_zh,
  meaning_en,
  COALESCE(difficulty, 1) AS level
FROM jgw_characters
ON CONFLICT (character) DO UPDATE SET
  pinyin     = EXCLUDED.pinyin,
  strokes    = EXCLUDED.strokes,
  meaning_zh = EXCLUDED.meaning_zh,
  meaning_en = EXCLUDED.meaning_en;

SELECT COUNT(*) AS migrated_characters FROM clf_characters;

-- ============================================================
-- MIGRATION 2: HSK Words  jgw_hsk_words → clf_words
-- ============================================================
INSERT INTO clf_words (
  word, pinyin, hsk_level,
  meaning_zh, meaning_en, meaning_it,
  category, example_zh, example_en,
  audio_url, level, active
)
SELECT
  word, pinyin, hsk_level,
  meaning_zh, meaning_en, meaning_it,
  category, example_zh, example_en,
  audio_url,
  CASE
    WHEN hsk_level <= 2 THEN 2
    WHEN hsk_level = 3  THEN 4
    WHEN hsk_level = 4  THEN 6
    WHEN hsk_level = 5  THEN 9
    WHEN hsk_level = 6  THEN 11
    ELSE 3
  END AS level,
  active
FROM jgw_hsk_words
ON CONFLICT (word, hsk_level) DO UPDATE SET
  pinyin     = EXCLUDED.pinyin,
  meaning_zh = EXCLUDED.meaning_zh,
  meaning_en = EXCLUDED.meaning_en,
  meaning_it = EXCLUDED.meaning_it,
  category   = EXCLUDED.category,
  example_zh = EXCLUDED.example_zh,
  audio_url  = EXCLUDED.audio_url,
  active     = EXCLUDED.active;

-- Also migrate jgw_words (词语 module)
INSERT INTO clf_words (word, pinyin, meaning_zh, meaning_en, meaning_it, level)
SELECT word_zh, pinyin, meaning_zh, meaning_it, meaning_en, 3
FROM jgw_words
WHERE word_zh NOT IN (SELECT word FROM clf_words)
ON CONFLICT DO NOTHING;

SELECT COUNT(*) AS migrated_words FROM clf_words;

-- ============================================================
-- MIGRATION 3: Grammar  jgw_grammar_patterns → clf_grammar
-- ============================================================
INSERT INTO clf_grammar (
  pattern, pattern_en,
  hsk_level, difficulty, theme,
  rule_zh, rule_en,
  example_zh, example_en,
  extra_examples, level, active
)
SELECT
  pattern, pattern_en,
  hsk_level, difficulty, theme,
  rule_zh, rule_en,
  example_zh, example_en,
  extra_examples,
  CASE
    WHEN hsk_level <= 3 THEN 5
    WHEN hsk_level = 4  THEN 7
    WHEN hsk_level = 5  THEN 9
    ELSE 10
  END AS level,
  active
FROM jgw_grammar_patterns
ON CONFLICT (pattern) DO UPDATE SET
  pattern_en     = EXCLUDED.pattern_en,
  rule_zh        = EXCLUDED.rule_zh,
  rule_en        = EXCLUDED.rule_en,
  example_zh     = EXCLUDED.example_zh,
  extra_examples = EXCLUDED.extra_examples,
  active         = EXCLUDED.active;

SELECT COUNT(*) AS migrated_grammar FROM clf_grammar;

-- ============================================================
-- MIGRATION 4: Idioms  jgw_chengyu → clf_idioms
-- ============================================================
INSERT INTO clf_idioms (
  idiom, pinyin,
  meaning_zh, meaning_en, meaning_it,
  story_zh, story_en, story_it,
  image_scene, image_url,
  example_zh,
  hsk_level, difficulty, theme,
  level, active
)
SELECT
  idiom, pinyin,
  meaning_zh, meaning_en, meaning_it,
  story_zh, story_en, story_it,
  image_scene, image_url,
  example_zh,
  hsk_level, difficulty, theme,
  CASE
    WHEN hsk_level <= 3 THEN 5
    WHEN hsk_level = 4  THEN 7
    WHEN hsk_level = 5  THEN 9
    ELSE 10
  END AS level,
  active
FROM jgw_chengyu
ON CONFLICT (idiom) DO UPDATE SET
  meaning_zh  = EXCLUDED.meaning_zh,
  meaning_en  = EXCLUDED.meaning_en,
  meaning_it  = EXCLUDED.meaning_it,
  story_zh    = EXCLUDED.story_zh,
  story_en    = EXCLUDED.story_en,
  story_it    = EXCLUDED.story_it,
  image_url   = EXCLUDED.image_url,
  active      = EXCLUDED.active;

SELECT COUNT(*) AS migrated_idioms FROM clf_idioms;

-- ============================================================
-- MIGRATION 5: Poems  jgw_poems → clf_poems
-- ============================================================
INSERT INTO clf_poems (
  title, title_en,
  author, dynasty, type, difficulty,
  lines, pinyin_map,
  translation_zh, translation_en, translation_it,
  background_zh, background_en, background_it,
  notes_zh, notes_en,
  image_url, image_prompt,
  level, active
)
SELECT
  title, title_en,
  author, dynasty, type, difficulty,
  lines, COALESCE(pinyin_map, '{}'::jsonb),
  translation_zh, translation_en, translation_it,
  background_zh, background_en, background_it,
  notes_zh, notes_en,
  image_url, image_prompt,
  CASE
    WHEN difficulty <= 1 THEN 5
    WHEN difficulty = 2  THEN 7
    ELSE 9
  END AS level,
  active
FROM jgw_poems
ON CONFLICT (title, author) DO UPDATE SET
  lines          = EXCLUDED.lines,
  pinyin_map     = EXCLUDED.pinyin_map,
  translation_zh = EXCLUDED.translation_zh,
  translation_en = EXCLUDED.translation_en,
  translation_it = EXCLUDED.translation_it,
  background_zh  = EXCLUDED.background_zh,
  background_en  = EXCLUDED.background_en,
  background_it  = EXCLUDED.background_it,
  image_url      = EXCLUDED.image_url,
  active         = EXCLUDED.active;

SELECT COUNT(*) AS migrated_poems FROM clf_poems;

-- ============================================================
-- MIGRATION 6: Progress  jgw_* progress → clf_progress
-- ============================================================

-- HSK progress
INSERT INTO clf_progress (device_token, item_table, item_id, correct, practiced_at)
SELECT
  p.device_token,
  'clf_words' AS item_table,
  c.id        AS item_id,
  p.correct,
  p.practiced_at
FROM jgw_hsk_progress p
JOIN jgw_hsk_words hw ON hw.id = p.word_id
JOIN clf_words c ON c.word = hw.word AND c.hsk_level = hw.hsk_level
ON CONFLICT DO NOTHING;

-- Chengyu progress
INSERT INTO clf_progress (device_token, item_table, item_id, correct, practiced_at)
SELECT
  p.device_token,
  'clf_idioms' AS item_table,
  c.id         AS item_id,
  p.correct,
  p.practiced_at
FROM jgw_chengyu_progress p
JOIN jgw_chengyu ch ON ch.id = p.chengyu_id
JOIN clf_idioms c ON c.idiom = ch.idiom
ON CONFLICT DO NOTHING;

SELECT COUNT(*) AS migrated_progress FROM clf_progress;

-- ============================================================
-- MIGRATION 7: Learner profiles from device sessions
-- ============================================================
INSERT INTO clf_learner_profiles (device_token, display_name, created_at)
SELECT DISTINCT
  ds.device_token,
  i.label AS display_name,
  ds.created_at
FROM jgw_device_sessions ds
LEFT JOIN jgw_invites i ON i.id = ds.invite_id
WHERE ds.device_token IS NOT NULL
ON CONFLICT (device_token) DO NOTHING;

SELECT COUNT(*) AS migrated_profiles FROM clf_learner_profiles;

-- ============================================================
-- VERIFICATION SUMMARY
-- ============================================================
SELECT
  'clf_characters' AS table_name, COUNT(*) AS rows FROM clf_characters
UNION ALL SELECT 'clf_words',   COUNT(*) FROM clf_words
UNION ALL SELECT 'clf_grammar', COUNT(*) FROM clf_grammar
UNION ALL SELECT 'clf_idioms',  COUNT(*) FROM clf_idioms
UNION ALL SELECT 'clf_poems',   COUNT(*) FROM clf_poems
UNION ALL SELECT 'clf_progress',COUNT(*) FROM clf_progress
UNION ALL SELECT 'clf_learner_profiles', COUNT(*) FROM clf_learner_profiles
ORDER BY table_name;

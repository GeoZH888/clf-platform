-- =========================================================
-- Phase G.2 - Seed clf_atoms from existing source tables
-- Idempotent (UPSERT via ON CONFLICT). Safe to re-run.
--
-- Coverage:
--   chengyu       13 -> type='chengyu'
--   words         80 -> type='word'
--   poems         11 -> type='poem'
--   riddles       36 -> type='topic'  (game atoms)
--   grammar_topics 14 -> type='grammar'
-- =========================================================

-- =========================================================
-- 1. SEED FROM clf_chengyu
-- display_text = idiom, level = hsk_level, metadata = full source row
-- =========================================================
INSERT INTO clf_atoms (
  type, ref_table, ref_id, display_text, level, category, difficulty, metadata
)
SELECT
  'chengyu',
  'clf_chengyu',
  c.id::text,
  c.idiom,
  COALESCE(c.hsk_level, c.difficulty, 3),  -- prefer hsk_level, fallback difficulty, default 3
  'cultural',
  800 + (COALESCE(c.hsk_level, c.difficulty, 3) * 200),  -- Elo: HSK1=1000 ... HSK6=2000
  jsonb_build_object(
    'pinyin',     c.pinyin,
    'meaning_zh', c.meaning_zh,
    'meaning_en', c.meaning_en,
    'meaning_it', c.meaning_it,
    'story_zh',   c.story_zh,
    'example_zh', c.example_zh,
    'theme',      c.theme,
    'image_url',  c.image_url
  )
FROM clf_chengyu c
WHERE COALESCE(c.active, true) = true
ON CONFLICT (type, ref_table, ref_id) DO UPDATE SET
  display_text = EXCLUDED.display_text,
  level        = EXCLUDED.level,
  difficulty   = EXCLUDED.difficulty,
  metadata     = EXCLUDED.metadata,
  updated_at   = now();


-- =========================================================
-- 2. SEED FROM clf_words
-- display_text = word_zh, level defaults to 1 (HSK1) — no hsk_level column
-- super_admin can re-level later via admin UI.
-- =========================================================
INSERT INTO clf_atoms (
  type, ref_table, ref_id, display_text, level, category, difficulty, metadata
)
SELECT
  'word',
  'clf_words',
  w.id::text,
  w.word_zh,
  1,                       -- default HSK1 — to be tuned later
  'core',
  1000,                    -- Elo: HSK1 baseline
  jsonb_build_object(
    'pinyin',     w.pinyin,
    'meaning_zh', w.meaning_zh,
    'meaning_en', w.meaning_en,
    'meaning_it', w.meaning_it,
    'example_zh', w.example_zh,
    'example_en', w.example_en,
    'example_it', w.example_it,
    'image_url',  w.image_url,
    'theme',      w.theme
  )
FROM clf_words w
ON CONFLICT (type, ref_table, ref_id) DO UPDATE SET
  display_text = EXCLUDED.display_text,
  metadata     = EXCLUDED.metadata,
  updated_at   = now();


-- =========================================================
-- 3. SEED FROM clf_poems
-- display_text = title, level from poems.level
-- =========================================================
INSERT INTO clf_atoms (
  type, ref_table, ref_id, display_text, level, category, difficulty, metadata
)
SELECT
  'poem',
  'clf_poems',
  p.id::text,
  p.title,
  COALESCE(p.level, p.difficulty, 3),
  'cultural',
  800 + (COALESCE(p.level, p.difficulty, 3) * 200),
  jsonb_build_object(
    'title_en',       p.title_en,
    'title_it',       p.title_it,
    'author',         p.author,
    'dynasty',        p.dynasty,
    'type',           p.type,
    'translation_zh', p.translation_zh,
    'translation_en', p.translation_en,
    'translation_it', p.translation_it,
    'background_zh',  p.background_zh,
    'image_url',      p.image_url,
    'audio_url',      p.audio_url,
    'tags',           p.tags
  )
FROM clf_poems p
WHERE COALESCE(p.active, true) = true
ON CONFLICT (type, ref_table, ref_id) DO UPDATE SET
  display_text = EXCLUDED.display_text,
  level        = EXCLUDED.level,
  difficulty   = EXCLUDED.difficulty,
  metadata     = EXCLUDED.metadata,
  updated_at   = now();


-- =========================================================
-- 4. SEED FROM clf_riddles
-- display_text = first 60 chars of riddle_text (riddle is the prompt)
-- type = 'topic' (per atom type list — riddles are game/practice topics)
-- Only seed approved riddles (status = 'approved')
-- =========================================================
INSERT INTO clf_atoms (
  type, ref_table, ref_id, display_text, level, category, difficulty, metadata
)
SELECT
  'topic',
  'clf_riddles',
  r.id::text,
  -- Truncate riddle to a reasonable display label
  CASE
    WHEN length(r.riddle_text) > 60 THEN substring(r.riddle_text, 1, 60) || '...'
    ELSE r.riddle_text
  END,
  COALESCE(r.level, 2),
  'practice',  -- riddles are practice content
  800 + (COALESCE(r.level, 2) * 200),
  jsonb_build_object(
    'riddle_text',       r.riddle_text,
    'answer',            r.answer,
    'answer_type',       r.answer_type,
    'category_hint',     r.category_hint,
    'explanation',       r.explanation,
    'hints',             r.hints,
    'illustration_url',  r.illustration_url,
    'subtype',           'riddle'   -- distinguishes from other 'topic' atoms later
  )
FROM clf_riddles r
WHERE COALESCE(r.status, 'approved') = 'approved'
ON CONFLICT (type, ref_table, ref_id) DO UPDATE SET
  display_text = EXCLUDED.display_text,
  level        = EXCLUDED.level,
  difficulty   = EXCLUDED.difficulty,
  metadata     = EXCLUDED.metadata,
  updated_at   = now();


-- =========================================================
-- 5. SEED FROM clf_grammar_topics
-- Note: id is text in this table (not uuid). Cast handled.
-- =========================================================
INSERT INTO clf_atoms (
  type, ref_table, ref_id, display_text, level, category, difficulty, metadata
)
SELECT
  'grammar',
  'clf_grammar_topics',
  g.id,
  g.title_zh,
  COALESCE(g.level, 2),
  'core',
  800 + (COALESCE(g.level, 2) * 200),
  jsonb_build_object(
    'title_en',    g.title_en,
    'title_it',    g.title_it,
    'prereq_ids',  g.prereq_ids,
    'explanation', g.explanation,
    'examples',    g.examples,
    'order_idx',   g.order_idx
  )
FROM clf_grammar_topics g
ON CONFLICT (type, ref_table, ref_id) DO UPDATE SET
  display_text = EXCLUDED.display_text,
  level        = EXCLUDED.level,
  difficulty   = EXCLUDED.difficulty,
  metadata     = EXCLUDED.metadata,
  updated_at   = now();


-- =========================================================
-- VERIFY: counts per type after seed
-- =========================================================
SELECT
  type,
  count(*) AS atoms,
  min(level) AS min_level,
  max(level) AS max_level,
  round(avg(difficulty)::numeric, 0) AS avg_difficulty
FROM clf_atoms
GROUP BY type
ORDER BY type;

-- Expected output approximately:
--   chengyu  | 13  | 1-6   | varies
--   grammar  | 14  | 1-6   | varies
--   poem     | 11  | 1-6   | varies
--   topic    | 36  | 1-6   | varies   (riddles)
--   word     | 80  | 1     | 1000     (all default HSK1, will re-level later)

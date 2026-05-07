# patch_phase_g2_seed.py
# Phase G.2 STAGE 2 — Seed clf_atoms from existing source tables.
#
# Source tables with content (per Stage 1 inspection):
#   - clf_chengyu          13 rows  -> type='chengyu'
#   - clf_words            80 rows  -> type='word'
#   - clf_poems            11 rows  -> type='poem'
#   - clf_riddles          36 rows  -> type='topic'  (game atoms)
#   - clf_grammar_topics   14 rows  -> type='grammar'
#
# Empty tables skipped (no atoms to seed):
#   clf_characters, clf_grammar, clf_idioms, clf_radicals,
#   clf_concepts, clf_knowledge_chunks
#
# Total atoms after seed: ~154

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

SQL = '''-- =========================================================
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
'''

# Write seed SQL
p_sql = ROOT / "db_seed_phase_g2_atoms.sql"
data = SQL.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
p_sql.write_bytes(data)
print(f"[OK] wrote {p_sql.name} ({len(data)} bytes)")

import re
inserts = re.findall(r'INSERT INTO clf_atoms', SQL)
upserts = re.findall(r'ON CONFLICT', SQL)
print(f"  INSERT statements: {len(inserts)}")
print(f"  ON CONFLICT (UPSERT): {len(upserts)}")

print()
print("=" * 60)
print("PHASE G.2 STAGE 2 - SEED ATOMS")
print("=" * 60)
print()
print("EXPECTED ATOMS AFTER SEED (~154 total):")
print("  chengyu  : 13  (from clf_chengyu)")
print("  word     : 80  (from clf_words)")
print("  poem     : 11  (from clf_poems)")
print("  topic    : 36  (riddles, from clf_riddles)")
print("  grammar  : 14  (from clf_grammar_topics)")
print("  TOTAL    : 154")
print()
print("STEPS:")
print("  1. Open Supabase SQL Editor (project yqcojudvvjntaajnrilr)")
print("  2. New query")
print("  3. Open the file in your editor:")
print(f"     {p_sql.absolute()}")
print("  4. Copy ALL contents")
print("  5. Paste into Supabase SQL Editor")
print("  6. Click 'Run'")
print()
print("EXPECTED LAST RESULT SET (5 rows, one per type):")
print("  type    | atoms | min_level | max_level | avg_difficulty")
print("  --------+-------+-----------+-----------+----------------")
print("  chengyu | 13    | varies    | varies    | varies")
print("  grammar | 14    | varies    | varies    | varies")
print("  poem    | 11    | varies    | varies    | varies")
print("  topic   | 36    | varies    | varies    | varies")
print("  word    | 80    | 1         | 1         | 1000")
print()
print("ASSUMPTIONS made (may need correction later):")
print("  - clf_words has no hsk_level column.")
print("    Defaulting all 80 words to level=1 (HSK1) and difficulty=1000.")
print("    Super_admin can re-level via admin UI later.")
print("  - clf_riddles seeded only WHERE status='approved'.")
print("    If your status field uses a different value (e.g. 'public'),")
print("    you'd see 0 riddles seeded - tell me and I'll adjust.")
print("  - clf_chengyu seeded only WHERE active=true.")
print("    Similarly for clf_poems.")
print("  - difficulty seeded as 800 + (level*200), giving:")
print("    HSK1=1000, HSK2=1200, ..., HSK6=2000.")
print("    Will adjust via Elo updates from real attempts later.")
print()
print("AFTER SUCCESS, RE-VERIFY:")
print("  SELECT type, count(*) FROM clf_atoms GROUP BY type ORDER BY type;")
print()
print("If counts look right, Phase G.2 stage 2 = done.")
print("If counts are wrong, paste numbers and I'll diagnose.")

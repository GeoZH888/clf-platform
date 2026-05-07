# patch_phase_g2_inspect.py
# Phase G.2 STAGE 1 — Inspect existing tables before seeding atoms.
#
# Why two stages: I don't know the column names of your existing tables.
# Seeding atoms requires knowing what to read FROM. Better to inspect
# than to guess column names and have INSERTs fail.
#
# This script writes ONE inspection SQL file. You run it in Supabase,
# paste output, and then I generate the actual seeding SQL.

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

INSPECT_SQL = '''-- =========================================================
-- Phase G.2 Stage 1 — Inspect existing tables
-- Purpose: discover columns of source tables before seeding atoms
-- =========================================================

-- =========================================================
-- Section 1 — Column names of every clf_* table that may
-- contribute atoms.
-- =========================================================
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'clf_characters',
    'clf_words',
    'clf_chengyu',
    'clf_grammar',
    'clf_grammar_topics',
    'clf_poems',
    'clf_idioms',
    'clf_riddles',
    'clf_radicals',
    'clf_scenarios',
    'clf_stories',
    'clf_concepts',
    'clf_knowledge_chunks'
  )
ORDER BY table_name, ordinal_position;


-- =========================================================
-- Section 2 — Row counts (tells us scale of seed)
-- =========================================================
SELECT 'clf_characters' AS tbl, count(*) AS n FROM clf_characters
UNION ALL SELECT 'clf_words',          count(*) FROM clf_words
UNION ALL SELECT 'clf_chengyu',        count(*) FROM clf_chengyu
UNION ALL SELECT 'clf_grammar',        count(*) FROM clf_grammar
UNION ALL SELECT 'clf_grammar_topics', count(*) FROM clf_grammar_topics
UNION ALL SELECT 'clf_poems',          count(*) FROM clf_poems
UNION ALL SELECT 'clf_idioms',         count(*) FROM clf_idioms
UNION ALL SELECT 'clf_riddles',        count(*) FROM clf_riddles
UNION ALL SELECT 'clf_radicals',       count(*) FROM clf_radicals
UNION ALL SELECT 'clf_scenarios',      count(*) FROM clf_scenarios
UNION ALL SELECT 'clf_stories',        count(*) FROM clf_stories
UNION ALL SELECT 'clf_concepts',       count(*) FROM clf_concepts
UNION ALL SELECT 'clf_knowledge_chunks', count(*) FROM clf_knowledge_chunks
ORDER BY n DESC;


-- =========================================================
-- Section 3 — Sample row from each (gives me real values to see)
-- Run separately if section 1+2 too long; safe to skip if needed
-- =========================================================
-- These are commented out by default. Uncomment one at a time
-- if you want to share sample data:

-- SELECT * FROM clf_characters LIMIT 1;
-- SELECT * FROM clf_words LIMIT 1;
-- SELECT * FROM clf_chengyu LIMIT 1;
-- etc.
'''

# Write inspect SQL
p_sql = ROOT / "db_inspect_phase_g2.sql"
data = INSPECT_SQL.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
p_sql.write_bytes(data)
print(f"[OK] wrote {p_sql.name} ({len(data)} bytes)")

print()
print("=" * 60)
print("PHASE G.2 STAGE 1 — INSPECTION")
print("=" * 60)
print()
print("Why two stages:")
print("  Seeding atoms requires reading FROM existing tables")
print("  (clf_characters etc.) and INSERTing INTO clf_atoms.")
print("  I don't know your existing column names. Guessing")
print("  produces broken INSERTs. Inspection first.")
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
print("OUTPUT will be 2 result sets:")
print("  Set 1: column listing for ~13 tables")
print("  Set 2: row counts per table")
print()
print("EXPORT both result sets to CSV (button next to results table)")
print("OR copy-paste them as text. Send them to me.")
print()
print("Then I generate the actual seeding SQL with real column names")
print("(no guessing).")
print()
print("Some tables may not exist (e.g. clf_idioms might be empty/missing)")
print("- those will just return 0 rows or error. Ignore those.")

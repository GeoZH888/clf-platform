-- =========================================================
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

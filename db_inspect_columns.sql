-- Just the column listing (only non-empty tables)
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'clf_words',
    'clf_riddles',
    'clf_grammar_topics',
    'clf_chengyu',
    'clf_poems'
  )
ORDER BY table_name, ordinal_position;

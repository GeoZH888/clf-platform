-- Fix for G.4 ingestion: add UNIQUE constraint on clf_corpus(name)
-- so we can use ON CONFLICT for idempotent upserts.

-- Safe — does nothing if constraint already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clf_corpus_name_unique'
      AND conrelid = 'public.clf_corpus'::regclass
  ) THEN
    ALTER TABLE clf_corpus
      ADD CONSTRAINT clf_corpus_name_unique UNIQUE (name);
  END IF;
END $$;

-- Verify:
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.clf_corpus'::regclass
  AND contype = 'u';

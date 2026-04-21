-- ═══════════════════════════════════════════════════════════════════════
--  Schema patch: switch embedding dimensions 1536 → 1024 for Voyage-3
--  Run ONLY AFTER running 001_new_infrastructure_BULLETPROOF.sql
--  Safe to run before any real data has been embedded.
--
--  If you already have embeddings stored (unlikely at this stage): the
--  ALTER TYPE will fail. In that case, either DELETE FROM content_chunks
--  first, or run the DROP/ADD form at the bottom instead.
-- ═══════════════════════════════════════════════════════════════════════

-- Drop dependent indexes first (pgvector indexes are dim-specific)
DROP INDEX IF EXISTS idx_chunks_embedding;
DROP INDEX IF EXISTS idx_textbook_emb;

-- Path A — no data yet (clean table), simplest approach
-- Works only if the column has no non-null values with the old dim
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM content_chunks WHERE embedding IS NOT NULL LIMIT 1) THEN
    RAISE NOTICE 'content_chunks has data — using DROP/ADD path';
    ALTER TABLE content_chunks DROP COLUMN embedding;
    ALTER TABLE content_chunks ADD COLUMN embedding vector(1024);
  ELSE
    RAISE NOTICE 'content_chunks is empty — altering column type in place';
    ALTER TABLE content_chunks ALTER COLUMN embedding TYPE vector(1024);
  END IF;

  IF EXISTS (SELECT 1 FROM jgw_textbook_sections WHERE embedding IS NOT NULL LIMIT 1) THEN
    ALTER TABLE jgw_textbook_sections DROP COLUMN embedding;
    ALTER TABLE jgw_textbook_sections ADD COLUMN embedding vector(1024);
  ELSE
    ALTER TABLE jgw_textbook_sections ALTER COLUMN embedding TYPE vector(1024);
  END IF;

  IF EXISTS (SELECT 1 FROM rag_queries WHERE query_embedding IS NOT NULL LIMIT 1) THEN
    ALTER TABLE rag_queries DROP COLUMN query_embedding;
    ALTER TABLE rag_queries ADD COLUMN query_embedding vector(1024);
  ELSE
    ALTER TABLE rag_queries ALTER COLUMN query_embedding TYPE vector(1024);
  END IF;
END $$;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON content_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_textbook_emb ON jgw_textbook_sections
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Update the RPC functions that reference vector(1536) dimensions
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.7,
  match_count     int   DEFAULT 10,
  filter_category text  DEFAULT NULL
)
RETURNS TABLE (
  chunk_id uuid, source_id uuid, content text, page_number int,
  section_title text, similarity float, source_filename text, source_category text
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT cc.id, cc.source_id, cc.content, cc.page_number, cc.section_title,
         1 - (cc.embedding <=> query_embedding) AS similarity,
         cs.filename, cs.category
  FROM content_chunks cc
  JOIN content_sources cs ON cc.source_id = cs.id
  WHERE cc.embedding IS NOT NULL
    AND (filter_category IS NULL OR cs.category = filter_category)
    AND 1 - (cc.embedding <=> query_embedding) > match_threshold
  ORDER BY cc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION match_textbook_sections(
  query_embedding vector(1024),
  match_count     int   DEFAULT 5,
  filter_textbook text  DEFAULT NULL,
  filter_grade    int   DEFAULT NULL
)
RETURNS TABLE (
  section_id uuid, textbook text, grade int, semester int,
  unit int, lesson int, title text, content_zh text, similarity float
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT ts.id, ts.textbook, ts.grade, ts.semester, ts.unit, ts.lesson,
         ts.title, ts.content_zh,
         1 - (ts.embedding <=> query_embedding) AS similarity
  FROM jgw_textbook_sections ts
  WHERE ts.embedding IS NOT NULL
    AND (filter_textbook IS NULL OR ts.textbook = filter_textbook)
    AND (filter_grade    IS NULL OR ts.grade    = filter_grade)
  ORDER BY ts.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

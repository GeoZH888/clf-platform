-- =========================================================
-- Migrate clf_chunk_embeddings from OpenAI (1536) to Voyage (1024)
--
-- Safe to run because clf_chunk_embeddings is currently empty.
-- If any rows existed, this would error - check first:
--   SELECT count(*) FROM clf_chunk_embeddings;
-- =========================================================

-- Drop existing index (must drop before changing column type)
DROP INDEX IF EXISTS idx_chunk_emb_cosine;

-- Change column type
ALTER TABLE clf_chunk_embeddings
  ALTER COLUMN embedding TYPE vector(1024);

-- Update default model name
ALTER TABLE clf_chunk_embeddings
  ALTER COLUMN model SET DEFAULT 'voyage-3';

-- Recreate ivfflat index for new dimension
CREATE INDEX idx_chunk_emb_cosine
  ON clf_chunk_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =========================================================
-- Recreate match_chunks RPC for vector(1024)
-- =========================================================
DROP FUNCTION IF EXISTS match_chunks(vector, float, int, int);

CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  filter_hsk_level int DEFAULT NULL
)
RETURNS TABLE (
  chunk_id uuid,
  content text,
  title text,
  hsk_level int,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id AS chunk_id,
    c.content,
    c.title,
    c.hsk_level,
    c.metadata,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM clf_corpus_chunks c
  JOIN clf_chunk_embeddings e ON e.chunk_id = c.id
  WHERE
    (filter_hsk_level IS NULL OR c.hsk_level = filter_hsk_level)
    AND (1 - (e.embedding <=> query_embedding)) >= match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_chunks(vector, float, int, int) TO authenticated;

-- Verify:
SELECT proname FROM pg_proc WHERE proname = 'match_chunks';

SELECT
  column_name, data_type,
  CASE WHEN udt_name = 'vector' THEN
    'vector(' || atttypmod || ')'
  ELSE udt_name END AS type_detail
FROM information_schema.columns c
JOIN pg_attribute a ON a.attname = c.column_name
JOIN pg_class cl ON cl.oid = a.attrelid AND cl.relname = c.table_name
WHERE c.table_name = 'clf_chunk_embeddings' AND c.column_name = 'embedding';

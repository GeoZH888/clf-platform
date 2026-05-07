-- =========================================================
-- Phase G.10 — match_chunks RPC for vector similarity search
--
-- Returns chunks ranked by cosine similarity to query_embedding.
-- Optionally filtered by HSK level.
--
-- Usage from JS:
--   supabase.rpc('match_chunks', {
--     query_embedding: [...1536 floats...],
--     match_threshold: 0.5,
--     match_count: 10,
--     filter_hsk_level: 2,
--   })
-- =========================================================

CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION match_chunks(vector, float, int, int) TO authenticated;

-- Verify the function exists:
SELECT proname, prosrc IS NOT NULL AS has_body
FROM pg_proc
WHERE proname = 'match_chunks';

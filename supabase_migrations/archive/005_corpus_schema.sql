-- ═══════════════════════════════════════════════════════════════════════
--  大卫学中文 — RAG Corpus Schema (Stage 1)
--
--  Three tables + storage bucket + vector search RPC.
--  Safe to re-run.
--
--  Layers:
--    corpus_collections   — top-level buckets (人教 / HSK / 成语词典)
--    corpus_documents     — one row per uploaded file (PDF/Word/Excel)
--    corpus_chunks        — 500-1000 char chunks with pgvector embeddings
--                           carries {book_id, chapter, section, page} metadata
--
--  Voyage voyage-3 = 1024-dim embeddings (set in 002 earlier)
-- ═══════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 1. Collections (顶层分组) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS corpus_collections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,           -- 'renjiao', 'hsk', 'chengyu'
  name_zh       text NOT NULL,                  -- '人教版'
  name_en       text,                           -- 'People\'s Education Press'
  description   text,
  color         text DEFAULT '#8B4513',         -- UI color for tagging
  icon          text DEFAULT '📚',
  sort_order    int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- Seed the 3 collections you mentioned
INSERT INTO corpus_collections (slug, name_zh, name_en, icon, color, sort_order) VALUES
  ('renjiao',  '人教版',       'People''s Education Press',  '📘', '#1565C0', 1),
  ('hsk',      'HSK 标准',     'HSK 3.0 Standard',           '🎓', '#2E7D32', 2),
  ('chengyu',  '成语词典',     'Chengyu Dictionary',         '📜', '#8B4513', 3)
ON CONFLICT (slug) DO NOTHING;

-- ── 2. Documents (每个上传的文件) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS corpus_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id   uuid REFERENCES corpus_collections(id) ON DELETE CASCADE,
  title           text NOT NULL,                -- '人教三年级上册'
  author          text,
  language        text DEFAULT 'zh',            -- 'zh' | 'en' | 'bilingual'

  -- Storage reference (file lives in Supabase Storage 'corpus-files' bucket)
  storage_path    text,                         -- 'renjiao/grade3_vol1.pdf'
  file_size       bigint,                       -- bytes
  mime_type       text,                         -- 'application/pdf'
  page_count      int,

  -- Curriculum metadata (optional, fills via admin UI)
  grade           text,                         -- '三年级上册' / 'HSK 4'
  subject         text,                         -- '语文' / '词汇'
  year_published  int,

  -- Processing status
  status          text DEFAULT 'pending',       -- pending|processing|ready|error
  status_message  text,
  chunk_count     int DEFAULT 0,
  processed_at    timestamptz,

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_collection ON corpus_documents(collection_id);
CREATE INDEX IF NOT EXISTS idx_doc_status     ON corpus_documents(status);
CREATE INDEX IF NOT EXISTS idx_doc_grade      ON corpus_documents(grade);

-- ── 3. Chunks (带 embedding 的文本片段) ─────────────────────────────
CREATE TABLE IF NOT EXISTS corpus_chunks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid REFERENCES corpus_documents(id) ON DELETE CASCADE,
  collection_id   uuid REFERENCES corpus_collections(id) ON DELETE CASCADE, -- denorm for fast filter

  -- Content
  chunk_index     int NOT NULL,                 -- 在文档内的序号 0, 1, 2...
  content         text NOT NULL,                -- 原文 chunk
  content_hash    text,                         -- SHA256 for dedup
  token_count     int,                          -- 大概 token 数

  -- Structural metadata (the "mixed" approach)
  metadata        jsonb DEFAULT '{}'::jsonb,
  -- Expected keys:
  --   page            int     页码
  --   chapter         text    章/课 标题
  --   chapter_num     int     第几课
  --   section         text    节标题
  --   section_num     int     第几节
  --   paragraph_num   int     段落序号
  --   heading_path    text[]  ['三年级上册', '第二单元', '第5课', '自然之美']
  --   char_start      int     在原文档的字符偏移
  --   char_end        int

  -- Embedding (voyage-3 = 1024 dim)
  embedding       vector(1024),

  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chunk_doc        ON corpus_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunk_collection ON corpus_chunks(collection_id);
CREATE INDEX IF NOT EXISTS idx_chunk_hash       ON corpus_chunks(content_hash);

-- pgvector HNSW index for fast cosine similarity search
-- HNSW is better than IVFFlat for incremental inserts (ingestion grows over time)
CREATE INDEX IF NOT EXISTS idx_chunk_embedding
  ON corpus_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Full-text search on Chinese content (complements vector search for exact matches)
CREATE INDEX IF NOT EXISTS idx_chunk_content_trgm
  ON corpus_chunks
  USING gin (content gin_trgm_ops);

-- ── 4. RLS ──────────────────────────────────────────────────────────
ALTER TABLE corpus_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE corpus_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE corpus_chunks      ENABLE ROW LEVEL SECURITY;

-- Drop old policies if present
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('corpus_collections','corpus_documents','corpus_chunks')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Collections are admin-manageable but learners never see them directly
-- (Generated content uses RAG but paraphrased, per copyright concerns)
CREATE POLICY "adm_all_collections"  ON corpus_collections  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "adm_all_documents"    ON corpus_documents    FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "adm_all_chunks"       ON corpus_chunks       FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Collections and document TITLES can be publicly listed (no content leaked)
-- So learners' app can show "Based on 人教三年级上册" attribution without giving away chunks
CREATE POLICY "pub_read_collections" ON corpus_collections FOR SELECT USING (true);

-- ── 5. Vector Search RPC (simpler than raw SQL from client) ─────────
-- Usage from JS:
--   supabase.rpc('match_chunks', {
--     query_embedding: [0.1, 0.2, ...],     -- 1024 floats
--     match_threshold: 0.7,
--     match_count: 10,
--     filter_collection_slug: 'renjiao'     -- optional
--   })
DROP FUNCTION IF EXISTS match_chunks(vector, float, int, text);
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding         vector(1024),
  match_threshold         float DEFAULT 0.7,
  match_count             int   DEFAULT 10,
  filter_collection_slug  text  DEFAULT NULL
)
RETURNS TABLE (
  chunk_id        uuid,
  document_id     uuid,
  document_title  text,
  collection_slug text,
  content         text,
  metadata        jsonb,
  similarity      float
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    c.id               AS chunk_id,
    c.document_id,
    d.title            AS document_title,
    col.slug           AS collection_slug,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM corpus_chunks c
  JOIN corpus_documents d    ON d.id = c.document_id
  JOIN corpus_collections col ON col.id = c.collection_id
  WHERE
    (filter_collection_slug IS NULL OR col.slug = filter_collection_slug)
    AND c.embedding IS NOT NULL
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Grant execute so authenticated admin can call it
GRANT EXECUTE ON FUNCTION match_chunks TO authenticated;

-- ── 6. Storage bucket for corpus files ──────────────────────────────
-- Supabase doesn't allow creating buckets from SQL in all environments,
-- so run this in the Supabase Dashboard → Storage → Create bucket instead:
--
-- Name: corpus-files
-- Public: OFF (private, admin-only)
-- File size limit: 100 MB (adjust per your needs)
--
-- If storage bucket creation via SQL is supported in your project:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'corpus-files',
  'corpus-files',
  false,                                -- PRIVATE, admin only
  104857600,                            -- 100 MB per file
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain',
    'text/csv',
    'application/json'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: only admins read/write corpus files
DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "adm_corpus_select" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "adm_corpus_insert" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "adm_corpus_update" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "adm_corpus_delete" ON storage.objects';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "adm_corpus_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'corpus-files' AND is_admin());
CREATE POLICY "adm_corpus_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'corpus-files' AND is_admin());
CREATE POLICY "adm_corpus_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'corpus-files' AND is_admin());
CREATE POLICY "adm_corpus_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'corpus-files' AND is_admin());

-- ── Verify ──────────────────────────────────────────────────────────
-- SELECT slug, name_zh FROM corpus_collections ORDER BY sort_order;
-- -- Expected 3 rows: renjiao, hsk, chengyu

-- SELECT COUNT(*) FROM corpus_documents;  -- 0 (empty, ready)
-- SELECT COUNT(*) FROM corpus_chunks;     -- 0 (empty, ready)

-- SELECT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'corpus-files');
-- -- Expected: true

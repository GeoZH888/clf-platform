-- ═══════════════════════════════════════════════════════════════════════
--  大卫学中文 — New Infrastructure Migration (v1)
--  Target: Fresh Supabase project OR new schema in existing project
--  Run in: Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- for fuzzy text search

-- ════════════════════════════════════════════════════════════════════════
-- 2. RAG / Content-Source tables
-- ════════════════════════════════════════════════════════════════════════

-- Every uploaded file (PDF, ZIP, image, audio, animation, CSV, …)
CREATE TABLE content_sources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename      text NOT NULL,
  mime_type     text,
  size_bytes    bigint,
  storage_path  text NOT NULL,          -- path in Supabase Storage bucket
  source_type   text,                   -- 'pdf' | 'zip' | 'image' | 'audio' | 'video' | 'animation' | 'csv' | 'text'
  category      text,                   -- 'hsk' | 'renjiao' | 'custom' | 'media'
  subcategory   text,                   -- 'hsk_3' | 'renjiao_g3_s2' | …
  status        text DEFAULT 'uploaded',-- 'uploaded' | 'extracting' | 'classified' | 'embedding' | 'ready' | 'error'
  metadata      jsonb DEFAULT '{}'::jsonb,
  uploaded_by   uuid REFERENCES auth.users(id),
  error_message text,
  created_at    timestamptz DEFAULT now(),
  processed_at  timestamptz,
  parent_source uuid REFERENCES content_sources(id)  -- for files extracted from a ZIP
);
CREATE INDEX idx_sources_status   ON content_sources(status);
CREATE INDEX idx_sources_category ON content_sources(category);

-- Text chunks extracted from sources (embedded for RAG)
CREATE TABLE content_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   uuid REFERENCES content_sources(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  content     text NOT NULL,
  content_zh  text,                         -- separated Chinese
  content_en  text,                         -- separated English
  content_it  text,                         -- separated Italian
  page_number int,
  section_title text,
  embedding   vector(1536),                 -- OpenAI text-embedding-3-small
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_chunks_source    ON content_chunks(source_id);
CREATE INDEX idx_chunks_embedding ON content_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_chunks_text_gin  ON content_chunks USING gin(content gin_trgm_ops);

-- ════════════════════════════════════════════════════════════════════════
-- 3. Learning-content tables (powering Miaohong / Pinyin / 词语 modules)
-- ════════════════════════════════════════════════════════════════════════

-- Oracle-bone / traced characters (Miaohong module)
CREATE TABLE jgw_characters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  glyph_modern    text NOT NULL,
  glyph_oracle    text,
  pinyin          text,
  meaning_zh      text,
  meaning_en      text,
  meaning_it      text,
  mnemonic_en     text,
  mnemonic_zh     text,
  mnemonic_it     text,
  stroke_count    int,
  difficulty      int DEFAULT 1,
  etymology       text,
  radical         text,
  example_word_zh text,
  example_word_en text,
  set_id          text NOT NULL,
  tags            text[] DEFAULT '{}',
  source_id       uuid REFERENCES content_sources(id),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(glyph_modern, set_id)
);
CREATE INDEX idx_chars_set ON jgw_characters(set_id);

-- Pinyin module exercises (listen / type / tone / table)
CREATE TABLE jgw_pinyin_exercises (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_type text NOT NULL,                -- 'listen' | 'type' | 'tone' | 'table'
  char          text,
  pinyin        text,
  tone          int,
  options       jsonb,
  hint_zh       text,
  hint_en       text,
  hint_it       text,
  difficulty    int DEFAULT 1,
  set_id        text,
  source_id     uuid REFERENCES content_sources(id),
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX idx_pinyin_type ON jgw_pinyin_exercises(exercise_type);

-- Vocabulary (词语 module)
CREATE TABLE jgw_words (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word                text NOT NULL,
  pinyin              text,
  meaning_zh          text,
  meaning_en          text,
  meaning_it          text,
  example_sentence_zh text,
  example_sentence_en text,
  example_sentence_it text,
  audio_url           text,
  image_url           text,
  theme               text,                     -- 'family' | 'food' | 'school' | …
  hsk_level           int,
  difficulty          int DEFAULT 1,
  tags                text[] DEFAULT '{}',
  source_id           uuid REFERENCES content_sources(id),
  created_at          timestamptz DEFAULT now()
);
CREATE INDEX idx_words_theme ON jgw_words(theme);
CREATE INDEX idx_words_hsk   ON jgw_words(hsk_level);

-- HSK vocabulary (structured import)
CREATE TABLE jgw_hsk_words (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word           text NOT NULL,
  pinyin         text,
  meaning_zh     text,
  meaning_en     text,
  meaning_it     text,
  hsk_level      int NOT NULL,                  -- 1-6 (v2.0) or 1-9 (v3.0)
  hsk_version    text DEFAULT '2.0',
  frequency_rank int,
  source_id      uuid REFERENCES content_sources(id),
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX idx_hsk_level ON jgw_hsk_words(hsk_level, hsk_version);
CREATE UNIQUE INDEX idx_hsk_word_level_ver ON jgw_hsk_words(word, hsk_level, hsk_version);

-- Textbook sections (人教版 RenJiao + custom curricula)
CREATE TABLE jgw_textbook_sections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook        text NOT NULL,                -- 'renjiao' | 'custom' | …
  grade           int,
  semester        int,
  unit            int,
  lesson          int,
  title           text,
  content_zh      text,
  content_en      text,
  content_it      text,
  vocabulary      jsonb,                        -- [{word,pinyin,meaning},…]
  grammar_points  jsonb,
  audio_url       text,
  source_id       uuid REFERENCES content_sources(id),
  embedding       vector(1536),
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX idx_textbook_loc ON jgw_textbook_sections(textbook, grade, semester, unit, lesson);
CREATE INDEX idx_textbook_emb ON jgw_textbook_sections
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Media library (audio / image / animation / video)
CREATE TABLE jgw_media_assets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type       text NOT NULL,               -- 'audio' | 'image' | 'animation' | 'video'
  title            text,
  description_zh   text,
  description_en   text,
  description_it   text,
  storage_path     text NOT NULL,
  public_url       text,
  mime_type        text,
  duration_seconds int,                         -- audio / video
  dimensions       jsonb,                       -- {width,height}
  linked_content   jsonb DEFAULT '[]'::jsonb,   -- [{type:'character',id:uuid},…]
  tags             text[] DEFAULT '{}',
  source_id        uuid REFERENCES content_sources(id),
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX idx_media_type ON jgw_media_assets(asset_type);
CREATE INDEX idx_media_tags ON jgw_media_assets USING gin(tags);

-- ════════════════════════════════════════════════════════════════════════
-- 4. Progress / points (keeps existing behavior compatible)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE jgw_points (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token text NOT NULL,
  module       text NOT NULL,                   -- 'lianzi' | 'pinyin' | 'words' | …
  action       text,                            -- 'pinyin_listen_right' | …
  points       int DEFAULT 1,
  metadata     jsonb DEFAULT '{}'::jsonb,
  earned_at    timestamptz DEFAULT now()
);
CREATE INDEX idx_points_device_module ON jgw_points(device_token, module);
CREATE INDEX idx_points_earned        ON jgw_points(earned_at DESC);

-- Practice logs (existing pinyin_practice_log in code)
CREATE TABLE pinyin_practice_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token text NOT NULL,
  module       text NOT NULL,
  score        int,
  correct      int,
  total        int,
  attempts     int,
  created_at   timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════════════
-- 5. Admin + RAG infrastructure
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE admin_users (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  role       text DEFAULT 'admin',              -- 'admin' | 'superadmin'
  created_at timestamptz DEFAULT now()
);

-- Log of RAG queries (for analytics + debugging)
CREATE TABLE rag_queries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query           text NOT NULL,
  query_embedding vector(1536),
  matched_chunks  jsonb,                        -- [{chunk_id, similarity}, …]
  response        text,
  filter_category text,
  user_id         uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);

-- Async job queue (classification + embedding workers read this)
CREATE TABLE processing_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id    uuid REFERENCES content_sources(id) ON DELETE CASCADE,
  job_type     text NOT NULL,                   -- 'extract' | 'classify' | 'embed' | 'media_probe'
  status       text DEFAULT 'pending',          -- 'pending' | 'running' | 'done' | 'failed'
  attempts     int DEFAULT 0,
  error        text,
  payload      jsonb DEFAULT '{}'::jsonb,
  created_at   timestamptz DEFAULT now(),
  started_at   timestamptz,
  finished_at  timestamptz
);
CREATE INDEX idx_jobs_status ON processing_jobs(status, created_at);

-- ════════════════════════════════════════════════════════════════════════
-- 6. Helper functions
-- ════════════════════════════════════════════════════════════════════════

-- Check whether the current user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  );
$$;

-- Semantic search across all content chunks
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count     int   DEFAULT 10,
  filter_category text  DEFAULT NULL
)
RETURNS TABLE (
  chunk_id        uuid,
  source_id       uuid,
  content         text,
  page_number     int,
  section_title   text,
  similarity      float,
  source_filename text,
  source_category text
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id, cc.source_id, cc.content, cc.page_number, cc.section_title,
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

-- Semantic search for textbook sections only
CREATE OR REPLACE FUNCTION match_textbook_sections(
  query_embedding vector(1536),
  match_count     int   DEFAULT 5,
  filter_textbook text  DEFAULT NULL,
  filter_grade    int   DEFAULT NULL
)
RETURNS TABLE (
  section_id uuid, textbook text, grade int, semester int,
  unit int, lesson int, title text, content_zh text,
  similarity float
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ts.id, ts.textbook, ts.grade, ts.semester,
    ts.unit, ts.lesson, ts.title, ts.content_zh,
    1 - (ts.embedding <=> query_embedding) AS similarity
  FROM jgw_textbook_sections ts
  WHERE ts.embedding IS NOT NULL
    AND (filter_textbook IS NULL OR ts.textbook = filter_textbook)
    AND (filter_grade    IS NULL OR ts.grade    = filter_grade)
  ORDER BY ts.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 7. Row-Level Security
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE content_sources        ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_chunks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_characters         ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_pinyin_exercises   ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_words              ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_hsk_words          ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_textbook_sections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_media_assets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_points             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinyin_practice_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_queries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs        ENABLE ROW LEVEL SECURITY;

-- Public learners can read all learning content
CREATE POLICY "pub_read_chars"    ON jgw_characters        FOR SELECT USING (true);
CREATE POLICY "pub_read_pinyin"   ON jgw_pinyin_exercises  FOR SELECT USING (true);
CREATE POLICY "pub_read_words"    ON jgw_words             FOR SELECT USING (true);
CREATE POLICY "pub_read_hsk"      ON jgw_hsk_words         FOR SELECT USING (true);
CREATE POLICY "pub_read_textbook" ON jgw_textbook_sections FOR SELECT USING (true);
CREATE POLICY "pub_read_media"    ON jgw_media_assets      FOR SELECT USING (true);

-- Public learners can write their progress
CREATE POLICY "pub_write_points"  ON jgw_points          FOR INSERT WITH CHECK (true);
CREATE POLICY "pub_read_points"   ON jgw_points          FOR SELECT USING (true);
CREATE POLICY "pub_write_log"     ON pinyin_practice_log FOR INSERT WITH CHECK (true);
CREATE POLICY "pub_read_log"      ON pinyin_practice_log FOR SELECT USING (true);

-- Admins can do everything else
CREATE POLICY "admin_all_sources"  ON content_sources       FOR ALL USING (is_admin());
CREATE POLICY "admin_all_chunks"   ON content_chunks        FOR ALL USING (is_admin());
CREATE POLICY "admin_write_chars"  ON jgw_characters        FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "admin_upd_chars"    ON jgw_characters        FOR UPDATE USING (is_admin());
CREATE POLICY "admin_del_chars"    ON jgw_characters        FOR DELETE USING (is_admin());
CREATE POLICY "admin_write_pinyin" ON jgw_pinyin_exercises  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "admin_upd_pinyin"   ON jgw_pinyin_exercises  FOR UPDATE USING (is_admin());
CREATE POLICY "admin_del_pinyin"   ON jgw_pinyin_exercises  FOR DELETE USING (is_admin());
CREATE POLICY "admin_write_words"  ON jgw_words             FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "admin_upd_words"    ON jgw_words             FOR UPDATE USING (is_admin());
CREATE POLICY "admin_del_words"    ON jgw_words             FOR DELETE USING (is_admin());
CREATE POLICY "admin_write_hsk"    ON jgw_hsk_words         FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "admin_upd_hsk"      ON jgw_hsk_words         FOR UPDATE USING (is_admin());
CREATE POLICY "admin_del_hsk"      ON jgw_hsk_words         FOR DELETE USING (is_admin());
CREATE POLICY "admin_write_tb"     ON jgw_textbook_sections FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "admin_upd_tb"       ON jgw_textbook_sections FOR UPDATE USING (is_admin());
CREATE POLICY "admin_del_tb"       ON jgw_textbook_sections FOR DELETE USING (is_admin());
CREATE POLICY "admin_write_media"  ON jgw_media_assets      FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "admin_upd_media"    ON jgw_media_assets      FOR UPDATE USING (is_admin());
CREATE POLICY "admin_del_media"    ON jgw_media_assets      FOR DELETE USING (is_admin());
CREATE POLICY "admin_read_admin"   ON admin_users           FOR SELECT USING (is_admin());
CREATE POLICY "admin_all_jobs"     ON processing_jobs       FOR ALL USING (is_admin());
CREATE POLICY "admin_all_rag"      ON rag_queries           FOR ALL USING (is_admin());

-- ════════════════════════════════════════════════════════════════════════
-- 8. Storage buckets  (run these from Supabase dashboard if CLI-less)
-- ════════════════════════════════════════════════════════════════════════
--
-- INSERT INTO storage.buckets (id, name, public) VALUES
--   ('uploads', 'uploads', false),   -- raw source files
--   ('media',   'media',   true);    -- public media (audio/image for learners)
--
-- Then add Storage RLS: admins can INSERT/UPDATE/DELETE on 'uploads',
-- public SELECT on 'media'.

-- ════════════════════════════════════════════════════════════════════════
-- 9. Bootstrap admin (replace with your email after first sign-in)
-- ════════════════════════════════════════════════════════════════════════
--
-- 1. Sign in once at /admin (magic link) so auth.users has your row
-- 2. Then run:
--    INSERT INTO admin_users (user_id, email, role)
--    SELECT id, email, 'superadmin' FROM auth.users WHERE email = 'YOUR_EMAIL';

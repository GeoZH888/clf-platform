-- ═══════════════════════════════════════════════════════════════════════
--  大卫学中文 — Safe / Idempotent Migration (v1-safe)
--  Use THIS file instead of 001_new_infrastructure.sql when your Supabase
--  project already has jgw_characters / jgw_points / pinyin_practice_log
--  from the previous version. Safe to re-run multiple times.
--
--  What it does:
--   • Creates NEW tables only if missing  (IF NOT EXISTS)
--   • Adds missing COLUMNS to existing tables (ADD COLUMN IF NOT EXISTS)
--   • Adds UNIQUE / FK constraints only if absent (DO blocks)
--   • DROPs and re-creates all POLICIES (to avoid "already exists" errors)
--   • CREATE OR REPLACE for all functions
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Extensions -----------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ════════════════════════════════════════════════════════════════════════
-- 2. NEW tables (RAG / admin infrastructure — these don't exist yet)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS content_sources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename      text NOT NULL,
  mime_type     text,
  size_bytes    bigint,
  storage_path  text NOT NULL,
  source_type   text,
  category      text,
  subcategory   text,
  status        text DEFAULT 'uploaded',
  metadata      jsonb DEFAULT '{}'::jsonb,
  uploaded_by   uuid REFERENCES auth.users(id),
  error_message text,
  created_at    timestamptz DEFAULT now(),
  processed_at  timestamptz,
  parent_source uuid REFERENCES content_sources(id)
);
CREATE INDEX IF NOT EXISTS idx_sources_status   ON content_sources(status);
CREATE INDEX IF NOT EXISTS idx_sources_category ON content_sources(category);

CREATE TABLE IF NOT EXISTS content_chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     uuid REFERENCES content_sources(id) ON DELETE CASCADE,
  chunk_index   int NOT NULL,
  content       text NOT NULL,
  content_zh    text,
  content_en    text,
  content_it    text,
  page_number   int,
  section_title text,
  embedding     vector(1536),
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chunks_source    ON content_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON content_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_chunks_text_gin  ON content_chunks USING gin(content gin_trgm_ops);

CREATE TABLE IF NOT EXISTS jgw_words (
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
  theme               text,
  hsk_level           int,
  difficulty          int DEFAULT 1,
  tags                text[] DEFAULT '{}',
  source_id           uuid REFERENCES content_sources(id),
  created_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_words_theme ON jgw_words(theme);
CREATE INDEX IF NOT EXISTS idx_words_hsk   ON jgw_words(hsk_level);

CREATE TABLE IF NOT EXISTS jgw_hsk_words (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word           text NOT NULL,
  pinyin         text,
  meaning_zh     text,
  meaning_en     text,
  meaning_it     text,
  hsk_level      int NOT NULL,
  hsk_version    text DEFAULT '2.0',
  frequency_rank int,
  source_id      uuid REFERENCES content_sources(id),
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hsk_level ON jgw_hsk_words(hsk_level, hsk_version);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hsk_word_level_ver ON jgw_hsk_words(word, hsk_level, hsk_version);

CREATE TABLE IF NOT EXISTS jgw_textbook_sections (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook       text NOT NULL,
  grade          int,
  semester       int,
  unit           int,
  lesson         int,
  title          text,
  content_zh     text,
  content_en     text,
  content_it     text,
  vocabulary     jsonb,
  grammar_points jsonb,
  audio_url      text,
  source_id      uuid REFERENCES content_sources(id),
  embedding      vector(1536),
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_textbook_loc ON jgw_textbook_sections(textbook, grade, semester, unit, lesson);
CREATE INDEX IF NOT EXISTS idx_textbook_emb ON jgw_textbook_sections
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

CREATE TABLE IF NOT EXISTS jgw_media_assets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type       text NOT NULL,
  title            text,
  description_zh   text,
  description_en   text,
  description_it   text,
  storage_path     text NOT NULL,
  public_url       text,
  mime_type        text,
  duration_seconds int,
  dimensions       jsonb,
  linked_content   jsonb DEFAULT '[]'::jsonb,
  tags             text[] DEFAULT '{}',
  source_id        uuid REFERENCES content_sources(id),
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_type ON jgw_media_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_media_tags ON jgw_media_assets USING gin(tags);

CREATE TABLE IF NOT EXISTS admin_users (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  role       text DEFAULT 'admin',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rag_queries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query           text NOT NULL,
  query_embedding vector(1536),
  matched_chunks  jsonb,
  response        text,
  filter_category text,
  user_id         uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS processing_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   uuid REFERENCES content_sources(id) ON DELETE CASCADE,
  job_type    text NOT NULL,
  status      text DEFAULT 'pending',
  attempts    int DEFAULT 0,
  error       text,
  payload     jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now(),
  started_at  timestamptz,
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON processing_jobs(status, created_at);

-- ════════════════════════════════════════════════════════════════════════
-- 3. EXISTING tables — create if missing, add columns if missing
-- ════════════════════════════════════════════════════════════════════════

-- jgw_characters ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS jgw_characters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  glyph_modern    text NOT NULL,
  set_id          text NOT NULL,
  created_at      timestamptz DEFAULT now()
);
-- Add any missing columns (no-op if they already exist)
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS glyph_oracle    text;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS pinyin          text;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS meaning_zh      text;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS meaning_en      text;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS meaning_it      text;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS mnemonic_en     text;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS mnemonic_zh     text;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS mnemonic_it     text;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS stroke_count    int;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS difficulty      int DEFAULT 1;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS etymology       text;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS radical         text;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS example_word_zh text;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS example_word_en text;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS tags            text[] DEFAULT '{}';
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS source_id       uuid REFERENCES content_sources(id);

CREATE INDEX IF NOT EXISTS idx_chars_set ON jgw_characters(set_id);

-- Add UNIQUE(glyph_modern, set_id) only if absent
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'jgw_characters'::regclass
      AND conname = 'jgw_characters_glyph_set_key'
  ) THEN
    -- Safe only if no duplicates exist. If this fails, de-dupe first.
    BEGIN
      ALTER TABLE jgw_characters
        ADD CONSTRAINT jgw_characters_glyph_set_key
        UNIQUE (glyph_modern, set_id);
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'Skipping UNIQUE(glyph_modern,set_id): duplicates exist. Run SELECT glyph_modern,set_id,COUNT(*) FROM jgw_characters GROUP BY 1,2 HAVING COUNT(*)>1; to find them.';
    END;
  END IF;
END $$;

-- jgw_pinyin_exercises ---------------------------------------------------
-- The NEW normalized row-per-exercise schema. Old code expects a single row
-- with JSON arrays; we add the new columns non-destructively so BOTH shapes
-- coexist while you migrate.
CREATE TABLE IF NOT EXISTS jgw_pinyin_exercises (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS exercise_type text;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS char          text;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS pinyin        text;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS tone          int;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS options       jsonb;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS hint_zh       text;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS hint_en       text;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS hint_it       text;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS difficulty    int DEFAULT 1;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS set_id        text;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS source_id     uuid REFERENCES content_sources(id);
-- Legacy JSON-array columns (your existing ListenIdentify.jsx / TypePinyin.jsx
-- read these via .maybeSingle()). Keep them:
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS listen_exercises jsonb;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS type_exercises   jsonb;

CREATE INDEX IF NOT EXISTS idx_pinyin_type ON jgw_pinyin_exercises(exercise_type);

-- jgw_points -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jgw_points (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token text NOT NULL,
  module       text NOT NULL,
  points       int DEFAULT 1,
  earned_at    timestamptz DEFAULT now()
);
ALTER TABLE jgw_points ADD COLUMN IF NOT EXISTS action   text;
ALTER TABLE jgw_points ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_points_device_module ON jgw_points(device_token, module);
CREATE INDEX IF NOT EXISTS idx_points_earned        ON jgw_points(earned_at DESC);

-- pinyin_practice_log ----------------------------------------------------
CREATE TABLE IF NOT EXISTS pinyin_practice_log (
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
-- 4. Functions (CREATE OR REPLACE — always safe to re-run)
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count     int   DEFAULT 10,
  filter_category text  DEFAULT NULL
)
RETURNS TABLE (
  chunk_id        uuid,   source_id       uuid,    content         text,
  page_number     int,    section_title   text,    similarity      float,
  source_filename text,   source_category text
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
  query_embedding vector(1536),
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

-- ════════════════════════════════════════════════════════════════════════
-- 5. RLS — enable once, then drop + recreate policies (idempotent)
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

-- Drop + recreate (avoids "policy already exists" on re-run)
DROP POLICY IF EXISTS "pub_read_chars"    ON jgw_characters;
DROP POLICY IF EXISTS "pub_read_pinyin"   ON jgw_pinyin_exercises;
DROP POLICY IF EXISTS "pub_read_words"    ON jgw_words;
DROP POLICY IF EXISTS "pub_read_hsk"      ON jgw_hsk_words;
DROP POLICY IF EXISTS "pub_read_textbook" ON jgw_textbook_sections;
DROP POLICY IF EXISTS "pub_read_media"    ON jgw_media_assets;
DROP POLICY IF EXISTS "pub_write_points"  ON jgw_points;
DROP POLICY IF EXISTS "pub_read_points"   ON jgw_points;
DROP POLICY IF EXISTS "pub_write_log"     ON pinyin_practice_log;
DROP POLICY IF EXISTS "pub_read_log"      ON pinyin_practice_log;
DROP POLICY IF EXISTS "admin_all_sources" ON content_sources;
DROP POLICY IF EXISTS "admin_all_chunks"  ON content_chunks;
DROP POLICY IF EXISTS "admin_write_chars" ON jgw_characters;
DROP POLICY IF EXISTS "admin_upd_chars"   ON jgw_characters;
DROP POLICY IF EXISTS "admin_del_chars"   ON jgw_characters;
DROP POLICY IF EXISTS "admin_write_pinyin" ON jgw_pinyin_exercises;
DROP POLICY IF EXISTS "admin_upd_pinyin"  ON jgw_pinyin_exercises;
DROP POLICY IF EXISTS "admin_del_pinyin"  ON jgw_pinyin_exercises;
DROP POLICY IF EXISTS "admin_write_words" ON jgw_words;
DROP POLICY IF EXISTS "admin_upd_words"   ON jgw_words;
DROP POLICY IF EXISTS "admin_del_words"   ON jgw_words;
DROP POLICY IF EXISTS "admin_write_hsk"   ON jgw_hsk_words;
DROP POLICY IF EXISTS "admin_upd_hsk"     ON jgw_hsk_words;
DROP POLICY IF EXISTS "admin_del_hsk"     ON jgw_hsk_words;
DROP POLICY IF EXISTS "admin_write_tb"    ON jgw_textbook_sections;
DROP POLICY IF EXISTS "admin_upd_tb"      ON jgw_textbook_sections;
DROP POLICY IF EXISTS "admin_del_tb"      ON jgw_textbook_sections;
DROP POLICY IF EXISTS "admin_write_media" ON jgw_media_assets;
DROP POLICY IF EXISTS "admin_upd_media"   ON jgw_media_assets;
DROP POLICY IF EXISTS "admin_del_media"   ON jgw_media_assets;
DROP POLICY IF EXISTS "admin_read_admin"  ON admin_users;
DROP POLICY IF EXISTS "admin_all_jobs"    ON processing_jobs;
DROP POLICY IF EXISTS "admin_all_rag"     ON rag_queries;

-- Public read on learning content
CREATE POLICY "pub_read_chars"    ON jgw_characters        FOR SELECT USING (true);
CREATE POLICY "pub_read_pinyin"   ON jgw_pinyin_exercises  FOR SELECT USING (true);
CREATE POLICY "pub_read_words"    ON jgw_words             FOR SELECT USING (true);
CREATE POLICY "pub_read_hsk"      ON jgw_hsk_words         FOR SELECT USING (true);
CREATE POLICY "pub_read_textbook" ON jgw_textbook_sections FOR SELECT USING (true);
CREATE POLICY "pub_read_media"    ON jgw_media_assets      FOR SELECT USING (true);

-- Public progress writes
CREATE POLICY "pub_write_points"  ON jgw_points          FOR INSERT WITH CHECK (true);
CREATE POLICY "pub_read_points"   ON jgw_points          FOR SELECT USING (true);
CREATE POLICY "pub_write_log"     ON pinyin_practice_log FOR INSERT WITH CHECK (true);
CREATE POLICY "pub_read_log"      ON pinyin_practice_log FOR SELECT USING (true);

-- Admin-only on everything else
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
-- 6. Sanity check — paste the SELECTs below into a separate query to verify:
-- ════════════════════════════════════════════════════════════════════════
--
--  SELECT table_name FROM information_schema.tables
--  WHERE table_schema='public' ORDER BY table_name;
--
--  Expected tables (14):
--    admin_users, content_chunks, content_sources, jgw_characters,
--    jgw_hsk_words, jgw_media_assets, jgw_pinyin_exercises, jgw_points,
--    jgw_textbook_sections, jgw_words, pinyin_practice_log,
--    processing_jobs, rag_queries
--
--  Column check on jgw_characters (should include source_id, tags, etc):
--    SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name='jgw_characters' ORDER BY ordinal_position;
--
-- ════════════════════════════════════════════════════════════════════════
-- 7. Storage buckets (run from Dashboard → Storage, not SQL):
-- ════════════════════════════════════════════════════════════════════════
--   • 'uploads' — PRIVATE
--   • 'media'   — PUBLIC
--
-- 8. Bootstrap yourself as superadmin (after first magic-link sign-in):
--   INSERT INTO admin_users (user_id, email, role)
--   SELECT id, email, 'superadmin' FROM auth.users WHERE email='YOUR_EMAIL';

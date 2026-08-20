-- ═══════════════════════════════════════════════════════════════════════
--  大卫学中文 — Bulletproof Migration (v1-bp)
--  Use THIS instead of earlier versions. Fixes:
--   • "relation jgw_characters already exists" — was v1
--   • "column hsk_version does not exist"     — was v1-safe
--
--  How: every table is CREATE TABLE IF NOT EXISTS with only the PK,
--  then every real column is ALTER TABLE ADD COLUMN IF NOT EXISTS.
--  This handles ANY partial prior state — fresh DB, full DB, half-built DB.
--  Re-runnable as many times as you want.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ════════════════════════════════════════════════════════════════════════
-- 2. content_sources
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS content_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS filename      text;
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS mime_type     text;
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS size_bytes    bigint;
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS storage_path  text;
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS source_type   text;
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS category      text;
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS subcategory   text;
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS status        text DEFAULT 'uploaded';
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS metadata      jsonb DEFAULT '{}'::jsonb;
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS uploaded_by   uuid;
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS created_at    timestamptz DEFAULT now();
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS processed_at  timestamptz;
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS parent_source uuid;

-- FK constraints — added via DO block so re-runs don't duplicate
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='content_sources_uploaded_by_fkey') THEN
    ALTER TABLE content_sources ADD CONSTRAINT content_sources_uploaded_by_fkey
      FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='content_sources_parent_source_fkey') THEN
    ALTER TABLE content_sources ADD CONSTRAINT content_sources_parent_source_fkey
      FOREIGN KEY (parent_source) REFERENCES content_sources(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sources_status   ON content_sources(status);
CREATE INDEX IF NOT EXISTS idx_sources_category ON content_sources(category);

-- ════════════════════════════════════════════════════════════════════════
-- 3. content_chunks
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS content_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS source_id     uuid;
ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS chunk_index   int;
ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS content       text;
ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS content_zh    text;
ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS content_en    text;
ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS content_it    text;
ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS page_number   int;
ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS section_title text;
ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS embedding     vector(1536);
ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS metadata      jsonb DEFAULT '{}'::jsonb;
ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS created_at    timestamptz DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='content_chunks_source_id_fkey') THEN
    ALTER TABLE content_chunks ADD CONSTRAINT content_chunks_source_id_fkey
      FOREIGN KEY (source_id) REFERENCES content_sources(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chunks_source    ON content_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON content_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_chunks_text_gin  ON content_chunks USING gin(content gin_trgm_ops);

-- ════════════════════════════════════════════════════════════════════════
-- 4. jgw_characters
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS jgw_characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS glyph_modern    text;
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
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS set_id          text;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS tags            text[] DEFAULT '{}';
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS source_id       uuid;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS created_at      timestamptz DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='jgw_characters_source_id_fkey') THEN
    ALTER TABLE jgw_characters ADD CONSTRAINT jgw_characters_source_id_fkey
      FOREIGN KEY (source_id) REFERENCES content_sources(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='jgw_characters_glyph_set_key') THEN
    BEGIN
      ALTER TABLE jgw_characters ADD CONSTRAINT jgw_characters_glyph_set_key
        UNIQUE (glyph_modern, set_id);
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'Skipping UNIQUE(glyph_modern,set_id): dedupe first with: SELECT glyph_modern,set_id,COUNT(*) FROM jgw_characters GROUP BY 1,2 HAVING COUNT(*)>1;';
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chars_set ON jgw_characters(set_id);

-- ════════════════════════════════════════════════════════════════════════
-- 5. jgw_pinyin_exercises
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS jgw_pinyin_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS exercise_type    text;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS char             text;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS pinyin           text;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS tone             int;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS options          jsonb;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS hint_zh          text;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS hint_en          text;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS hint_it          text;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS difficulty       int DEFAULT 1;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS set_id           text;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS source_id        uuid;
-- Legacy JSON-array columns kept for your existing ListenIdentify.jsx / TypePinyin.jsx:
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS listen_exercises jsonb;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS type_exercises   jsonb;
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS created_at       timestamptz DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='jgw_pinyin_exercises_source_id_fkey') THEN
    ALTER TABLE jgw_pinyin_exercises ADD CONSTRAINT jgw_pinyin_exercises_source_id_fkey
      FOREIGN KEY (source_id) REFERENCES content_sources(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pinyin_type ON jgw_pinyin_exercises(exercise_type);

-- ════════════════════════════════════════════════════════════════════════
-- 6. jgw_words (词语 module)
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS jgw_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS word                text;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS pinyin              text;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS meaning_zh          text;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS meaning_en          text;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS meaning_it          text;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS example_sentence_zh text;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS example_sentence_en text;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS example_sentence_it text;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS audio_url           text;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS image_url           text;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS theme               text;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS hsk_level           int;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS difficulty          int DEFAULT 1;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS tags                text[] DEFAULT '{}';
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS source_id           uuid;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS created_at          timestamptz DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='jgw_words_source_id_fkey') THEN
    ALTER TABLE jgw_words ADD CONSTRAINT jgw_words_source_id_fkey
      FOREIGN KEY (source_id) REFERENCES content_sources(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_words_theme ON jgw_words(theme);
CREATE INDEX IF NOT EXISTS idx_words_hsk   ON jgw_words(hsk_level);

-- ════════════════════════════════════════════════════════════════════════
-- 7. jgw_hsk_words ← the one that just failed
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS jgw_hsk_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE jgw_hsk_words ADD COLUMN IF NOT EXISTS word           text;
ALTER TABLE jgw_hsk_words ADD COLUMN IF NOT EXISTS pinyin         text;
ALTER TABLE jgw_hsk_words ADD COLUMN IF NOT EXISTS meaning_zh     text;
ALTER TABLE jgw_hsk_words ADD COLUMN IF NOT EXISTS meaning_en     text;
ALTER TABLE jgw_hsk_words ADD COLUMN IF NOT EXISTS meaning_it     text;
ALTER TABLE jgw_hsk_words ADD COLUMN IF NOT EXISTS hsk_level      int;
ALTER TABLE jgw_hsk_words ADD COLUMN IF NOT EXISTS hsk_version    text DEFAULT '2.0';
ALTER TABLE jgw_hsk_words ADD COLUMN IF NOT EXISTS frequency_rank int;
ALTER TABLE jgw_hsk_words ADD COLUMN IF NOT EXISTS source_id      uuid;
ALTER TABLE jgw_hsk_words ADD COLUMN IF NOT EXISTS created_at     timestamptz DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='jgw_hsk_words_source_id_fkey') THEN
    ALTER TABLE jgw_hsk_words ADD CONSTRAINT jgw_hsk_words_source_id_fkey
      FOREIGN KEY (source_id) REFERENCES content_sources(id);
  END IF;
END $$;

-- Indexes come AFTER ADD COLUMN, so referenced columns are guaranteed present
CREATE INDEX IF NOT EXISTS idx_hsk_level ON jgw_hsk_words(hsk_level, hsk_version);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hsk_word_level_ver
  ON jgw_hsk_words(word, hsk_level, hsk_version);

-- ════════════════════════════════════════════════════════════════════════
-- 8. jgw_textbook_sections
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS jgw_textbook_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE jgw_textbook_sections ADD COLUMN IF NOT EXISTS textbook       text;
ALTER TABLE jgw_textbook_sections ADD COLUMN IF NOT EXISTS grade          int;
ALTER TABLE jgw_textbook_sections ADD COLUMN IF NOT EXISTS semester       int;
ALTER TABLE jgw_textbook_sections ADD COLUMN IF NOT EXISTS unit           int;
ALTER TABLE jgw_textbook_sections ADD COLUMN IF NOT EXISTS lesson         int;
ALTER TABLE jgw_textbook_sections ADD COLUMN IF NOT EXISTS title          text;
ALTER TABLE jgw_textbook_sections ADD COLUMN IF NOT EXISTS content_zh     text;
ALTER TABLE jgw_textbook_sections ADD COLUMN IF NOT EXISTS content_en     text;
ALTER TABLE jgw_textbook_sections ADD COLUMN IF NOT EXISTS content_it     text;
ALTER TABLE jgw_textbook_sections ADD COLUMN IF NOT EXISTS vocabulary     jsonb;
ALTER TABLE jgw_textbook_sections ADD COLUMN IF NOT EXISTS grammar_points jsonb;
ALTER TABLE jgw_textbook_sections ADD COLUMN IF NOT EXISTS audio_url      text;
ALTER TABLE jgw_textbook_sections ADD COLUMN IF NOT EXISTS source_id      uuid;
ALTER TABLE jgw_textbook_sections ADD COLUMN IF NOT EXISTS embedding      vector(1536);
ALTER TABLE jgw_textbook_sections ADD COLUMN IF NOT EXISTS created_at     timestamptz DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='jgw_textbook_sections_source_id_fkey') THEN
    ALTER TABLE jgw_textbook_sections ADD CONSTRAINT jgw_textbook_sections_source_id_fkey
      FOREIGN KEY (source_id) REFERENCES content_sources(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_textbook_loc ON jgw_textbook_sections(textbook, grade, semester, unit, lesson);
CREATE INDEX IF NOT EXISTS idx_textbook_emb ON jgw_textbook_sections
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- ════════════════════════════════════════════════════════════════════════
-- 9. jgw_media_assets
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS jgw_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE jgw_media_assets ADD COLUMN IF NOT EXISTS asset_type       text;
ALTER TABLE jgw_media_assets ADD COLUMN IF NOT EXISTS title            text;
ALTER TABLE jgw_media_assets ADD COLUMN IF NOT EXISTS description_zh   text;
ALTER TABLE jgw_media_assets ADD COLUMN IF NOT EXISTS description_en   text;
ALTER TABLE jgw_media_assets ADD COLUMN IF NOT EXISTS description_it   text;
ALTER TABLE jgw_media_assets ADD COLUMN IF NOT EXISTS storage_path     text;
ALTER TABLE jgw_media_assets ADD COLUMN IF NOT EXISTS public_url       text;
ALTER TABLE jgw_media_assets ADD COLUMN IF NOT EXISTS mime_type        text;
ALTER TABLE jgw_media_assets ADD COLUMN IF NOT EXISTS duration_seconds int;
ALTER TABLE jgw_media_assets ADD COLUMN IF NOT EXISTS dimensions       jsonb;
ALTER TABLE jgw_media_assets ADD COLUMN IF NOT EXISTS linked_content   jsonb DEFAULT '[]'::jsonb;
ALTER TABLE jgw_media_assets ADD COLUMN IF NOT EXISTS tags             text[] DEFAULT '{}';
ALTER TABLE jgw_media_assets ADD COLUMN IF NOT EXISTS source_id        uuid;
ALTER TABLE jgw_media_assets ADD COLUMN IF NOT EXISTS created_at       timestamptz DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='jgw_media_assets_source_id_fkey') THEN
    ALTER TABLE jgw_media_assets ADD CONSTRAINT jgw_media_assets_source_id_fkey
      FOREIGN KEY (source_id) REFERENCES content_sources(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_media_type ON jgw_media_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_media_tags ON jgw_media_assets USING gin(tags);

-- ════════════════════════════════════════════════════════════════════════
-- 10. jgw_points
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS jgw_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE jgw_points ADD COLUMN IF NOT EXISTS device_token text;
ALTER TABLE jgw_points ADD COLUMN IF NOT EXISTS module       text;
ALTER TABLE jgw_points ADD COLUMN IF NOT EXISTS action       text;
ALTER TABLE jgw_points ADD COLUMN IF NOT EXISTS points       int DEFAULT 1;
ALTER TABLE jgw_points ADD COLUMN IF NOT EXISTS metadata     jsonb DEFAULT '{}'::jsonb;
ALTER TABLE jgw_points ADD COLUMN IF NOT EXISTS earned_at    timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_points_device_module ON jgw_points(device_token, module);
CREATE INDEX IF NOT EXISTS idx_points_earned        ON jgw_points(earned_at DESC);

-- ════════════════════════════════════════════════════════════════════════
-- 11. pinyin_practice_log
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pinyin_practice_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE pinyin_practice_log ADD COLUMN IF NOT EXISTS device_token text;
ALTER TABLE pinyin_practice_log ADD COLUMN IF NOT EXISTS module       text;
ALTER TABLE pinyin_practice_log ADD COLUMN IF NOT EXISTS score        int;
ALTER TABLE pinyin_practice_log ADD COLUMN IF NOT EXISTS correct      int;
ALTER TABLE pinyin_practice_log ADD COLUMN IF NOT EXISTS total        int;
ALTER TABLE pinyin_practice_log ADD COLUMN IF NOT EXISTS attempts     int;
ALTER TABLE pinyin_practice_log ADD COLUMN IF NOT EXISTS created_at   timestamptz DEFAULT now();

-- ════════════════════════════════════════════════════════════════════════
-- 12. admin_users
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid PRIMARY KEY
);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS email      text;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role       text DEFAULT 'admin';
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='admin_users_user_id_fkey') THEN
    ALTER TABLE admin_users ADD CONSTRAINT admin_users_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════
-- 13. rag_queries
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS rag_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE rag_queries ADD COLUMN IF NOT EXISTS query           text;
ALTER TABLE rag_queries ADD COLUMN IF NOT EXISTS query_embedding vector(1536);
ALTER TABLE rag_queries ADD COLUMN IF NOT EXISTS matched_chunks  jsonb;
ALTER TABLE rag_queries ADD COLUMN IF NOT EXISTS response        text;
ALTER TABLE rag_queries ADD COLUMN IF NOT EXISTS filter_category text;
ALTER TABLE rag_queries ADD COLUMN IF NOT EXISTS user_id         uuid;
ALTER TABLE rag_queries ADD COLUMN IF NOT EXISTS created_at      timestamptz DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='rag_queries_user_id_fkey') THEN
    ALTER TABLE rag_queries ADD CONSTRAINT rag_queries_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════
-- 14. processing_jobs
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS source_id   uuid;
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS job_type    text;
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS status      text DEFAULT 'pending';
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS attempts    int DEFAULT 0;
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS error       text;
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS payload     jsonb DEFAULT '{}'::jsonb;
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now();
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS started_at  timestamptz;
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS finished_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='processing_jobs_source_id_fkey') THEN
    ALTER TABLE processing_jobs ADD CONSTRAINT processing_jobs_source_id_fkey
      FOREIGN KEY (source_id) REFERENCES content_sources(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_status ON processing_jobs(status, created_at);

-- ════════════════════════════════════════════════════════════════════════
-- 15. Functions (always safe to CREATE OR REPLACE)
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
-- 16. RLS (enable is idempotent; policies use DROP/CREATE pattern)
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

DROP POLICY IF EXISTS "pub_read_chars"     ON jgw_characters;
DROP POLICY IF EXISTS "pub_read_pinyin"    ON jgw_pinyin_exercises;
DROP POLICY IF EXISTS "pub_read_words"     ON jgw_words;
DROP POLICY IF EXISTS "pub_read_hsk"       ON jgw_hsk_words;
DROP POLICY IF EXISTS "pub_read_textbook"  ON jgw_textbook_sections;
DROP POLICY IF EXISTS "pub_read_media"     ON jgw_media_assets;
DROP POLICY IF EXISTS "pub_write_points"   ON jgw_points;
DROP POLICY IF EXISTS "pub_read_points"    ON jgw_points;
DROP POLICY IF EXISTS "pub_write_log"      ON pinyin_practice_log;
DROP POLICY IF EXISTS "pub_read_log"       ON pinyin_practice_log;
DROP POLICY IF EXISTS "admin_all_sources"  ON content_sources;
DROP POLICY IF EXISTS "admin_all_chunks"   ON content_chunks;
DROP POLICY IF EXISTS "admin_write_chars"  ON jgw_characters;
DROP POLICY IF EXISTS "admin_upd_chars"    ON jgw_characters;
DROP POLICY IF EXISTS "admin_del_chars"    ON jgw_characters;
DROP POLICY IF EXISTS "admin_write_pinyin" ON jgw_pinyin_exercises;
DROP POLICY IF EXISTS "admin_upd_pinyin"   ON jgw_pinyin_exercises;
DROP POLICY IF EXISTS "admin_del_pinyin"   ON jgw_pinyin_exercises;
DROP POLICY IF EXISTS "admin_write_words"  ON jgw_words;
DROP POLICY IF EXISTS "admin_upd_words"    ON jgw_words;
DROP POLICY IF EXISTS "admin_del_words"    ON jgw_words;
DROP POLICY IF EXISTS "admin_write_hsk"    ON jgw_hsk_words;
DROP POLICY IF EXISTS "admin_upd_hsk"      ON jgw_hsk_words;
DROP POLICY IF EXISTS "admin_del_hsk"      ON jgw_hsk_words;
DROP POLICY IF EXISTS "admin_write_tb"     ON jgw_textbook_sections;
DROP POLICY IF EXISTS "admin_upd_tb"       ON jgw_textbook_sections;
DROP POLICY IF EXISTS "admin_del_tb"       ON jgw_textbook_sections;
DROP POLICY IF EXISTS "admin_write_media"  ON jgw_media_assets;
DROP POLICY IF EXISTS "admin_upd_media"    ON jgw_media_assets;
DROP POLICY IF EXISTS "admin_del_media"    ON jgw_media_assets;
DROP POLICY IF EXISTS "admin_read_admin"   ON admin_users;
DROP POLICY IF EXISTS "admin_all_jobs"     ON processing_jobs;
DROP POLICY IF EXISTS "admin_all_rag"      ON rag_queries;

CREATE POLICY "pub_read_chars"    ON jgw_characters        FOR SELECT USING (true);
CREATE POLICY "pub_read_pinyin"   ON jgw_pinyin_exercises  FOR SELECT USING (true);
CREATE POLICY "pub_read_words"    ON jgw_words             FOR SELECT USING (true);
CREATE POLICY "pub_read_hsk"      ON jgw_hsk_words         FOR SELECT USING (true);
CREATE POLICY "pub_read_textbook" ON jgw_textbook_sections FOR SELECT USING (true);
CREATE POLICY "pub_read_media"    ON jgw_media_assets      FOR SELECT USING (true);

CREATE POLICY "pub_write_points"  ON jgw_points          FOR INSERT WITH CHECK (true);
CREATE POLICY "pub_read_points"   ON jgw_points          FOR SELECT USING (true);
CREATE POLICY "pub_write_log"     ON pinyin_practice_log FOR INSERT WITH CHECK (true);
CREATE POLICY "pub_read_log"      ON pinyin_practice_log FOR SELECT USING (true);

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
-- Done. Run this to verify (13 tables expected):
--
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' ORDER BY table_name;
--
-- Then in Supabase Dashboard → Storage, create buckets:
--   • 'uploads' (private)
--   • 'media'   (public)
-- ════════════════════════════════════════════════════════════════════════

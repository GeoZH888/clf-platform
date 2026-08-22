-- ============================================================
-- 大卫学中文 · Chinese Language Foundation (CLF) Database
-- Heritage Chinese Learning Platform
-- Version 1.0
-- ============================================================
-- Run this ONCE in Supabase SQL Editor.
-- Existing jgw_* tables are NOT touched.
-- New clf_* tables are created alongside.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;  -- for RAG embeddings

-- ============================================================
-- LAYER 1: ATOMIC UNITS
-- ============================================================

-- Radicals (部首) — building blocks of characters
CREATE TABLE IF NOT EXISTS clf_radicals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  radical      text UNIQUE NOT NULL,   -- e.g. 水
  radical_num  int,                    -- Kangxi radical number (1-214)
  strokes      int,
  meaning_zh   text,
  meaning_en   text,
  meaning_it   text,
  pinyin       text,
  example_chars text[],                -- characters using this radical
  audio_url    text,
  image_url    text,
  sort_order   int DEFAULT 0,
  active       boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- Characters (汉字) — individual Chinese characters
-- Absorbs: jgw_characters
CREATE TABLE IF NOT EXISTS clf_characters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character       text UNIQUE NOT NULL,   -- e.g. 爱
  pinyin          text,                   -- ài
  tones           int[],                  -- [4] = 4th tone
  strokes         int,
  radical_id      uuid REFERENCES clf_radicals(id),
  hsk_level       int,                    -- 1-6, null if not in HSK
  frequency_rank  int,                    -- rank in modern Chinese corpus
  meaning_zh      text,
  meaning_en      text,
  meaning_it      text,
  example_word    text,                   -- most common word using this char
  example_zh      text,
  example_en      text,
  stroke_order    jsonb,                  -- [{stroke:1, direction:'horizontal'}, ...]
  stroke_svg      text,                   -- animated SVG or hanzi-writer compatible
  audio_url       text,                   -- TTS pronunciation
  image_url       text,
  level           int DEFAULT 1,          -- 1=preschool ... 6=advanced
  age_min         int DEFAULT 5,
  tags            text[],
  sort_order      int DEFAULT 0,
  active          boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- LAYER 2: LEXICAL
-- ============================================================

-- Words & Vocabulary (词汇)
-- Absorbs: jgw_words + jgw_hsk_words
CREATE TABLE IF NOT EXISTS clf_words (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word            text NOT NULL,
  pinyin          text,
  hsk_level       int,                    -- 1-6
  school_level    int,                    -- school year 1-12
  frequency_rank  int,
  category        text,                   -- 名词/动词/形容词/副词/...
  topic           text,                   -- family/food/school/body/nature/...
  meaning_zh      text,
  meaning_en      text,
  meaning_it      text,
  example_zh      text,
  example_en      text,
  example_it      text,
  audio_url       text,
  image_url       text,
  animation_url   text,
  -- Heritage context
  context_notes   text,                   -- notes for diaspora learners
  related_word_ids uuid[],               -- semantically related words
  antonym_ids     uuid[],
  tags            text[],
  level           int DEFAULT 1,
  active          boolean DEFAULT true,
  sort_order      int DEFAULT 0,
  UNIQUE(word, hsk_level),
  created_at      timestamptz DEFAULT now()
);

-- Grammar Patterns (语法)
-- Absorbs: jgw_grammar_patterns
CREATE TABLE IF NOT EXISTS clf_grammar (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern         text UNIQUE NOT NULL,   -- e.g. 把字句
  pattern_en      text,
  hsk_level       int,
  school_level    int,
  difficulty      int DEFAULT 1,          -- 1-5
  theme           text,                   -- structure/comparison/aspect/logic/modal
  rule_zh         text,
  rule_en         text,
  rule_it         text,
  example_zh      text,
  example_en      text,
  example_it      text,
  extra_examples  text,                   -- pipe-separated additional examples
  audio_url       text,
  animation_url   text,                   -- animated sentence-building diagram
  tags            text[],
  level           int DEFAULT 3,
  active          boolean DEFAULT true,
  sort_order      int DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- Idioms (成语)
-- Absorbs: jgw_chengyu
CREATE TABLE IF NOT EXISTS clf_idioms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idiom           text UNIQUE NOT NULL,   -- 亡羊补牢
  pinyin          text,
  meaning_zh      text,
  meaning_en      text,
  meaning_it      text,
  story_zh        text,                   -- origin story Chinese
  story_en        text,
  story_it        text,
  image_scene     text,                   -- image generation prompt
  image_url       text,
  audio_url       text,
  example_zh      text,
  example_en      text,
  hsk_level       int,
  difficulty      int DEFAULT 2,          -- 1-5
  theme           text,
  tags            text[],
  level           int DEFAULT 4,
  active          boolean DEFAULT true,
  sort_order      int DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- LAYER 3: CULTURAL & LITERARY
-- ============================================================

-- Classical Poetry (诗歌)
-- Absorbs: jgw_poems
CREATE TABLE IF NOT EXISTS clf_poems (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  title_en        text,
  title_it        text,
  author          text,
  dynasty         text,
  dynasty_en      text,
  type            text,                   -- 五言绝句/七言绝句/词/古风/...
  difficulty      int DEFAULT 2,          -- 1-5
  lines           jsonb DEFAULT '[]',     -- ["床前明月光","疑是地上霜",...]
  pinyin_map      jsonb DEFAULT '{}',     -- {0:["chuáng","qián",...], 1:[...]}
  translation_zh  text,
  translation_en  text,
  translation_it  text,
  background_zh   text,                   -- historical context
  background_en   text,
  background_it   text,
  notes_zh        text,
  notes_en        text,
  image_url       text,
  image_prompt    text,
  audio_url       text,                   -- full poem reading
  tags            text[],
  level           int DEFAULT 4,
  age_min         int DEFAULT 8,
  active          boolean DEFAULT true,
  sort_order      int DEFAULT 0,
  UNIQUE(title, author),
  created_at      timestamptz DEFAULT now()
);

-- Stories & Texts (故事与课文)
-- For graded readers — short texts at each level
CREATE TABLE IF NOT EXISTS clf_texts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_zh        text,
  title_en        text,
  title_it        text,
  genre           text,   -- fable/folk_tale/modern/news/dialogue/description
  subject         text,   -- chinese/history/science/geography/daily_life
  level           int NOT NULL,           -- 1-12
  age_min         int,
  word_count      int,
  body_zh         text NOT NULL,          -- full Chinese text
  body_en         text,
  body_it         text,
  vocabulary_ids  uuid[],                 -- clf_words referenced in this text
  grammar_ids     uuid[],                 -- clf_grammar patterns used
  audio_url       text,
  image_url       text,
  source          text,                   -- textbook/original/adapted
  tags            text[],
  active          boolean DEFAULT true,
  sort_order      int DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- LAYER 4: SUBJECT IMMERSION CONTENT
-- Chinese language through subject contexts
-- ============================================================

-- Subject concepts — things like "分数", "光合作用", "长城"
-- These are NOT teaching the subject — they teach the Chinese word/concept
CREATE TABLE IF NOT EXISTS clf_concepts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject         text NOT NULL,  -- math/science/history/geography/arts/daily_life
  concept_type    text,           -- word/formula/place/person/event/object/process
  level           int NOT NULL,   -- 1-12 school year
  age_min         int,
  title_zh        text NOT NULL,  -- 分数
  title_en        text,           -- fraction
  title_it        text,           -- frazione
  body_zh         text,           -- brief explanation in simple Chinese
  body_en         text,
  body_it         text,
  -- The KEY: how this concept helps Chinese language learning
  vocab_taught    text[],         -- Chinese words learned via this concept
  grammar_used    text[],         -- grammar patterns demonstrated
  -- Media
  image_url       text,
  animation_url   text,           -- SVG/Lottie animation of the concept
  audio_url       text,
  -- Cross-subject links
  related_ids     uuid[],
  tags            text[],
  active          boolean DEFAULT true,
  sort_order      int DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- LAYER 5: RAG / KNOWLEDGE BASE
-- ============================================================

-- Source documents (textbooks, PDFs)
CREATE TABLE IF NOT EXISTS clf_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,          -- "HSK3标准教程"
  subject         text,
  level           int,                    -- school year / HSK level
  language        text DEFAULT 'zh',
  publisher       text,
  edition         text,
  file_url        text,                   -- Supabase storage URL
  chunk_count     int DEFAULT 0,
  status          text DEFAULT 'pending', -- pending/processing/ready/error
  created_at      timestamptz DEFAULT now()
);

-- Knowledge chunks (from ingested textbooks)
CREATE TABLE IF NOT EXISTS clf_knowledge_chunks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       uuid REFERENCES clf_sources(id) ON DELETE CASCADE,
  subject         text,
  level           int,
  language        text DEFAULT 'zh',
  chunk_text      text NOT NULL,
  chunk_zh        text,
  chunk_en        text,
  page            int,
  chunk_index     int,
  embedding       vector(1536),           -- OpenAI text-embedding-3-small
  token_count     int,
  tags            text[],
  created_at      timestamptz DEFAULT now()
);

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
  subject_filter  text DEFAULT NULL,
  level_filter    int  DEFAULT NULL,
  match_count     int  DEFAULT 5,
  threshold       float DEFAULT 0.75
)
RETURNS TABLE (
  id         uuid,
  chunk_text text,
  subject    text,
  level      int,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id, chunk_text, subject, level,
    1 - (embedding <=> query_embedding) AS similarity
  FROM clf_knowledge_chunks
  WHERE
    (subject_filter IS NULL OR subject = subject_filter)
    AND (level_filter IS NULL OR level = level_filter)
    AND 1 - (embedding <=> query_embedding) > threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- LAYER 6: CURRICULUM & LEVELS
-- ============================================================

-- Level definitions
CREATE TABLE IF NOT EXISTS clf_levels (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level           int UNIQUE NOT NULL,    -- 1-12 + special: 0=preschool
  label_zh        text,                   -- 幼儿/小学一年级/...
  label_en        text,                   -- Preschool/Grade 1/...
  label_it        text,
  description_zh  text,
  description_en  text,
  age_min         int,
  age_max         int,
  hsk_equivalent  text,                   -- 'HSK1', 'HSK2', null
  char_target     int,                    -- target character count
  word_target     int,                    -- target vocabulary count
  color           text,                   -- hex color for UI
  icon            text                    -- emoji icon
);

-- Seed level definitions
INSERT INTO clf_levels (level, label_zh, label_en, label_it, age_min, age_max, hsk_equivalent, char_target, word_target, color, icon)
VALUES
  (0, '幼儿', 'Preschool', 'Prescolare', 3, 5, NULL, 50, 100, '#FF9800', '🐣'),
  (1, '小学一年级', 'Grade 1', 'Prima elementare', 6, 7, 'HSK1', 100, 200, '#F44336', '🌱'),
  (2, '小学二年级', 'Grade 2', 'Seconda elementare', 7, 8, 'HSK1', 200, 400, '#E91E63', '🌿'),
  (3, '小学三年级', 'Grade 3', 'Terza elementare', 8, 9, 'HSK2', 400, 600, '#9C27B0', '🌳'),
  (4, '小学四年级', 'Grade 4', 'Quarta elementare', 9, 10, 'HSK2', 600, 800, '#673AB7', '📖'),
  (5, '小学五年级', 'Grade 5', 'Quinta elementare', 10, 11, 'HSK3', 800, 1000, '#3F51B5', '📚'),
  (6, '小学六年级', 'Grade 6', 'Sesta elementare', 11, 12, 'HSK3', 1000, 1200, '#2196F3', '🎓'),
  (7, '初中一年级', 'Grade 7', 'Prima media', 12, 13, 'HSK4', 1200, 1500, '#03A9F4', '⭐'),
  (8, '初中二年级', 'Grade 8', 'Seconda media', 13, 14, 'HSK4', 1500, 2000, '#00BCD4', '⭐⭐'),
  (9, '初中三年级', 'Grade 9', 'Terza media', 14, 15, 'HSK5', 2000, 2500, '#009688', '🏆'),
  (10, '高中', 'High School', 'Superiori', 15, 18, 'HSK5', 2500, 3500, '#4CAF50', '🏅'),
  (11, '大学/成人', 'University/Adult', 'Università', 18, 99, 'HSK6', 3500, 5000, '#8BC34A', '🎖️')
ON CONFLICT (level) DO NOTHING;

-- Curriculum units
CREATE TABLE IF NOT EXISTS clf_units (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level           int NOT NULL,
  subject         text NOT NULL DEFAULT 'chinese',
  unit_number     int NOT NULL,
  title_zh        text,
  title_en        text,
  title_it        text,
  description_zh  text,
  description_en  text,
  theme           text,                   -- e.g. 家庭/学校/自然/节日
  prereq_unit_ids uuid[],
  mastery_threshold float DEFAULT 0.8,
  item_count      int DEFAULT 0,
  sort_order      int DEFAULT 0,
  active          boolean DEFAULT true,
  UNIQUE(level, subject, unit_number)
);

-- Unit items (what's in each unit)
CREATE TABLE IF NOT EXISTS clf_unit_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         uuid REFERENCES clf_units(id) ON DELETE CASCADE,
  item_table      text NOT NULL,  -- clf_characters/clf_words/clf_grammar/clf_idioms/clf_poems
  item_id         uuid NOT NULL,
  item_order      int DEFAULT 0,
  is_required     boolean DEFAULT true
);

-- ============================================================
-- LAYER 7: CROSS-REFERENCING
-- ============================================================

-- Semantic links between any items
CREATE TABLE IF NOT EXISTS clf_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table    text NOT NULL,
  source_id       uuid NOT NULL,
  target_table    text NOT NULL,
  target_id       uuid NOT NULL,
  link_type       text NOT NULL,  -- contains/derives_from/related/used_in/illustrates/antonym
  weight          float DEFAULT 1.0,
  UNIQUE(source_table, source_id, target_table, target_id, link_type)
);

-- Semantic tags (concepts like 思乡/家庭/自然)
CREATE TABLE IF NOT EXISTS clf_tags (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag             text UNIQUE NOT NULL,
  tag_en          text,
  tag_it          text,
  category        text            -- emotion/theme/topic/period/grammar_type
);

-- Tag any item
CREATE TABLE IF NOT EXISTS clf_item_tags (
  item_table      text NOT NULL,
  item_id         uuid NOT NULL,
  tag_id          uuid REFERENCES clf_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_table, item_id, tag_id)
);

-- ============================================================
-- LAYER 8: USER & PROGRESS
-- ============================================================

-- Extended learner profiles (heritage-specific)
CREATE TABLE IF NOT EXISTS clf_learner_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token    text UNIQUE NOT NULL,
  display_name    text,
  native_lang     text DEFAULT 'it',     -- it/en/fr/de/...
  current_level   int DEFAULT 1,
  age             int,
  generation      int,                   -- 1=immigrant, 2=born abroad, 3=grandchildren
  dialect         text,                  -- wenzhounese/cantonese/mandarin_native
  goals           text[],               -- ['speak_with_grandparents','read','write','hsk3']
  streak_days     int DEFAULT 0,
  total_points    int DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Universal progress (works for any table/item)
CREATE TABLE IF NOT EXISTS clf_progress (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token    text NOT NULL,
  item_table      text NOT NULL,         -- clf_characters/clf_words/clf_grammar/...
  item_id         uuid NOT NULL,
  correct         boolean NOT NULL,
  score           float,                 -- 0.0-1.0
  response_ms     int,                   -- how long to answer
  session_id      uuid,
  practiced_at    timestamptz DEFAULT now(),
  UNIQUE(device_token, item_table, item_id, practiced_at)
);

-- Unit mastery tracking
CREATE TABLE IF NOT EXISTS clf_unit_progress (
  device_token    text NOT NULL,
  unit_id         uuid REFERENCES clf_units(id) ON DELETE CASCADE,
  mastery         float DEFAULT 0,       -- 0.0-1.0
  items_practiced int DEFAULT 0,
  items_mastered  int DEFAULT 0,
  unlocked        boolean DEFAULT false,
  started_at      timestamptz,
  completed_at    timestamptz,
  PRIMARY KEY (device_token, unit_id)
);

-- Learning sessions
CREATE TABLE IF NOT EXISTS clf_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token    text NOT NULL,
  module          text,                  -- characters/words/grammar/idioms/poems/games/...
  subject         text DEFAULT 'chinese',
  duration_sec    int,
  items_practiced int DEFAULT 0,
  items_correct   int DEFAULT 0,
  points_earned   int DEFAULT 0,
  started_at      timestamptz DEFAULT now(),
  ended_at        timestamptz
);

-- ============================================================
-- LAYER 9: MEDIA ASSETS
-- ============================================================

-- Centralised media registry
CREATE TABLE IF NOT EXISTS clf_media (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_table      text,
  item_id         uuid,
  media_type      text NOT NULL,         -- audio/image/animation/video/svg
  lang            text DEFAULT 'zh',
  url             text NOT NULL,
  bucket          text,                  -- supabase storage bucket name
  duration_ms     int,                   -- for audio/video
  width           int,                   -- for images
  height          int,
  provider        text,                  -- azure_tts/stability/dalle3/ideogram/hanziwriter
  prompt          text,                  -- generation prompt if AI-generated
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_clf_characters_hsk     ON clf_characters(hsk_level);
CREATE INDEX IF NOT EXISTS idx_clf_characters_level   ON clf_characters(level);
CREATE INDEX IF NOT EXISTS idx_clf_words_hsk          ON clf_words(hsk_level);
CREATE INDEX IF NOT EXISTS idx_clf_words_level        ON clf_words(level);
CREATE INDEX IF NOT EXISTS idx_clf_words_topic        ON clf_words(topic);
CREATE INDEX IF NOT EXISTS idx_clf_grammar_hsk        ON clf_grammar(hsk_level);
CREATE INDEX IF NOT EXISTS idx_clf_idioms_hsk         ON clf_idioms(hsk_level);
CREATE INDEX IF NOT EXISTS idx_clf_poems_level        ON clf_poems(level);
CREATE INDEX IF NOT EXISTS idx_clf_concepts_subject   ON clf_concepts(subject, level);
CREATE INDEX IF NOT EXISTS idx_clf_progress_token     ON clf_progress(device_token, item_table);
CREATE INDEX IF NOT EXISTS idx_clf_chunks_subject     ON clf_knowledge_chunks(subject, level);
CREATE INDEX IF NOT EXISTS idx_clf_links_source       ON clf_links(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_clf_unit_items_unit    ON clf_unit_items(unit_id);

-- Vector index for RAG (create after data is loaded)
-- CREATE INDEX ON clf_knowledge_chunks
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE clf_characters        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_radicals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_words             ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_grammar           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_idioms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_poems             ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_texts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_concepts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_sources           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_knowledge_chunks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_levels            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_units             ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_unit_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_links             ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_tags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_item_tags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_learner_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_progress          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_unit_progress     ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_media             ENABLE ROW LEVEL SECURITY;

-- Public READ on all content tables
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "public read clf_characters" ON clf_characters FOR SELECT TO anon USING (active=true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "public read clf_radicals" ON clf_radicals FOR SELECT TO anon USING (active=true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "public read clf_words" ON clf_words FOR SELECT TO anon USING (active=true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "public read clf_grammar" ON clf_grammar FOR SELECT TO anon USING (active=true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "public read clf_idioms" ON clf_idioms FOR SELECT TO anon USING (active=true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "public read clf_poems" ON clf_poems FOR SELECT TO anon USING (active=true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "public read clf_texts" ON clf_texts FOR SELECT TO anon USING (active=true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "public read clf_concepts" ON clf_concepts FOR SELECT TO anon USING (active=true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "public read clf_levels" ON clf_levels FOR SELECT TO anon USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "public read clf_units" ON clf_units FOR SELECT TO anon USING (active=true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "public read clf_unit_items" ON clf_unit_items FOR SELECT TO anon USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "public read clf_links" ON clf_links FOR SELECT TO anon USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "public read clf_tags" ON clf_tags FOR SELECT TO anon USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "public read clf_item_tags" ON clf_item_tags FOR SELECT TO anon USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "public read clf_chunks" ON clf_knowledge_chunks FOR SELECT TO anon USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "public read clf_media" ON clf_media FOR SELECT TO anon USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin WRITE on content tables (anon key, admin panel)
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "admin write clf_characters" ON clf_characters FOR ALL TO anon USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "admin write clf_words" ON clf_words FOR ALL TO anon USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "admin write clf_grammar" ON clf_grammar FOR ALL TO anon USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "admin write clf_idioms" ON clf_idioms FOR ALL TO anon USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "admin write clf_poems" ON clf_poems FOR ALL TO anon USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "admin write clf_texts" ON clf_texts FOR ALL TO anon USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "admin write clf_concepts" ON clf_concepts FOR ALL TO anon USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "admin write clf_sources" ON clf_sources FOR ALL TO anon USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "admin write clf_chunks" ON clf_knowledge_chunks FOR ALL TO anon USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "admin write clf_units" ON clf_units FOR ALL TO anon USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "admin write clf_unit_items" ON clf_unit_items FOR ALL TO anon USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "admin write clf_tags" ON clf_tags FOR ALL TO anon USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "admin write clf_item_tags" ON clf_item_tags FOR ALL TO anon USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "admin write clf_links" ON clf_links FOR ALL TO anon USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "admin write clf_media" ON clf_media FOR ALL TO anon USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "admin write clf_radicals" ON clf_radicals FOR ALL TO anon USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users write their OWN progress
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "users write clf_progress" ON clf_progress FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "users write clf_unit_progress" ON clf_unit_progress FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "users write clf_sessions" ON clf_sessions FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "users write clf_learner_profiles" ON clf_learner_profiles FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

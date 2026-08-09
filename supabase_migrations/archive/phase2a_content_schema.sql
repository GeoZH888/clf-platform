-- ===========================================================================
-- Phase 2A: scenario dialogues + story hub content
-- One shared schema for both modules, discriminated by `module` column.
-- Run in Supabase SQL editor for project yqcojudvvjntaajnrilr.
-- Idempotent where reasonable; safe to re-run.
-- ===========================================================================

-- ---- enums ----
DO $$ BEGIN
  CREATE TYPE clf_content_module AS ENUM ('scenario', 'story');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- main content table ----
CREATE TABLE IF NOT EXISTS clf_content_items (
  id              uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  module          clf_content_module  NOT NULL,

  -- Trilingual titles
  title_zh        text NOT NULL,
  title_en        text,
  title_it        text,

  -- Trilingual body (structured JSONB)
  --   scenario: { turns:[{ speaker:'ai'|'user_prompt', text, hint? }, ...] }
  --   story:    { paragraphs:[text,...], questions:[{q,a,choices?},...] }
  body_zh         jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_en         jsonb,
  body_it         jsonb,

  -- Images: [{ url, caption_zh, caption_en, caption_it, position? }, ...]
  images          jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Pre-generated TTS URLs (filled after admin save)
  audio_zh        text,
  audio_en        text,
  audio_it        text,

  -- Adaptive metadata
  difficulty      smallint NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  topics          text[]   NOT NULL DEFAULT '{}',
  hsk_band        smallint,

  -- Scenario-only: AI persona for live dialogue
  -- { persona, goal, constraints, opening_line_zh? }
  ai_role         jsonb,

  -- Bookkeeping
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_published    boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clf_content_items_module_idx     ON clf_content_items(module);
CREATE INDEX IF NOT EXISTS clf_content_items_difficulty_idx ON clf_content_items(difficulty);
CREATE INDEX IF NOT EXISTS clf_content_items_topics_idx     ON clf_content_items USING GIN(topics);
CREATE INDEX IF NOT EXISTS clf_content_items_published_idx  ON clf_content_items(is_published) WHERE is_published = true;

-- ---- per-user progress ----
CREATE TABLE IF NOT EXISTS clf_content_progress (
  user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id           uuid REFERENCES clf_content_items(id) ON DELETE CASCADE,
  attempts          int  NOT NULL DEFAULT 0,
  best_score        numeric(5,2),
  last_score        numeric(5,2),
  last_attempted_at timestamptz,
  completed_at      timestamptz,
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS clf_content_progress_user_idx ON clf_content_progress(user_id);
CREATE INDEX IF NOT EXISTS clf_content_progress_item_idx ON clf_content_progress(item_id);

-- ---- per-turn dialogue history (scenarios only) ----
CREATE TABLE IF NOT EXISTS clf_dialogue_turns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id             uuid NOT NULL REFERENCES clf_content_items(id) ON DELETE CASCADE,
  session_id          uuid NOT NULL,
  turn_idx            int  NOT NULL,
  speaker             text NOT NULL CHECK (speaker IN ('user','ai')),
  lang                text NOT NULL CHECK (lang IN ('zh','en','it')),
  text                text NOT NULL,
  recognized_text     text,
  pronunciation_score numeric(5,2),
  audio_url           text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clf_dialogue_turns_session_idx   ON clf_dialogue_turns(session_id, turn_idx);
CREATE INDEX IF NOT EXISTS clf_dialogue_turns_user_item_idx ON clf_dialogue_turns(user_id, item_id);

-- ---- updated_at auto-touch ----
CREATE OR REPLACE FUNCTION clf_content_items_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clf_content_items_touch ON clf_content_items;
CREATE TRIGGER clf_content_items_touch
  BEFORE UPDATE ON clf_content_items
  FOR EACH ROW EXECUTE FUNCTION clf_content_items_touch_updated_at();

-- ---- Row-Level Security ----
ALTER TABLE clf_content_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_content_progress  ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_dialogue_turns    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read published content" ON clf_content_items;
CREATE POLICY "read published content"
  ON clf_content_items FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS "admins write content" ON clf_content_items;
CREATE POLICY "admins write content"
  ON clf_content_items FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM clf_user_profiles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin','school_master')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM clf_user_profiles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin','school_master')
  ));

DROP POLICY IF EXISTS "own progress" ON clf_content_progress;
CREATE POLICY "own progress"
  ON clf_content_progress FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own dialogue turns" ON clf_dialogue_turns;
CREATE POLICY "own dialogue turns"
  ON clf_dialogue_turns FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---- storage bucket reminder (run separately if not exists) ----
-- After this migration, in Supabase dashboard create a bucket:
--   name: clf-content-images
--   public: true
--   policies: authenticated users can upload, anyone can read

-- ===========================================================================
-- Sanity check
-- ===========================================================================
SELECT 'tables' AS what, count(*) AS n
  FROM information_schema.tables
  WHERE table_name IN ('clf_content_items','clf_content_progress','clf_dialogue_turns')
UNION ALL
SELECT 'indexes', count(*)
  FROM pg_indexes
  WHERE tablename IN ('clf_content_items','clf_content_progress','clf_dialogue_turns')
UNION ALL
SELECT 'policies', count(*)
  FROM pg_policies
  WHERE tablename IN ('clf_content_items','clf_content_progress','clf_dialogue_turns');

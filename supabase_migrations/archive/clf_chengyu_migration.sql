-- ═══════════════════════════════════════════════════════════════════
--  Phase 1 — Chengyu module migration to CLF namespace
--
--  - Creates clf_chengyu (mirrors jgw_chengyu structure)
--  - Creates clf_chengyu_progress (with both user_id + device_token)
--  - Copies all rows from jgw_chengyu → clf_chengyu (preserving id)
--  - Adds related_* fields for Phase 2 (cross-module linking, currently null)
--  - DOES NOT copy progress (fresh start for all users)
--  - Idempotent: re-running won't duplicate data
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── clf_chengyu ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clf_chengyu (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idiom        text NOT NULL,
  pinyin       text NOT NULL,
  meaning_zh   text NOT NULL,
  meaning_en   text,
  meaning_it   text,
  story_zh     text,
  story_en     text,
  story_it     text,
  example_zh   text,
  example_en   text,
  difficulty   int    DEFAULT 1,    -- 1=easy, 4=hardest
  hsk_level    int,                  -- HSK level association
  theme        text,                 -- wisdom / animals / nature / history / general
  image_url    text,
  image_style  text,
  image_scene  text,
  sort_order   int    DEFAULT 0,
  active       boolean DEFAULT true,
  -- Phase 2 cross-module linking (currently null, populated by AI in Phase 2)
  related_grammar_topic_id text REFERENCES clf_grammar_topics(id) ON DELETE SET NULL,
  related_character_ids    text[],   -- IDs of related characters in clf_characters
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clf_chengyu_active ON clf_chengyu(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_clf_chengyu_difficulty ON clf_chengyu(difficulty, sort_order);
CREATE INDEX IF NOT EXISTS idx_clf_chengyu_theme ON clf_chengyu(theme);
CREATE INDEX IF NOT EXISTS idx_clf_chengyu_grammar ON clf_chengyu(related_grammar_topic_id);

-- ── clf_chengyu_progress (dual-path: user_id OR device_token) ──

CREATE TABLE IF NOT EXISTS clf_chengyu_progress (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Either of these identifies the user. New users use user_id (auth.users-backed).
  -- Legacy device_token still supported for old jgw_invites users.
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token  text,
  idiom_id      uuid NOT NULL REFERENCES clf_chengyu(id) ON DELETE CASCADE,
  practiced_at  timestamptz DEFAULT now(),
  score         int,                              -- 0-100 grading
  correct       boolean,                          -- simple right/wrong
  mode          text,                             -- 'flash' | 'quiz' | 'fill' | 'match' | 'chain' | 'story'
  created_at    timestamptz DEFAULT now(),
  -- Sanity: at least one of user_id or device_token must be set
  CONSTRAINT chengyu_progress_needs_owner
    CHECK (user_id IS NOT NULL OR device_token IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_chengyu_progress_user ON clf_chengyu_progress(user_id, practiced_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chengyu_progress_device ON clf_chengyu_progress(device_token, practiced_at DESC) WHERE device_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chengyu_progress_idiom ON clf_chengyu_progress(idiom_id);

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE clf_chengyu          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_chengyu_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone reads chengyu"       ON clf_chengyu;
DROP POLICY IF EXISTS "Admins write chengyu"         ON clf_chengyu;
DROP POLICY IF EXISTS "Users read own chengyu progress"  ON clf_chengyu_progress;
DROP POLICY IF EXISTS "Users write own chengyu progress" ON clf_chengyu_progress;

CREATE POLICY "Everyone reads chengyu"
  ON clf_chengyu FOR SELECT USING (active = true);

CREATE POLICY "Admins write chengyu"
  ON clf_chengyu FOR ALL
  USING (
    EXISTS (SELECT 1 FROM jgw_admins WHERE user_id = auth.uid())
    OR (auth.jwt()->'user_metadata'->>'role') = 'superadmin'
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM jgw_admins WHERE user_id = auth.uid())
    OR (auth.jwt()->'user_metadata'->>'role') = 'superadmin'
  );

-- Progress: user can read/write rows where user_id matches them.
-- Device-token-backed rows are managed by service role only (frontend can
-- still write via supabase client because RLS ALL policy allows owner match,
-- and progress rows for device_token users are inserted only via the
-- frontend hook, which doesn't go through RLS for new users — see
-- useAdaptiveLearning.js for handling).
CREATE POLICY "Users read own chengyu progress"
  ON clf_chengyu_progress FOR SELECT
  USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND device_token IS NOT NULL)
       -- Legacy: device_token rows readable by anyone (the hook filters by token client-side)
  );

CREATE POLICY "Users write own chengyu progress"
  ON clf_chengyu_progress FOR ALL
  USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND device_token IS NOT NULL)
  )
  WITH CHECK (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (user_id IS NULL AND device_token IS NOT NULL)
  );

-- ── Data copy: jgw_chengyu → clf_chengyu ─────────────────────

-- Only copy rows whose IDs aren't already in clf_chengyu (idempotent)
INSERT INTO clf_chengyu (
  id, idiom, pinyin,
  meaning_zh, meaning_en, meaning_it,
  story_zh, story_en, story_it,
  example_zh, example_en,
  difficulty, hsk_level, theme,
  image_url, image_style, image_scene,
  sort_order, active,
  created_at, updated_at
)
SELECT
  id, idiom, pinyin,
  meaning_zh, meaning_en, meaning_it,
  story_zh, story_en, story_it,
  example_zh, example_en,
  difficulty, hsk_level, theme,
  image_url, image_style, image_scene,
  sort_order, COALESCE(active, true),
  created_at, COALESCE(updated_at, created_at)
FROM jgw_chengyu
ON CONFLICT (id) DO NOTHING;

-- ── Verify ────────────────────────────────────────────────────

DO $$
DECLARE
  src_count int;
  dst_count int;
BEGIN
  SELECT COUNT(*) INTO src_count FROM jgw_chengyu;
  SELECT COUNT(*) INTO dst_count FROM clf_chengyu;
  RAISE NOTICE 'jgw_chengyu rows: %, clf_chengyu rows: %', src_count, dst_count;
END $$;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- 练字 adaptive learning progress table
-- ============================================================
-- Mirrors clf_chengyu_progress shape so useAdaptiveLearning hook
-- works without modification. Uses character text as key (not uuid)
-- because the existing 练字 system identifies characters by their
-- text — matching that avoids a brittle joins layer.

CREATE TABLE IF NOT EXISTS clf_lianzi_progress (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid,
  device_token  text,
  character     text          NOT NULL,             -- the actual character, e.g. '木'
  correct       boolean,
  score         integer,                            -- 0-100, stroke accuracy
  mode          text,                               -- 'list' | 'dictation' | 'completion'
  practiced_at  timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT lianzi_progress_identity_required
    CHECK (user_id IS NOT NULL OR device_token IS NOT NULL)
);

-- Indexes for the queries useAdaptiveLearning makes
CREATE INDEX IF NOT EXISTS idx_lianzi_progress_user_char
  ON clf_lianzi_progress (user_id, character, practiced_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lianzi_progress_device_char
  ON clf_lianzi_progress (device_token, character, practiced_at DESC)
  WHERE device_token IS NOT NULL;

-- RLS
ALTER TABLE clf_lianzi_progress ENABLE ROW LEVEL SECURITY;

-- Anyone can read (clients fetch their own; row-level filter is in app code)
DROP POLICY IF EXISTS "Read lianzi progress" ON clf_lianzi_progress;
CREATE POLICY "Read lianzi progress"
  ON clf_lianzi_progress FOR SELECT
  USING (true);

-- Anyone can insert their own progress (anon students need this)
DROP POLICY IF EXISTS "Insert lianzi progress" ON clf_lianzi_progress;
CREATE POLICY "Insert lianzi progress"
  ON clf_lianzi_progress FOR INSERT
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

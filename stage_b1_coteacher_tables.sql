-- ════════════════════════════════════════════════════════════════════════════
-- Stage b1.1 — Co-Teacher tables
-- Creates: dwxz_teacher_conversations, dwxz_teacher_messages, dwxz_lesson_plans
-- Adds:    preferred_chat_language column on dwxz_teacher_teaching_profiles
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Conversations ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dwxz_teacher_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id        UUID REFERENCES dwxz_classes(id) ON DELETE SET NULL,
  -- class_id NULL = playground conversation
  title           TEXT,
  language        TEXT DEFAULT 'zh',
  status          TEXT NOT NULL DEFAULT 'active',
  -- 'active' | 'archived'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_conv_teacher
  ON dwxz_teacher_conversations(teacher_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_conv_class
  ON dwxz_teacher_conversations(class_id, updated_at DESC)
  WHERE class_id IS NOT NULL;

-- ── 2. Messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dwxz_teacher_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES dwxz_teacher_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  -- 'user' | 'assistant' | 'system' | 'tool'
  content         TEXT,
  tool_calls      JSONB,
  metadata        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_msg_conv
  ON dwxz_teacher_messages(conversation_id, created_at);

-- ── 3. Lesson plans (the living workspace) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS dwxz_lesson_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID UNIQUE REFERENCES dwxz_teacher_conversations(id) ON DELETE CASCADE,
  teacher_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id        UUID REFERENCES dwxz_classes(id) ON DELETE SET NULL,

  -- Top-level metadata
  title           TEXT,
  hsk_level       TEXT,            -- store as 'HSK3' string, not integer (allows 'mixed')
  duration_min    INTEGER,
  topic           TEXT,

  -- Living workspace panels (filled progressively by AI tool calls)
  objectives      JSONB DEFAULT '[]'::jsonb,
  vocab           JSONB DEFAULT '[]'::jsonb,
  key_sentences   JSONB DEFAULT '[]'::jsonb,
  outline         JSONB DEFAULT '[]'::jsonb,
  slides          JSONB DEFAULT '[]'::jsonb,    -- Stage b2 hydrates
  worksheet       JSONB DEFAULT '[]'::jsonb,    -- Stage b2
  quiz            JSONB DEFAULT '[]'::jsonb,    -- Stage b2
  homework        JSONB DEFAULT '[]'::jsonb,    -- Stage b2

  -- Lifecycle
  status          TEXT DEFAULT 'draft',
  -- 'draft' | 'ready' | 'taught' | 'archived'
  taught_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_teacher
  ON dwxz_lesson_plans(teacher_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_class
  ON dwxz_lesson_plans(class_id, updated_at DESC)
  WHERE class_id IS NOT NULL;

-- ── 4. updated_at trigger (keep updated_at fresh on UPDATE) ─────────────────
CREATE OR REPLACE FUNCTION dwxz_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_conv ON dwxz_teacher_conversations;
CREATE TRIGGER trg_touch_conv
  BEFORE UPDATE ON dwxz_teacher_conversations
  FOR EACH ROW EXECUTE FUNCTION dwxz_touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_plan ON dwxz_lesson_plans;
CREATE TRIGGER trg_touch_plan
  BEFORE UPDATE ON dwxz_lesson_plans
  FOR EACH ROW EXECUTE FUNCTION dwxz_touch_updated_at();

-- ── 5. RLS policies ─────────────────────────────────────────────────────────
ALTER TABLE dwxz_teacher_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dwxz_teacher_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE dwxz_lesson_plans          ENABLE ROW LEVEL SECURITY;

-- Teachers manage their own data
DROP POLICY IF EXISTS teacher_own_convs ON dwxz_teacher_conversations;
CREATE POLICY teacher_own_convs ON dwxz_teacher_conversations
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS teacher_own_msgs ON dwxz_teacher_messages;
CREATE POLICY teacher_own_msgs ON dwxz_teacher_messages
  FOR ALL TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM dwxz_teacher_conversations WHERE teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM dwxz_teacher_conversations WHERE teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS teacher_own_plans ON dwxz_lesson_plans;
CREATE POLICY teacher_own_plans ON dwxz_lesson_plans
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Super admin override (uses your existing is_admin() function)
DROP POLICY IF EXISTS adm_all_teacher_convs ON dwxz_teacher_conversations;
CREATE POLICY adm_all_teacher_convs ON dwxz_teacher_conversations
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS adm_all_teacher_msgs ON dwxz_teacher_messages;
CREATE POLICY adm_all_teacher_msgs ON dwxz_teacher_messages
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS adm_all_lesson_plans ON dwxz_lesson_plans;
CREATE POLICY adm_all_lesson_plans ON dwxz_lesson_plans
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ── 6. Sticky language preference on the teacher profile ───────────────────
-- Idempotent: only adds the column if it doesn't exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dwxz_teacher_teaching_profiles'
      AND column_name = 'preferred_chat_language'
  ) THEN
    ALTER TABLE dwxz_teacher_teaching_profiles
      ADD COLUMN preferred_chat_language TEXT DEFAULT 'zh';
  END IF;
END $$;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Run these after to confirm:
--   SELECT table_name FROM information_schema.tables
--     WHERE table_name LIKE 'dwxz_teacher_%' OR table_name = 'dwxz_lesson_plans';
--   SELECT policyname, tablename FROM pg_policies
--     WHERE tablename IN ('dwxz_teacher_conversations','dwxz_teacher_messages','dwxz_lesson_plans');

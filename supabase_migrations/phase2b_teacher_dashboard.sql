-- =================================================================
-- Phase 2B: TeacherDashboard tables
-- Run in Supabase SQL editor for project yqcojudvvjntaajnrilr.
-- Idempotent. Safe to re-run.
-- =================================================================

-- Cache for AI weekly summaries (24-hour TTL via app-side query filter)
CREATE TABLE IF NOT EXISTS clf_class_ai_summaries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id    uuid,
  summary     text NOT NULL,
  provider    text,
  task        text NOT NULL DEFAULT 'analyze_class',
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clf_class_ai_summaries_teacher_idx
  ON clf_class_ai_summaries(teacher_id, task, created_at DESC);

-- AI-flagged students needing attention
CREATE TABLE IF NOT EXISTS clf_teacher_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  student_name    text NOT NULL,
  severity        text NOT NULL CHECK (severity IN ('low','medium','high')),
  reason          text NOT NULL,
  category        text,
  dismissed       boolean NOT NULL DEFAULT false,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clf_teacher_alerts_active_idx
  ON clf_teacher_alerts(teacher_id, dismissed, severity);

-- Enable Realtime on the alerts table so StudentSpotlight gets live updates
DO $$
BEGIN
  PERFORM 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND tablename='clf_teacher_alerts';
  IF NOT FOUND THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE clf_teacher_alerts;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Row-Level Security
ALTER TABLE clf_class_ai_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_teacher_alerts     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher own summaries" ON clf_class_ai_summaries;
CREATE POLICY "teacher own summaries"
  ON clf_class_ai_summaries FOR ALL
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teacher own alerts" ON clf_teacher_alerts;
CREATE POLICY "teacher own alerts"
  ON clf_teacher_alerts FOR ALL
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Sanity check
SELECT 'tables' AS what, count(*) FROM information_schema.tables
  WHERE table_name IN ('clf_class_ai_summaries','clf_teacher_alerts')
UNION ALL
SELECT 'policies', count(*) FROM pg_policies
  WHERE tablename IN ('clf_class_ai_summaries','clf_teacher_alerts');

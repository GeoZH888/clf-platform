-- ===============================================================
-- Phase B: Teacher panel schema
-- Run in Supabase SQL editor for project yqcojudvvjntaajnrilr.
-- Idempotent.
-- ===============================================================

-- Classes (each teacher owns one or more classes)
CREATE TABLE IF NOT EXISTS clf_classes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  grade_level text,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clf_classes_teacher_idx ON clf_classes(teacher_id);

-- Class membership (teacher invites students/parents)
CREATE TABLE IF NOT EXISTS clf_class_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      uuid NOT NULL REFERENCES clf_classes(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  student_name  text NOT NULL,
  parent_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, user_id)
);
CREATE INDEX IF NOT EXISTS clf_class_members_class_idx ON clf_class_members(class_id);

-- Homework assignments
CREATE TABLE IF NOT EXISTS clf_homework (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL REFERENCES clf_classes(id) ON DELETE CASCADE,
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  due_at      timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Homework submissions (text + file_url + image_url, multi-modal)
CREATE TABLE IF NOT EXISTS clf_homework_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id   uuid NOT NULL REFERENCES clf_homework(id) ON DELETE CASCADE,
  class_id      uuid NOT NULL REFERENCES clf_classes(id) ON DELETE CASCADE,
  student_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  text_content  text,
  file_urls     text[] DEFAULT '{}',
  image_urls    text[] DEFAULT '{}',
  audio_url     text,
  score         numeric,
  feedback      text,
  graded_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Parent-teacher communication threads
CREATE TABLE IF NOT EXISTS clf_pt_threads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_name text NOT NULL,
  student_id  uuid,
  subject     text NOT NULL,
  last_msg_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clf_pt_messages (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES clf_pt_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  body      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Notices (broadcasts to a class)
CREATE TABLE IF NOT EXISTS clf_notices (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id   uuid REFERENCES clf_classes(id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text NOT NULL,
  pinned     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Courses + AI-generated artifacts
CREATE TABLE IF NOT EXISTS clf_courses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id    uuid REFERENCES clf_classes(id) ON DELETE SET NULL,
  title       text NOT NULL,
  topic       text,
  level       text,
  knowledge_map jsonb,
  outline     jsonb,
  ppt_url     text,
  quiz        jsonb,
  status      text NOT NULL DEFAULT 'draft',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Teaching materials (3 destinations: students / rag / private)
CREATE TABLE IF NOT EXISTS clf_materials (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id     uuid REFERENCES clf_classes(id) ON DELETE SET NULL,
  title        text NOT NULL,
  description  text,
  file_url     text NOT NULL,
  file_size    bigint,
  mime_type    text,
  destination  text NOT NULL CHECK (destination IN ('students', 'rag-pending', 'private')),
  rag_status   text DEFAULT 'pending' CHECK (rag_status IN ('pending', 'approved', 'rejected')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clf_materials_uploader_idx ON clf_materials(uploader_id, destination);

-- Storage bucket (run separately if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) VALUES ('teacher-materials', 'teacher-materials', false)
ON CONFLICT (id) DO NOTHING;

-- ROW LEVEL SECURITY
ALTER TABLE clf_classes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_class_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_homework             ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_homework_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_pt_threads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_pt_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_notices              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_courses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_materials            ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher own classes" ON clf_classes;
CREATE POLICY "teacher own classes" ON clf_classes FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teacher own homework" ON clf_homework;
CREATE POLICY "teacher own homework" ON clf_homework FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teacher own threads" ON clf_pt_threads;
CREATE POLICY "teacher own threads" ON clf_pt_threads FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teacher own notices" ON clf_notices;
CREATE POLICY "teacher own notices" ON clf_notices FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teacher own courses" ON clf_courses;
CREATE POLICY "teacher own courses" ON clf_courses FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "uploader own materials" ON clf_materials;
CREATE POLICY "uploader own materials" ON clf_materials FOR ALL TO authenticated
  USING (uploader_id = auth.uid()) WITH CHECK (uploader_id = auth.uid());

DROP POLICY IF EXISTS "teacher class members" ON clf_class_members;
CREATE POLICY "teacher class members" ON clf_class_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clf_classes WHERE id = class_id AND teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM clf_classes WHERE id = class_id AND teacher_id = auth.uid()));

DROP POLICY IF EXISTS "submission via class" ON clf_homework_submissions;
CREATE POLICY "submission via class" ON clf_homework_submissions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clf_classes WHERE id = class_id AND teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM clf_classes WHERE id = class_id AND teacher_id = auth.uid()));

DROP POLICY IF EXISTS "msg via thread" ON clf_pt_messages;
CREATE POLICY "msg via thread" ON clf_pt_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clf_pt_threads WHERE id = thread_id AND teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM clf_pt_threads WHERE id = thread_id AND teacher_id = auth.uid()));

-- Sanity check
SELECT 'classes'        AS what, count(*) FROM clf_classes
UNION ALL SELECT 'homework',     count(*) FROM clf_homework
UNION ALL SELECT 'threads',      count(*) FROM clf_pt_threads
UNION ALL SELECT 'notices',      count(*) FROM clf_notices
UNION ALL SELECT 'courses',      count(*) FROM clf_courses
UNION ALL SELECT 'materials',    count(*) FROM clf_materials;

-- ============================================================
-- 大卫学中文 B2B → CLF Supabase 合并脚本 v2
-- Target: https://yqcojudvvjntaajnrilr.supabase.co
-- Fix: no ALTER TABLE on non-existent tables
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Admin users table (separate from CLF auth.users) ─────
-- CLF uses auth.users for login; this table stores Admin roles
CREATE TABLE IF NOT EXISTS admin_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id     uuid UNIQUE,          -- links to auth.users.id
  username    text UNIQUE,
  email       text UNIQUE,
  name        text,
  name_zh     text,
  role        text DEFAULT 'student'
                CHECK (role IN ('super_admin','school_master','teacher','student','parent')),
  is_active   bool DEFAULT true,
  school_id   uuid,
  avatar      text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ── Schools ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schools (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  name_zh          text,
  city             text,
  code             text UNIQUE,
  max_teachers     int  DEFAULT 10,
  max_students     int  DEFAULT 50,
  current_teachers int  DEFAULT 0,
  current_students int  DEFAULT 0,
  is_active        bool DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- ── Classes ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  level       text,
  teacher_id  uuid,
  school_id   uuid REFERENCES schools(id) ON DELETE SET NULL,
  schedule    text,
  room        text,
  color       text DEFAULT '#c41e3a',
  is_active   bool DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- ── Class Students ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS class_students (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid REFERENCES classes(id) ON DELETE CASCADE,
  student_id  uuid,
  status      text DEFAULT 'active',
  joined_at   timestamptz DEFAULT now(),
  UNIQUE (class_id, student_id)
);

-- ── Attendance ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid REFERENCES classes(id) ON DELETE CASCADE,
  student_id  uuid,
  date        date NOT NULL,
  status      text DEFAULT 'absent'
                CHECK (status IN ('present','absent','late')),
  recorded_by uuid,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (class_id, student_id, date)
);

-- ── Grades ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grades (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   uuid REFERENCES classes(id) ON DELETE CASCADE,
  student_id uuid,
  score      numeric(5,2),
  note       text,
  date       date DEFAULT CURRENT_DATE,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- ── Homework ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS homework (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  class_id    uuid REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id  uuid,
  due_date    date,
  type        text DEFAULT 'written',
  is_active   bool DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS homework_submissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id  uuid REFERENCES homework(id) ON DELETE CASCADE,
  student_id   uuid,
  content      text,
  score        numeric(5,2),
  feedback     text,
  submitted_at timestamptz DEFAULT now(),
  graded_at    timestamptz,
  UNIQUE (homework_id, student_id)
);

-- ── Join Requests ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS join_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name    text,
  user_name_zh text,
  class_name   text,
  school       text,
  role         text DEFAULT 'student',
  status       text DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected')),
  note         text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ── Invites ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL UNIQUE,
  role       text NOT NULL,
  used       int  DEFAULT 0,
  max_uses   int  DEFAULT 10,
  note       text,
  school_id  uuid REFERENCES schools(id),
  is_active  bool DEFAULT true,
  created_at timestamptz DEFAULT now(),
  expires_at date
);

-- ── RAG / Knowledge Base ──────────────────────────────────
CREATE TABLE IF NOT EXISTS rag_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  size        text,
  file_type   text,
  file_url    text,
  status      text DEFAULT 'processing'
                CHECK (status IN ('processing','indexed','failed')),
  chunks      int  DEFAULT 0,
  tags        text[] DEFAULT '{}',
  uploaded_by uuid,
  created_at  timestamptz DEFAULT now(),
  indexed_at  timestamptz
);

-- ── AI Config (Admin sets → CLF reads) ───────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key   text NOT NULL UNIQUE,
  setting_value text,
  category      text DEFAULT 'general',
  updated_at    timestamptz DEFAULT now(),
  updated_by    uuid
);

-- ── Panda Assets ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS panda_assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emotion     text NOT NULL UNIQUE,
  emotion_zh  text,
  image_url   text,
  prompt      text,
  color       text,
  usage_desc  text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ── Student XP / Gamification ────────────────────────────
CREATE TABLE IF NOT EXISTS student_points (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid UNIQUE,
  total_xp    int  DEFAULT 0,
  streak_days int  DEFAULT 0,
  last_active date DEFAULT CURRENT_DATE,
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS point_transactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid,
  amount     int NOT NULL,
  reason     text,
  source     text,
  created_at timestamptz DEFAULT now()
);

-- ── RLS: enable + allow all (tighten later per role) ─────
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'admin_users','schools','classes','class_students',
    'attendance','grades','homework','homework_submissions',
    'join_requests','invites','rag_files','system_settings',
    'panda_assets','student_points','point_transactions'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = 'Allow all'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "Allow all" ON %I FOR ALL USING (true) WITH CHECK (true)', t
      );
    END IF;
  END LOOP;
END $$;

-- ── Seed: Schools ─────────────────────────────────────────
INSERT INTO schools (name, name_zh, city, code, max_teachers, max_students, is_active)
VALUES
  ('大卫中文学院 · 佛罗伦萨', '佛罗伦萨分校', 'Firenze', 'FI001', 10, 60, true),
  ('大卫中文学院 · 米兰',     '米兰分校',     'Milano',  'MI001',  5, 30, true)
ON CONFLICT (code) DO NOTHING;

-- ── Seed: AI Config defaults ──────────────────────────────
INSERT INTO system_settings (setting_key, setting_value, category)
VALUES
  ('ai_provider',            'anthropic',              'ai'),
  ('ai_model',               'claude-sonnet-4-5',      'ai'),
  ('ai_temperature',         '0.7',                    'ai'),
  ('ai_max_tokens',          '2048',                   'ai'),
  ('ai_daily_limit_teacher', '100',                    'ai'),
  ('ai_daily_limit_student', '20',                     'ai'),
  ('ai_ppt_enabled',         'true',                   'ai'),
  ('ai_quiz_enabled',        'true',                   'ai'),
  ('ai_summary_enabled',     'true',                   'ai'),
  ('ai_lesson_plan_enabled', 'true',                   'ai'),
  ('ai_flashcard_enabled',   'true',                   'ai'),
  ('img_provider',           'dalle',                  'ai'),
  ('rag_embed_model',        'text-embedding-3-small', 'ai'),
  ('speech_whisper_enabled', 'true',                   'ai'),
  ('speech_tts_enabled',     'true',                   'ai')
ON CONFLICT (setting_key) DO NOTHING;

-- ── Seed: Panda emotions ──────────────────────────────────
INSERT INTO panda_assets (emotion, emotion_zh, color, usage_desc)
VALUES
  ('normal',     '正常',   '#4CAF50', '首页·欢迎'),
  ('excited',    '兴奋',   '#FF9800', '答对·高分'),
  ('sad',        '难过',   '#2196F3', '答错·账号到期'),
  ('thinking',   '思考',   '#9C27B0', 'AI加载·批改中'),
  ('sleeping',   '睡觉',   '#607D8B', '设备暂停'),
  ('cheering',   '加油',   '#E91E63', '练习完成'),
  ('surprised',  '惊讶',   '#FF5722', '解锁成就'),
  ('writing',    '练字',   '#8B4513', '书法练习'),
  ('reading',    '阅读',   '#2E7D32', '文化阅读'),
  ('mouth_open', '开口a',  '#1565C0', '拼音教学')
ON CONFLICT (emotion) DO NOTHING;

-- ── Seed: Invite codes ────────────────────────────────────
INSERT INTO invites (code, role, used, max_uses, note, is_active, expires_at)
VALUES
  ('DAVID1',  'teacher', 0,  5, '教师邀请',   true, '2026-12-31'),
  ('CLF001',  'student', 0, 50, 'CLF学生注册', true, '2026-12-31'),
  ('PARENT1', 'parent',  0, 30, '家长注册',    true, '2026-12-31')
ON CONFLICT (code) DO NOTHING;

-- ── Seed: Admin user ──────────────────────────────────────
INSERT INTO admin_users (username, email, name, name_zh, role, is_active)
VALUES
  ('superadmin',   'admin@david.com',   'Super Admin',   '超级管理员', 'super_admin',   true),
  ('schoolmaster', 'master@david.com',  'School Master', '校长',       'school_master', true),
  ('teacher1',     'li@david.com',      'Teacher Li',    '李老师',     'teacher',       true)
ON CONFLICT (username) DO NOTHING;

-- ── Verify ────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM schools)         AS schools,
  (SELECT count(*) FROM admin_users)     AS admin_users,
  (SELECT count(*) FROM system_settings) AS ai_settings,
  (SELECT count(*) FROM panda_assets)    AS panda_emotions,
  (SELECT count(*) FROM invites)         AS invites,
  '✅ 大卫学中文 B2B + CLF 共享数据库配置完成！' AS status;

-- ═══════════════════════════════════════════════════════════════════════
--  大卫学中文 — Identity & Family System (Phase 1: schema only)
--
--  Adds:
--    1. username to jgw_user_profiles (unique, immutable identifier)
--    2. family_links table (parent ↔ child, M:N)
--    3. parent_messages (parent ↔ child messaging)
--    4. parent_assignments (tasks parents assign to kids)
--    5. parent_settings_override (parent-controlled difficulty/limits)
--    6. jgw_invites extensions (pre-linked usernames, role, initial_password)
--    7. Helper RPCs for username→email lookup (used by login flow)
--
--  Non-destructive: existing admin@wenzi-learn.net login continues to work.
--  UI changes come in a separate delivery.
--
--  Safe to run multiple times (all additive with IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Extend jgw_user_profiles ────────────────────────────────────────
ALTER TABLE jgw_user_profiles ADD COLUMN IF NOT EXISTS username      text;
ALTER TABLE jgw_user_profiles ADD COLUMN IF NOT EXISTS display_name  text;
ALTER TABLE jgw_user_profiles ADD COLUMN IF NOT EXISTS role          text DEFAULT 'student';
-- role values: 'student' | 'parent' | 'teacher' | 'admin'

-- Unique constraint on username — but allow NULL for legacy rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username
  ON jgw_user_profiles(username)
  WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON jgw_user_profiles(role);

-- ── 2. Family links (parent ↔ child, M:N) ──────────────────────────────
CREATE TABLE IF NOT EXISTS family_links (
  parent_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship    text DEFAULT 'guardian',   -- 'mother' | 'father' | 'guardian' | 'other'
  linked_by       uuid REFERENCES auth.users(id),
  linked_via      text DEFAULT 'admin_manual',
  -- 'invitation_pre_link' | 'admin_manual' | 'child_added' | 'parent_added'
  can_view        boolean DEFAULT true,
  can_message     boolean DEFAULT true,
  can_assign      boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  PRIMARY KEY (parent_user_id, child_user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_parent ON family_links(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_family_child  ON family_links(child_user_id);

-- ── 3. Parent → Child messaging ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parent_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message         text NOT NULL,
  kind            text DEFAULT 'encouragement',
  -- 'encouragement' | 'instruction' | 'reply' | 'congratulation'
  read_at         timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_msg_to_unread ON parent_messages(to_user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_msg_from      ON parent_messages(from_user_id);

-- ── 4. Parent-assigned tasks ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parent_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind            text NOT NULL,
  -- 'hsk_level' | 'renjiao_lesson' | 'character_set' | 'time_goal' | 'chengyu_set'
  params          jsonb DEFAULT '{}'::jsonb,
  -- Expected shape per kind:
  --   hsk_level:       { "level": 4, "count": 20 }
  --   renjiao_lesson:  { "grade": "三年级上册", "lesson": 5 }
  --   character_set:   { "glyphs": ["一","二","三"] }
  --   time_goal:       { "minutes": 30 }
  note            text,
  due_at          timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assign_child_pending ON parent_assignments(child_user_id, completed_at) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assign_parent       ON parent_assignments(parent_user_id);

-- ── 5. Parent settings override for child ──────────────────────────────
CREATE TABLE IF NOT EXISTS parent_settings_override (
  parent_user_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  child_user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  difficulty_max   int,                       -- cap learner difficulty (1-5)
  daily_time_min   int,                       -- recommended daily minutes
  paths_allowed    text[],                    -- ['hsk'] | ['renjiao'] | ['hsk','renjiao']
  updated_at       timestamptz DEFAULT now(),
  PRIMARY KEY (parent_user_id, child_user_id)
);

-- ── 6. Extend invitations ──────────────────────────────────────────────
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS assigned_username     text;
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS initial_password      text;
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS initial_display_name  text;
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS role                  text DEFAULT 'student';
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS pre_link_parent_usernames text[];
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS pre_link_child_usernames  text[];

CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_assigned_username
  ON jgw_invites(assigned_username)
  WHERE assigned_username IS NOT NULL;

-- ── 7. RLS policies ────────────────────────────────────────────────────
ALTER TABLE family_links             ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_assignments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_settings_override ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies if re-running
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname, tablename FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('family_links','parent_messages','parent_assignments','parent_settings_override')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- family_links: parent or child can read their own links; admin manages all
CREATE POLICY "family_self_read" ON family_links FOR SELECT
  USING (auth.uid() = parent_user_id OR auth.uid() = child_user_id);
CREATE POLICY "family_admin_write" ON family_links FOR ALL
  USING (
    EXISTS (SELECT 1 FROM jgw_admins WHERE user_id = auth.uid())
    OR auth.uid() = parent_user_id
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM jgw_admins WHERE user_id = auth.uid())
    OR auth.uid() = parent_user_id
  );

-- parent_messages: sender and receiver can read; sender can insert; receiver can mark read (via UPDATE)
CREATE POLICY "msg_read" ON parent_messages FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "msg_send" ON parent_messages FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "msg_mark_read" ON parent_messages FOR UPDATE
  USING (auth.uid() = to_user_id);

-- parent_assignments: both sides read; parent inserts/updates; child marks completed
CREATE POLICY "assign_read" ON parent_assignments FOR SELECT
  USING (auth.uid() = parent_user_id OR auth.uid() = child_user_id);
CREATE POLICY "assign_create" ON parent_assignments FOR INSERT
  WITH CHECK (auth.uid() = parent_user_id);
CREATE POLICY "assign_update" ON parent_assignments FOR UPDATE
  USING (auth.uid() = parent_user_id OR auth.uid() = child_user_id);

-- parent_settings_override: parent manages; child can read
CREATE POLICY "setoverride_read" ON parent_settings_override FOR SELECT
  USING (auth.uid() = parent_user_id OR auth.uid() = child_user_id);
CREATE POLICY "setoverride_parent_write" ON parent_settings_override FOR ALL
  USING (auth.uid() = parent_user_id) WITH CHECK (auth.uid() = parent_user_id);

-- ── 8. Helper RPCs ─────────────────────────────────────────────────────

-- Resolve a username to the synthetic email for Supabase Auth
-- Used at login time: user types username, client calls this, gets email, signs in
CREATE OR REPLACE FUNCTION resolve_username_to_email(p_username text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT u.email
  FROM auth.users u
  JOIN jgw_user_profiles p ON p.user_id = u.id
  WHERE LOWER(p.username) = LOWER(p_username)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION resolve_username_to_email(text) TO anon, authenticated;

-- Get current user's full profile + linked family
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS TABLE (
  user_id       uuid,
  username      text,
  display_name  text,
  role          text,
  email         text,
  family        jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    p.user_id,
    p.username,
    p.display_name,
    p.role,
    u.email,
    CASE
      WHEN p.role = 'parent' THEN (
        SELECT jsonb_agg(jsonb_build_object(
          'child_user_id', fl.child_user_id,
          'child_username', cp.username,
          'child_display_name', cp.display_name,
          'relationship', fl.relationship
        ))
        FROM family_links fl
        JOIN jgw_user_profiles cp ON cp.user_id = fl.child_user_id
        WHERE fl.parent_user_id = p.user_id
      )
      WHEN p.role = 'student' THEN (
        SELECT jsonb_agg(jsonb_build_object(
          'parent_user_id', fl.parent_user_id,
          'parent_username', pp.username,
          'parent_display_name', pp.display_name,
          'relationship', fl.relationship
        ))
        FROM family_links fl
        JOIN jgw_user_profiles pp ON pp.user_id = fl.parent_user_id
        WHERE fl.child_user_id = p.user_id
      )
      ELSE NULL
    END AS family
  FROM jgw_user_profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION get_my_profile() TO authenticated;

-- Check if a username is available (for admin when creating invites)
CREATE OR REPLACE FUNCTION is_username_available(p_username text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM jgw_user_profiles WHERE LOWER(username) = LOWER(p_username)
    UNION
    SELECT 1 FROM jgw_invites WHERE LOWER(assigned_username) = LOWER(p_username)
      AND used_at IS NULL AND (expires_at IS NULL OR expires_at > now())
  );
$$;

GRANT EXECUTE ON FUNCTION is_username_available(text) TO authenticated;

-- Generate a unique auto-generated username (for AI-assign mode)
-- For students: YANG_LIN_001 pattern (takes prefix or defaults STUDENT)
-- For parents:  PARENT_2847 pattern (4-digit random)
CREATE OR REPLACE FUNCTION generate_username(p_role text, p_prefix text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  candidate text;
  attempt   int := 0;
BEGIN
  LOOP
    attempt := attempt + 1;
    IF attempt > 100 THEN
      RAISE EXCEPTION 'Could not generate unique username after 100 attempts';
    END IF;

    IF p_role = 'parent' THEN
      candidate := 'PARENT_' || lpad(floor(random() * 10000)::text, 4, '0');
    ELSIF p_role = 'student' THEN
      IF p_prefix IS NOT NULL THEN
        candidate := upper(p_prefix) || '_' || lpad(floor(random() * 1000)::text, 3, '0');
      ELSE
        candidate := 'STUDENT_' || lpad(floor(random() * 10000)::text, 4, '0');
      END IF;
    ELSE
      candidate := upper(COALESCE(p_role, 'USER')) || '_' || lpad(floor(random() * 10000)::text, 4, '0');
    END IF;

    -- Check uniqueness
    IF is_username_available(candidate) THEN
      RETURN candidate;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_username(text, text) TO authenticated;

-- ── 9. Backfill existing admin profile (if not already done) ───────────
-- Your admin@wenzi-learn.net account gets a username for UI display consistency,
-- but can STILL log in with email. New columns don't break old flow.
UPDATE jgw_user_profiles
SET
  username = COALESCE(username, 'admin'),
  role = COALESCE(role, 'admin'),
  display_name = COALESCE(display_name, 'Admin')
WHERE user_id IN (
  SELECT user_id FROM jgw_admins WHERE role = 'superadmin'
)
  AND username IS NULL;

-- ── Verify ─────────────────────────────────────────────────────────────
-- SELECT user_id, username, role, display_name FROM jgw_user_profiles LIMIT 5;
-- SELECT 'family_links' AS t, COUNT(*) FROM family_links
-- UNION ALL SELECT 'parent_messages', COUNT(*) FROM parent_messages
-- UNION ALL SELECT 'parent_assignments', COUNT(*) FROM parent_assignments;

-- Test the helper functions:
-- SELECT resolve_username_to_email('admin');    -- should return admin's email
-- SELECT is_username_available('yang_lin');     -- true/false
-- SELECT generate_username('student', 'YANG');  -- returns e.g. YANG_472
-- SELECT * FROM get_my_profile();               -- current user's data

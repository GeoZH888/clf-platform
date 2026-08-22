-- ═══════════════════════════════════════════════════════════════════════
--  大卫学中文 — Migration 003 FIX (view-aware)
--
--  Use this if 003_lingua_learn_compat.sql failed on:
--    ERROR: ALTER action ADD COLUMN cannot be performed on relation
--           "jgw_points_summary" — This operation is not supported for views.
--
--  Cause: jgw_points_summary exists as a VIEW in your DB, not a table.
--  Fix: detect view vs table, skip ALTER/RLS on views, let views stay as-is.
--
--  Safe to run multiple times. Completes everything 003 left unfinished.
-- ═══════════════════════════════════════════════════════════════════════

-- Step 1: Handle jgw_points_summary — view, table, or missing?
DO $$
DECLARE
  rel_kind char;
BEGIN
  SELECT relkind INTO rel_kind
  FROM pg_class
  WHERE relname = 'jgw_points_summary'
    AND relnamespace = 'public'::regnamespace;

  IF rel_kind = 'v' OR rel_kind = 'm' THEN
    RAISE NOTICE 'jgw_points_summary is a % — skipping ALTER (views cannot have columns added)',
      CASE rel_kind WHEN 'v' THEN 'view' ELSE 'materialized view' END;

  ELSIF rel_kind = 'r' THEN
    RAISE NOTICE 'jgw_points_summary is a table — adding any missing columns';
    EXECUTE 'ALTER TABLE jgw_points_summary ADD COLUMN IF NOT EXISTS device_token text';
    EXECUTE 'ALTER TABLE jgw_points_summary ADD COLUMN IF NOT EXISTS day          date';
    EXECUTE 'ALTER TABLE jgw_points_summary ADD COLUMN IF NOT EXISTS total_points int DEFAULT 0';

  ELSE
    RAISE NOTICE 'jgw_points_summary does not exist — creating as a view over jgw_points';
    EXECUTE $v$
      CREATE VIEW jgw_points_summary AS
      SELECT
        device_token,
        DATE(earned_at) AS day,
        COALESCE(SUM(points), 0)::int AS total_points
      FROM jgw_points
      WHERE device_token IS NOT NULL
      GROUP BY device_token, DATE(earned_at)
    $v$;
  END IF;
END $$;

-- Step 2: RLS — enable on real tables only, skip views
-- (Views inherit RLS from the underlying tables; no ALTER needed on them)
DO $$
DECLARE
  t text;
  real_tables text[] := ARRAY[
    'jgw_invites','jgw_device_sessions','jgw_learner_profiles','jgw_admins',
    'jgw_chengyu','jgw_chengyu_progress','jgw_poems','jgw_grammar_patterns',
    'jgw_articulation_diagrams','jgw_hsk_progress','jgw_progress','jgw_practice_log',
    'jgw_words_log','jgw_practice_sessions','jgw_point_rules',
    'jgw_panda_assets','illustrations','clf_learner_profiles','clf_characters','clf_progress'
  ];
BEGIN
  FOREACH t IN ARRAY real_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class
      WHERE relname = t AND relnamespace = 'public'::regnamespace AND relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- Step 3: is_admin() — handles both admin_users and jgw_admins
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM jgw_admins  WHERE user_id = auth.uid());
$$;

-- Step 4: Drop any leftover policies (so recreating below doesn't collide)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname='public' AND tablename IN (
      'jgw_invites','jgw_device_sessions','jgw_learner_profiles','jgw_admins',
      'jgw_chengyu','jgw_chengyu_progress','jgw_poems','jgw_grammar_patterns',
      'jgw_articulation_diagrams','jgw_hsk_progress','jgw_progress','jgw_practice_log',
      'jgw_words_log','jgw_practice_sessions','jgw_point_rules',
      'jgw_panda_assets','illustrations','clf_learner_profiles','clf_characters','clf_progress'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Step 5: Policies — ONLY on real tables (checked via same helper)
-- Helper: wraps CREATE POLICY in a check that the target is a real table
DO $$
DECLARE
  stmts text[] := ARRAY[
    -- Public read on content
    $s$CREATE POLICY "pub_read_chengyu"   ON jgw_chengyu              FOR SELECT USING (true)$s$,
    $s$CREATE POLICY "pub_read_poems"     ON jgw_poems                FOR SELECT USING (true)$s$,
    $s$CREATE POLICY "pub_read_grammar"   ON jgw_grammar_patterns     FOR SELECT USING (true)$s$,
    $s$CREATE POLICY "pub_read_artic"     ON jgw_articulation_diagrams FOR SELECT USING (true)$s$,
    $s$CREATE POLICY "pub_read_panda"     ON jgw_panda_assets         FOR SELECT USING (true)$s$,
    $s$CREATE POLICY "pub_read_rules"     ON jgw_point_rules          FOR SELECT USING (true)$s$,
    $s$CREATE POLICY "pub_read_illust"    ON illustrations            FOR SELECT USING (true)$s$,
    $s$CREATE POLICY "pub_read_clf_chars" ON clf_characters           FOR SELECT USING (true)$s$,
    -- Public progress writes
    $s$CREATE POLICY "pub_rw_sessions"    ON jgw_device_sessions   FOR ALL USING (true) WITH CHECK (true)$s$,
    $s$CREATE POLICY "pub_rw_profile"     ON jgw_learner_profiles  FOR ALL USING (true) WITH CHECK (true)$s$,
    $s$CREATE POLICY "pub_rw_chy_prog"    ON jgw_chengyu_progress  FOR ALL USING (true) WITH CHECK (true)$s$,
    $s$CREATE POLICY "pub_rw_hsk_prog"    ON jgw_hsk_progress      FOR ALL USING (true) WITH CHECK (true)$s$,
    $s$CREATE POLICY "pub_rw_progress"    ON jgw_progress          FOR ALL USING (true) WITH CHECK (true)$s$,
    $s$CREATE POLICY "pub_rw_practice"    ON jgw_practice_log      FOR ALL USING (true) WITH CHECK (true)$s$,
    $s$CREATE POLICY "pub_rw_words_log"   ON jgw_words_log         FOR ALL USING (true) WITH CHECK (true)$s$,
    $s$CREATE POLICY "pub_rw_sessions2"   ON jgw_practice_sessions FOR ALL USING (true) WITH CHECK (true)$s$,
    $s$CREATE POLICY "pub_rw_clf_prof"    ON clf_learner_profiles  FOR ALL USING (true) WITH CHECK (true)$s$,
    $s$CREATE POLICY "pub_rw_clf_prog"    ON clf_progress          FOR ALL USING (true) WITH CHECK (true)$s$,
    -- Invites
    $s$CREATE POLICY "pub_read_invites"   ON jgw_invites           FOR SELECT USING (true)$s$,
    $s$CREATE POLICY "pub_upd_invites"    ON jgw_invites           FOR UPDATE USING (true)$s$,
    -- Admin-only
    $s$CREATE POLICY "adm_all_chengyu"    ON jgw_chengyu              FOR ALL USING (is_admin())$s$,
    $s$CREATE POLICY "adm_all_poems"      ON jgw_poems                FOR ALL USING (is_admin())$s$,
    $s$CREATE POLICY "adm_all_grammar"    ON jgw_grammar_patterns     FOR ALL USING (is_admin())$s$,
    $s$CREATE POLICY "adm_all_artic"      ON jgw_articulation_diagrams FOR ALL USING (is_admin())$s$,
    $s$CREATE POLICY "adm_all_rules"      ON jgw_point_rules          FOR ALL USING (is_admin())$s$,
    $s$CREATE POLICY "adm_all_panda"      ON jgw_panda_assets         FOR ALL USING (is_admin())$s$,
    $s$CREATE POLICY "adm_all_illust"     ON illustrations            FOR ALL USING (is_admin())$s$,
    $s$CREATE POLICY "adm_ins_invite"     ON jgw_invites              FOR INSERT WITH CHECK (is_admin())$s$,
    $s$CREATE POLICY "adm_del_invite"     ON jgw_invites              FOR DELETE USING (is_admin())$s$,
    $s$CREATE POLICY "adm_all_clf_chars"  ON clf_characters           FOR INSERT WITH CHECK (is_admin())$s$,
    $s$CREATE POLICY "adm_upd_clf_chars"  ON clf_characters           FOR UPDATE USING (is_admin())$s$,
    $s$CREATE POLICY "adm_del_clf_chars"  ON clf_characters           FOR DELETE USING (is_admin())$s$,
    $s$CREATE POLICY "adm_read_admins"    ON jgw_admins               FOR SELECT USING (is_admin())$s$
  ];
  stmt text;
  tbl text;
BEGIN
  FOREACH stmt IN ARRAY stmts LOOP
    -- Extract target table name between "ON " and next whitespace
    tbl := substring(stmt FROM ' ON (\w+)');
    IF EXISTS (
      SELECT 1 FROM pg_class
      WHERE relname = tbl AND relnamespace = 'public'::regnamespace AND relkind = 'r'
    ) THEN
      BEGIN
        EXECUTE stmt;
      EXCEPTION WHEN duplicate_object THEN
        NULL;  -- already exists, skip
      END;
    ELSE
      RAISE NOTICE 'Skipping policy for % (not a real table)', tbl;
    END IF;
  END LOOP;
END $$;

-- Step 6: Seed default point rules (no-op if already there)
INSERT INTO jgw_point_rules (action, points, description, active) VALUES
  ('character_practiced',   2, 'Practiced a character', true),
  ('character_perfect',     5, 'Perfect character practice', true),
  ('pinyin_listen_right',   1, 'Correct pinyin listen', true),
  ('pinyin_type_right',     3, 'Correct pinyin typing', true),
  ('word_learned',          2, 'Learned a word', true),
  ('chengyu_flash',         1, 'Viewed an idiom', true),
  ('chengyu_quiz_right',    3, 'Correct idiom quiz', true),
  ('hsk_quiz_right',        2, 'Correct HSK quiz', true),
  ('poetry_read',           1, 'Read a poem', true),
  ('grammar_quiz_right',    3, 'Correct grammar quiz', true)
ON CONFLICT (action) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════
-- Done. Verify:
--
--   -- Count real tables vs views
--   SELECT relkind, COUNT(*) FROM pg_class
--   WHERE relnamespace = 'public'::regnamespace AND relname LIKE 'jgw_%' OR relname LIKE 'clf_%'
--   GROUP BY relkind;
--   -- Expected: 'r' (table) ~28, 'v' (view) 1+, 'i' (index) many
--
--   -- Confirm policies are in place
--   SELECT COUNT(*) FROM pg_policies WHERE schemaname='public';
-- ════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
--  大卫学中文 — Lingua-Learn Compatibility Migration (v3)
--
--  Adds every table that lingua-learn's UI expects into the CLF Supabase
--  project. Safe to run on top of 001_new_infrastructure_BULLETPROOF.sql
--  and 002_voyage_1024_dim.sql — fully idempotent.
--
--  After running this, lingua-learn's ENTIRE UI can read/write against
--  your CLF database without needing any other schema work.
-- ═══════════════════════════════════════════════════════════════════════

-- Safety nets
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ════════════════════════════════════════════════════════════════════════
-- A. Learner auth + sessions (lingua-learn's device-token model)
-- ════════════════════════════════════════════════════════════════════════

-- Invites — admin-issued QR codes grant access
CREATE TABLE IF NOT EXISTS jgw_invites (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS token         text UNIQUE;
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS label         text;
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS modules       text[] DEFAULT '{}';
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS max_sessions  int DEFAULT 1;
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS expires_at    timestamptz;
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS used_at       timestamptz;
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS created_by    uuid;
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS created_at    timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_invites_token ON jgw_invites(token);

-- Device sessions — track which devices redeemed which invite
CREATE TABLE IF NOT EXISTS jgw_device_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_device_sessions ADD COLUMN IF NOT EXISTS invite_id    uuid;
ALTER TABLE jgw_device_sessions ADD COLUMN IF NOT EXISTS device_token text;
ALTER TABLE jgw_device_sessions ADD COLUMN IF NOT EXISTS user_agent   text;
ALTER TABLE jgw_device_sessions ADD COLUMN IF NOT EXISTS is_active    boolean DEFAULT true;
ALTER TABLE jgw_device_sessions ADD COLUMN IF NOT EXISTS last_seen    timestamptz DEFAULT now();
ALTER TABLE jgw_device_sessions ADD COLUMN IF NOT EXISTS created_at   timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_sessions_token  ON jgw_device_sessions(device_token);
CREATE INDEX IF NOT EXISTS idx_sessions_invite ON jgw_device_sessions(invite_id, is_active);

-- Learner profile (lingua-learn's version, separate from clf_learner_profiles)
CREATE TABLE IF NOT EXISTS jgw_learner_profiles (device_token text PRIMARY KEY);
ALTER TABLE jgw_learner_profiles ADD COLUMN IF NOT EXISTS display_name  text;
ALTER TABLE jgw_learner_profiles ADD COLUMN IF NOT EXISTS native_lang   text DEFAULT 'en';
ALTER TABLE jgw_learner_profiles ADD COLUMN IF NOT EXISTS current_level int DEFAULT 1;
ALTER TABLE jgw_learner_profiles ADD COLUMN IF NOT EXISTS goals         text[] DEFAULT '{}';
ALTER TABLE jgw_learner_profiles ADD COLUMN IF NOT EXISTS streak_days   int DEFAULT 0;
ALTER TABLE jgw_learner_profiles ADD COLUMN IF NOT EXISTS xp            int DEFAULT 0;
ALTER TABLE jgw_learner_profiles ADD COLUMN IF NOT EXISTS created_at    timestamptz DEFAULT now();

-- Admins (lingua-learn has jgw_admins, you already have admin_users — this is the lingua-learn-compatible one)
CREATE TABLE IF NOT EXISTS jgw_admins (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_admins ADD COLUMN IF NOT EXISTS user_id    uuid UNIQUE;
ALTER TABLE jgw_admins ADD COLUMN IF NOT EXISTS email      text;
ALTER TABLE jgw_admins ADD COLUMN IF NOT EXISTS role       text DEFAULT 'admin';
ALTER TABLE jgw_admins ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='jgw_admins_user_id_fkey') THEN
    ALTER TABLE jgw_admins ADD CONSTRAINT jgw_admins_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════
-- B. Learning content tables
-- ════════════════════════════════════════════════════════════════════════

-- jgw_characters already exists from 001 — add any missing lingua-learn fields
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS glyph_trad      text;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS pinyin_tone     int;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS pictograph_type text;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS geometry        jsonb DEFAULT '{}'::jsonb;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS semantics       jsonb DEFAULT '{}'::jsonb;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS image_url       text;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS active          boolean DEFAULT true;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS sort_order      int DEFAULT 0;

-- Chengyu (idioms)
CREATE TABLE IF NOT EXISTS jgw_chengyu (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_chengyu ADD COLUMN IF NOT EXISTS idiom         text UNIQUE;
ALTER TABLE jgw_chengyu ADD COLUMN IF NOT EXISTS pinyin        text;
ALTER TABLE jgw_chengyu ADD COLUMN IF NOT EXISTS meaning_zh    text;
ALTER TABLE jgw_chengyu ADD COLUMN IF NOT EXISTS meaning_en    text;
ALTER TABLE jgw_chengyu ADD COLUMN IF NOT EXISTS meaning_it    text;
ALTER TABLE jgw_chengyu ADD COLUMN IF NOT EXISTS story_zh      text;
ALTER TABLE jgw_chengyu ADD COLUMN IF NOT EXISTS story_en      text;
ALTER TABLE jgw_chengyu ADD COLUMN IF NOT EXISTS example       text;
ALTER TABLE jgw_chengyu ADD COLUMN IF NOT EXISTS image_url     text;
ALTER TABLE jgw_chengyu ADD COLUMN IF NOT EXISTS image_style   text;
ALTER TABLE jgw_chengyu ADD COLUMN IF NOT EXISTS hsk_level     int;
ALTER TABLE jgw_chengyu ADD COLUMN IF NOT EXISTS difficulty    int DEFAULT 1;
ALTER TABLE jgw_chengyu ADD COLUMN IF NOT EXISTS active        boolean DEFAULT true;
ALTER TABLE jgw_chengyu ADD COLUMN IF NOT EXISTS sort_order    int DEFAULT 0;
ALTER TABLE jgw_chengyu ADD COLUMN IF NOT EXISTS created_at    timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS jgw_chengyu_progress (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_chengyu_progress ADD COLUMN IF NOT EXISTS device_token text;
ALTER TABLE jgw_chengyu_progress ADD COLUMN IF NOT EXISTS chengyu_id   uuid;
ALTER TABLE jgw_chengyu_progress ADD COLUMN IF NOT EXISTS status       text;
ALTER TABLE jgw_chengyu_progress ADD COLUMN IF NOT EXISTS last_seen    timestamptz DEFAULT now();

-- Poems
CREATE TABLE IF NOT EXISTS jgw_poems (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_poems ADD COLUMN IF NOT EXISTS title         text;
ALTER TABLE jgw_poems ADD COLUMN IF NOT EXISTS author        text;
ALTER TABLE jgw_poems ADD COLUMN IF NOT EXISTS dynasty       text;
ALTER TABLE jgw_poems ADD COLUMN IF NOT EXISTS content_zh    text;
ALTER TABLE jgw_poems ADD COLUMN IF NOT EXISTS content_en    text;
ALTER TABLE jgw_poems ADD COLUMN IF NOT EXISTS content_it    text;
ALTER TABLE jgw_poems ADD COLUMN IF NOT EXISTS pinyin        text;
ALTER TABLE jgw_poems ADD COLUMN IF NOT EXISTS annotation_zh text;
ALTER TABLE jgw_poems ADD COLUMN IF NOT EXISTS image_url     text;
ALTER TABLE jgw_poems ADD COLUMN IF NOT EXISTS audio_url     text;
ALTER TABLE jgw_poems ADD COLUMN IF NOT EXISTS difficulty    int DEFAULT 1;
ALTER TABLE jgw_poems ADD COLUMN IF NOT EXISTS active        boolean DEFAULT true;
ALTER TABLE jgw_poems ADD COLUMN IF NOT EXISTS sort_order    int DEFAULT 0;
ALTER TABLE jgw_poems ADD COLUMN IF NOT EXISTS created_at    timestamptz DEFAULT now();

-- Grammar patterns
CREATE TABLE IF NOT EXISTS jgw_grammar_patterns (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS pattern       text;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS title_zh      text;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS title_en      text;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS explanation_zh text;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS explanation_en text;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS explanation_it text;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS examples      jsonb DEFAULT '[]'::jsonb;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS hsk_level     int;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS category      text;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS difficulty    int DEFAULT 1;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS active        boolean DEFAULT true;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS sort_order    int DEFAULT 0;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS created_at    timestamptz DEFAULT now();

-- jgw_words already exists from 001 — add lingua-learn fields if missing
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS word_zh     text;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS word_trad   text;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS active      boolean DEFAULT true;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS sort_order  int DEFAULT 0;
-- Keep the `word` column from 001 as primary; `word_zh` is a convenience alias for lingua-learn

-- jgw_hsk_words already exists from 001 — add ordering field
ALTER TABLE jgw_hsk_words ADD COLUMN IF NOT EXISTS active     boolean DEFAULT true;
ALTER TABLE jgw_hsk_words ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;

-- jgw_pinyin_exercises already exists — add active flag
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- Articulation diagrams (mouth shapes for pinyin)
CREATE TABLE IF NOT EXISTS jgw_articulation_diagrams (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_articulation_diagrams ADD COLUMN IF NOT EXISTS phoneme     text UNIQUE;
ALTER TABLE jgw_articulation_diagrams ADD COLUMN IF NOT EXISTS ipa         text;
ALTER TABLE jgw_articulation_diagrams ADD COLUMN IF NOT EXISTS svg_data    text;
ALTER TABLE jgw_articulation_diagrams ADD COLUMN IF NOT EXISTS image_url   text;
ALTER TABLE jgw_articulation_diagrams ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE jgw_articulation_diagrams ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now();

-- ════════════════════════════════════════════════════════════════════════
-- C. Progress & analytics
-- ════════════════════════════════════════════════════════════════════════

-- HSK progress
CREATE TABLE IF NOT EXISTS jgw_hsk_progress (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_hsk_progress ADD COLUMN IF NOT EXISTS device_token text;
ALTER TABLE jgw_hsk_progress ADD COLUMN IF NOT EXISTS word_id      uuid;
ALTER TABLE jgw_hsk_progress ADD COLUMN IF NOT EXISTS hsk_level    int;
ALTER TABLE jgw_hsk_progress ADD COLUMN IF NOT EXISTS status       text;
ALTER TABLE jgw_hsk_progress ADD COLUMN IF NOT EXISTS streak       int DEFAULT 0;
ALTER TABLE jgw_hsk_progress ADD COLUMN IF NOT EXISTS last_seen    timestamptz DEFAULT now();

-- Generic progress log (module-agnostic)
CREATE TABLE IF NOT EXISTS jgw_progress (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_progress ADD COLUMN IF NOT EXISTS device_token text;
ALTER TABLE jgw_progress ADD COLUMN IF NOT EXISTS module       text;
ALTER TABLE jgw_progress ADD COLUMN IF NOT EXISTS item_id      text;
ALTER TABLE jgw_progress ADD COLUMN IF NOT EXISTS score        int;
ALTER TABLE jgw_progress ADD COLUMN IF NOT EXISTS completed_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS jgw_practice_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_practice_log ADD COLUMN IF NOT EXISTS device_token text;
ALTER TABLE jgw_practice_log ADD COLUMN IF NOT EXISTS module       text;
ALTER TABLE jgw_practice_log ADD COLUMN IF NOT EXISTS action       text;
ALTER TABLE jgw_practice_log ADD COLUMN IF NOT EXISTS metadata     jsonb DEFAULT '{}'::jsonb;
ALTER TABLE jgw_practice_log ADD COLUMN IF NOT EXISTS created_at   timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS jgw_words_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_words_log ADD COLUMN IF NOT EXISTS device_token text;
ALTER TABLE jgw_words_log ADD COLUMN IF NOT EXISTS word_id      uuid;
ALTER TABLE jgw_words_log ADD COLUMN IF NOT EXISTS action       text;
ALTER TABLE jgw_words_log ADD COLUMN IF NOT EXISTS correct      boolean;
ALTER TABLE jgw_words_log ADD COLUMN IF NOT EXISTS created_at   timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS jgw_practice_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_practice_sessions ADD COLUMN IF NOT EXISTS device_token text;
ALTER TABLE jgw_practice_sessions ADD COLUMN IF NOT EXISTS module       text;
ALTER TABLE jgw_practice_sessions ADD COLUMN IF NOT EXISTS duration_s   int;
ALTER TABLE jgw_practice_sessions ADD COLUMN IF NOT EXISTS items_done   int;
ALTER TABLE jgw_practice_sessions ADD COLUMN IF NOT EXISTS started_at   timestamptz DEFAULT now();
ALTER TABLE jgw_practice_sessions ADD COLUMN IF NOT EXISTS ended_at     timestamptz;

-- Points (jgw_points already exists from 001)
-- Point rules (configurable XP awards)
CREATE TABLE IF NOT EXISTS jgw_point_rules (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_point_rules ADD COLUMN IF NOT EXISTS action      text UNIQUE;
ALTER TABLE jgw_point_rules ADD COLUMN IF NOT EXISTS points      int DEFAULT 1;
ALTER TABLE jgw_point_rules ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE jgw_point_rules ADD COLUMN IF NOT EXISTS active      boolean DEFAULT true;

-- Daily summary view (lingua-learn expects this as a table fallback)
CREATE TABLE IF NOT EXISTS jgw_points_summary (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_points_summary ADD COLUMN IF NOT EXISTS device_token text;
ALTER TABLE jgw_points_summary ADD COLUMN IF NOT EXISTS day          date;
ALTER TABLE jgw_points_summary ADD COLUMN IF NOT EXISTS total_points int DEFAULT 0;

-- ════════════════════════════════════════════════════════════════════════
-- D. Panda assets (favicon + teacher illustrations)
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS jgw_panda_assets (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_panda_assets ADD COLUMN IF NOT EXISTS emotion     text;
ALTER TABLE jgw_panda_assets ADD COLUMN IF NOT EXISTS image_url   text;
ALTER TABLE jgw_panda_assets ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE jgw_panda_assets ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now();

-- Generic illustrations (admin-uploaded)
CREATE TABLE IF NOT EXISTS illustrations (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE illustrations ADD COLUMN IF NOT EXISTS subject      text;
ALTER TABLE illustrations ADD COLUMN IF NOT EXISTS subject_type text;
ALTER TABLE illustrations ADD COLUMN IF NOT EXISTS image_url    text;
ALTER TABLE illustrations ADD COLUMN IF NOT EXISTS style        text;
ALTER TABLE illustrations ADD COLUMN IF NOT EXISTS prompt       text;
ALTER TABLE illustrations ADD COLUMN IF NOT EXISTS created_at   timestamptz DEFAULT now();

-- ════════════════════════════════════════════════════════════════════════
-- E. CLF-specific tables (these ARE the "CLF user logic")
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS clf_learner_profiles (device_token text PRIMARY KEY);
ALTER TABLE clf_learner_profiles ADD COLUMN IF NOT EXISTS display_name   text;
ALTER TABLE clf_learner_profiles ADD COLUMN IF NOT EXISTS native_lang    text DEFAULT 'en';
ALTER TABLE clf_learner_profiles ADD COLUMN IF NOT EXISTS generation     int DEFAULT 2;
ALTER TABLE clf_learner_profiles ADD COLUMN IF NOT EXISTS current_level  int DEFAULT 1;
ALTER TABLE clf_learner_profiles ADD COLUMN IF NOT EXISTS hsk_equivalent text;
ALTER TABLE clf_learner_profiles ADD COLUMN IF NOT EXISTS goals          text[] DEFAULT '{}';
ALTER TABLE clf_learner_profiles ADD COLUMN IF NOT EXISTS streak_days    int DEFAULT 0;
ALTER TABLE clf_learner_profiles ADD COLUMN IF NOT EXISTS created_at     timestamptz DEFAULT now();
ALTER TABLE clf_learner_profiles ADD COLUMN IF NOT EXISTS updated_at     timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS clf_characters (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE clf_characters ADD COLUMN IF NOT EXISTS glyph       text UNIQUE;
ALTER TABLE clf_characters ADD COLUMN IF NOT EXISTS pinyin      text;
ALTER TABLE clf_characters ADD COLUMN IF NOT EXISTS meaning_zh  text;
ALTER TABLE clf_characters ADD COLUMN IF NOT EXISTS meaning_en  text;
ALTER TABLE clf_characters ADD COLUMN IF NOT EXISTS meaning_it  text;
ALTER TABLE clf_characters ADD COLUMN IF NOT EXISTS level       int;
ALTER TABLE clf_characters ADD COLUMN IF NOT EXISTS category    text;
ALTER TABLE clf_characters ADD COLUMN IF NOT EXISTS image_url   text;
ALTER TABLE clf_characters ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS clf_progress (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE clf_progress ADD COLUMN IF NOT EXISTS device_token text;
ALTER TABLE clf_progress ADD COLUMN IF NOT EXISTS item_table   text;
ALTER TABLE clf_progress ADD COLUMN IF NOT EXISTS item_id      uuid;
ALTER TABLE clf_progress ADD COLUMN IF NOT EXISTS correct      boolean;
ALTER TABLE clf_progress ADD COLUMN IF NOT EXISTS score        int;
ALTER TABLE clf_progress ADD COLUMN IF NOT EXISTS attempted_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_clf_progress_device ON clf_progress(device_token, item_table);

-- ════════════════════════════════════════════════════════════════════════
-- F. RLS — public read on learning content, writes require admin
-- ════════════════════════════════════════════════════════════════════════

-- Enable
ALTER TABLE jgw_invites              ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_device_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_learner_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_admins               ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_chengyu              ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_chengyu_progress     ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_poems                ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_grammar_patterns     ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_articulation_diagrams ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_hsk_progress         ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_progress             ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_practice_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_words_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_practice_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_point_rules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_points_summary       ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_panda_assets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE illustrations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_learner_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_characters           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_progress             ENABLE ROW LEVEL SECURITY;

-- is_admin() replacement that works with BOTH admin_users (from 001) and jgw_admins (lingua-learn)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM jgw_admins  WHERE user_id = auth.uid());
$$;

-- Drop & recreate policies (idempotent re-runs)
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
      'jgw_words_log','jgw_practice_sessions','jgw_point_rules','jgw_points_summary',
      'jgw_panda_assets','illustrations','clf_learner_profiles','clf_characters','clf_progress'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Public read on content
CREATE POLICY "pub_read_chengyu"   ON jgw_chengyu              FOR SELECT USING (true);
CREATE POLICY "pub_read_poems"     ON jgw_poems                FOR SELECT USING (true);
CREATE POLICY "pub_read_grammar"   ON jgw_grammar_patterns     FOR SELECT USING (true);
CREATE POLICY "pub_read_artic"     ON jgw_articulation_diagrams FOR SELECT USING (true);
CREATE POLICY "pub_read_panda"     ON jgw_panda_assets         FOR SELECT USING (true);
CREATE POLICY "pub_read_rules"     ON jgw_point_rules          FOR SELECT USING (true);
CREATE POLICY "pub_read_illust"    ON illustrations            FOR SELECT USING (true);
CREATE POLICY "pub_read_clf_chars" ON clf_characters           FOR SELECT USING (true);

-- Public progress writes (device-token auth, no real user ID available)
CREATE POLICY "pub_rw_sessions"    ON jgw_device_sessions   FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "pub_rw_profile"     ON jgw_learner_profiles  FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "pub_rw_chy_prog"    ON jgw_chengyu_progress  FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "pub_rw_hsk_prog"    ON jgw_hsk_progress      FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "pub_rw_progress"    ON jgw_progress          FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "pub_rw_practice"    ON jgw_practice_log      FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "pub_rw_words_log"   ON jgw_words_log         FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "pub_rw_sessions2"   ON jgw_practice_sessions FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "pub_rw_summary"     ON jgw_points_summary    FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "pub_rw_clf_prof"    ON clf_learner_profiles  FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "pub_rw_clf_prog"    ON clf_progress          FOR ALL    USING (true) WITH CHECK (true);

-- Invite redemption: lookup (SELECT) public, UPDATE gated by token match handled in app code
CREATE POLICY "pub_read_invites"   ON jgw_invites           FOR SELECT USING (true);
CREATE POLICY "pub_upd_invites"    ON jgw_invites           FOR UPDATE USING (true);

-- Admin full access to admin-managed tables
CREATE POLICY "adm_all_chengyu"    ON jgw_chengyu              FOR ALL USING (is_admin());
CREATE POLICY "adm_all_poems"      ON jgw_poems                FOR ALL USING (is_admin());
CREATE POLICY "adm_all_grammar"    ON jgw_grammar_patterns     FOR ALL USING (is_admin());
CREATE POLICY "adm_all_artic"      ON jgw_articulation_diagrams FOR ALL USING (is_admin());
CREATE POLICY "adm_all_rules"      ON jgw_point_rules          FOR ALL USING (is_admin());
CREATE POLICY "adm_all_panda"      ON jgw_panda_assets         FOR ALL USING (is_admin());
CREATE POLICY "adm_all_illust"     ON illustrations            FOR ALL USING (is_admin());
CREATE POLICY "adm_ins_invite"     ON jgw_invites              FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "adm_del_invite"     ON jgw_invites              FOR DELETE USING (is_admin());
CREATE POLICY "adm_all_clf_chars"  ON clf_characters           FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "adm_upd_clf_chars"  ON clf_characters           FOR UPDATE USING (is_admin());
CREATE POLICY "adm_del_clf_chars"  ON clf_characters           FOR DELETE USING (is_admin());
CREATE POLICY "adm_read_admins"    ON jgw_admins               FOR SELECT USING (is_admin());

-- ════════════════════════════════════════════════════════════════════════
-- G. Seed minimal data so lingua-learn doesn't break on empty DB
-- ════════════════════════════════════════════════════════════════════════

-- Default point rules
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
--   SELECT COUNT(*) FROM information_schema.tables
--   WHERE table_schema='public' AND table_name LIKE 'jgw_%' OR table_name LIKE 'clf_%';
--   -> should be ~30
-- ════════════════════════════════════════════════════════════════════════

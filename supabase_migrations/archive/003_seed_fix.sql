-- ═══════════════════════════════════════════════════════════════════════
--  大卫学中文 — Migration 003 SEED FIX
--
--  Fixes:
--   ERROR 42703: column "description" of relation "jgw_point_rules"
--                does not exist
--
--  Cause: jgw_point_rules was already in your DB with fewer columns than
--  003 expected. The earlier ADD COLUMN block succeeded for SOME tables
--  before the view error aborted the transaction, so column-adds after
--  the failure never ran.
--
--  This file guarantees every column exists BEFORE inserting seed data.
-- ═══════════════════════════════════════════════════════════════════════

-- Ensure jgw_point_rules has all the columns we need
CREATE TABLE IF NOT EXISTS jgw_point_rules (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_point_rules ADD COLUMN IF NOT EXISTS action      text;
ALTER TABLE jgw_point_rules ADD COLUMN IF NOT EXISTS points      int DEFAULT 1;
ALTER TABLE jgw_point_rules ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE jgw_point_rules ADD COLUMN IF NOT EXISTS active      boolean DEFAULT true;

-- Make sure action is UNIQUE for the ON CONFLICT clause to work
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'jgw_point_rules'::regclass
      AND contype = 'u'
      AND conname LIKE '%action%'
  ) THEN
    BEGIN
      ALTER TABLE jgw_point_rules ADD CONSTRAINT jgw_point_rules_action_key UNIQUE (action);
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'Cannot add UNIQUE on action — duplicate actions exist. Run: DELETE FROM jgw_point_rules WHERE id NOT IN (SELECT MIN(id) FROM jgw_point_rules GROUP BY action);';
    END;
  END IF;
END $$;

-- Now seed the default rules
INSERT INTO jgw_point_rules (action, points, description, active) VALUES
  ('character_practiced',   2, 'Practiced a character',  true),
  ('character_perfect',     5, 'Perfect character practice', true),
  ('pinyin_listen_right',   1, 'Correct pinyin listen',  true),
  ('pinyin_type_right',     3, 'Correct pinyin typing',  true),
  ('word_learned',          2, 'Learned a word',         true),
  ('chengyu_flash',         1, 'Viewed an idiom',        true),
  ('chengyu_quiz_right',    3, 'Correct idiom quiz',     true),
  ('hsk_quiz_right',        2, 'Correct HSK quiz',       true),
  ('poetry_read',           1, 'Read a poem',            true),
  ('grammar_quiz_right',    3, 'Correct grammar quiz',   true)
ON CONFLICT (action) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════
-- Belt-and-suspenders: re-run ADD COLUMN for every table migration 003
-- was supposed to touch, so any other partial-failure leftovers are fixed.
-- All idempotent — no-ops if columns already present.
-- ════════════════════════════════════════════════════════════════════════

-- jgw_invites
CREATE TABLE IF NOT EXISTS jgw_invites (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS token         text;
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS label         text;
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS modules       text[] DEFAULT '{}';
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS max_sessions  int DEFAULT 1;
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS expires_at    timestamptz;
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS used_at       timestamptz;
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS created_by    uuid;
ALTER TABLE jgw_invites ADD COLUMN IF NOT EXISTS created_at    timestamptz DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='jgw_invites_token_key') THEN
    BEGIN
      ALTER TABLE jgw_invites ADD CONSTRAINT jgw_invites_token_key UNIQUE (token);
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_invites_token ON jgw_invites(token);

-- jgw_device_sessions
CREATE TABLE IF NOT EXISTS jgw_device_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_device_sessions ADD COLUMN IF NOT EXISTS invite_id    uuid;
ALTER TABLE jgw_device_sessions ADD COLUMN IF NOT EXISTS device_token text;
ALTER TABLE jgw_device_sessions ADD COLUMN IF NOT EXISTS user_agent   text;
ALTER TABLE jgw_device_sessions ADD COLUMN IF NOT EXISTS is_active    boolean DEFAULT true;
ALTER TABLE jgw_device_sessions ADD COLUMN IF NOT EXISTS last_seen    timestamptz DEFAULT now();
ALTER TABLE jgw_device_sessions ADD COLUMN IF NOT EXISTS created_at   timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_sessions_token  ON jgw_device_sessions(device_token);
CREATE INDEX IF NOT EXISTS idx_sessions_invite ON jgw_device_sessions(invite_id, is_active);

-- jgw_learner_profiles
CREATE TABLE IF NOT EXISTS jgw_learner_profiles (device_token text PRIMARY KEY);
ALTER TABLE jgw_learner_profiles ADD COLUMN IF NOT EXISTS display_name  text;
ALTER TABLE jgw_learner_profiles ADD COLUMN IF NOT EXISTS native_lang   text DEFAULT 'en';
ALTER TABLE jgw_learner_profiles ADD COLUMN IF NOT EXISTS current_level int DEFAULT 1;
ALTER TABLE jgw_learner_profiles ADD COLUMN IF NOT EXISTS goals         text[] DEFAULT '{}';
ALTER TABLE jgw_learner_profiles ADD COLUMN IF NOT EXISTS streak_days   int DEFAULT 0;
ALTER TABLE jgw_learner_profiles ADD COLUMN IF NOT EXISTS xp            int DEFAULT 0;
ALTER TABLE jgw_learner_profiles ADD COLUMN IF NOT EXISTS created_at    timestamptz DEFAULT now();

-- jgw_admins
CREATE TABLE IF NOT EXISTS jgw_admins (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_admins ADD COLUMN IF NOT EXISTS user_id    uuid;
ALTER TABLE jgw_admins ADD COLUMN IF NOT EXISTS email      text;
ALTER TABLE jgw_admins ADD COLUMN IF NOT EXISTS role       text DEFAULT 'admin';
ALTER TABLE jgw_admins ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='jgw_admins_user_id_key') THEN
    BEGIN
      ALTER TABLE jgw_admins ADD CONSTRAINT jgw_admins_user_id_key UNIQUE (user_id);
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;

-- jgw_characters — add lingua-learn-specific fields
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS glyph_trad      text;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS pinyin_tone     int;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS pictograph_type text;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS geometry        jsonb DEFAULT '{}'::jsonb;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS semantics       jsonb DEFAULT '{}'::jsonb;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS image_url       text;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS active          boolean DEFAULT true;
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS sort_order      int DEFAULT 0;

-- jgw_chengyu
CREATE TABLE IF NOT EXISTS jgw_chengyu (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_chengyu ADD COLUMN IF NOT EXISTS idiom         text;
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='jgw_chengyu_idiom_key') THEN
    BEGIN
      ALTER TABLE jgw_chengyu ADD CONSTRAINT jgw_chengyu_idiom_key UNIQUE (idiom);
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;

-- jgw_chengyu_progress
CREATE TABLE IF NOT EXISTS jgw_chengyu_progress (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_chengyu_progress ADD COLUMN IF NOT EXISTS device_token text;
ALTER TABLE jgw_chengyu_progress ADD COLUMN IF NOT EXISTS chengyu_id   uuid;
ALTER TABLE jgw_chengyu_progress ADD COLUMN IF NOT EXISTS status       text;
ALTER TABLE jgw_chengyu_progress ADD COLUMN IF NOT EXISTS last_seen    timestamptz DEFAULT now();

-- jgw_poems
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

-- jgw_grammar_patterns
CREATE TABLE IF NOT EXISTS jgw_grammar_patterns (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS pattern        text;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS title_zh       text;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS title_en       text;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS explanation_zh text;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS explanation_en text;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS explanation_it text;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS examples       jsonb DEFAULT '[]'::jsonb;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS hsk_level      int;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS category       text;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS difficulty     int DEFAULT 1;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS active         boolean DEFAULT true;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS sort_order     int DEFAULT 0;
ALTER TABLE jgw_grammar_patterns ADD COLUMN IF NOT EXISTS created_at     timestamptz DEFAULT now();

-- jgw_words — lingua-learn aliases
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS word_zh     text;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS word_trad   text;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS active      boolean DEFAULT true;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS sort_order  int DEFAULT 0;

-- jgw_hsk_words
ALTER TABLE jgw_hsk_words ADD COLUMN IF NOT EXISTS active     boolean DEFAULT true;
ALTER TABLE jgw_hsk_words ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;

-- jgw_pinyin_exercises
ALTER TABLE jgw_pinyin_exercises ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- jgw_articulation_diagrams
CREATE TABLE IF NOT EXISTS jgw_articulation_diagrams (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_articulation_diagrams ADD COLUMN IF NOT EXISTS phoneme     text;
ALTER TABLE jgw_articulation_diagrams ADD COLUMN IF NOT EXISTS ipa         text;
ALTER TABLE jgw_articulation_diagrams ADD COLUMN IF NOT EXISTS svg_data    text;
ALTER TABLE jgw_articulation_diagrams ADD COLUMN IF NOT EXISTS image_url   text;
ALTER TABLE jgw_articulation_diagrams ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE jgw_articulation_diagrams ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='jgw_articulation_diagrams_phoneme_key') THEN
    BEGIN
      ALTER TABLE jgw_articulation_diagrams ADD CONSTRAINT jgw_articulation_diagrams_phoneme_key UNIQUE (phoneme);
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;

-- Progress/logs
CREATE TABLE IF NOT EXISTS jgw_hsk_progress (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_hsk_progress ADD COLUMN IF NOT EXISTS device_token text;
ALTER TABLE jgw_hsk_progress ADD COLUMN IF NOT EXISTS word_id      uuid;
ALTER TABLE jgw_hsk_progress ADD COLUMN IF NOT EXISTS hsk_level    int;
ALTER TABLE jgw_hsk_progress ADD COLUMN IF NOT EXISTS status       text;
ALTER TABLE jgw_hsk_progress ADD COLUMN IF NOT EXISTS streak       int DEFAULT 0;
ALTER TABLE jgw_hsk_progress ADD COLUMN IF NOT EXISTS last_seen    timestamptz DEFAULT now();

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

-- Panda + illustrations
CREATE TABLE IF NOT EXISTS jgw_panda_assets (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE jgw_panda_assets ADD COLUMN IF NOT EXISTS emotion     text;
ALTER TABLE jgw_panda_assets ADD COLUMN IF NOT EXISTS image_url   text;
ALTER TABLE jgw_panda_assets ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE jgw_panda_assets ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS illustrations (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE illustrations ADD COLUMN IF NOT EXISTS subject      text;
ALTER TABLE illustrations ADD COLUMN IF NOT EXISTS subject_type text;
ALTER TABLE illustrations ADD COLUMN IF NOT EXISTS image_url    text;
ALTER TABLE illustrations ADD COLUMN IF NOT EXISTS style        text;
ALTER TABLE illustrations ADD COLUMN IF NOT EXISTS prompt       text;
ALTER TABLE illustrations ADD COLUMN IF NOT EXISTS created_at   timestamptz DEFAULT now();

-- CLF
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
ALTER TABLE clf_characters ADD COLUMN IF NOT EXISTS glyph       text;
ALTER TABLE clf_characters ADD COLUMN IF NOT EXISTS pinyin      text;
ALTER TABLE clf_characters ADD COLUMN IF NOT EXISTS meaning_zh  text;
ALTER TABLE clf_characters ADD COLUMN IF NOT EXISTS meaning_en  text;
ALTER TABLE clf_characters ADD COLUMN IF NOT EXISTS meaning_it  text;
ALTER TABLE clf_characters ADD COLUMN IF NOT EXISTS level       int;
ALTER TABLE clf_characters ADD COLUMN IF NOT EXISTS category    text;
ALTER TABLE clf_characters ADD COLUMN IF NOT EXISTS image_url   text;
ALTER TABLE clf_characters ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='clf_characters_glyph_key') THEN
    BEGIN
      ALTER TABLE clf_characters ADD CONSTRAINT clf_characters_glyph_key UNIQUE (glyph);
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS clf_progress (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE clf_progress ADD COLUMN IF NOT EXISTS device_token text;
ALTER TABLE clf_progress ADD COLUMN IF NOT EXISTS item_table   text;
ALTER TABLE clf_progress ADD COLUMN IF NOT EXISTS item_id      uuid;
ALTER TABLE clf_progress ADD COLUMN IF NOT EXISTS correct      boolean;
ALTER TABLE clf_progress ADD COLUMN IF NOT EXISTS score        int;
ALTER TABLE clf_progress ADD COLUMN IF NOT EXISTS attempted_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_clf_progress_device ON clf_progress(device_token, item_table);

-- ════════════════════════════════════════════════════════════════════════
-- Verify
--
--   SELECT action, points, description FROM jgw_point_rules ORDER BY action;
--   -- Should show 10 rows
--
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public'
--     AND (table_name LIKE 'jgw_%' OR table_name LIKE 'clf_%')
--   ORDER BY table_name;
-- ════════════════════════════════════════════════════════════════════════

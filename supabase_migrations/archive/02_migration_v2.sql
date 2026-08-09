-- ════════════════════════════════════════════════════════════════════
-- STAGE 1A v2 MIGRATION — FIXED
-- ════════════════════════════════════════════════════════════════════
-- Run on CLF's Supabase. Fixes the FK constraint issue from v1.
--
-- v1 failed because dwxz_user_profile.user_id couldn't FK to
-- jgw_registrations.approved_user_id (column wasn't unique).
--
-- Fix: Add UNIQUE constraint on approved_user_id FIRST, then everything else.
-- Verified safe: all 4 existing rows have non-null, distinct approved_user_id.
--
-- Wrapped in BEGIN/COMMIT — atomic. If anything fails, all rolled back.

BEGIN;

-- ── Step 0: Add UNIQUE constraint on approved_user_id ───────────────
-- This is required so other tables can FK to it.
-- Postgres UNIQUE constraints allow multiple NULLs but enforce
-- uniqueness on non-null values, which matches our data.
ALTER TABLE jgw_registrations
  ADD CONSTRAINT jgw_registrations_approved_user_id_unique
  UNIQUE (approved_user_id);

-- ── Step 1: Add columns to jgw_registrations ────────────────────────
ALTER TABLE jgw_registrations
  ADD COLUMN IF NOT EXISTS role        text,
  ADD COLUMN IF NOT EXISTS is_active   boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS name_zh     text,
  ADD COLUMN IF NOT EXISTS gender      text,
  ADD COLUMN IF NOT EXISTS birth_year  integer,
  ADD COLUMN IF NOT EXISTS phone       text;

-- ── Step 2: Add CHECK constraint on role ────────────────────────────
ALTER TABLE jgw_registrations
  DROP CONSTRAINT IF EXISTS jgw_registrations_role_check;

ALTER TABLE jgw_registrations
  ADD CONSTRAINT jgw_registrations_role_check
  CHECK (role IS NULL OR role IN (
    'super_admin',
    'admin',
    'teacher',
    'student',
    'parent',
    'school_admin',
    'school_master',
    'community'
  ));

-- ── Step 3: Create dwxz_user_profile table ──────────────────────────
-- David-specific user fields, 1:1 linked to jgw_registrations.
CREATE TABLE IF NOT EXISTS public.dwxz_user_profile (
  user_id              uuid PRIMARY KEY,
  school_id            uuid,
  hsk_level            integer DEFAULT 1,
  avatar               text,
  avatar_url           text,
  student_id           text,
  parent_name          text,
  parent_phone         text,
  apply_class          text,
  language_preference  text DEFAULT 'zh',
  login_type           text DEFAULT 'username',
  password_changed     boolean DEFAULT true,
  approved_by          uuid,
  approved_at          timestamp with time zone,
  rejected             boolean DEFAULT false,
  last_login           timestamp with time zone,
  created_at           timestamp with time zone DEFAULT now(),
  updated_at           timestamp with time zone DEFAULT now(),
  CONSTRAINT dwxz_user_profile_user_fk
    FOREIGN KEY (user_id) REFERENCES jgw_registrations(approved_user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS dwxz_user_profile_school_idx
  ON dwxz_user_profile(school_id);

-- ── Step 4: Documentation ───────────────────────────────────────────
COMMENT ON COLUMN jgw_registrations.role IS
  'User role: super_admin/admin/teacher/student/parent/school_admin/school_master/community.
   NULL for legacy CLF users (treated as community).';

COMMENT ON TABLE dwxz_user_profile IS
  'David system user profile fields. 1:1 with jgw_registrations via user_id.
   Created during David→CLF merge.';

COMMIT;

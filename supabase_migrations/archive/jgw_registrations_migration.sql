-- ═══════════════════════════════════════════════════════════════════
--  Registration system migration
--  1. jgw_registrations      — user applications + review state
--  2. jgw_registration_invites — admin-created invite codes (hybrid path)
-- ═══════════════════════════════════════════════════════════════════

-- Need pgcrypto for bcrypt password hashing (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Registrations ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view by token"      ON jgw_registrations;
DROP POLICY IF EXISTS "Admins read all registrations" ON jgw_registrations;
DROP POLICY IF EXISTS "Admins update registrations"   ON jgw_registrations;

CREATE TABLE IF NOT EXISTS jgw_registrations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  username         text NOT NULL UNIQUE,
  password_hash    text NOT NULL,
  email            text,
  reason           text NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected')),
  status_token     uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invite_code      text,
  rejection_reason text,
  reviewed_at      timestamptz,
  reviewed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_ip        text,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registrations_status  ON jgw_registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_created ON jgw_registrations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registrations_username ON jgw_registrations(username);

ALTER TABLE jgw_registrations ENABLE ROW LEVEL SECURITY;

-- Regular users + anon cannot SELECT directly — they must use the
-- /register-status Netlify function which takes the status_token.
-- Admins (jgw_admins or superadmin metadata) can read everything.
CREATE POLICY "Admins read all registrations"
  ON jgw_registrations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM jgw_admins WHERE user_id = auth.uid())
    OR (auth.jwt()->'user_metadata'->>'role') = 'superadmin'
  );

CREATE POLICY "Admins update registrations"
  ON jgw_registrations FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM jgw_admins WHERE user_id = auth.uid())
    OR (auth.jwt()->'user_metadata'->>'role') = 'superadmin'
  );

-- INSERT happens from Netlify function using service role key, bypassing RLS.
-- No public insert policy on purpose.

-- ── 2. Invite codes ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins manage invites" ON jgw_registration_invites;

CREATE TABLE IF NOT EXISTS jgw_registration_invites (
  code        text PRIMARY KEY,
  max_uses    int NOT NULL DEFAULT 1,
  used_count  int NOT NULL DEFAULT 0,
  expires_at  timestamptz,
  notes       text,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE jgw_registration_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invites"
  ON jgw_registration_invites FOR ALL
  USING (
    EXISTS (SELECT 1 FROM jgw_admins WHERE user_id = auth.uid())
    OR (auth.jwt()->'user_metadata'->>'role') = 'superadmin'
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM jgw_admins WHERE user_id = auth.uid())
    OR (auth.jwt()->'user_metadata'->>'role') = 'superadmin'
  );

-- Validation happens in Netlify function with service role key, bypassing RLS.

NOTIFY pgrst, 'reload schema';

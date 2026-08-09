-- ═══════════════════════════════════════════════════════════════════
--  Migration: clf_quicklogin_tokens + sessions
--  Lets superadmins create accounts AND issue QR codes that auto-login
--  on scan, bounded by expiry date and max device count.
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Tables ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clf_quicklogin_tokens (
  token         text PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username      text NOT NULL,
  max_devices   int  NOT NULL DEFAULT 1,
  device_count  int  NOT NULL DEFAULT 0,
  expires_at    timestamptz,
  label         text,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now(),
  last_used_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_quicklogin_user ON clf_quicklogin_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_quicklogin_expires ON clf_quicklogin_tokens(expires_at);

CREATE TABLE IF NOT EXISTS clf_quicklogin_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token        text NOT NULL REFERENCES clf_quicklogin_tokens(token) ON DELETE CASCADE,
  device_id    text NOT NULL,
  user_agent   text,
  ip           text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (token, device_id)
);

CREATE INDEX IF NOT EXISTS idx_quicklogin_sessions_token ON clf_quicklogin_sessions(token);

-- ── RLS ────────────────────────────────────────────────────────

ALTER TABLE clf_quicklogin_tokens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_quicklogin_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read tokens" ON clf_quicklogin_tokens;
DROP POLICY IF EXISTS "Admins insert tokens" ON clf_quicklogin_tokens;
DROP POLICY IF EXISTS "Admins update tokens" ON clf_quicklogin_tokens;
DROP POLICY IF EXISTS "Admins delete tokens" ON clf_quicklogin_tokens;
DROP POLICY IF EXISTS "Admins read sessions" ON clf_quicklogin_sessions;

-- Only admins or superadmins can see/manage tokens via client SDK.
-- Netlify functions use service role and bypass RLS.
CREATE POLICY "Admins read tokens"
  ON clf_quicklogin_tokens FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM jgw_admins WHERE user_id = auth.uid())
    OR (auth.jwt()->'user_metadata'->>'role') = 'superadmin'
  );

CREATE POLICY "Admins insert tokens"
  ON clf_quicklogin_tokens FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM jgw_admins WHERE user_id = auth.uid())
    OR (auth.jwt()->'user_metadata'->>'role') = 'superadmin'
  );

CREATE POLICY "Admins update tokens"
  ON clf_quicklogin_tokens FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM jgw_admins WHERE user_id = auth.uid())
    OR (auth.jwt()->'user_metadata'->>'role') = 'superadmin'
  );

CREATE POLICY "Admins delete tokens"
  ON clf_quicklogin_tokens FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM jgw_admins WHERE user_id = auth.uid())
    OR (auth.jwt()->'user_metadata'->>'role') = 'superadmin'
  );

CREATE POLICY "Admins read sessions"
  ON clf_quicklogin_sessions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM jgw_admins WHERE user_id = auth.uid())
    OR (auth.jwt()->'user_metadata'->>'role') = 'superadmin'
  );

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════
--  Migration: extend jgw_device_sessions to support auth.users logins
--  (new admin-created accounts don't have jgw_invites.id)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE jgw_device_sessions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Make invite_id nullable (was required for legacy rows; new rows use user_id instead)
ALTER TABLE jgw_device_sessions
  ALTER COLUMN invite_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_device_sessions_user_id
  ON jgw_device_sessions(user_id);

-- Sanity: at least one of invite_id or user_id must be present
-- (skip constraint if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'device_sessions_needs_owner'
  ) THEN
    ALTER TABLE jgw_device_sessions
      ADD CONSTRAINT device_sessions_needs_owner
      CHECK (invite_id IS NOT NULL OR user_id IS NOT NULL);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

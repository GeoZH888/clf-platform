-- ═══════════════════════════════════════════════════════════════════
--  Migration: auto-approve + label columns on jgw_registration_invites
--  Enables QR-based invites that skip the admin review queue.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE jgw_registration_invites
  ADD COLUMN IF NOT EXISTS auto_approve boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS label        text;

NOTIFY pgrst, 'reload schema';

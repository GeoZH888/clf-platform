// src/lib/adminAudit.js
// Helper for writing rows to clf_admin_audit_log from admin-side UI actions.
// RLS (see supabase/migrations/007_admin_security.sql) requires:
//   - actor_user_id = auth.uid()  (you can't log as someone else)
//   - is_super_admin()            (only super_admin can write to this table)
//
// Best-effort: a failed audit insert NEVER blocks the user-facing action.
// The action either committed or didn't; the audit log is for forensics.

import { supabase } from './supabase.js';

export async function writeAuditLog({ targetUserId, action, before, after, context }) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      console.warn('[audit] no authenticated user, skipping audit row');
      return;
    }
    const { error } = await supabase
      .from('clf_admin_audit_log')
      .insert({
        actor_user_id:  user.id,
        target_user_id: targetUserId ?? null,
        action,
        before_value:   before ?? null,
        after_value:    after ?? null,
        context:        context ?? null,
      });
    if (error) console.warn('[audit] insert failed:', error.message);
  } catch (e) {
    console.warn('[audit] unexpected error:', e?.message);
  }
}

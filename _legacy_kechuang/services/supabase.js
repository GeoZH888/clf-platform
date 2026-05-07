// src/kechuang/services/supabase.js
// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL CLIENT RE-EXPORT
// ───────────────────────────────────────────────────────────────────────────
// The kechuang module previously created its own Supabase client using
// Create-React-App env-var syntax (process.env.REACT_APP_*) which doesn't
// work in Vite. That bug crashed the whole bundle on production builds.
//
// All Supabase access in kechuang/ now flows through the unified client
// in src/lib/supabase.js. Do NOT call createClient() in this folder.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from '../../lib/supabase';

export { supabase };
export default supabase;

// ─────────────────────────────────────────────────────────────
// Auth helpers — Supabase Auth (replaces old custom verifyPassword)
// ─────────────────────────────────────────────────────────────
export const authHelpers = {
  signUp: (email, password, userData) =>
    supabase.auth.signUp({ email, password, options: { data: userData } }),

  signIn: (email, password) =>
    supabase.auth.signInWithPassword({ email, password }),

  signOut: () => supabase.auth.signOut(),

  getCurrentUser: async () => (await supabase.auth.getUser()).data.user,
  getSession:     async () => (await supabase.auth.getSession()).data.session,

  onAuthStateChange: (cb) => supabase.auth.onAuthStateChange(cb),
};

// ─────────────────────────────────────────────────────────────
// Generic helpers (kept for backward compatibility with kechuang components)
// ─────────────────────────────────────────────────────────────
export const db = {
  async select(table, columns = '*', filters = {}) {
    let query = supabase.from(table).select(columns);
    Object.entries(filters).forEach(([k, v]) => { query = query.eq(k, v); });
    return query;
  },
  async insert(table, data) {
    return supabase.from(table).insert(data).select();
  },
  async update(table, id, data) {
    return supabase.from(table).update(data).eq('id', id).select();
  },
  async delete(table, id) {
    return supabase.from(table).delete().eq('id', id);
  },
};

export const storage = {
  uploadFile:   (bucket, path, file) => supabase.storage.from(bucket).upload(path, file),
  getPublicUrl: (bucket, path)        => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl,
  deleteFile:   (bucket, path)        => supabase.storage.from(bucket).remove([path]),
};

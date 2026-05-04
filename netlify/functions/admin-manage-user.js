// netlify/functions/admin-manage-user.js
// Admin-only operations on existing users.
// Actions: reset_password, delete_user, revoke_qr, regenerate_qr.
// Reads from clf_user_profiles (replaces jgw_registrations dependency).

import { createClient } from '@supabase/supabase-js';

const supabaseUrl    = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function randChars(n, alphabet) {
  let out = '';
  for (let i = 0; i < n; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
function genPassword() {
  return randChars(8, 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789');
}

async function requireSuperAdmin(authHeader) {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing auth token');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error('Invalid token');

  const { data: profile } = await supabase
    .from('clf_user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile) throw new Error('Not authorized: no profile');
  if (profile.is_active === false) throw new Error('Not authorized: account disabled');
  if (!['super_admin', 'school_master'].includes(profile.role)) {
    throw new Error('Not authorized: insufficient role');
  }
  return user;
}

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let adminUser;
  try {
    adminUser = await requireSuperAdmin(
      event.headers.authorization || event.headers.Authorization);
  } catch (err) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: err.message }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { action, user_id, max_devices, expires_at, label } = body;

  if (!user_id) {
    return { statusCode: 400, headers,
      body: JSON.stringify({ error: 'user_id required' }) };
  }

  // ── RESET_PASSWORD ────────────────────────────────────────────
  if (action === 'reset_password') {
    try {
      const newPassword = genPassword();
      const { error: authErr } = await supabase.auth.admin.updateUserById(
        user_id, { password: newPassword }
      );
      if (authErr) throw authErr;

      // No more jgw_registrations.password_hash to maintain — auth.users
      // is now the single source of truth for passwords.
      return { statusCode: 200, headers,
        body: JSON.stringify({ ok: true, new_password: newPassword }) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // ── DELETE_USER ───────────────────────────────────────────────
  if (action === 'delete_user') {
    try {
      // 1. Delete clf_quicklogin_tokens (CASCADE on user_id, but be explicit)
      await supabase.from('clf_quicklogin_tokens').delete().eq('user_id', user_id);

      // 2. Delete clf_user_modules
      await supabase.from('clf_user_modules').delete().eq('user_id', user_id);

      // 3. Delete clf_user_profiles
      await supabase.from('clf_user_profiles').delete().eq('user_id', user_id);

      // 4. Delete auth.users (final, irreversible)
      const { error: delErr } = await supabase.auth.admin.deleteUser(user_id);
      if (delErr) throw delErr;

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // ── REVOKE_QR ─────────────────────────────────────────────────
  if (action === 'revoke_qr') {
    const { error } = await supabase
      .from('clf_quicklogin_tokens')
      .delete()
      .eq('user_id', user_id);
    if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  // ── REGENERATE_QR ─────────────────────────────────────────────
  if (action === 'regenerate_qr') {
    try {
      // Delete any existing token for this user
      await supabase.from('clf_quicklogin_tokens').delete().eq('user_id', user_id);

      // Get username from clf_user_profiles
      const { data: profile } = await supabase
        .from('clf_user_profiles')
        .select('email')
        .eq('user_id', user_id)
        .maybeSingle();
      if (!profile) throw new Error('User not found');

      const username = profile.email?.split('@')[0] || '';

      const newToken = randChars(24,
        'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789');
      const { error: tokErr } = await supabase.from('clf_quicklogin_tokens').insert({
        token: newToken,
        user_id,
        username,
        max_devices: max_devices || 1,
        expires_at: expires_at || null,
        label: label || null,
        created_by: adminUser.id,
      });
      if (tokErr) throw tokErr;

      return { statusCode: 200, headers,
        body: JSON.stringify({ ok: true, token: newToken }) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 400, headers,
    body: JSON.stringify({ error: `Unknown action: ${action}` }) };
}

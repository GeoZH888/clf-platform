// netlify/functions/student-auth.js
// Dual-path username+password login:
//   - Legacy: look up in jgw_invites (Miaohong-era users, plaintext password)
//   - New: look up in jgw_registrations + auth.users (admin-created, bcrypt hash)
// Both paths create a row in jgw_device_sessions and return a device_token.

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers,
      body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const SUPABASE_URL     = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_ROLE_KEY) {
    return { statusCode: 500, headers,
      body: JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { username, password, fingerprint } = body;
  if (!username || !password) {
    return { statusCode: 400, headers,
      body: JSON.stringify({ error: 'username and password required' }) };
  }

  const cleanUsername = username.trim().toLowerCase();
  const cleanPassword = password.trim();
  const fp = fingerprint || ('fp_' + Math.random().toString(36).slice(2));

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── PATH A: Try legacy jgw_invites first ──
  const { data: legacyInv } = await admin
    .from('jgw_invites')
    .select('*')
    .eq('username', cleanUsername)
    .eq('password', cleanPassword)
    .maybeSingle();

  if (legacyInv) {
    return await handleLegacyLogin(admin, legacyInv, fp, headers);
  }

  // ── PATH B: Try new jgw_registrations / auth.users ──
  const { data: reg } = await admin
    .from('jgw_registrations')
    .select('*')
    .eq('username', cleanUsername)
    .eq('status', 'approved')
    .maybeSingle();

  if (reg && reg.password_hash && reg.approved_user_id) {
    const match = await bcrypt.compare(cleanPassword, reg.password_hash);
    if (match) {
      return await handleNewUserLogin(admin, reg, fp, headers);
    }
  }

  // ── Neither path matched ──
  return { statusCode: 401, headers,
    body: JSON.stringify({ error: '用户名或密码错误 · Username or password incorrect' }) };
};

// ── Legacy path: jgw_invites-backed account ──
async function handleLegacyLogin(admin, inv, fp, headers) {
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
    return { statusCode: 403, headers,
      body: JSON.stringify({ error: 'expired', label: inv.label }) };
  }
  const maxDevices = inv.max_devices || 1;

  // Existing session for this device?
  const { data: existing } = await admin
    .from('jgw_device_sessions')
    .select('*')
    .eq('invite_id', inv.id)
    .eq('device_fingerprint', fp)
    .maybeSingle();

  if (existing) {
    await admin.from('jgw_device_sessions')
      .update({ is_active: true, last_seen: new Date().toISOString() })
      .eq('id', existing.id);
    return { statusCode: 200, headers, body: JSON.stringify({
      device_token: existing.device_token,
      label: inv.label, modules: inv.modules,
      expires_at: inv.expires_at,
    })};
  }

  // Device cap — pause oldest if over limit
  const { data: activeSessions } = await admin
    .from('jgw_device_sessions')
    .select('id, last_seen')
    .eq('invite_id', inv.id)
    .eq('is_active', true);

  if ((activeSessions?.length || 0) >= maxDevices) {
    const oldest = (activeSessions || []).slice().sort((a,b) =>
      new Date(a.last_seen||0) - new Date(b.last_seen||0))[0];
    if (oldest) {
      await admin.from('jgw_device_sessions')
        .update({ is_active: false }).eq('id', oldest.id);
    }
  }

  if (!inv.used_at) {
    await admin.from('jgw_invites')
      .update({ used_at: new Date().toISOString() }).eq('id', inv.id);
  }

  const { data: sess, error: sessErr } = await admin
    .from('jgw_device_sessions')
    .insert({
      invite_id: inv.id,
      expires_at: inv.expires_at,
      device_fingerprint: fp,
      is_active: true,
    })
    .select()
    .maybeSingle();

  if (sessErr || !sess) {
    return { statusCode: 500, headers,
      body: JSON.stringify({ error: 'Failed to create session: ' + (sessErr?.message || 'unknown') }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({
    device_token: sess.device_token,
    label: inv.label,
    modules: inv.modules,
    expires_at: inv.expires_at,
  })};
}

// ── New path: jgw_registrations / auth.users-backed account ──
async function handleNewUserLogin(admin, reg, fp, headers) {
  const userId = reg.approved_user_id;

  // No expiry on new accounts (matches admin intent for direct-create)
  // If an admin had set an expiry on a registration, could enforce it here.

  // Default device cap for user-keyed accounts — look up from clf_quicklogin_tokens
  // if an active QR token exists for this user (it may define max_devices).
  // Otherwise fall back to 3 devices.
  const { data: qrToken } = await admin
    .from('clf_quicklogin_tokens')
    .select('max_devices, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  const maxDevices = qrToken?.max_devices || 3;

  // Existing session for this device?
  const { data: existing } = await admin
    .from('jgw_device_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('device_fingerprint', fp)
    .maybeSingle();

  if (existing) {
    await admin.from('jgw_device_sessions')
      .update({ is_active: true, last_seen: new Date().toISOString() })
      .eq('id', existing.id);
    return { statusCode: 200, headers, body: JSON.stringify({
      device_token: existing.device_token,
      label: reg.name,
      modules: ['lianzi','pinyin','words','hsk','poetry','chengyu','grammar','games'],
      expires_at: qrToken?.expires_at || null,
      user_id: userId,
      username: reg.username,
      display_name: reg.name,
    })};
  }

  // Device cap
  const { data: activeSessions } = await admin
    .from('jgw_device_sessions')
    .select('id, last_seen')
    .eq('user_id', userId)
    .eq('is_active', true);

  if ((activeSessions?.length || 0) >= maxDevices) {
    const oldest = (activeSessions || []).slice().sort((a,b) =>
      new Date(a.last_seen||0) - new Date(b.last_seen||0))[0];
    if (oldest) {
      await admin.from('jgw_device_sessions')
        .update({ is_active: false }).eq('id', oldest.id);
    }
  }

  // Create new session (no invite_id since this is an auth.users-backed login)
  const { data: sess, error: sessErr } = await admin
    .from('jgw_device_sessions')
    .insert({
      user_id: userId,
      expires_at: qrToken?.expires_at || null,
      device_fingerprint: fp,
      is_active: true,
    })
    .select()
    .maybeSingle();

  if (sessErr || !sess) {
    return { statusCode: 500, headers,
      body: JSON.stringify({ error: 'Failed to create session: ' + (sessErr?.message || 'unknown') }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({
    device_token: sess.device_token,
    label: reg.name,
    modules: ['lianzi','pinyin','words','hsk','poetry','chengyu','grammar','games'],
    expires_at: qrToken?.expires_at || null,
    user_id: userId,
    username: reg.username,
    display_name: reg.name,
  })};
}

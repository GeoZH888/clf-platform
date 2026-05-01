// netlify/functions/student-auth.js
// Dual-path username+password login:
//   - Legacy: look up in jgw_invites (Miaohong-era users, plaintext password)
//   - New: look up in jgw_registrations + auth.users (admin-created, bcrypt hash)
// Both paths create a row in jgw_device_sessions and return a device_token.
//
// MODULE RESOLUTION (Stage 5B — two-layer permission):
//   Path A (legacy): modules come from jgw_invites.modules array (untouched)
//   Path B (new):    modules come from clf_user_modules.{available, selected}
//                    A module shows only if BOTH columns are true.
//                    'available' = admin grants. 'selected' = user opts in.
//
// AUTH RESPONSE (Stage 5B): now includes user.role for frontend role-based UI.

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// ── Canonical module catalog (must match src/config/modules.js) ──────
// Duplicated here because Netlify functions can't import from src/.
// Keep this list in sync when modules.js changes.
const MODULE_DEFAULTS = {
  // gateable: true, defaultEnabled: true (社区 standard bundle)
  lianzi:   true,
  words:    true,
  pinyin:   true,
  chengyu:  true,
  poetry:   true,
  grammar:  true,
  hsk:      true,
  riddles:  true,
  // gateable: true, defaultEnabled: false (premium / 课堂 / future)
  kechuang: false,
  lessons:  false,
  chat:     false,
  voice:    false,
  homework: false,
  shop:     false,
  parents:  false,
};

// Always-on modules (gateable: false in modules.js)
const ALWAYS_ON_MODULES = ['home', 'profile', 'progress'];

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

// ─────────────────────────────────────────────────────────────────────
// Resolve modules for a Path B user from clf_user_modules + defaults
// ─────────────────────────────────────────────────────────────────────
// Returns an array of canonical module IDs the user has access to.
//
// STAGE 5B two-layer logic:
//   - 'available' (admin grant): is this module available to this user?
//   - 'selected'  (user opt-in): does the user want it on their home?
//   Module is shown only if BOTH available AND selected are true.
//
// Logic per module:
//   - If clf_user_modules has a row → both flags must be true
//   - Otherwise → use defaultEnabled from MODULE_DEFAULTS as both
//                 (assumes new users have default modules available + selected)
//
// Always-on modules are always included regardless of user_modules state.
// Falls back to STANDARD_BUNDLE on DB error so transient failure doesn't
// lock the user out of everything.
async function resolveModulesForUser(admin, userId) {
  const standardBundle = Object.entries(MODULE_DEFAULTS)
    .filter(([_, v]) => v === true)
    .map(([k]) => k);

  if (!userId) return [...ALWAYS_ON_MODULES, ...standardBundle];

  try {
    const { data, error } = await admin
      .from('clf_user_modules')
      .select('module_id, available, selected')
      .eq('user_id', userId);

    if (error) {
      console.warn('[resolveModulesForUser] DB error, using defaults:', error.message);
      return [...ALWAYS_ON_MODULES, ...standardBundle];
    }

    // Build a map of explicit overrides: a module is "on" if BOTH flags true
    const overrides = {};
    (data || []).forEach(row => {
      overrides[row.module_id] = (row.available === true) && (row.selected === true);
    });

    // Final list: always-on + every module that resolves to enabled
    const enabled = [...ALWAYS_ON_MODULES];
    for (const [moduleId, defaultVal] of Object.entries(MODULE_DEFAULTS)) {
      const finalVal = (moduleId in overrides) ? overrides[moduleId] : defaultVal;
      if (finalVal) enabled.push(moduleId);
    }
    return enabled;
  } catch (err) {
    console.warn('[resolveModulesForUser] exception, using defaults:', err.message);
    return [...ALWAYS_ON_MODULES, ...standardBundle];
  }
}

// ─────────────────────────────────────────────────────────────────────
// PATH A: legacy jgw_invites-backed account
// (modules come from jgw_invites.modules array — untouched)
// ─────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────
// PATH B: new jgw_registrations / auth.users-backed account
// (modules come from clf_user_modules + defaults — STAGE C BRIDGE)
// ─────────────────────────────────────────────────────────────────────
async function handleNewUserLogin(admin, reg, fp, headers) {
  const userId = reg.approved_user_id;

  // Resolve actual modules for this user (replaces hardcoded list)
  const modules = await resolveModulesForUser(admin, userId);

  // Default device cap for user-keyed accounts
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
      modules,    // ← STAGE C: resolved from clf_user_modules + defaults
      expires_at: qrToken?.expires_at || null,
      user_id: userId,
      username: reg.username,
      display_name: reg.name,
      role: reg.role || null,    // ← STAGE 5B: include user's role
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

  // Create new session
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
    modules,    // ← STAGE C: resolved from clf_user_modules + defaults
    expires_at: qrToken?.expires_at || null,
    user_id: userId,
    username: reg.username,
    display_name: reg.name,
    role: reg.role || null,    // ← STAGE 5B: include user's role
  })};
}

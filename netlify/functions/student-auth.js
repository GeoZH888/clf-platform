// netlify/functions/student-auth.js
// Username + password login using Supabase Auth.
//
// Flow:
//   1. Resolve username → email (look up in clf_user_profiles).
//   2. Call supabase.auth.signInWithPassword(email, password).
//   3. Return the access_token + refresh_token to the client, which
//      then hands them to supabase.auth.setSession() so the SDK
//      manages the session normally.
//   4. Resolve user's modules from clf_user_modules + defaults.
//
// No more device tokens, jgw_invites, jgw_device_sessions, dual-paths.
// Sessions are pure Supabase Auth (JWT, auto-refreshing, multi-device).

const { createClient } = require('@supabase/supabase-js');

// Canonical module catalog (mirrors src/config/modules.js)
const MODULE_DEFAULTS = {
  lianzi:   true,
  words:    true,
  pinyin:   true,
  chengyu:  true,
  poetry:   true,
  grammar:  true,
  hsk:      true,
  riddles:  true,
  kechuang: false,
  lessons:  false,
  chat:     false,
  voice:    false,
  homework: false,
  shop:     false,
  parents:  false,
};
const ALWAYS_ON = ['home', 'profile', 'progress'];

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const ANON_KEY     = process.env.VITE_SUPABASE_ANON_KEY;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return { statusCode: 500, headers,
      body: JSON.stringify({ error: 'Server misconfigured: missing Supabase env vars' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { username, password } = body;
  if (!username || !password) {
    return { statusCode: 400, headers,
      body: JSON.stringify({ error: 'username and password required' }) };
  }

  const cleanUsername = username.trim().toLowerCase();

  // ── Step 1: Resolve username → email (admin client, bypasses RLS) ──
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // We accept either: 'marco' or 'marco@users.david-zhongwen.net'
  let email = cleanUsername.includes('@')
    ? cleanUsername
    : null;

  if (!email) {
    // Look up email by username pattern (display_name or stored mapping).
    // Convention: email is `${username}@users.david-zhongwen.net`
    email = `${cleanUsername}@users.david-zhongwen.net`;

    // But also look up clf_user_profiles in case username doesn't match
    // the email prefix (e.g. teacher with custom email).
    const { data: profile } = await admin
      .from('clf_user_profiles')
      .select('email')
      .ilike('display_name', cleanUsername)
      .maybeSingle();
    if (profile?.email) email = profile.email;
  }

  // ── Step 2: Sign in via Supabase Auth (anon client) ──
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
    email,
    password: password.trim(),
  });

  if (signInErr || !signIn?.session) {
    return { statusCode: 401, headers, body: JSON.stringify({
      error: '用户名或密码错误 · Username or password incorrect',
    })};
  }

  const userId = signIn.user.id;

  // ── Step 3: Get profile (display name, role, is_active) ──
  const { data: profile } = await admin
    .from('clf_user_profiles')
    .select('display_name, display_name_zh, role, is_active')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) {
    return { statusCode: 403, headers,
      body: JSON.stringify({ error: 'No profile for this user. Contact admin.' }) };
  }
  if (profile.is_active === false) {
    return { statusCode: 403, headers,
      body: JSON.stringify({ error: '账号已停用 · Account disabled' }) };
  }

  // ── Step 4: Resolve modules ──
  const modules = await resolveModules(admin, userId);

  // ── Step 5: Return session + profile + modules ──
  return { statusCode: 200, headers, body: JSON.stringify({
    access_token:  signIn.session.access_token,
    refresh_token: signIn.session.refresh_token,
    expires_at:    signIn.session.expires_at,    // unix ts
    user_id:       userId,
    username:      cleanUsername,
    display_name:  profile.display_name_zh || profile.display_name || cleanUsername,
    role:          profile.role,
    modules,
  })};
};

// ─────────────────────────────────────────────────────────────────
async function resolveModules(admin, userId) {
  const standard = Object.entries(MODULE_DEFAULTS)
    .filter(([_, v]) => v).map(([k]) => k);
  if (!userId) return [...ALWAYS_ON, ...standard];

  try {
    const { data, error } = await admin
      .from('clf_user_modules')
      .select('module_id, available, selected')
      .eq('user_id', userId);
    if (error) return [...ALWAYS_ON, ...standard];

    const overrides = {};
    (data || []).forEach(r => {
      overrides[r.module_id] = r.available === true && r.selected === true;
    });

    const enabled = [...ALWAYS_ON];
    for (const [id, def] of Object.entries(MODULE_DEFAULTS)) {
      const final = id in overrides ? overrides[id] : def;
      if (final) enabled.push(id);
    }
    return enabled;
  } catch {
    return [...ALWAYS_ON, ...standard];
  }
}

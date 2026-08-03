// netlify/functions/admin-create-user.js
// Admin-only: directly create user account(s).
// Writes to: auth.users, clf_user_profiles, clf_user_modules (optional QR token).
// Replaces the previous flow that wrote to jgw_registrations.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl    = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const FAKE_EMAIL_DOMAIN = 'users.david-zhongwen.net';

// ── helpers ─────────────────────────────────────────────────────
function randChars(n, alphabet) {
  let out = '';
  for (let i = 0; i < n; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function genPassword() {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return randChars(8, alpha);
}

function genUsername(displayName) {
  const cleaned = (displayName || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-z0-9]/g, '');
  const base = cleaned ? cleaned.slice(0, 8) : 'user';
  return base + '_' + randChars(4, '23456789abcdefghjkmnpqrstuvwxyz');
}

// Validate a JWT belongs to staff who may create accounts, and report which
// kind. Teachers are allowed so they can enrol their own students from the
// test portal, but the handler forces their created role to `student` — a
// teacher must not be able to mint another teacher or an admin.
const CAN_CREATE = ['super_admin', 'school_master', 'teacher'];

async function requireStaff(authHeader) {
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
  if (!CAN_CREATE.includes(profile.role)) {
    throw new Error('Not authorized: insufficient role');
  }
  return { user, callerRole: profile.role };
}

// Create one account. Returns { name, username, password, user_id, qr_token }.
async function createOne({ name, username, password, email, adminUser, role, tier_id,
                          generateQrToken, maxDevices, expiresAt, label }) {
  const finalUsername = (username || genUsername(name)).toLowerCase().trim();
  const finalPassword = password || genPassword();
  const fakeEmail     = `${finalUsername}@${FAKE_EMAIL_DOMAIN}`;
  const finalRole     = role || 'student';

  // ── Check uniqueness in clf_user_profiles ──
  const { data: existing } = await supabase
    .from('clf_user_profiles')
    .select('user_id')
    .eq('email', fakeEmail)
    .maybeSingle();
  if (existing) throw new Error(`Username "${finalUsername}" is taken`);

  // ── 1. Create auth.users ──
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: fakeEmail,
    password: finalPassword,
    email_confirm: true,
    user_metadata: {
      display_name: name.trim(),
      username: finalUsername,
      created_by: 'admin_direct',
    },
  });
  if (authErr) throw authErr;

  const userId = authData.user.id;

  // ── 2. Create clf_user_profiles row ──
  const profileRow = {
    user_id: userId,
    email: fakeEmail,
    role: finalRole,
    display_name: name.trim(),
    is_active: true,
    tier_id: tier_id || null,
  };
  // Heuristic: if name is CJK, also store in display_name_zh
  if (/[\u4e00-\u9fff]/.test(name)) {
    profileRow.display_name_zh = name.trim();
  }

  const { error: profErr } = await supabase
    .from('clf_user_profiles')
    .upsert(profileRow, { onConflict: 'user_id' });

  if (profErr) {
    // Rollback: delete the auth user we just created
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    throw profErr;
  }

  // ── 3. Optionally generate a quick-login QR token ──
  let qrToken = null;
  if (generateQrToken) {
    qrToken = randChars(24, 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789');
    const { error: tokErr } = await supabase.from('clf_quicklogin_tokens').insert({
      token: qrToken,
      user_id: userId,
      username: finalUsername,
      max_devices: maxDevices || 1,
      expires_at: expiresAt || null,
      label: label || null,
      created_by: adminUser.id,
    });
    if (tokErr) {
      console.error('[admin-create-user] qr token insert:', tokErr);
      qrToken = null;  // not fatal
    }
  }

  return {
    name: name.trim(),
    username: finalUsername,
    password: finalPassword,
    user_id: userId,
    qr_token: qrToken,
  };
}

// ── handler ─────────────────────────────────────────────────────
export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let adminUser, callerRole;
  try {
    ({ user: adminUser, callerRole } =
      await requireStaff(event.headers.authorization || event.headers.Authorization));
  } catch (err) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: err.message }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  // A teacher may only create students, and may not assign a paid tier.
  // Enforced here rather than in the UI so a hand-made request can't escalate.
  if (callerRole === 'teacher') {
    if (body.role && body.role !== 'student') {
      return { statusCode: 403, headers,
        body: JSON.stringify({ error: '教师只能创建学生账号' }) };
    }
    body.role = 'student';
    delete body.tier_id;
  }

  // QR options shared by both modes
  const qrOpts = {
    generateQrToken: !!body.generateQrToken,
    maxDevices: body.maxDevices || 1,
    expiresAt: body.expiresAt || null,
  };

  if (body.mode === 'single') {
    if (!body.name || body.name.trim().length < 1) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '姓名必填' }) };
    }
    try {
      const result = await createOne({
        ...body, adminUser,
        ...qrOpts,
        label: body.label || null,
      });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, result }) };
    } catch (err) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (body.mode === 'batch') {
    const names = (body.names || []).filter(n => n && n.trim());
    if (names.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '请提供至少一个姓名' }) };
    }
    if (names.length > 100) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '批量最多 100 个' }) };
    }

    const results = [];
    const errors = [];
    for (let i = 0; i < names.length; i++) {
      const rawName = names[i];
      try {
        const r = await createOne({
          name: rawName, adminUser,
          role: body.role,
          tier_id: body.tier_id,
          ...qrOpts,
          label: body.labelPrefix ? `${body.labelPrefix} #${i + 1}` : null,
        });
        results.push(r);
      } catch (err) {
        errors.push({ name: rawName, error: err.message });
      }
    }
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ ok: true, results, errors }),
    };
  }

  return {
    statusCode: 400, headers,
    body: JSON.stringify({ error: 'mode must be "single" or "batch"' }),
  };
}

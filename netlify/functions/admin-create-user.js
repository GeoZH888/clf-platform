// netlify/functions/admin-create-user.js
// Admin-only: directly create user account(s), skipping any invite flow.
// Supports both single-user creation and batch creation from a name list.
//
// Auth: requires the caller to be a superadmin (checked via their JWT).

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
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
  // 8-char, no confusable characters (0/O, 1/l, I)
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return randChars(8, alpha);
}

function genUsername(displayName) {
  // Strip to ASCII letters/digits. If nothing remains (e.g. all CJK),
  // use a short prefix 'user' + random.
  const cleaned = (displayName || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')    // Strip non-ASCII (CJK)
    .replace(/[^a-z0-9]/g, '');
  const base = cleaned ? cleaned.slice(0, 8) : 'user';
  return base + '_' + randChars(4, '23456789abcdefghjkmnpqrstuvwxyz');
}

// Validate a JWT belongs to a superadmin
async function requireSuperAdmin(authHeader) {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing auth token');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error('Invalid token');

  // Check jgw_admins OR user_metadata.role === 'superadmin'
  const { data: adminRow } = await supabase
    .from('jgw_admins').select('user_id').eq('user_id', user.id).maybeSingle();
  const isSuperadmin = user.user_metadata?.role === 'superadmin';

  if (!adminRow && !isSuperadmin) throw new Error('Not authorized');
  return user;
}

// Create one account. Returns { name, username, password, user_id }.
// Throws if username is taken or createUser fails.
async function createOne({ name, username, password, email, adminUser }) {
  const finalUsername = (username || genUsername(name)).toLowerCase().trim();
  const finalPassword = password || genPassword();
  const fakeEmail = `${finalUsername}@${FAKE_EMAIL_DOMAIN}`;

  // Check uniqueness in jgw_registrations
  const { data: existing } = await supabase
    .from('jgw_registrations')
    .select('id').eq('username', finalUsername).maybeSingle();
  if (existing) throw new Error(`Username "${finalUsername}" is taken`);

  // Create auth.users
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

  // Record in jgw_registrations as approved
  const password_hash = await bcrypt.hash(finalPassword, 10);
  const { error: regErr } = await supabase.from('jgw_registrations').insert({
    name: name.trim(),
    username: finalUsername,
    password_hash,
    email: email?.trim() || null,
    reason: '[管理员直接创建]',
    status: 'approved',
    reviewed_at: new Date().toISOString(),
    reviewed_by: adminUser.id,
    approved_user_id: authData.user.id,
  });
  if (regErr) {
    // Rollback: delete auth user we just made
    await supabase.auth.admin.deleteUser(authData.user.id).catch(() => {});
    throw regErr;
  }

  return {
    name: name.trim(),
    username: finalUsername,
    password: finalPassword,
    user_id: authData.user.id,
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

  let adminUser;
  try {
    adminUser = await requireSuperAdmin(event.headers.authorization || event.headers.Authorization);
  } catch (err) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: err.message }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  // Two modes:
  //   { mode: 'single', name, username?, password?, email? }
  //   { mode: 'batch', names: ['张三', 'Marco Rossi', ...] }

  if (body.mode === 'single') {
    if (!body.name || body.name.trim().length < 1) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '姓名必填' }) };
    }
    try {
      const result = await createOne({ ...body, adminUser });
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
    for (const rawName of names) {
      try {
        const r = await createOne({ name: rawName, adminUser });
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

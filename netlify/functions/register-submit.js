// netlify/functions/register-submit.js
// User self-registration. Flow simplified after migration:
//
//   1. Validate input (name, username, password, optional invite_code).
//   2. If invite_code given + auto_approve=true: create auth.users +
//      clf_user_profiles immediately. User can log in.
//   3. Otherwise: insert into jgw_registrations (review queue) for
//      manual admin approval. Backwards-compatible with the existing
//      RegistrationApprovalsTab UI.
//
// Note: we keep `jgw_registrations` and `jgw_registration_invites` (which
// is the *invite-code* table for self-signup, NOT the legacy student
// invite table that we just deleted). They're separate concepts.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl    = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const FAKE_EMAIL_DOMAIN = 'users.david-zhongwen.net';

// In-memory rate limit (per-IP, 1/min). Resets on cold start.
const recentSubmissions = new Map();
const RATE_WINDOW_MS = 60 * 1000;

function rateLimited(ip) {
  const now = Date.now();
  for (const [k, t] of recentSubmissions) {
    if (now - t > RATE_WINDOW_MS) recentSubmissions.delete(k);
  }
  const last = recentSubmissions.get(ip);
  if (last && (now - last) < RATE_WINDOW_MS) return true;
  recentSubmissions.set(ip, now);
  return false;
}

function validate(body) {
  const { name, username, password, email, reason, invite_code } = body;
  const errors = [];
  if (!name || name.trim().length < 1 || name.trim().length > 80)
    errors.push('姓名长度需在 1-80 字之间');
  if (!username || !/^[a-zA-Z0-9_]{3,30}$/.test(username))
    errors.push('用户名需为 3-30 位字母/数字/下划线');
  if (!password || password.length < 8 || password.length > 100)
    errors.push('密码至少 8 位');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push('邮箱格式不正确');
  if (!invite_code && (!reason || reason.trim().length < 3))
    errors.push('请填写申请理由');
  if (invite_code && !/^[A-Za-z0-9_-]{3,40}$/.test(invite_code))
    errors.push('邀请码格式不正确');
  return errors;
}

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
          || event.headers['x-nf-client-connection-ip']
          || 'unknown';
  if (rateLimited(ip))
    return { statusCode: 429, headers, body: JSON.stringify({ error: '请求过于频繁，请稍后再试' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const errors = validate(body);
  if (errors.length > 0)
    return { statusCode: 400, headers, body: JSON.stringify({ error: errors.join('；') }) };

  const { name, username, password, email, reason, invite_code } = body;
  const cleanUsername = username.toLowerCase().trim();
  const fakeEmail = `${cleanUsername}@${FAKE_EMAIL_DOMAIN}`;

  // ── Username uniqueness check ──
  // (jgw_registrations review queue dropped after migration)
  const { data: existingProfile } = await supabase
    .from('clf_user_profiles')
    .select('user_id')
    .eq('email', fakeEmail)
    .maybeSingle();
  if (existingProfile) {
    return { statusCode: 409, headers, body: JSON.stringify({ error: '此用户名已被使用' }) };
  }

  // ── Validate invite if provided ──
  let invite = null;
  if (invite_code) {
    const { data: inv } = await supabase
      .from('jgw_registration_invites')
      .select('*')
      .eq('code', invite_code)
      .maybeSingle();
    if (!inv)
      return { statusCode: 400, headers, body: JSON.stringify({ error: '邀请码无效' }) };
    if (inv.expires_at && new Date(inv.expires_at) < new Date())
      return { statusCode: 400, headers, body: JSON.stringify({ error: '邀请码已过期' }) };
    if (inv.used_count >= inv.max_uses)
      return { statusCode: 400, headers, body: JSON.stringify({ error: '邀请码已达到使用上限' }) };
    invite = inv;
  }

  // ─────────────────────────────────────────────────────────────────
  // AUTO-APPROVE PATH (invite + auto_approve=true)
  // Create auth.users + clf_user_profiles directly.
  // ─────────────────────────────────────────────────────────────────
  if (invite && invite.auto_approve) {
    try {
      // 1. Create Supabase Auth user
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: fakeEmail,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: name.trim(),
          username: cleanUsername,
          invited_by: invite.code,
        },
      });
      if (authErr) throw authErr;
      const userId = authData.user.id;

      // 2. Create clf_user_profiles row
      const { error: profErr } = await supabase.from('clf_user_profiles').insert({
        user_id: userId,
        email: fakeEmail,
        role: invite.target_role || 'student',
        display_name: name.trim(),
        is_active: true,
      });
      if (profErr) {
        await supabase.auth.admin.deleteUser(userId).catch(() => {});
        throw profErr;
      }

      // 3. Increment invite usage
      await supabase
        .from('jgw_registration_invites')
        .update({ used_count: (invite.used_count || 0) + 1 })
        .eq('code', invite.code);

      // 4. Optionally pre-grant modules from invite
      if (Array.isArray(invite.modules) && invite.modules.length > 0) {
        const moduleRows = invite.modules.map(modId => ({
          user_id: userId,
          module_id: modId,
          available: true,
          selected: true,
        }));
        await supabase.from('clf_user_modules').insert(moduleRows).select();
      }

      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          ok: true,
          direct_login: true,
          username: cleanUsername,
          email: fakeEmail,
          user_id: userId,
        }),
      };
    } catch (err) {
      console.error('[register-submit] auto-approve failed:', err);
      return {
        statusCode: 500, headers,
        body: JSON.stringify({ error: '账号创建失败：' + (err.message || 'unknown') }),
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // REVIEW QUEUE PATH (no invite OR invite.auto_approve=false)
  // 
  // After migration, the review-queue table (jgw_registrations) was
  // dropped. Manual review is no longer supported via this endpoint.
  // To register, users must use an invite_code that has auto_approve=true.
  // ─────────────────────────────────────────────────────────────────
  return {
    statusCode: 400, headers,
    body: JSON.stringify({
      error: '当前不接受公开注册。请向管理员索取邀请码。'
           + ' (Public registration is closed. Please ask an admin for an invite code.)'
    }),
  };
}

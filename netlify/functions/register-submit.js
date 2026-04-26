// netlify/functions/register-submit.js
// Handles registration submissions (both paths):
//   1. No invite OR invite.auto_approve=false → pending review queue (original flow)
//   2. Invite with auto_approve=true → create auth.users immediately, return direct_login=true
//
// Uses Supabase service role key to bypass RLS.

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl    = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Fake-email domain for username-based Supabase Auth. Users never see this.
const FAKE_EMAIL_DOMAIN = 'users.david-zhongwen.net';

// In-memory rate limit (per-IP, 1/min). Resets on cold start.
const recentSubmissions = new Map();
const RATE_WINDOW_MS = 60 * 1000;

function rateLimited(ip) {
  const now = Date.now();
  const last = recentSubmissions.get(ip);
  for (const [k, t] of recentSubmissions) {
    if (now - t > RATE_WINDOW_MS) recentSubmissions.delete(k);
  }
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
  // Reason is required only when NOT using an invite
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

  // ── Check username uniqueness in registrations ──
  // Note: this is a best-effort fast-fail check. The DB has a UNIQUE constraint
  // on jgw_registrations.username so even under TOCTOU race the duplicate
  // insert will fail at INSERT time. This check just gives a nicer error.
  const { data: existingReg } = await supabase
    .from('jgw_registrations')
    .select('id, status')
    .eq('username', cleanUsername)
    .maybeSingle();
  if (existingReg) {
    return {
      statusCode: 409, headers,
      body: JSON.stringify({ error: '此用户名已被使用' }),
    };
  }

  // Note: we used to scan auth.users via listUsers() here as a second check,
  // but (a) listUsers caps at 1000 and silently truncates beyond that,
  // (b) auth.users itself enforces email uniqueness, so any conflict will
  // surface from supabase.auth.admin.createUser() with a clear error message.
  // Removed for correctness + performance.

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

  // ── Hash password ──
  const password_hash = await bcrypt.hash(password, 10);

  // ── AUTO-APPROVE PATH (invite + auto_approve=true) ──
  // Create auth.users row directly, insert registration as 'approved',
  // increment invite usage. User can log in immediately.
  if (invite && invite.auto_approve) {
    let createdUserId = null;
    try {
      // 1. Reserve invite slot ATOMICALLY before any other writes.
      // RPC takes a row lock and rejects if max_uses already hit, preventing
      // the TOCTOU race the old "read + update" pattern allowed.
      const { data: rpcResult, error: rpcErr } = await supabase
        .rpc('increment_invite_usage', { invite_code: invite.code });
      if (rpcErr) throw new Error('邀请码状态查询失败: ' + rpcErr.message);
      const status = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
      if (!status?.ok) {
        const reason = status?.reason || 'unknown';
        const msgMap = {
          not_found: '邀请码无效',
          expired:   '邀请码已过期',
          exhausted: '邀请码已达到使用上限',
        };
        return {
          statusCode: 400, headers,
          body: JSON.stringify({ error: msgMap[reason] || '邀请码状态异常' }),
        };
      }

      // 2. Create Supabase Auth user
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
      createdUserId = authData.user.id;

      // 3. Insert registration record (status=approved immediately).
      // The DB UNIQUE constraint on username is the final defense against
      // any race that slipped past the earlier check.
      const { data: reg, error: regErr } = await supabase
        .from('jgw_registrations')
        .insert({
          name: name.trim(),
          username: cleanUsername,
          password_hash,
          email: email?.trim() || null,
          reason: reason?.trim() || `[邀请注册: ${invite.code}]`,
          invite_code: invite.code,
          client_ip: ip,
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          approved_user_id: createdUserId,
        })
        .select('id, status_token')
        .single();
      if (regErr) throw regErr;

      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          ok: true,
          direct_login: true,
          username: cleanUsername,
          id: reg.id,
          status_token: reg.status_token,
        }),
      };
    } catch (err) {
      // ROLLBACK: clean up orphan auth user if we created one.
      // We do NOT decrement the invite counter here because:
      //   (a) doing it non-atomically reintroduces the race we just fixed,
      //   (b) at worst, one invite slot gets "leaked" (counted but no user
      //       actually created), so the invite runs out 1 use earlier than
      //       expected — minor inconvenience, not data corruption.
      //   If you really care, add a decrement_invite_usage RPC mirroring
      //   increment_invite_usage and call it here.
      console.error('[register-submit] auto-approve failed:', err);
      if (createdUserId) {
        await supabase.auth.admin.deleteUser(createdUserId).catch(e =>
          console.error('[register-submit] orphan cleanup failed for', createdUserId, ':', e?.message));
      }

      return {
        statusCode: 500, headers,
        body: JSON.stringify({ error: '账号创建失败：' + (err.message || 'unknown') }),
      };
    }
  }

  // ── REVIEW QUEUE PATH (no invite OR invite.auto_approve=false) ──
  const { data: reg, error: insErr } = await supabase
    .from('jgw_registrations')
    .insert({
      name: name.trim(),
      username: cleanUsername,
      password_hash,
      email: email?.trim() || null,
      reason: reason.trim(),
      invite_code: invite ? invite.code : null,
      client_ip: ip,
    })
    .select('id, status_token')
    .single();

  if (insErr) {
    console.error('[register-submit] insert failed:', insErr);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: '提交失败，请稍后再试' }),
    };
  }

  // Increment invite usage if used (non-auto-approve invite).
  // Use the atomic RPC so 2 concurrent requests on a max_uses=1 invite can't
  // both "succeed" and bypass the limit.
  if (invite) {
    const { data: rpcResult } = await supabase
      .rpc('increment_invite_usage', { invite_code: invite.code });
    const status = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
    if (!status?.ok) {
      // Race lost: invite filled up while we were inserting. The user's
      // jgw_registrations row still exists (status='pending' awaiting review),
      // so admin can still approve it manually. Don't fail the request.
      console.warn(`[register-submit] invite ${invite.code} race lost on increment:`, status?.reason);
    }
  }

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      ok: true,
      direct_login: false,
      id: reg.id,
      status_token: reg.status_token,
      invite_used: !!invite,
    }),
  };
}

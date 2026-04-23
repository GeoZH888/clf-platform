// netlify/functions/quick-login.js
// Exchanges a quick-login token for a Supabase session.
// Called by the /quick-login frontend page when a user scans a QR code.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { token, device_id, user_agent } = body;
  if (!token || !/^[A-Za-z0-9_-]{10,60}$/.test(token)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: '无效 token' }) };
  }
  if (!device_id || device_id.length < 8 || device_id.length > 100) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: '无效设备 ID' }) };
  }

  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
          || event.headers['x-nf-client-connection-ip']
          || 'unknown';

  // ── 1. Look up token ──
  const { data: tokenRow, error: tokenErr } = await supabase
    .from('clf_quicklogin_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (tokenErr || !tokenRow) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: '邀请已失效' }) };
  }

  // ── 2. Expiry check ──
  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    return { statusCode: 410, headers, body: JSON.stringify({ error: '邀请已过期' }) };
  }

  // ── 3. Device session check ──
  const { data: existingSession } = await supabase
    .from('clf_quicklogin_sessions')
    .select('id')
    .eq('token', token)
    .eq('device_id', device_id)
    .maybeSingle();

  if (!existingSession) {
    // New device — check the cap
    if (tokenRow.device_count >= tokenRow.max_devices) {
      return {
        statusCode: 403, headers,
        body: JSON.stringify({
          error: `此邀请已在 ${tokenRow.max_devices} 台设备登录，无法继续添加新设备`
        }),
      };
    }

    // Record new device session
    const { error: insErr } = await supabase
      .from('clf_quicklogin_sessions')
      .insert({
        token, device_id, ip,
        user_agent: (user_agent || '').slice(0, 200),
      });
    if (insErr) {
      console.error('[quick-login] session insert:', insErr);
      return { statusCode: 500, headers, body: JSON.stringify({ error: '创建会话失败' }) };
    }

    // Bump device_count + last_used
    await supabase
      .from('clf_quicklogin_tokens')
      .update({
        device_count: tokenRow.device_count + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('token', token);
  } else {
    // Known device — just update last_used
    await supabase
      .from('clf_quicklogin_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('token', token);
  }

  // ── 4. Generate a Supabase session for the user ──
  // We use generateLink with type=magiclink to get a valid session without
  // requiring email delivery. Then we extract the session tokens.
  const { data: authUser, error: userErr } = await supabase.auth.admin.getUserById(
    tokenRow.user_id
  );
  if (userErr || !authUser?.user) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: '用户不存在' }) };
  }

  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: authUser.user.email,
  });
  if (linkErr) {
    console.error('[quick-login] generateLink:', linkErr);
    return { statusCode: 500, headers, body: JSON.stringify({ error: '生成登录会话失败' }) };
  }

  // Return the hashed token for the frontend to verify and establish session
  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      ok: true,
      email: authUser.user.email,
      hashed_token: linkData.properties.hashed_token,
      verification_type: linkData.properties.verification_type,
      username: tokenRow.username,
      display_name: authUser.user.user_metadata?.display_name || tokenRow.username,
    }),
  };
}

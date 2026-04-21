// netlify/functions/student-auth.js
// Verifies username+password server-side using service role key (bypasses RLS)
// Returns device session token on success

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const SUPABASE_URL      = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SERVICE_ROLE_KEY) {
    return { statusCode: 500, headers,
      body: JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not set in Netlify env vars' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { username, password, fingerprint } = body;
  if (!username || !password) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'username and password required' }) };
  }

  // Use service role client — bypasses RLS
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Find invite by username + password
  const { data: inv, error: invErr } = await admin
    .from('jgw_invites')
    .select('*')
    .eq('username', username.trim().toLowerCase())
    .eq('password', password.trim())
    .maybeSingle();

  if (invErr || !inv) {
    return { statusCode: 401, headers,
      body: JSON.stringify({ error: '用户名或密码错误 · Username or password incorrect' }) };
  }

  // 2. Check expiry
  if (new Date(inv.expires_at) < new Date()) {
    return { statusCode: 403, headers,
      body: JSON.stringify({ error: 'expired', label: inv.label }) };
  }

  const fp = fingerprint || ('fp_' + Math.random().toString(36).slice(2));
  const maxDevices = inv.max_devices || 1;

  // 3. Check if this device already has a session
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

  // 4. Check device count — pause oldest if over limit
  const { data: activeSessions } = await admin
    .from('jgw_device_sessions')
    .select('id, last_seen')
    .eq('invite_id', inv.id)
    .eq('is_active', true);

  if ((activeSessions?.length || 0) >= maxDevices) {
    const oldest = activeSessions.sort((a,b) =>
      new Date(a.last_seen||0) - new Date(b.last_seen||0))[0];
    if (oldest) {
      await admin.from('jgw_device_sessions')
        .update({ is_active: false }).eq('id', oldest.id);
    }
  }

  // 5. Mark invite as used
  if (!inv.used_at) {
    await admin.from('jgw_invites')
      .update({ used_at: new Date().toISOString() }).eq('id', inv.id);
  }

  // 6. Create new session
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
};

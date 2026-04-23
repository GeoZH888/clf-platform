// netlify/functions/verify-session.js
// Validates a device_token and returns session info.
// Supports both session types:
//   - Legacy (jgw_invites-backed): session.invite_id set, label from jgw_invites
//   - New (auth.users-backed):      session.user_id set,   label from jgw_registrations

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!URL || !KEY) return { statusCode: 500, headers, body: JSON.stringify({
    error: 'Missing Supabase env vars.', valid: false
  })};

  // SB helper — only parse JSON when response has body content
  const SB = async (path, opts = {}) => {
    const res = await fetch(`${URL}/rest/v1/${path}`, {
      ...opts,
      headers: {
        'Content-Type':  'application/json',
        'apikey':        KEY,
        'Authorization': `Bearer ${KEY}`,
        ...(opts.headers || {}),
      },
    });
    // 204 No Content (common for PATCH/DELETE with no Prefer:return) → no body
    if (res.status === 204) return null;
    const text = await res.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return null; }
  };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ valid: false }) }; }

  const { device_token } = body;
  if (!device_token) return { statusCode: 400, headers, body: JSON.stringify({ valid: false }) };

  // ── 1. Fetch the session row (no JOIN — we'll resolve label separately) ──
  const sessions = await SB(
    `jgw_device_sessions?device_token=eq.${encodeURIComponent(device_token)}&limit=1`
    + `&select=id,expires_at,is_active,invite_id,user_id`
  );
  const session = Array.isArray(sessions) ? sessions[0] : null;

  if (!session) return { statusCode: 200, headers, body: JSON.stringify({ valid: false, reason: 'not_found' }) };
  if (session.expires_at && new Date(session.expires_at) < new Date()) {
    return { statusCode: 200, headers, body: JSON.stringify({ valid: false, reason: 'expired' }) };
  }
  if (!session.is_active) {
    return { statusCode: 200, headers, body: JSON.stringify({ valid: false, reason: 'paused' }) };
  }

  // ── 2. Resolve label + modules based on session type ──
  let label = 'Guest';
  let modules = null;
  let user_id = null;
  let username = null;

  if (session.invite_id) {
    // Legacy: fetch from jgw_invites
    const inv = await SB(
      `jgw_invites?id=eq.${encodeURIComponent(session.invite_id)}&limit=1&select=label,modules,username`
    );
    if (Array.isArray(inv) && inv[0]) {
      label = inv[0].label || 'Guest';
      modules = inv[0].modules || null;
      username = inv[0].username || null;
    }
  } else if (session.user_id) {
    // New: fetch from jgw_registrations
    const regs = await SB(
      `jgw_registrations?approved_user_id=eq.${encodeURIComponent(session.user_id)}&limit=1&select=name,username`
    );
    if (Array.isArray(regs) && regs[0]) {
      label = regs[0].name || regs[0].username || 'User';
      username = regs[0].username || null;
      // New admin-created users have full module access
      modules = ['lianzi','pinyin','words','hsk','poetry','chengyu','grammar','games'];
      user_id = session.user_id;
    }
  }

  // ── 3. Touch last_seen (fire-and-forget, don't await JSON) ──
  // Use Prefer: return=minimal to avoid response-body issues anyway
  fetch(`${URL}/rest/v1/jgw_device_sessions?id=eq.${session.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        KEY,
      'Authorization': `Bearer ${KEY}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify({ last_seen: new Date().toISOString() }),
  }).catch(() => {});   // swallow errors — non-critical

  return { statusCode: 200, headers, body: JSON.stringify({
    valid: true,
    expires_at: session.expires_at,
    label,
    modules,
    user_id,
    username,
  })};
};

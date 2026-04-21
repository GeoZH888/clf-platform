// netlify/functions/verify-session.js
// Uses fetch + Supabase REST API directly â€” no npm imports needed

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const URL = process.env.VITE_SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!URL || !KEY) return { statusCode: 500, headers, body: JSON.stringify({
    error: 'Missing Supabase env vars.', valid: false
  })};

  const SB = (path, opts = {}) => fetch(`${URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'Content-Type':  'application/json',
      'apikey':        KEY,
      'Authorization': `Bearer ${KEY}`,
      ...(opts.headers || {}),
    },
  }).then(r => r.json());

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ valid: false }) }; }

  const { device_token } = body;
  if (!device_token) return { statusCode: 400, headers, body: JSON.stringify({ valid: false }) };

  // Get session with invite label
  const sessions = await SB(
    `jgw_device_sessions?device_token=eq.${encodeURIComponent(device_token)}&limit=1&select=id,expires_at,is_active,invite_id,jgw_invites(label)`
  );
  const session = Array.isArray(sessions) ? sessions[0] : null;

  if (!session) return { statusCode: 200, headers, body: JSON.stringify({ valid: false, reason: 'not_found' }) };
  if (new Date(session.expires_at) < new Date()) return { statusCode: 200, headers, body: JSON.stringify({ valid: false, reason: 'expired' }) };
  if (!session.is_active) return { statusCode: 200, headers, body: JSON.stringify({ valid: false, reason: 'paused' }) };

  // Update last_seen
  await SB(`jgw_device_sessions?id=eq.${session.id}`, {
    method: 'PATCH', body: JSON.stringify({ last_seen: new Date().toISOString() })
  });

  return { statusCode: 200, headers, body: JSON.stringify({
    valid: true,
    expires_at: session.expires_at,
    label: session.jgw_invites?.label || 'Guest',
  })};
};


// netlify/functions/redeem-invite.js
// Uses fetch + Supabase REST API directly â€” no npm imports needed

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const URL  = process.env.VITE_SUPABASE_URL;
  const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!URL || !KEY) return { statusCode: 500, headers, body: JSON.stringify({
    error: 'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Netlify env vars.'
  })};

  const SB = (path, opts = {}) => fetch(`${URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'Content-Type':  'application/json',
      'apikey':        KEY,
      'Authorization': `Bearer ${KEY}`,
      'Prefer':        opts.prefer || '',
      ...(opts.headers || {}),
    },
  }).then(r => r.json());

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { token, device_ua, device_fingerprint } = body;
  if (!token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing token' }) };

  // 1. Get invite
  const invites = await SB(`jgw_invites?token=eq.${encodeURIComponent(token)}&limit=1`, { prefer: 'return=representation' });
  const invite  = Array.isArray(invites) ? invites[0] : null;

  if (!invite) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invalid invite code.' }) };
  if (new Date(invite.expires_at) < new Date()) return { statusCode: 410, headers,
    body: JSON.stringify({ error: `This invite expired on ${new Date(invite.expires_at).toLocaleDateString()}.` }) };

  // 2. Same device fingerprint â€” reactivate existing session
  if (device_fingerprint) {
    const sessions = await SB(`jgw_device_sessions?invite_id=eq.${invite.id}&device_fingerprint=eq.${encodeURIComponent(device_fingerprint)}&limit=1`);
    const existing = Array.isArray(sessions) ? sessions[0] : null;

    if (existing) {
      // Reactivate this device
      await SB(`jgw_device_sessions?invite_id=eq.${invite.id}&device_fingerprint=eq.${encodeURIComponent(device_fingerprint)}`, {
        method: 'PATCH', body: JSON.stringify({ is_active: true, last_seen: new Date().toISOString() })
      });
      // Pause all others
      await SB(`jgw_device_sessions?invite_id=eq.${invite.id}&device_fingerprint=neq.${encodeURIComponent(device_fingerprint)}`, {
        method: 'PATCH', body: JSON.stringify({ is_active: false })
      });
      return { statusCode: 200, headers, body: JSON.stringify({
        success: true, device_token: existing.device_token,
        expires_at: invite.expires_at, label: invite.label || 'Guest',
      })};
    }
  }

  // 3. New device â€” pause all existing sessions
  await SB(`jgw_device_sessions?invite_id=eq.${invite.id}`, {
    method: 'PATCH', body: JSON.stringify({ is_active: false })
  });

  // 4. Mark invite used (first time)
  if (!invite.used_at) {
    await SB(`jgw_invites?id=eq.${invite.id}`, {
      method: 'PATCH', body: JSON.stringify({ used_at: new Date().toISOString(), device_ua: device_ua || '' })
    });
  }

  // 5. Create new session
  const newSessions = await SB('jgw_device_sessions', {
    method: 'POST',
    prefer: 'return=representation',
    body: JSON.stringify({
      invite_id: invite.id, expires_at: invite.expires_at,
      device_fingerprint: device_fingerprint || null, is_active: true,
    }),
  });
  const session = Array.isArray(newSessions) ? newSessions[0] : null;

  if (!session) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to create session.' }) };

  return { statusCode: 200, headers, body: JSON.stringify({
    success: true, device_token: session.device_token,
    expires_at: session.expires_at, label: invite.label || 'Guest',
  })};
};


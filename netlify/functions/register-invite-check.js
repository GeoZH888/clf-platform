// netlify/functions/register-invite-check.js
// Validates an invite code and returns its metadata WITHOUT consuming a use.
// Called by RegisterScreen on page load when ?invite=XYZ is in the URL,
// so we can show the user whether their code is valid before they fill the form.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const code = event.queryStringParameters?.code?.trim();
  if (!code || !/^[A-Za-z0-9_-]{3,40}$/.test(code)) {
    return {
      statusCode: 400, headers,
      body: JSON.stringify({ valid: false, reason: 'invalid_format' }),
    };
  }

  const { data, error } = await supabase
    .from('jgw_registration_invites')
    .select('code, max_uses, used_count, expires_at, auto_approve, label')
    .eq('code', code)
    .maybeSingle();

  if (error || !data) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ valid: false, reason: 'not_found' }),
    };
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ valid: false, reason: 'expired' }),
    };
  }

  if (data.used_count >= data.max_uses) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ valid: false, reason: 'exhausted' }),
    };
  }

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      valid: true,
      auto_approve: data.auto_approve !== false,    // default true
      remaining: data.max_uses - data.used_count,
      expires_at: data.expires_at,
      label: data.label || null,
    }),
  };
}

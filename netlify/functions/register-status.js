// netlify/functions/register-status.js
// Returns the status of a registration given its secret status_token.
// Only returns sanitized fields — never password_hash, never IP.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
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

  const token = event.queryStringParameters?.token;
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return {
      statusCode: 400, headers,
      body: JSON.stringify({ error: 'Invalid token' }),
    };
  }

  const { data, error } = await supabase
    .from('jgw_registrations')
    .select('name, username, email, status, rejection_reason, reviewed_at, created_at')
    .eq('status_token', token)
    .maybeSingle();

  if (error || !data) {
    // Intentionally same response for "not found" and "query error" — doesn't
    // leak whether a token exists
    return {
      statusCode: 404, headers,
      body: JSON.stringify({ error: '未找到申请记录' }),
    };
  }

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      name: data.name,
      username: data.username,
      email: data.email,
      status: data.status,
      rejection_reason: data.status === 'rejected' ? data.rejection_reason : null,
      reviewed_at: data.reviewed_at,
      created_at: data.created_at,
    }),
  };
}

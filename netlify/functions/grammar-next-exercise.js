// netlify/functions/grammar-next-exercise.js
// Pick the next exercise for a user in a given topic, based on their mastery.
// Algorithm:
//   - Target difficulty = mastery * 2 (so m=0 → d=0, m=0.5 → d=1, m=1 → d=2)
//   - Sample difficulty from Gaussian around target (σ=0.6), clamp to {0,1,2}
//   - Avoid repeating the last 3 exercises shown
//   - If no pool exists at chosen difficulty, fall back to any difficulty
//
// Auth: supports both Supabase JWT (auth.users-backed) and device_token
// (legacy jgw_invites OR new users logged in via student-auth).

import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function gaussianDifficulty(target, sigma = 0.6) {
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const d  = target + z * sigma;
  return Math.max(0, Math.min(2, Math.round(d)));
}

// Resolve the requesting user to a stable key (user_id UUID or invite_id).
// Accepts either:
//   - Authorization: Bearer <Supabase JWT>
//   - X-Device-Token: <device_token>
// Returns { user_key, kind: 'user_id'|'invite_id' } or throws.
async function resolveUser(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const deviceToken = event.headers['x-device-token'] || event.headers['X-Device-Token'];

  // Path A: Supabase JWT (auth.users-backed)
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (jwt) {
    const { data: { user }, error } = await supabase.auth.getUser(jwt);
    if (!error && user) {
      return { user_key: user.id, kind: 'user_id' };
    }
  }

  // Path B: device_token → look up session in jgw_device_sessions
  if (deviceToken) {
    const { data: sess } = await supabase
      .from('jgw_device_sessions')
      .select('user_id, invite_id, is_active, expires_at')
      .eq('device_token', deviceToken)
      .maybeSingle();
    if (sess && sess.is_active !== false) {
      if (sess.expires_at && new Date(sess.expires_at) < new Date()) {
        throw new Error('Session expired');
      }
      if (sess.user_id) return { user_key: sess.user_id, kind: 'user_id' };
      if (sess.invite_id) return { user_key: sess.invite_id, kind: 'invite_id' };
    }
  }

  throw new Error('Not authenticated — missing or invalid credentials');
}

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Token',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let who;
  try { who = await resolveUser(event); }
  catch (err) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: err.message }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { topic_id } = body;
  if (!topic_id) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'topic_id required' }) };
  }

  // Only user_id-keyed progress is stored. Invite-only users get a
  // transient mastery of 0 (can still practice, just can't persist across
  // sessions until upgraded to auth.users).
  const hasUserId = who.kind === 'user_id';

  let mastery = 0;
  let recentIds = [];
  if (hasUserId) {
    const { data: progress } = await supabase
      .from('clf_grammar_progress')
      .select('mastery, history')
      .eq('user_id', who.user_key)
      .eq('topic_id', topic_id)
      .maybeSingle();
    mastery = progress?.mastery ?? 0;
    recentIds = (progress?.history || []).slice(-3).map(h => h.exercise_id).filter(Boolean);
  }

  const targetD = mastery * 2;
  const chosenD = gaussianDifficulty(targetD);

  const fetchPool = async (difficulty) => {
    const { data } = await supabase
      .from('clf_grammar_exercises')
      .select('*')
      .eq('topic_id', topic_id)
      .eq('difficulty', difficulty);
    return (data || []).filter(ex => !recentIds.includes(ex.id));
  };

  let pool = await fetchPool(chosenD);
  if (pool.length === 0) {
    const alternatives = [0, 1, 2].filter(d => d !== chosenD)
      .sort((a, b) => Math.abs(a - targetD) - Math.abs(b - targetD));
    for (const d of alternatives) {
      pool = await fetchPool(d);
      if (pool.length > 0) break;
    }
  }
  if (pool.length === 0) {
    const { data: all } = await supabase
      .from('clf_grammar_exercises')
      .select('*')
      .eq('topic_id', topic_id);
    pool = all || [];
  }
  if (pool.length === 0) {
    return { statusCode: 404, headers,
      body: JSON.stringify({ error: '此主题暂无练习题' }) };
  }

  const exercise = pool[Math.floor(Math.random() * pool.length)];

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      ok: true,
      exercise,
      mastery,
      chosen_difficulty: chosenD,
      pool_size: pool.length,
      persist: hasUserId,   // frontend knows if progress is saved
    }),
  };
}

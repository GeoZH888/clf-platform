// netlify/functions/grammar-submit-answer.js
// Submit an answer to a grammar exercise. Updates user's mastery score
// with convergent increments based on correctness and difficulty.
//
// Auth: supports both Supabase JWT and device_token (see grammar-next-exercise).
// Progress only persists for user_id-keyed users (auth.users-backed).

import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function resolveUser(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const deviceToken = event.headers['x-device-token'] || event.headers['X-Device-Token'];

  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (jwt) {
    const { data: { user }, error } = await supabase.auth.getUser(jwt);
    if (!error && user) {
      return { user_key: user.id, kind: 'user_id' };
    }
  }

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

function normalize(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[。，！？；：""''（）【】]/g, '')
    .toLowerCase();
}

function computeMasteryDelta(currentMastery, difficulty, correct) {
  const m = Math.max(0, Math.min(1, currentMastery));
  if (correct) {
    const base = [0.03, 0.08, 0.15][difficulty] ?? 0.05;
    return base * (1 - m);
  } else {
    const base = [0.08, 0.05, 0.02][difficulty] ?? 0.05;
    return -base * m;
  }
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

  const { topic_id, exercise_id, user_answer } = body;
  if (!topic_id || !exercise_id) {
    return { statusCode: 400, headers,
      body: JSON.stringify({ error: 'topic_id and exercise_id required' }) };
  }

  // 1. Fetch exercise to grade
  const { data: ex, error: exErr } = await supabase
    .from('clf_grammar_exercises')
    .select('id, topic_id, difficulty, answer, explanation')
    .eq('id', exercise_id)
    .maybeSingle();
  if (exErr || !ex) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Exercise not found' }) };
  }
  if (ex.topic_id !== topic_id) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'topic_id / exercise_id mismatch' }) };
  }

  const correct = normalize(user_answer) === normalize(ex.answer);

  const hasUserId = who.kind === 'user_id';
  let newMastery = 0, delta = 0;

  if (hasUserId) {
    // 2. Fetch current progress (or create)
    const { data: currProgress } = await supabase
      .from('clf_grammar_progress')
      .select('*')
      .eq('user_id', who.user_key)
      .eq('topic_id', topic_id)
      .maybeSingle();

    const currMastery = currProgress?.mastery ?? 0;
    delta = computeMasteryDelta(currMastery, ex.difficulty, correct);
    newMastery = Math.max(0, Math.min(1, currMastery + delta));

    const newHistory = [...(currProgress?.history || []), {
      exercise_id, difficulty: ex.difficulty, correct,
      at: new Date().toISOString(),
    }].slice(-20);

    const { error: upsertErr } = await supabase
      .from('clf_grammar_progress')
      .upsert({
        user_id: who.user_key,
        topic_id,
        mastery: newMastery,
        total_attempts: (currProgress?.total_attempts ?? 0) + 1,
        correct_count: (currProgress?.correct_count ?? 0) + (correct ? 1 : 0),
        last_seen_at: new Date().toISOString(),
        history: newHistory,
      });
    if (upsertErr) {
      console.error('[grammar-submit] upsert:', upsertErr);
      return { statusCode: 500, headers,
        body: JSON.stringify({ error: 'Failed to save progress: ' + upsertErr.message }) };
    }
  } else {
    // invite_id-only user — still grade, but don't persist mastery
    delta = computeMasteryDelta(0, ex.difficulty, correct);
    newMastery = Math.max(0, delta);  // transient only
  }

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      ok: true,
      correct,
      correct_answer: ex.answer,
      explanation: ex.explanation || null,
      new_mastery: newMastery,
      delta,
      persist: hasUserId,
    }),
  };
}

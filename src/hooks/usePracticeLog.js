// src/hooks/usePracticeLog.js
// Records each completed practice attempt with stroke accuracy.
//
// Dual-write design:
//   - jgw_practice_log  — legacy stats table (kept for backward compat)
//   - clf_lianzi_progress — new adaptive learning table (drives useAdaptiveLearning)
//
// Both tables receive the same write. Reads still come from jgw_practice_log
// for the existing stats UI; useAdaptiveLearning reads from clf_lianzi_progress.

import { supabase } from '../lib/supabase';

const TOKEN_KEY = 'jgw_device_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || 'anonymous';
}

// Resolve identity: prefer Supabase auth user, fall back to device token
async function resolveIdentity() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return { user_id: session.user.id, device_token: null };
  } catch (_) { /* fall through */ }
  return { user_id: null, device_token: getToken() };
}

// Save one completed practice attempt — writes to BOTH tables
export async function logPractice({ character, mistakes, totalStrokes, score, mode }) {
  const device_token = getToken();
  if (!device_token || !character) return;

  // Compute correctness for adaptive (a stroke score above 70 = success)
  const correct = (score || 0) >= 70;
  const identity = await resolveIdentity();

  // Write 1: legacy stats table (unchanged behavior)
  const legacyWrite = supabase.from('jgw_practice_log').insert({
    device_token,
    character,
    mistakes:      mistakes || 0,
    total_strokes: totalStrokes || 0,
    completed:     true,
    score:         score || 0,
  });

  // Write 2: adaptive learning table (new)
  const adaptiveWrite = supabase.from('clf_lianzi_progress').insert({
    user_id:      identity.user_id,
    device_token: identity.user_id ? null : identity.device_token,
    character,
    correct,
    score:        score || 0,
    mode:         mode || 'list',
    practiced_at: new Date().toISOString(),
  });

  // Fire both in parallel; don't block UI on either
  await Promise.allSettled([legacyWrite, adaptiveWrite]);
}

// Get stats for all characters this device has practiced (legacy reader)
export async function getMyStats() {
  const device_token = getToken();
  const { data } = await supabase
    .from('jgw_practice_log')
    .select('character, mistakes, total_strokes, score, practiced_at')
    .eq('device_token', device_token)
    .order('practiced_at', { ascending: false });
  return data || [];
}

// Get stats for one specific character (legacy reader)
export async function getCharStats(character) {
  const device_token = getToken();
  const { data } = await supabase
    .from('jgw_practice_log')
    .select('mistakes, total_strokes, score, practiced_at')
    .eq('device_token', device_token)
    .eq('character', character)
    .order('practiced_at', { ascending: true });
  return data || [];
}

// src/hooks/usePracticeLog.js
// Records each completed practice attempt with stroke accuracy

import { supabase } from '../lib/supabase';

const TOKEN_KEY = 'jgw_device_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || 'anonymous';
}

// Save one completed practice attempt
export async function logPractice({ character, mistakes, totalStrokes, score }) {
  const device_token = getToken();
  if (!device_token || !character) return;

  await supabase.from('jgw_practice_log').insert({
    device_token,
    character,
    mistakes:      mistakes || 0,
    total_strokes: totalStrokes || 0,
    completed:     true,
    score:         score || 0,
  });
}

// Get stats for all characters this device has practiced
export async function getMyStats() {
  const device_token = getToken();
  const { data } = await supabase
    .from('jgw_practice_log')
    .select('character, mistakes, total_strokes, score, practiced_at')
    .eq('device_token', device_token)
    .order('practiced_at', { ascending: false });
  return data || [];
}

// Get stats for one specific character
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

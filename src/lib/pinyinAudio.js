// src/lib/pinyinAudio.js
// Looks up custom-recorded audio for a pinyin sound.
// Returns the Supabase Storage URL if a recording exists, null otherwise.
// Callers fall back to their existing TTS pipelines when null.
//
// Usage:
//   const url = await getPinyinAudioUrl('b');
//   if (url) playAudio(url);
//   else     playTTS('bō');
//
// Caching:
//   - Single bulk fetch on first call (all audio URLs in one query).
//   - Cache kept in memory for the session; 5-minute soft TTL so if you
//     record a new audio, it appears after a short delay without reload.
//   - Set `forceRefresh: true` in your admin page after saving a recording.

import { supabase } from './supabase.js';        // adjust import path if different

let CACHE = null;                                 // { [sound]: url }
let CACHE_LOADED_AT = 0;
const TTL = 5 * 60 * 1000;                        // 5 minutes

async function loadCache() {
  try {
    const { data, error } = await supabase
      .from('pinyin_audio')
      .select('sound, audio_url');
    if (error) throw error;
    CACHE = {};
    for (const row of data || []) CACHE[row.sound] = row.audio_url;
    CACHE_LOADED_AT = Date.now();
  } catch (err) {
    console.warn('[pinyinAudio] failed to load cache:', err.message);
    CACHE = {};                                   // empty cache — callers will use TTS fallback
    CACHE_LOADED_AT = Date.now();
  }
}

export async function getPinyinAudioUrl(sound, opts = {}) {
  const stale = Date.now() - CACHE_LOADED_AT > TTL;
  if (!CACHE || stale || opts.forceRefresh) await loadCache();
  return CACHE[sound] || null;
}

// Imperative — clear the cache after admin records/deletes a sound
export function invalidatePinyinAudioCache() {
  CACHE = null;
  CACHE_LOADED_AT = 0;
}

// Convenience: load an Audio element directly. Returns null if no recording.
export async function loadPinyinAudio(sound) {
  const url = await getPinyinAudioUrl(sound);
  if (!url) return null;
  const audio = new Audio(url);
  audio.preload = 'auto';
  return audio;
}

// ── IPA overrides (hybrid — pinyinIPA.js defaults + DB overrides) ──

let IPA_CACHE = null;
let IPA_LOADED_AT = 0;

async function loadIPAOverrides() {
  try {
    const { data, error } = await supabase
      .from('pinyin_sound_overrides')
      .select('*');
    if (error) throw error;
    IPA_CACHE = {};
    for (const row of data || []) IPA_CACHE[row.sound] = row;
    IPA_LOADED_AT = Date.now();
  } catch (err) {
    console.warn('[pinyinAudio] IPA overrides failed:', err.message);
    IPA_CACHE = {};
    IPA_LOADED_AT = Date.now();
  }
}

// Returns { ipa?, desc_zh?, desc_en?, desc_it?, example_char?, example_meaning? }
// or null if no override exists. Merge with defaults at call site.
export async function getIPAOverride(sound, opts = {}) {
  const stale = Date.now() - IPA_LOADED_AT > TTL;
  if (!IPA_CACHE || stale || opts.forceRefresh) await loadIPAOverrides();
  return IPA_CACHE[sound] || null;
}

export function invalidateIPAOverrideCache() {
  IPA_CACHE = null;
  IPA_LOADED_AT = 0;
}

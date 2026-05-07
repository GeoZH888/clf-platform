// src/lib/aiProvider.js
// AI provider dispatcher — reads config from Supabase, routes calls.
import { supabase } from '../school/services/supabase';

let cachedConfig = null;
let cacheExpiry = 0;
const CACHE_MS = 60_000; // 1 min

async function loadConfig() {
  if (cachedConfig && Date.now() < cacheExpiry) return cachedConfig;
  const { data, error } = await supabase
    .from('clf_ai_provider_config')
    .select('*').eq('enabled', true);
  if (error) {
    console.warn('[aiProvider] config load failed:', error);
    return [];
  }
  cachedConfig = data || [];
  cacheExpiry = Date.now() + CACHE_MS;
  return cachedConfig;
}

// Get the default provider for a feature (text/image/audio)
export async function getProvider(feature, userOverride = null) {
  if (userOverride) return { provider: userOverride };
  const config = await loadConfig();
  const matches = config.filter(c => c.feature === feature);
  const defaults = matches.filter(c => c.is_default);
  return defaults[0] || matches[0] || null;
}

// Call AI for text generation. Routes to the right Netlify function based on provider.
// Returns { text, provider, model } on success or { error } on failure.
export async function callTextAI(prompt, options = {}) {
  const cfg = await getProvider('text', options.providerOverride);
  if (!cfg) return { error: 'No text AI provider configured' };
  const fnMap = {
    anthropic: '/.netlify/functions/ai-text-anthropic',
    openai:    '/.netlify/functions/ai-text-openai',
    gemini:    '/.netlify/functions/ai-text-gemini',
    deepseek:  '/.netlify/functions/ai-text-deepseek',
    qwen:      '/.netlify/functions/ai-text-qwen',
    mistral:   '/.netlify/functions/ai-text-mistral',
  };
  const url = fnMap[cfg.provider];
  if (!url) return { error: `Unknown text provider: ${cfg.provider}` };
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model: cfg.model, ...options }),
    });
    if (!resp.ok) return { error: `HTTP ${resp.status}: ${await resp.text()}` };
    const data = await resp.json();
    return { ...data, provider: cfg.provider, model: cfg.model };
  } catch (e) {
    return { error: e.message };
  }
}

// Call AI for image generation
export async function callImageAI(prompt, options = {}) {
  const cfg = await getProvider('image', options.providerOverride);
  if (!cfg) return { error: 'No image AI provider configured' };
  const fnMap = {
    ideogram:  '/.netlify/functions/generate-illustration',
    stability: '/.netlify/functions/stability-proxy',
  };
  const url = fnMap[cfg.provider];
  if (!url) return { error: `Unknown image provider: ${cfg.provider}` };
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, ...options }),
    });
    if (!resp.ok) return { error: `HTTP ${resp.status}` };
    const data = await resp.json();
    return { ...data, provider: cfg.provider };
  } catch (e) {
    return { error: e.message };
  }
}

// Call audio TTS
export async function callAudioAI(text, options = {}) {
  const cfg = await getProvider('audio', options.providerOverride);
  if (!cfg) return { error: 'No audio AI provider configured' };
  const fnMap = {
    azure_tts:  '/.netlify/functions/azure-tts-speak',
    youdao_tts: '/.netlify/functions/youdao-tts',
  };
  const url = fnMap[cfg.provider];
  if (!url) return { error: `Unknown audio provider: ${cfg.provider}` };
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, ...options }),
    });
    if (!resp.ok) return { error: `HTTP ${resp.status}` };
    const data = await resp.json();
    return { ...data, provider: cfg.provider };
  } catch (e) {
    return { error: e.message };
  }
}

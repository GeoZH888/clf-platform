// netlify/functions/tts-generate.js
//
// Generate audio for a single poem via Azure Neural TTS, upload to
// Supabase Storage (poem-audio bucket), update clf_poems.audio_url.
//
// Input (POST body):
//   {
//     poem_id: uuid,
//     voice: 'xiaoxiao' | 'xiaoxiao-poetry' | 'yunxi' | 'xiaoyi' | 'yunyang' | 'xiaochen',
//     force?: bool   // skip cache check, regenerate even if same voice already done
//   }
//
// Output:
//   { ok: true, audio_url, voice, duration_seconds, cached: bool }
//
// Auth: requires admin JWT (same pattern as admin-create-user.js)
//
// Env vars needed:
//   AZURE_TTS_KEY     — your Speech Service key
//   AZURE_TTS_REGION  — e.g. 'westeurope', 'eastus'
//   VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';

const supabaseUrl    = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const azureKey       = process.env.AZURE_TTS_KEY;
const azureRegion    = process.env.AZURE_TTS_REGION || 'westeurope';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Voice catalog ────────────────────────────────────────────────────────
// Maps internal voice ID → Azure voice name + style.
// Style "poetry-reading" only works on certain voices (xiaoxiao/yunxi/yunyang).
const VOICE_MAP = {
  'xiaoxiao':         { name: 'zh-CN-XiaoxiaoNeural',  style: null,             rate: '0.85', label: '晓晓·亲切' },
  'xiaoxiao-poetry':  { name: 'zh-CN-XiaoxiaoNeural',  style: 'poetry-reading', rate: '0.80', label: '晓晓·诗朗诵' },
  'yunxi':            { name: 'zh-CN-YunxiNeural',     style: null,             rate: '0.85', label: '云希·清亮' },
  'yunxi-poetry':     { name: 'zh-CN-YunxiNeural',     style: 'poetry-reading', rate: '0.80', label: '云希·诗朗诵' },
  'xiaoyi':           { name: 'zh-CN-XiaoyiNeural',    style: null,             rate: '0.85', label: '晓伊·活泼' },
  'yunyang':          { name: 'zh-CN-YunyangNeural',   style: null,             rate: '0.85', label: '云扬·成熟' },
  'yunyang-poetry':   { name: 'zh-CN-YunyangNeural',   style: 'poetry-reading', rate: '0.80', label: '云扬·诗朗诵' },
  'xiaochen':         { name: 'zh-CN-XiaochenNeural',  style: null,             rate: '0.85', label: '晓辰·温暖' },
};

const DEFAULT_VOICE = 'xiaoxiao-poetry';

// ─── Auth check (admin only) ──────────────────────────────────────────────
async function requireAdmin(authHeader) {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing auth token');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error('Invalid token');

  const { data: adminRow } = await supabase
    .from('jgw_admins').select('user_id').eq('user_id', user.id).maybeSingle();
  const isSuperadmin = user.user_metadata?.role === 'superadmin';

  if (!adminRow && !isSuperadmin) throw new Error('Not authorized');
  return user;
}

// ─── Build SSML ───────────────────────────────────────────────────────────
function buildSSML(text, voiceConfig) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const styleOpen = voiceConfig.style
    ? `<mstts:express-as style="${voiceConfig.style}">`
    : '';
  const styleClose = voiceConfig.style ? '</mstts:express-as>' : '';

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="zh-CN">
  <voice name="${voiceConfig.name}">
    ${styleOpen}
    <prosody rate="${voiceConfig.rate}">${escaped}</prosody>
    ${styleClose}
  </voice>
</speak>`;
}

// ─── Build poem text for TTS ──────────────────────────────────────────────
function buildPoemText(poem) {
  const title  = poem.title || '';
  const author = poem.author || '';
  const dynasty = poem.dynasty || '';

  // Lines with line-break pauses (period gives natural pause in Azure SSML).
  const lines = Array.isArray(poem.lines) ? poem.lines : [];
  const linesText = lines.filter(l => l && l.trim()).join('。');

  // Pattern: "title. author of dynasty dynasty. line1. line2. line3..."
  // Uses Chinese punctuation to trigger TTS pacing.
  const intro = author && dynasty
    ? `${title}。${dynasty}代，${author}。`
    : `${title}。`;

  return intro + linesText + '。';
}

// ─── Call Azure TTS REST API ──────────────────────────────────────────────
async function synthesize(ssml) {
  const endpoint = `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': azureKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
      'User-Agent': 'clf-platform-tts',
    },
    body: ssml,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Azure TTS ${res.status}: ${errText.slice(0, 200)}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── Estimate duration from MP3 size (rough) ──────────────────────────────
// At 96kbps mono mp3, ~12 KB per second
function estimateDuration(bufferLen) {
  return Math.round(bufferLen / 12000);
}

// ─── Handler ──────────────────────────────────────────────────────────────
export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  // Validate env
  if (!azureKey) {
    return { statusCode: 500, headers, body: JSON.stringify({
      error: 'AZURE_TTS_KEY not set in Netlify env vars',
    })};
  }

  // Auth
  let adminUser;
  try {
    adminUser = await requireAdmin(
      event.headers.authorization || event.headers.Authorization);
  } catch (err) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: err.message }) };
  }

  // Parse body
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { poem_id, voice = DEFAULT_VOICE, force = false } = body;
  if (!poem_id) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'poem_id required' }) };
  }

  const voiceConfig = VOICE_MAP[voice];
  if (!voiceConfig) {
    return { statusCode: 400, headers, body: JSON.stringify({
      error: `Unknown voice "${voice}". Valid: ${Object.keys(VOICE_MAP).join(', ')}`,
    })};
  }

  // Fetch poem
  const { data: poem, error: fetchErr } = await supabase
    .from('clf_poems')
    .select('id, title, author, dynasty, lines, audio_url, audio_voice, audio_provider')
    .eq('id', poem_id)
    .maybeSingle();

  if (fetchErr || !poem) {
    return { statusCode: 404, headers, body: JSON.stringify({
      error: fetchErr?.message || 'poem not found',
    })};
  }

  // Cache check: same voice + already exists
  if (!force && poem.audio_url
      && poem.audio_voice === voice
      && poem.audio_provider === 'azure') {
    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true,
      audio_url: poem.audio_url,
      voice,
      cached: true,
    })};
  }

  try {
    // Build text + SSML
    const text = buildPoemText(poem);
    const ssml = buildSSML(text, voiceConfig);

    // Synthesize
    const audioBuffer = await synthesize(ssml);

    // Upload to Storage
    const path = `${poem.id}_${voice}_${Date.now()}.mp3`;
    const { error: upErr } = await supabase.storage
      .from('poem-audio')
      .upload(path, audioBuffer, { upsert: true, contentType: 'audio/mpeg' });

    if (upErr) throw new Error(`upload failed: ${upErr.message}`);

    const { data: { publicUrl } } = supabase.storage
      .from('poem-audio')
      .getPublicUrl(path);

    const duration = estimateDuration(audioBuffer.length);

    // Update DB
    const { error: updErr } = await supabase.from('clf_poems').update({
      audio_url:      publicUrl,
      audio_voice:    voice,
      audio_provider: 'azure',
      audio_duration: duration,
    }).eq('id', poem.id);

    if (updErr) throw new Error(`db update failed: ${updErr.message}`);

    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true,
      audio_url: publicUrl,
      voice,
      duration_seconds: duration,
      cached: false,
    })};
  } catch (err) {
    console.error('[tts-generate]', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
}

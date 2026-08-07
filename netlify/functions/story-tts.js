// netlify/functions/story-tts.js
//
// Generate narration for ONE story page via Azure Neural TTS, upload to
// Supabase Storage (story-audio bucket), update clf_story_pages.audio_url.
//
// One page per call on purpose: a story runs 6–15 pages and Netlify kills a
// synchronous function at 26s. The admin loops over pages client-side so it
// can show progress and survive a single page failing.
//
// Input (POST body):
//   {
//     page_id: uuid,
//     voice?:  key of VOICE_MAP  (default 'xiaoxiao-story')
//     force?:  bool   // regenerate even if this voice was already rendered
//   }
//
// Output:
//   { ok: true, audio_url, voice, duration_seconds, cached: bool }
//
// Auth: admin JWT — same pattern as tts-generate.js
//
// Env vars:
//   AZURE_SPEECH_KEY (or legacy AZURE_TTS_KEY)
//   AZURE_SPEECH_REGION (or legacy AZURE_TTS_REGION)
//   VITE_SUPABASE_URL / SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';

const supabaseUrl    = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const azureKey       = process.env.AZURE_SPEECH_KEY    || process.env.AZURE_TTS_KEY;
const azureRegion    = process.env.AZURE_SPEECH_REGION || process.env.AZURE_TTS_REGION || 'westeurope';

const BUCKET = 'story-audio';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Voice catalog ────────────────────────────────────────────────────────
// Storytelling registers, slower than the poetry voices — these lines are
// read by children who are decoding characters at the same time.
// `style` is best-effort: synthesize() retries without it if Azure rejects it.
const VOICE_MAP = {
  'xiaoxiao-story': { name: 'zh-CN-XiaoxiaoNeural', style: 'gentle',   rate: '0.80', label: '晓晓·讲故事' },
  'xiaoxiao':       { name: 'zh-CN-XiaoxiaoNeural', style: null,       rate: '0.85', label: '晓晓·亲切' },
  'xiaoyi':         { name: 'zh-CN-XiaoyiNeural',   style: 'cheerful', rate: '0.85', label: '晓伊·活泼' },
  'yunxi':          { name: 'zh-CN-YunxiNeural',    style: null,       rate: '0.85', label: '云希·清亮' },
  'yunxi-story':    { name: 'zh-CN-YunxiNeural',    style: 'narration-relaxed', rate: '0.80', label: '云希·娓娓道来' },
  'yunyang':        { name: 'zh-CN-YunyangNeural',  style: null,       rate: '0.85', label: '云扬·成熟' },
  'xiaochen':       { name: 'zh-CN-XiaochenNeural', style: null,       rate: '0.85', label: '晓辰·温暖' },
};

const DEFAULT_VOICE = 'xiaoxiao-story';

// ─── Auth check (admin only) ──────────────────────────────────────────────
async function requireAdmin(authHeader) {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing auth token');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error('Invalid token');

  const { data: profile } = await supabase
    .from('clf_user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile) throw new Error('Not authorized: no profile');
  if (profile.is_active === false) throw new Error('Not authorized: account disabled');
  if (!['super_admin', 'school_master', 'teacher'].includes(profile.role)) {
    throw new Error('Not authorized: insufficient role');
  }
  return user;
}

// ─── Build SSML ───────────────────────────────────────────────────────────
function buildSSML(text, voiceConfig, withStyle = true) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const useStyle = withStyle && voiceConfig.style;
  const styleOpen  = useStyle ? `<mstts:express-as style="${voiceConfig.style}">` : '';
  const styleClose = useStyle ? '</mstts:express-as>' : '';

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="zh-CN">
  <voice name="${voiceConfig.name}">
    ${styleOpen}
    <prosody rate="${voiceConfig.rate}">${escaped}</prosody>
    ${styleClose}
  </voice>
</speak>`;
}

// ─── Call Azure TTS REST API ──────────────────────────────────────────────
async function callAzure(ssml) {
  const endpoint = `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': azureKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
      'User-Agent': 'clf-platform-story-tts',
    },
    body: ssml,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err = new Error(`Azure TTS ${res.status}: ${errText.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return Buffer.from(await res.arrayBuffer());
}

// Azure 400s on an express-as style the voice doesn't support. Rather than
// hard-coding which styles are live in which region, drop the style and retry.
async function synthesize(text, voiceConfig) {
  try {
    return await callAzure(buildSSML(text, voiceConfig, true));
  } catch (err) {
    if (voiceConfig.style && err.status === 400) {
      return await callAzure(buildSSML(text, voiceConfig, false));
    }
    throw err;
  }
}

// ─── Storage ──────────────────────────────────────────────────────────────
// The bucket is created on first use so deploying this needs no dashboard step.
async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  // A parallel invocation may have won the race — that is not a failure.
  if (error && !/exist/i.test(error.message)) {
    throw new Error(`could not create ${BUCKET} bucket: ${error.message}`);
  }
}

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

  if (!azureKey) {
    return { statusCode: 500, headers, body: JSON.stringify({
      error: 'AZURE_SPEECH_KEY (or AZURE_TTS_KEY) not set in Netlify env vars',
    })};
  }

  try {
    await requireAdmin(event.headers.authorization || event.headers.Authorization);
  } catch (err) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: err.message }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { page_id, voice = DEFAULT_VOICE, force = false } = body;
  if (!page_id) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'page_id required' }) };
  }

  const voiceConfig = VOICE_MAP[voice];
  if (!voiceConfig) {
    return { statusCode: 400, headers, body: JSON.stringify({
      error: `Unknown voice "${voice}". Valid: ${Object.keys(VOICE_MAP).join(', ')}`,
    })};
  }

  const { data: page, error: fetchErr } = await supabase
    .from('clf_story_pages')
    .select('id, story_id, page_order, text_zh, audio_url, audio_voice, audio_provider')
    .eq('id', page_id)
    .maybeSingle();

  if (fetchErr || !page) {
    return { statusCode: 404, headers, body: JSON.stringify({
      error: fetchErr?.message || 'story page not found',
    })};
  }

  const text = (page.text_zh || '').trim();
  if (!text) {
    return { statusCode: 400, headers, body: JSON.stringify({
      error: `第 ${page.page_order} 页没有中文文本 · page has no text_zh to read`,
    })};
  }

  // Cache check: same voice, already rendered
  if (!force && page.audio_url
      && page.audio_voice === voice
      && page.audio_provider === 'azure') {
    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true, audio_url: page.audio_url, voice, cached: true,
    })};
  }

  try {
    await ensureBucket();

    const audioBuffer = await synthesize(text, voiceConfig);

    const path = `${page.story_id}/${page.id}_${voice}_${Date.now()}.mp3`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, audioBuffer, { upsert: true, contentType: 'audio/mpeg' });
    if (upErr) throw new Error(`upload failed: ${upErr.message}`);

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const duration = estimateDuration(audioBuffer.length);

    const { error: updErr } = await supabase.from('clf_story_pages').update({
      audio_url:      publicUrl,
      audio_voice:    voice,
      audio_provider: 'azure',
      audio_duration: duration,
    }).eq('id', page.id);
    if (updErr) throw new Error(`db update failed: ${updErr.message}`);

    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true,
      audio_url: publicUrl,
      voice,
      duration_seconds: duration,
      cached: false,
    })};
  } catch (err) {
    console.error('[story-tts]', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
}

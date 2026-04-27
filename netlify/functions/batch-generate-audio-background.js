// netlify/functions/batch-generate-audio-background.js
//
// 批量为诗词生成 Azure Neural TTS 朗读
// BACKGROUND FUNCTION — 可能运行 1-10 分钟, 取决于条数
//
// 输入 (POST body):
//   {
//     poem_ids?: [...]              // 直接指定 (优先)
//     filter?: { dynasty, type, limit, only_missing }
//     voice: 'xiaoxiao-poetry' | ...  // 见 VOICE_MAP
//     force?: bool                  // 已有同 voice audio 也重新生成
//   }
//
// 流程:
//   1. 查 clf_poems
//   2. 创建 batch job
//   3. 每首:
//      - 若已有同 voice audio 且 !force → skip
//      - 调 Azure TTS → 上传到 poem-audio bucket → UPDATE clf_poems
//      - 更新 job.total_added 计数
//   4. 完成
//
// 鉴权：跟 tts-generate 一样要 admin JWT
//
// 注意：跟 batch-generate-illustrations-background.js 是平行函数，
// 不通过 target_type 分流（audio 跟 image 流程差异较大，单独 function 更清晰）

import { createClient } from '@supabase/supabase-js';

const supabaseUrl    = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const azureKey       = process.env.AZURE_SPEECH_KEY    || process.env.AZURE_TTS_KEY;
const azureRegion    = process.env.AZURE_SPEECH_REGION || process.env.AZURE_TTS_REGION || 'westeurope';

// Voice map — must match tts-generate.js
const VOICE_MAP = {
  'xiaoxiao':         { name: 'zh-CN-XiaoxiaoNeural',  style: null,             rate: '0.85' },
  'xiaoxiao-poetry':  { name: 'zh-CN-XiaoxiaoNeural',  style: 'poetry-reading', rate: '0.80' },
  'yunxi':            { name: 'zh-CN-YunxiNeural',     style: null,             rate: '0.85' },
  'yunxi-poetry':     { name: 'zh-CN-YunxiNeural',     style: 'poetry-reading', rate: '0.80' },
  'xiaoyi':           { name: 'zh-CN-XiaoyiNeural',    style: null,             rate: '0.85' },
  'yunyang':          { name: 'zh-CN-YunyangNeural',   style: null,             rate: '0.85' },
  'yunyang-poetry':   { name: 'zh-CN-YunyangNeural',   style: 'poetry-reading', rate: '0.80' },
  'xiaochen':         { name: 'zh-CN-XiaochenNeural',  style: null,             rate: '0.85' },
};

// ─── Utility helpers (mirror tts-generate.js) ─────────────────────────────

function buildSSML(text, voiceConfig) {
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const styleOpen = voiceConfig.style ? `<mstts:express-as style="${voiceConfig.style}">` : '';
  const styleClose = voiceConfig.style ? '</mstts:express-as>' : '';
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="zh-CN">
  <voice name="${voiceConfig.name}">
    ${styleOpen}
    <prosody rate="${voiceConfig.rate}">${escaped}</prosody>
    ${styleClose}
  </voice>
</speak>`;
}

function buildPoemText(poem) {
  const title  = poem.title || '';
  const author = poem.author || '';
  const dynasty = poem.dynasty || '';
  const lines = Array.isArray(poem.lines) ? poem.lines : [];
  const linesText = lines.filter(l => l && l.trim()).join('。');
  const intro = author && dynasty
    ? `${title}。${dynasty}代，${author}。`
    : `${title}。`;
  return intro + linesText + '。';
}

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

function estimateDuration(bufferLen) {
  return Math.round(bufferLen / 12000);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Main handler (Background function uses default export) ───────────────

export default async (req, context) => {
  if (req.method !== 'POST') {
    return json({ error: 'POST only' }, 405);
  }

  if (!azureKey) {
    return json({ error: 'AZURE_SPEECH_KEY (or AZURE_TTS_KEY) not set in Netlify env vars' }, 500);
  }

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'invalid JSON' }, 400); }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    poem_ids = null,
    filter = {},
    voice = 'xiaoxiao-poetry',
    force = false,
  } = body;

  const voiceConfig = VOICE_MAP[voice];
  if (!voiceConfig) {
    return json({ error: `Unknown voice "${voice}"` }, 400);
  }

  // ── 1. Query poems ─────────────────────────────────────────────────────
  const { dynasty = null, type = null, limit = 50 } = filter;
  const onlyMissing = (poem_ids && poem_ids.length > 0)
    ? false  // when explicit ids given, default to NOT filter — admin chose them
    : (filter.only_missing !== false);

  let poems;
  if (poem_ids && poem_ids.length > 0) {
    const { data, error } = await supabase
      .from('clf_poems')
      .select('id, title, author, dynasty, lines, audio_url, audio_voice, audio_provider')
      .in('id', poem_ids);
    if (error) return json({ error: 'query: ' + error.message }, 500);
    poems = data || [];
  } else {
    let q = supabase
      .from('clf_poems')
      .select('id, title, author, dynasty, lines, audio_url, audio_voice, audio_provider')
      .eq('active', true)
      .limit(limit);
    if (dynasty)     q = q.eq('dynasty', dynasty);
    if (type)        q = q.eq('type', type);
    if (onlyMissing) q = q.is('audio_url', null);
    const { data, error } = await q;
    if (error) return json({ error: 'query: ' + error.message }, 500);
    poems = data || [];
  }

  if (poems.length === 0) {
    return json({ error: 'no poems match filter' }, 404);
  }

  // ── 2. Create batch job ────────────────────────────────────────────────
  const jobLabel = (poem_ids && poem_ids.length > 0)
    ? `Audio: ${poems.length} selected (${voice})`
    : `Audio: ${dynasty || 'all'}/${type || 'all'} (${voice})`;

  const { data: job, error: jobErr } = await supabase
    .from('character_extraction_jobs')
    .insert({
      source_type: 'poem_audio_batch',
      source_label: jobLabel,
      extraction_method: 'poem_audio_batch',
      status: 'extracting',
      total_candidates: poems.length,
      total_added: 0,
      config: {
        target_type: 'poem_audio',
        mode: (poem_ids && poem_ids.length > 0) ? 'selected' : 'filter',
        poem_count: poem_ids?.length,
        filter, voice, force,
      },
    })
    .select()
    .single();
  if (jobErr) return json({ error: 'job: ' + jobErr.message }, 500);

  // ── 3. Process each poem ───────────────────────────────────────────────
  let completed = 0;
  let skipped = 0;
  const errors = [];

  for (const p of poems) {
    try {
      // Cache check
      if (!force
          && p.audio_url
          && p.audio_voice === voice
          && p.audio_provider === 'azure') {
        skipped++;
        console.log(`[batch-tts] ${skipped} skipped (cached): ${p.title}`);
        continue;
      }

      // Build text + SSML + synthesize
      const text = buildPoemText(p);
      const ssml = buildSSML(text, voiceConfig);
      const audioBuffer = await synthesize(ssml);

      // Upload
      const path = `${p.id}_${voice}_${Date.now()}.mp3`;
      const { error: upErr } = await supabase.storage
        .from('poem-audio')
        .upload(path, audioBuffer, { upsert: true, contentType: 'audio/mpeg' });
      if (upErr) {
        errors.push({ poem: p.title, error: 'upload: ' + upErr.message });
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('poem-audio')
        .getPublicUrl(path);

      const duration = estimateDuration(audioBuffer.length);

      // Update DB
      await supabase.from('clf_poems').update({
        audio_url:      publicUrl,
        audio_voice:    voice,
        audio_provider: 'azure',
        audio_duration: duration,
      }).eq('id', p.id);

      completed++;
      console.log(`[batch-tts] ${completed}/${poems.length}: ${p.title} -> OK (${duration}s)`);

      // Throttle 200ms — Azure free tier limit is 20 req/sec
      await new Promise(r => setTimeout(r, 200));

      // Update job progress every 5
      if (completed % 5 === 0 || completed === poems.length) {
        await supabase
          .from('character_extraction_jobs')
          .update({ total_added: completed })
          .eq('id', job.id);
      }
    } catch (err) {
      console.error(`[batch-tts] ${p.title} error:`, err.message);
      errors.push({ poem: p.title, error: err.message });
    }
  }

  // ── 4. Mark job complete ───────────────────────────────────────────────
  await supabase
    .from('character_extraction_jobs')
    .update({
      status: 'complete',
      total_added: completed,
      total_skipped: skipped + errors.length,
      completed_at: new Date().toISOString(),
      error_message: errors.length > 0
        ? `${errors.length} errors. First: ${errors[0]?.error || ''}`.substring(0, 500)
        : (skipped > 0 ? `${skipped} cached (skipped)` : null),
    })
    .eq('id', job.id);

  return json({
    target_type: 'poem_audio',
    job_id: job.id,
    total: poems.length,
    completed,
    skipped,
    errors: errors.length,
  });
};

export const config = {
  path: '/.netlify/functions/batch-generate-audio-background',
};

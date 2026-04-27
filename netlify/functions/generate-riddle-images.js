// netlify/functions/generate-riddle-images.js
//
// Generates ONE image for a riddle and stores it.
//
// Body:
//   {
//     riddle_id: uuid (required),
//     type:      'illustration' | 'answer'  (required),
//     provider?: 'stability' | 'openai' | 'ideogram'  (optional, default 'stability'),
//     prompt?:   string  (optional — if omitted, default is computed from the riddle),
//     force?:    bool    (optional — regenerate even if an image already exists)
//   }
//
// Persistence rule (the user's explicit choice):
//   The custom prompt is saved to clf_riddles.{type}_prompt ONLY if image
//   generation succeeds. Failed prompts never persist. This guarantees
//   that whatever's in the DB is a known-good starting point for future
//   regenerations.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

const BUCKET = 'riddle-illustrations';

// ─────────────────────────────────────────────────────────────────────────────
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: HEADERS });
  if (req.method !== 'POST')    return json(405, { error: 'Method not allowed' });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      riddle_id,
      type      = 'answer',
      provider  = 'stability',
      prompt:   customPrompt = null,
      force     = false,
    } = body;

    if (!riddle_id) return json(400, { error: 'riddle_id required' });
    if (!['illustration', 'answer'].includes(type))
      return json(400, { error: 'type must be illustration or answer' });

    // 1. Load riddle
    const { data: riddle, error: rErr } = await supabase
      .from('clf_riddles')
      .select('*')
      .eq('id', riddle_id)
      .single();
    if (rErr || !riddle) return json(404, { error: 'Riddle not found' });

    // Skip if image exists and not forcing (only relevant for auto-fire path)
    const existingUrl = type === 'illustration' ? riddle.illustration_url : riddle.answer_image_url;
    if (existingUrl && !force) {
      return json(200, { url: existingUrl, skipped: true });
    }

    // 2. Build prompt — use admin-supplied if given, else default
    const finalPrompt = customPrompt && customPrompt.trim()
      ? customPrompt.trim()
      : buildDefaultPrompt(riddle, type);

    // 3. Generate via ai-gateway
    const baseUrl = process.env.URL || process.env.DEPLOY_URL || '';
    const aiRes = await fetch(`${baseUrl}/.netlify/functions/ai-gateway`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        action:  'generate_image',
        provider,
        prompt:  finalPrompt,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return json(500, {
        error: `AI gateway ${aiRes.status}: ${errText.slice(0, 300)}`,
        prompt_used: finalPrompt,
        provider,
      });
    }

    const aiData = await aiRes.json();
    if (aiData.error) return json(500, {
      error: aiData.error,
      prompt_used: finalPrompt,
      provider,
    });

    // Extract image bytes
    const blob = await extractImageBlob(aiData);
    if (!blob) return json(500, {
      error: '未找到图片字段',
      raw: JSON.stringify(aiData).slice(0, 200),
      prompt_used: finalPrompt,
    });

    // 4. Upload to Supabase Storage
    const key = `riddle_${riddle.id.slice(0, 8)}_${type}.png`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(key, blob, {
        upsert:       true,
        contentType:  'image/png',
        cacheControl: '3600',
      });
    if (upErr) return json(500, {
      error: `Storage upload: ${upErr.message}`,
      prompt_used: finalPrompt,
    });

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(key);
    const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

    // 5. Update riddle — including the prompt that worked (success-only persistence)
    const update = type === 'illustration'
      ? {
          illustration_url:      publicUrl,
          illustration_prompt:   finalPrompt,
          illustration_provider: provider,
        }
      : {
          answer_image_url:      publicUrl,
          answer_prompt:         finalPrompt,
          answer_provider:       provider,
        };

    // Mark images_generated_at if both are now present
    const otherUrl = type === 'illustration'
      ? riddle.answer_image_url
      : riddle.illustration_url;
    if (otherUrl) update.images_generated_at = new Date().toISOString();

    const { error: dbErr } = await supabase
      .from('clf_riddles')
      .update(update)
      .eq('id', riddle_id);
    if (dbErr) return json(500, {
      error: `DB update: ${dbErr.message}`,
      prompt_used: finalPrompt,
    });

    return json(200, {
      url:         publicUrl,
      type,
      riddle_id,
      prompt_used: finalPrompt,
      provider,
    });
  } catch (err) {
    console.error('[generate-riddle-images]', err);
    return json(500, { error: err.message || String(err) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Default prompt — based on 谜面字面意思 + 解释 (per user's request)
// Returns a Chinese prompt that's easy to read and edit in the modal.
// ─────────────────────────────────────────────────────────────────────────────
export function buildDefaultPrompt(riddle, type) {
  const { riddle_text, answer, answer_type, category_hint, explanation } = riddle;

  if (type === 'answer') {
    const subjectKind =
      answer_type === 'idiom'    ? '成语' :
      answer_type === 'word'     ? '词语' :
      answer_type === 'object'   ? '事物' :
      '汉字';

    return [
      `中国传统插画，表现「${answer}」这个${subjectKind}的含义。`,
      `谜面背景：${riddle_text}。`,
      explanation ? `含义解释：${explanation}。` : '',
      `风格：温暖喜庆的中国节日艺术，红金色调，工笔或水彩风格。`,
      `单一中心主体，简洁背景。`,
      `重要：图中不要出现任何中文字符或汉字。`,
      `适合作为灯谜揭晓时的展示图。`,
    ].filter(Boolean).join('\n');
  }

  // type === 'illustration' — based on 谜面字面意思 + 解释
  const lines = [
    `中国传统装饰插画，基于谜面的字面意思创作。`,
    `谜面：${riddle_text}`,
  ];
  if (category_hint) lines.push(`谜目：${category_hint}`);
  if (explanation)   lines.push(`谜底解释：${explanation}`);
  lines.push(
    `风格：中国水墨画或工笔画，温暖的灯笼节日氛围。`,
    `重要：图中不要出现任何中文字符或汉字。`,
  );
  if (answer_type === 'character') {
    lines.push(`特别注意：避免在图中画出任何与答案「${answer}」相关的字形、部首或显眼线索。`);
  }
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Convert ai-gateway response → Blob, handling multiple shapes
// ─────────────────────────────────────────────────────────────────────────────
async function extractImageBlob(data) {
  const directUrl = data.url || data.imageUrl || data.image_url
    || data.result?.url || data.data?.[0]?.url
    || data.images?.[0]?.url || (typeof data.images?.[0] === 'string' ? data.images[0] : null);

  if (directUrl && typeof directUrl === 'string' && directUrl.startsWith('http')) {
    const r = await fetch(directUrl);
    if (!r.ok) return null;
    return await r.blob();
  }

  const b64 = data.base64 || data.image || data.b64_json || data.images?.[0]?.base64;
  if (b64) {
    const mime = data.mimeType || data.mime_type || 'image/png';
    const bin  = atob(b64);
    const arr  = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  if (directUrl && typeof directUrl === 'string' && directUrl.startsWith('data:')) {
    const [meta, b64part] = directUrl.split(',');
    const mime = meta.match(/data:([^;]+)/)?.[1] || 'image/png';
    const bin  = atob(b64part);
    const arr  = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  return null;
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

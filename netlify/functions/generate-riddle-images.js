// netlify/functions/generate-riddle-images.js
//
// Two modes:
//   1. Generation mode (default): generate image, save to storage + DB
//   2. Translate-only mode (translate_only: true): just translate Chinese
//      prompt to English. Used by the admin modal's English preview panel.
//
// Body:
//   {
//     riddle_id: uuid,
//     type:      'illustration' | 'answer',
//     provider?: 'stability' | 'openai' | 'ideogram',
//     prompt?:   string  (Chinese, what admin typed),
//     prompt_en?: string  (English, optional override — used directly for
//                          English-only providers if provided),
//     force?:    bool,
//     translate_only?: bool  (NEW — return translation without generating)
//   }
//
// Persistence: prompt+provider saved to clf_riddles ONLY on successful
// image generation. Translation never persisted.

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

const BUCKET = 'riddle-illustrations';
const ENGLISH_ONLY_PROVIDERS = new Set(['stability']);
const HAS_CHINESE = /[\u4e00-\u9fff]/;

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
      prompt:   customPrompt    = null,
      prompt_en: customPromptEn = null,
      force     = false,
      translate_only = false,
    } = body;

    if (!riddle_id) return json(400, { error: 'riddle_id required' });
    if (!['illustration', 'answer'].includes(type))
      return json(400, { error: 'type must be illustration or answer' });

    // Translate-only mode — skip everything else
    if (translate_only) {
      const text = (customPrompt || '').trim();
      if (!text) return json(400, { error: 'prompt required for translate_only' });
      try {
        const en = HAS_CHINESE.test(text) ? await translateToEnglish(text) : text;
        return json(200, { prompt_en: en, was_chinese: HAS_CHINESE.test(text) });
      } catch (err) {
        return json(500, { error: `Translation failed: ${err.message}` });
      }
    }

    // 1. Load riddle
    const { data: riddle, error: rErr } = await supabase
      .from('clf_riddles').select('*').eq('id', riddle_id).single();
    if (rErr || !riddle) return json(404, { error: 'Riddle not found' });

    // Skip if image exists and not forcing
    const existingUrl = type === 'illustration' ? riddle.illustration_url : riddle.answer_image_url;
    if (existingUrl && !force) return json(200, { url: existingUrl, skipped: true });

    // 2. Resolve Chinese prompt (what gets saved)
    const finalPrompt = customPrompt && customPrompt.trim()
      ? customPrompt.trim()
      : buildDefaultPrompt(riddle, type);

    // 3. Resolve what gets sent to the provider
    //    - English-only provider: use admin's manual English if given, else translate
    //    - Other providers: use Chinese as-is (or English if admin overrode)
    let promptToSend = finalPrompt;
    let translationUsed = false;

    if (ENGLISH_ONLY_PROVIDERS.has(provider)) {
      if (customPromptEn && customPromptEn.trim()) {
        promptToSend = customPromptEn.trim();
      } else if (HAS_CHINESE.test(finalPrompt)) {
        try {
          promptToSend = await translateToEnglish(finalPrompt);
          translationUsed = true;
        } catch (err) {
          return json(500, {
            error: `中译英失败: ${err.message}`,
            prompt_used: finalPrompt,
          });
        }
      }
    } else if (customPromptEn && customPromptEn.trim()) {
      // Admin provided English override even for non-English-only provider
      promptToSend = customPromptEn.trim();
    }

    // 4. Generate via ai-gateway
    const baseUrl = process.env.URL || process.env.DEPLOY_URL || '';
    const aiRes = await fetch(`${baseUrl}/.netlify/functions/ai-gateway`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'generate_image', provider, prompt: promptToSend }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return json(500, {
        error: `AI gateway ${aiRes.status}: ${errText.slice(0, 300)}`,
        prompt_used: finalPrompt,
        prompt_sent: promptToSend,
      });
    }

    const aiData = await aiRes.json();
    if (aiData.error) return json(500, {
      error: aiData.error, prompt_used: finalPrompt, prompt_sent: promptToSend,
    });

    const blob = await extractImageBlob(aiData);
    if (!blob) return json(500, {
      error: '未找到图片字段',
      raw: JSON.stringify(aiData).slice(0, 200),
      prompt_used: finalPrompt,
    });

    // 5. Upload to storage
    const key = `riddle_${riddle.id.slice(0, 8)}_${type}.png`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(key, blob, { upsert: true, contentType: 'image/png', cacheControl: '3600' });
    if (upErr) return json(500, { error: `Storage upload: ${upErr.message}`, prompt_used: finalPrompt });

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(key);
    const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

    // 6. Update riddle — saving Chinese original (not translation)
    const update = type === 'illustration'
      ? { illustration_url: publicUrl, illustration_prompt: finalPrompt, illustration_provider: provider }
      : { answer_image_url: publicUrl, answer_prompt:       finalPrompt, answer_provider:       provider };

    const otherUrl = type === 'illustration' ? riddle.answer_image_url : riddle.illustration_url;
    if (otherUrl) update.images_generated_at = new Date().toISOString();

    const { error: dbErr } = await supabase.from('clf_riddles').update(update).eq('id', riddle_id);
    if (dbErr) return json(500, { error: `DB update: ${dbErr.message}`, prompt_used: finalPrompt });

    return json(200, {
      url:              publicUrl,
      type,
      riddle_id,
      prompt_used:      finalPrompt,
      prompt_sent:      promptToSend,
      translation_used: translationUsed,
      provider,
    });
  } catch (err) {
    console.error('[generate-riddle-images]', err);
    return json(500, { error: err.message || String(err) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
async function translateToEnglish(chinesePrompt) {
  const resp = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content:
        `Translate the following image generation prompt from Chinese to English. ` +
        `Preserve ALL instructions, styles, and constraints exactly — including any ` +
        `negative instructions like "do NOT show X". Keep proper nouns and quoted ` +
        `Chinese characters in their original form (e.g. 「茶」 stays as 「茶」). ` +
        `Return ONLY the English translation, with no preamble or commentary.\n\n` +
        `Chinese prompt:\n${chinesePrompt}`,
    }],
  });
  const text = resp.content?.[0]?.text?.trim();
  if (!text) throw new Error('Empty translation response');
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
export function buildDefaultPrompt(riddle, type) {
  const { riddle_text, answer, answer_type, category_hint, explanation } = riddle;

  if (type === 'answer') {
    const subjectKind =
      answer_type === 'idiom'   ? '成语' :
      answer_type === 'word'    ? '词语' :
      answer_type === 'object'  ? '事物' :
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

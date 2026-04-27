// netlify/functions/generate-chengyu-image.js
//
// Generates an illustration for a 成语 (Chinese idiom) and stores it.
//
// Default prompts use the 历史典故 (story_zh) as primary source material —
// stories are visually concrete and produce more consistent results than
// abstract meanings.
//
// Body:
//   {
//     chengyu_id: uuid (required),
//     provider?:  'stability' | 'openai' | 'ideogram'  (default 'stability'),
//     prompt?:    string  (Chinese, what admin typed),
//     prompt_en?: string  (English override; used directly if provided),
//     force?:     bool    (regenerate even if image_url exists),
//     translate_only?: bool  (just translate, no image — for modal preview)
//   }
//
// Persistence: prompt+provider saved to clf_chengyu ONLY on success.

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

const BUCKET = 'chengyu-illustrations';
const ENGLISH_ONLY_PROVIDERS = new Set(['stability']);
const HAS_CHINESE = /[\u4e00-\u9fff]/;

// ─────────────────────────────────────────────────────────────────────────────
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: HEADERS });
  if (req.method !== 'POST')    return json(405, { error: 'Method not allowed' });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      chengyu_id,
      provider  = 'stability',
      prompt:   customPrompt    = null,
      prompt_en: customPromptEn = null,
      force     = false,
      translate_only = false,
    } = body;

    if (!chengyu_id) return json(400, { error: 'chengyu_id required' });

    // Translate-only mode (for modal preview)
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

    // 1. Load chengyu
    const { data: chengyu, error: cErr } = await supabase
      .from('clf_chengyu').select('*').eq('id', chengyu_id).single();
    if (cErr || !chengyu) return json(404, { error: 'Chengyu not found' });

    // Skip if image exists and not forcing
    if (chengyu.image_url && !force) {
      return json(200, { url: chengyu.image_url, skipped: true });
    }

    // 2. Resolve Chinese prompt (saved on success)
    const finalPrompt = customPrompt && customPrompt.trim()
      ? customPrompt.trim()
      : buildDefaultPrompt(chengyu);

    // 3. Resolve what to send to provider
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

    // 5. Upload to storage — ASCII-safe filename based on id slice
    const key = `chengyu_${chengyu.id.slice(0, 8)}.png`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(key, blob, { upsert: true, contentType: 'image/png', cacheControl: '3600' });
    if (upErr) return json(500, { error: `Storage upload: ${upErr.message}`, prompt_used: finalPrompt });

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(key);
    const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

    // 6. Update chengyu — save Chinese original (not translation)
    const { error: dbErr } = await supabase
      .from('clf_chengyu')
      .update({
        image_url:      publicUrl,
        image_prompt:   finalPrompt,
        image_provider: provider,
        updated_at:     new Date().toISOString(),
      })
      .eq('id', chengyu_id);
    if (dbErr) return json(500, { error: `DB update: ${dbErr.message}`, prompt_used: finalPrompt });

    return json(200, {
      url:              publicUrl,
      chengyu_id,
      prompt_used:      finalPrompt,
      prompt_sent:      promptToSend,
      translation_used: translationUsed,
      provider,
    });
  } catch (err) {
    console.error('[generate-chengyu-image]', err);
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
        `Chinese characters in their original form (e.g. 「狐假虎威」 stays as 「狐假虎威」). ` +
        `Return ONLY the English translation, with no preamble or commentary.\n\n` +
        `Chinese prompt:\n${chinesePrompt}`,
    }],
  });
  const text = resp.content?.[0]?.text?.trim();
  if (!text) throw new Error('Empty translation response');
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default prompt — built from STORY (story_zh) as the primary source.
// Stories are visually concrete (characters, setting, action) so they produce
// much more consistent images than abstract meanings.
// ─────────────────────────────────────────────────────────────────────────────
export function buildDefaultPrompt(chengyu) {
  const { idiom, pinyin, meaning_zh, story_zh, theme } = chengyu;

  const lines = [
    `基于成语「${idiom}」的历史典故创作中国传统插画。`,
  ];
  if (pinyin)     lines.push(`拼音：${pinyin}`);
  if (meaning_zh) lines.push(`含义：${meaning_zh}`);
  if (story_zh) {
    lines.push(``);
    lines.push(`历史典故：`);
    lines.push(story_zh);
    lines.push(``);
  }
  if (theme)      lines.push(`主题：${theme}`);
  lines.push(
    `风格：温暖的中国传统插画，工笔或水彩风格，叙事性强。`,
    `画面要展现故事中的关键场景和角色，生动有趣。`,
    `重要：图中不要出现任何中文字符或汉字。`,
  );
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

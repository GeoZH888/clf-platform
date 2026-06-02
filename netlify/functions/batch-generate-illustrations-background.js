// netlify/functions/batch-generate-illustrations-background.js
//
// 批量为字符 / 词语 / 诗词生成插画
// BACKGROUND FUNCTION — 可能运行 10-30 分钟, 取决于条数 + 模型
//
// 输入 (POST body):
//   character batch (default, target_type 省略或 'character'):
//     {
//       character_ids?: [...]         // 直接指定 (优先)
//       filter?: { hsk_level, source_label, limit, only_missing }
//       only_missing?: true           // 用于 character_ids 模式
//       provider: 'stability' | 'dalle3'
//       style: 'cartoon' | 'simple_pictograms' | 'watercolor' | 'flat'
//       custom_prompt_template?: string  // 用 {meaning} 占位
//     }
//
//   word batch (target_type === 'word'):
//     {
//       target_type: 'word',
//       word_ids?: [...]              // 直接指定 (优先)
//       filter?: { theme, limit, only_missing, only_illustratable }
//       only_missing?: true
//       only_illustratable?: true
//       provider: 'stability' | 'dalle3'
//       style: 'flashcard' | 'photo' | 'emoji' | 'cartoon' | 'abstract'
//     }
//
//   poem batch (target_type === 'poem'):
//     {
//       target_type: 'poem',
//       poem_ids?: [...]              // 直接指定 (优先)
//       filter?: { dynasty, type, limit, only_missing, active_only }
//       only_missing?: true
//       provider: 'stability' | 'dalle3'
//       style: 'ink' | 'classical' | 'atmospheric' | 'modern'
//     }
//
// 流程对所有 target 都一样:
//   1. 查目标表 (jgw_characters / clf_words / clf_poems)
//   2. 创建 batch job (character_extraction_jobs 表, extraction_method 区分)
//   3. 每条:
//      - 构造 prompt (从 clf_prompt_templates 读, 代码 fallback 兜底)
//      - 调生图 API
//      - 上传到 Storage (illustrations / word-illustrations / poem-images bucket)
//      - UPDATE 目标表的 image_url
//      - 更新 job.total_added (作为进度计数)
//   4. 完成时 status=complete

import { createClient } from '@supabase/supabase-js';

// ─── Style prompt defaults ────────────────────────────────────────────────

// Character styles — kept as a hardcoded fallback (current behavior)
const CHAR_DEFAULT_STYLE_PROMPTS = {
  cartoon: 'cartoon illustration, simple, bright colors, child-friendly, white background, for children learning Chinese',
  simple_pictograms: 'simple pictogram illustration, minimal design, white background, single subject, educational for kids',
  watercolor: 'watercolor painting, soft colors, artistic, calligraphy inspired, white background',
  flat: 'flat design illustration, simple shapes, modern, white background',
};

// Word styles — fallback when DB read fails. Should match seed in
// clf_prompt_templates_word_migration.sql under keys word_image_<style>.
// Variables: {word_zh}, {meaning_en}
const WORD_DEFAULT_STYLE_PROMPTS = {
  flashcard: 'Clean educational flashcard illustration of "{meaning_en}" (Chinese: {word_zh}) for vocabulary learners. Single central subject, white background, bright primary colors, bold clean shapes, no text, suitable for language-learning app. Simple and instantly recognizable.',
  photo:     'High-quality educational photograph of "{meaning_en}" (Chinese: {word_zh}). Clear focus, neutral background, well-lit studio style, single subject. Suitable for language-learning flashcard. Photorealistic, no text.',
  emoji:     'Large emoji-style illustration of "{meaning_en}" on a plain white background. Round, friendly, glossy aesthetic similar to Apple/Google emoji design. Single centered subject, bright colors, soft shadow, no text.',
  cartoon:   'Cute cartoon illustration of "{meaning_en}" (Chinese: {word_zh}) for children\'s Chinese textbook. Friendly characters or objects, pastel colors, rounded shapes, playful style, white background, no text. Evokes warmth and fun.',
  abstract:  'Abstract minimalist illustration evoking the concept of "{meaning_en}". Geometric shapes, muted color palette, flat design, symbolic rather than literal. Suitable for modern educational material. No text.',
};

// Poem styles — fallback when DB read fails. Should match seed in
// clf_prompt_templates_poem_migration.sql under keys poem_image_<style>.
// Variables: {title}, {author}, {dynasty}, {theme_hint}
const POEM_DEFAULT_STYLE_PROMPTS = {
  ink:         'Traditional Chinese ink wash painting illustrating the poem "{title}" by {author} ({dynasty} dynasty). Theme: {theme_hint}. Atmospheric, monochrome with subtle color washes, brush stroke texture, vertical scroll composition. No Chinese characters or text.',
  classical:   'Traditional Chinese gongbi painting illustrating the poem "{title}" by {author} ({dynasty} dynasty). Theme: {theme_hint}. Fine outline, mineral pigments, meticulous detail, decorative composition. No Chinese characters or text.',
  atmospheric: 'Atmospheric mood-driven illustration evoking the emotional core of "{title}" by {author}. Theme: {theme_hint}. Painterly, cinematic, muted palette, light as main subject. No text.',
  modern:      'Modern children\'s textbook illustration of the poem "{title}" by {author} ({dynasty} dynasty). Scene: {theme_hint}. Friendly cartoon-illustration style, warm colors, scene-based. No text. White or pastel background.',
};

const NEGATIVE_PROMPT = 'text, letters, words, writing, calligraphy, Chinese characters, glyphs, symbols, watermark, signature, logo, multiple subjects, collage, blurry, low quality, distorted, deformed';

// ─── Main handler ─────────────────────────────────────────────────────────

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Branch on target_type. Default to 'character' for backwards compatibility.
  const targetType = ['word','poem'].includes(body.target_type) ? body.target_type : 'character';

  if (targetType === 'word') {
    return runWordBatch(body, supabase);
  } else if (targetType === 'poem') {
    return runPoemBatch(body, supabase);
  } else {
    return runCharacterBatch(body, supabase);
  }
};

// ─── Character batch (preserved from original) ────────────────────────────

async function runCharacterBatch(body, supabase) {
  const {
    character_ids = null,
    filter = {},
    only_missing = true,
    provider = 'stability',
    style = 'simple_pictograms',
    custom_prompt_template = null,
  } = body;

  const {
    hsk_level = null,
    source_label = null,
    limit = 50,
  } = filter;

  // 1. Query characters
  let chars;

  if (character_ids && character_ids.length > 0) {
    let query = supabase
      .from('jgw_characters')
      .select('id, glyph_modern, meaning_en, meaning_zh, visual_description, image_url, pictograph_type')
      .in('id', character_ids);

    if (only_missing) query = query.is('image_url', null);

    const { data, error: qErr } = await query;
    if (qErr) return json({ error: 'query: ' + qErr.message }, 500);
    chars = data || [];
  } else {
    let query = supabase
      .from('jgw_characters')
      .select('id, glyph_modern, meaning_en, meaning_zh, visual_description, image_url, pictograph_type')
      .limit(limit);

    if (hsk_level) query = query.eq('hsk_level', hsk_level);
    if (filter.only_missing !== false) query = query.is('image_url', null);

    if (source_label) {
      const { data: occs } = await supabase
        .from('character_source_occurrences')
        .select('character_id')
        .eq('source_label', source_label);
      const charIds = [...new Set((occs || []).map(o => o.character_id))];
      if (charIds.length === 0) {
        return json({ error: 'no characters for this source' }, 404);
      }
      query = query.in('id', charIds.slice(0, limit));
    }

    const { data, error: qErr } = await query;
    if (qErr) return json({ error: 'query: ' + qErr.message }, 500);
    chars = data || [];
  }

  if (chars.length === 0) {
    return json({ error: 'no characters match filter' }, 404);
  }

  // 2. Create batch job
  const jobLabel = character_ids
    ? `Illustrations: ${chars.length} selected chars`
    : `Illustrations: ${source_label || `HSK ${hsk_level}` || 'filtered'}`;

  const { data: job, error: jobErr } = await supabase
    .from('character_extraction_jobs')
    .insert({
      source_type: 'illustration_batch',
      source_label: jobLabel,
      extraction_method: 'illustration_batch',
      status: 'extracting',
      total_candidates: chars.length,
      total_added: 0,
      config: {
        target_type: 'character',
        mode: character_ids ? 'selected' : 'filter',
        character_count: character_ids?.length,
        filter, provider, style, custom_prompt_template,
      },
    })
    .select()
    .single();

  if (jobErr) return json({ error: 'job: ' + jobErr.message }, 500);

  // 3. Process
  const stylePrompt = CHAR_DEFAULT_STYLE_PROMPTS[style] || CHAR_DEFAULT_STYLE_PROMPTS.simple_pictograms;
  let completed = 0;
  const errors = [];

  for (const char of chars) {
    try {
      const meaningText = char.visual_description || char.meaning_en || char.meaning_zh || '';
      if (!meaningText) {
        errors.push({ char: char.glyph_modern, error: 'no meaning available' });
        continue;
      }

      const prompt = custom_prompt_template
        ? custom_prompt_template.replace('{meaning}', meaningText)
        : `${meaningText}, ${stylePrompt}`;

      const imageBase64 = await generateImage(provider, prompt);
      if (!imageBase64) {
        errors.push({ char: char.glyph_modern, error: 'generation returned no image' });
        continue;
      }

      const path = `char_${char.id}_${style}_${Date.now()}.png`;
      const buffer = Buffer.from(imageBase64, 'base64');

      const { error: upErr } = await supabase.storage
        .from('illustrations')
        .upload(path, buffer, { upsert: true, contentType: 'image/png' });

      if (upErr) {
        errors.push({ char: char.glyph_modern, error: 'upload: ' + upErr.message });
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('illustrations')
        .getPublicUrl(path);

      await supabase
        .from('jgw_characters')
        .update({
          image_url: publicUrl,
          pictograph_type: style,
          updated_at: new Date().toISOString(),
        })
        .eq('id', char.id);

      completed++;
      console.log(`[batch-illust char] ${completed}/${chars.length}: ${char.glyph_modern} -> OK`);

      if (completed % 5 === 0 || completed === chars.length) {
        await supabase
          .from('character_extraction_jobs')
          .update({ total_added: completed })
          .eq('id', job.id);
      }
    } catch (err) {
      console.error(`[batch-illust char] ${char.glyph_modern} error:`, err.message);
      errors.push({ char: char.glyph_modern, error: err.message });
    }
  }

  await supabase
    .from('character_extraction_jobs')
    .update({
      status: 'complete',
      total_added: completed,
      total_skipped: errors.length,
      completed_at: new Date().toISOString(),
      error_message: errors.length > 0
        ? `${errors.length} errors. First: ${errors[0]?.error || ''}`.substring(0, 500)
        : null,
    })
    .eq('id', job.id);

  return json({
    target_type: 'character',
    job_id: job.id,
    total: chars.length,
    completed,
    errors: errors.length,
  });
}

// ─── Word batch (NEW) ─────────────────────────────────────────────────────

async function runWordBatch(body, supabase) {
  const {
    word_ids = null,
    filter = {},
    only_missing = true,
    only_illustratable = true,
    provider = 'stability',
    style = 'flashcard',
  } = body;

  const {
    theme = null,
    limit = 50,
  } = filter;

  // Top-level OR filter-level, default true
  const effectiveOnlyMissing = (word_ids && word_ids.length > 0)
    ? only_missing
    : (filter.only_missing !== false);
  const effectiveOnlyIllustratable = (word_ids && word_ids.length > 0)
    ? only_illustratable
    : (filter.only_illustratable !== false);

  // 1. Query words
  let words;

  if (word_ids && word_ids.length > 0) {
    let query = supabase
      .from('clf_words')
      .select('id, word_zh, pinyin, meaning_en, meaning_zh, image_url, illustratable, theme, hsk_level')
      .in('id', word_ids);

    if (effectiveOnlyMissing)       query = query.is('image_url', null);
    if (effectiveOnlyIllustratable) query = query.neq('illustratable', false);

    const { data, error: qErr } = await query;
    if (qErr) return json({ error: 'query: ' + qErr.message }, 500);
    words = data || [];
  } else {
    let query = supabase
      .from('clf_words')
      .select('id, word_zh, pinyin, meaning_en, meaning_zh, image_url, illustratable, theme, hsk_level')
      .limit(limit);

    if (theme)                       query = query.eq('theme', theme);
    if (effectiveOnlyMissing)        query = query.is('image_url', null);
    if (effectiveOnlyIllustratable)  query = query.neq('illustratable', false);

    const { data, error: qErr } = await query;
    if (qErr) return json({ error: 'query: ' + qErr.message }, 500);
    words = data || [];
  }

  if (words.length === 0) {
    return json({ error: 'no words match filter' }, 404);
  }

  // 2. Resolve prompt template (DB → fallback to code DEFAULT)
  const promptTpl = await resolveWordPromptTemplate(style, supabase);

  // 3. Create batch job
  const jobLabel = (word_ids && word_ids.length > 0)
    ? `Word illustrations: ${words.length} selected`
    : `Word illustrations: ${theme || 'all themes'}`;

  const { data: job, error: jobErr } = await supabase
    .from('character_extraction_jobs')
    .insert({
      source_type: 'word_illustration_batch',
      source_label: jobLabel,
      extraction_method: 'word_illustration_batch',
      status: 'extracting',
      total_candidates: words.length,
      total_added: 0,
      config: {
        target_type: 'word',
        mode: (word_ids && word_ids.length > 0) ? 'selected' : 'filter',
        word_count: word_ids?.length,
        filter, provider, style,
      },
    })
    .select()
    .single();

  if (jobErr) return json({ error: 'job: ' + jobErr.message }, 500);

  // 4. Process
  let completed = 0;
  const errors = [];

  for (const w of words) {
    try {
      const meaning_en = w.meaning_en || w.meaning_zh || '';
      if (!meaning_en) {
        errors.push({ word: w.word_zh, error: 'no meaning available' });
        continue;
      }

      const prompt = promptTpl
        .replaceAll('{word_zh}', w.word_zh || '')
        .replaceAll('{meaning_en}', meaning_en);

      const imageBase64 = await generateImage(provider, prompt);
      if (!imageBase64) {
        errors.push({ word: w.word_zh, error: 'generation returned no image' });
        continue;
      }

      const path = `word_${w.id}_${style}_${Date.now()}.png`;
      const buffer = Buffer.from(imageBase64, 'base64');

      const { error: upErr } = await supabase.storage
        .from('word-illustrations')
        .upload(path, buffer, { upsert: true, contentType: 'image/png' });

      if (upErr) {
        errors.push({ word: w.word_zh, error: 'upload: ' + upErr.message });
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('word-illustrations')
        .getPublicUrl(path);

      await supabase
        .from('clf_words')
        .update({
          image_url: publicUrl,
          // No pictograph_type — that's character-only
        })
        .eq('id', w.id);

      completed++;
      console.log(`[batch-illust word] ${completed}/${words.length}: ${w.word_zh} -> OK`);

      if (completed % 5 === 0 || completed === words.length) {
        await supabase
          .from('character_extraction_jobs')
          .update({ total_added: completed })
          .eq('id', job.id);
      }
    } catch (err) {
      console.error(`[batch-illust word] ${w.word_zh} error:`, err.message);
      errors.push({ word: w.word_zh, error: err.message });
    }
  }

  await supabase
    .from('character_extraction_jobs')
    .update({
      status: 'complete',
      total_added: completed,
      total_skipped: errors.length,
      completed_at: new Date().toISOString(),
      error_message: errors.length > 0
        ? `${errors.length} errors. First: ${errors[0]?.error || ''}`.substring(0, 500)
        : null,
    })
    .eq('id', job.id);

  return json({
    target_type: 'word',
    job_id: job.id,
    total: words.length,
    completed,
    errors: errors.length,
  });
}

// ─── Poem batch (NEW) ─────────────────────────────────────────────────────

async function runPoemBatch(body, supabase) {
  const {
    poem_ids = null,
    filter = {},
    only_missing = true,
    provider = 'stability',
    style = 'ink',
  } = body;

  const {
    dynasty = null,
    type = null,
    limit = 50,
    active_only = true,
  } = filter;

  const effectiveOnlyMissing = (poem_ids && poem_ids.length > 0)
    ? only_missing
    : (filter.only_missing !== false);

  // 1. Query poems
  let poems;

  if (poem_ids && poem_ids.length > 0) {
    let query = supabase
      .from('clf_poems')
      .select('id, title, author, dynasty, type, lines, background_en, image_prompt, image_url, active')
      .in('id', poem_ids);

    if (effectiveOnlyMissing) query = query.is('image_url', null);

    const { data, error: qErr } = await query;
    if (qErr) return json({ error: 'query: ' + qErr.message }, 500);
    poems = data || [];
  } else {
    let query = supabase
      .from('clf_poems')
      .select('id, title, author, dynasty, type, lines, background_en, image_prompt, image_url, active')
      .limit(limit);

    if (dynasty)              query = query.eq('dynasty', dynasty);
    if (type)                 query = query.eq('type', type);
    if (effectiveOnlyMissing) query = query.is('image_url', null);
    if (active_only !== false) query = query.eq('active', true);

    const { data, error: qErr } = await query;
    if (qErr) return json({ error: 'query: ' + qErr.message }, 500);
    poems = data || [];
  }

  if (poems.length === 0) {
    return json({ error: 'no poems match filter' }, 404);
  }

  // 2. Resolve prompt template (DB → fallback to code DEFAULT)
  const promptTpl = await resolvePoemPromptTemplate(style, supabase);

  // 3. Create batch job
  const jobLabel = (poem_ids && poem_ids.length > 0)
    ? `Poem illustrations: ${poems.length} selected`
    : `Poem illustrations: ${dynasty || 'all'}/${type || 'all'}`;

  const { data: job, error: jobErr } = await supabase
    .from('character_extraction_jobs')
    .insert({
      source_type: 'poem_illustration_batch',
      source_label: jobLabel,
      extraction_method: 'poem_illustration_batch',
      status: 'extracting',
      total_candidates: poems.length,
      total_added: 0,
      config: {
        target_type: 'poem',
        mode: (poem_ids && poem_ids.length > 0) ? 'selected' : 'filter',
        poem_count: poem_ids?.length,
        filter, provider, style,
      },
    })
    .select()
    .single();

  if (jobErr) return json({ error: 'job: ' + jobErr.message }, 500);

  // 4. Process each poem
  let completed = 0;
  const errors = [];

  for (const p of poems) {
    try {
      // Build theme hint with same fallback chain as PoetryAdminTab single gen
      const themeHint = p.image_prompt
        || p.background_en
        || (Array.isArray(p.lines) ? p.lines.slice(0, 2).join('. ') : '')
        || `${p.dynasty || 'classical'} dynasty Chinese poem, atmospheric scene`;

      const prompt = promptTpl
        .replaceAll('{title}',      p.title || '')
        .replaceAll('{author}',     p.author || '')
        .replaceAll('{dynasty}',    p.dynasty || '')
        .replaceAll('{theme_hint}', themeHint);

      const imageBase64 = await generateImage(provider, prompt);
      if (!imageBase64) {
        errors.push({ poem: p.title, error: 'generation returned no image' });
        continue;
      }

      const path = `${p.id}_${style}_${Date.now()}.png`;
      const buffer = Buffer.from(imageBase64, 'base64');

      const { error: upErr } = await supabase.storage
        .from('poem-images')
        .upload(path, buffer, { upsert: true, contentType: 'image/png' });

      if (upErr) {
        errors.push({ poem: p.title, error: 'upload: ' + upErr.message });
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('poem-images')
        .getPublicUrl(path);

      await supabase
        .from('clf_poems')
        .update({ image_url: publicUrl })
        .eq('id', p.id);

      completed++;
      console.log(`[batch-illust poem] ${completed}/${poems.length}: ${p.title} -> OK`);

      if (completed % 5 === 0 || completed === poems.length) {
        await supabase
          .from('character_extraction_jobs')
          .update({ total_added: completed })
          .eq('id', job.id);
      }
    } catch (err) {
      console.error(`[batch-illust poem] ${p.title} error:`, err.message);
      errors.push({ poem: p.title, error: err.message });
    }
  }

  await supabase
    .from('character_extraction_jobs')
    .update({
      status: 'complete',
      total_added: completed,
      total_skipped: errors.length,
      completed_at: new Date().toISOString(),
      error_message: errors.length > 0
        ? `${errors.length} errors. First: ${errors[0]?.error || ''}`.substring(0, 500)
        : null,
    })
    .eq('id', job.id);

  return json({
    target_type: 'poem',
    job_id: job.id,
    total: poems.length,
    completed,
    errors: errors.length,
  });
}

// ─── Poem prompt resolver (DB → fallback) ─────────────────────────────────

async function resolvePoemPromptTemplate(style, supabase) {
  try {
    const { data, error } = await supabase
      .from('clf_prompt_templates')
      .select('template')
      .eq('key', `poem_image_${style}`)
      .maybeSingle();
    if (error) throw error;
    if (data?.template) return data.template;
  } catch (e) {
    console.warn(`[batch-illust] DB fetch failed for poem_image_${style}, using code fallback:`, e.message);
  }
  return POEM_DEFAULT_STYLE_PROMPTS[style] || POEM_DEFAULT_STYLE_PROMPTS.ink;
}

// ─── Word prompt resolver (DB → fallback) ─────────────────────────────────

async function resolveWordPromptTemplate(style, supabase) {
  try {
    const { data, error } = await supabase
      .from('clf_prompt_templates')
      .select('template')
      .eq('key', `word_image_${style}`)
      .maybeSingle();
    if (error) throw error;
    if (data?.template) return data.template;
  } catch (e) {
    console.warn(`[batch-illust] DB fetch failed for word_image_${style}, using code fallback:`, e.message);
  }
  return WORD_DEFAULT_STYLE_PROMPTS[style] || WORD_DEFAULT_STYLE_PROMPTS.flashcard;
}

// ─── Image generation (shared) ────────────────────────────────────────────

async function generateImage(provider, prompt) {
  const baseUrl = process.env.URL || 'https://zhongwen-allinone.ci-world.com';

  if (provider === 'stability') {
    const res = await fetch(`${baseUrl}/.netlify/functions/stability-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        negative_prompt: NEGATIVE_PROMPT,
        width: 512,
        height: 512,
      }),
    });

    if (!res.ok) throw new Error(`stability ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.image_base64;
  }

  if (provider === 'dalle3') {
    const res = await fetch(`${baseUrl}/.netlify/functions/ai-gateway`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate_image',
        provider: 'openai',
        prompt,
      }),
    });

    if (!res.ok) throw new Error(`dalle ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (data.image_base64) return data.image_base64;
    if (data.image_url) {
      const imgRes = await fetch(data.image_url);
      const buf = await imgRes.arrayBuffer();
      return Buffer.from(buf).toString('base64');
    }
    throw new Error('no image in dalle response');
  }

  throw new Error('unknown provider: ' + provider);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = { path: '/.netlify/functions/batch-generate-illustrations-background' };

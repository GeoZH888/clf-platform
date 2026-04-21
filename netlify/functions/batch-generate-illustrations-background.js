// netlify/functions/batch-generate-illustrations-background.js
//
// 批量为字符生成插画 (Phase 2C)
// BACKGROUND FUNCTION — 可能运行 10-30 分钟, 取决于字数 + 模型
//
// 输入 (POST body):
//   {
//     filter: {
//       hsk_level: 1,                 // 过滤 HSK 级别
//       source_label: "HSK 1",        // 或按来源过滤  
//       only_missing: true,           // 只给没图的字生成 (默认 true)
//       limit: 50,                    // 最多几张 (默认 50)
//     },
//     provider: 'stability' | 'dalle3',  // 图生成模型
//     style: 'cartoon' | 'simple_pictograms' | ... // 风格
//     custom_prompt_template?: string,   // 自定义 prompt 模板, 用 {meaning} 占位
//   }
//
// 流程:
//   1. 查 jgw_characters 符合 filter 的字
//   2. 创建 batch job (存在 character_extraction_jobs 表里, method='illustration_batch')
//   3. 对每字:
//      - 构造 prompt (meaning-centric)
//      - 调生图 API
//      - 上传到 Storage bucket
//      - UPDATE jgw_characters SET image_url=...
//      - 更新 job.total_added (作为进度计数)
//   4. 完成时 status=complete

import { createClient } from '@supabase/supabase-js';

const DEFAULT_STYLE_PROMPTS = {
  cartoon: 'cartoon illustration, simple, bright colors, child-friendly, white background, for children learning Chinese',
  simple_pictograms: 'simple pictogram illustration, minimal design, white background, single subject, educational for kids',
  watercolor: 'watercolor painting, soft colors, artistic, calligraphy inspired, white background',
  flat: 'flat design illustration, simple shapes, modern, white background',
};

const NEGATIVE_PROMPT = 'text, letters, words, writing, calligraphy, Chinese characters, glyphs, symbols, watermark, signature, logo, multiple subjects, collage, blurry, low quality, distorted, deformed';

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  const {
    character_ids = null,        // 直接指定字符 id (优先)
    filter = {},                  // 或用过滤条件
    only_missing = true,          // 适用于 character_ids 模式
    provider = 'stability',
    style = 'simple_pictograms',
    custom_prompt_template = null,
  } = body;

  const {
    hsk_level = null,
    source_label = null,
    limit = 50,
  } = filter;

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. Query characters to process
  let chars;
  
  if (character_ids && character_ids.length > 0) {
    // 直接指定字符 ID 模式
    let query = supabase
      .from('jgw_characters')
      .select('id, glyph_modern, meaning_en, meaning_zh, visual_description, image_url, pictograph_type')
      .in('id', character_ids);
    
    if (only_missing) query = query.is('image_url', null);
    
    const { data, error: qErr } = await query;
    if (qErr) return json({ error: 'query: ' + qErr.message }, 500);
    chars = data || [];
    
  } else {
    // 过滤模式
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
      total_added: 0,  // 用作进度计数
      config: { 
        mode: character_ids ? 'selected' : 'filter',
        character_count: character_ids?.length,
        filter, provider, style, custom_prompt_template 
      },
    })
    .select()
    .single();

  if (jobErr) return json({ error: 'job: ' + jobErr.message }, 500);

  // 3. Process each character (in background)
  const stylePrompt = DEFAULT_STYLE_PROMPTS[style] || DEFAULT_STYLE_PROMPTS.simple_pictograms;
  let completed = 0;
  const errors = [];
  
  for (const char of chars) {
    try {
      // Build prompt — meaning-centric (not glyph)
      const meaningText = char.visual_description || char.meaning_en || char.meaning_zh || '';
      if (!meaningText) {
        errors.push({ char: char.glyph_modern, error: 'no meaning available' });
        continue;
      }
      
      const prompt = custom_prompt_template
        ? custom_prompt_template.replace('{meaning}', meaningText)
        : `${meaningText}, ${stylePrompt}`;
      
      // Generate
      const imageBase64 = await generateImage(provider, prompt);
      if (!imageBase64) {
        errors.push({ char: char.glyph_modern, error: 'generation returned no image' });
        continue;
      }
      
      // Upload to Storage
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
      
      // Update character
      await supabase
        .from('jgw_characters')
        .update({
          image_url: publicUrl,
          pictograph_type: style,
          updated_at: new Date().toISOString(),
        })
        .eq('id', char.id);
      
      completed++;
      console.log(`[batch-illust] ${completed}/${chars.length}: ${char.glyph_modern} -> OK`);
      
      // Update job progress every 5 chars
      if (completed % 5 === 0 || completed === chars.length) {
        await supabase
          .from('character_extraction_jobs')
          .update({ total_added: completed })
          .eq('id', job.id);
      }
      
    } catch (err) {
      console.error(`[batch-illust] ${char.glyph_modern} error:`, err.message);
      errors.push({ char: char.glyph_modern, error: err.message });
    }
  }

  // 4. Finalize
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
    job_id: job.id,
    total: chars.length,
    completed,
    errors: errors.length,
  });
};

// ─────────────────────────────────────────────────────────────────────
// 生图 — 调 Stability / DALL-E
// ─────────────────────────────────────────────────────────────────────

async function generateImage(provider, prompt) {
  const baseUrl = process.env.URL || 'https://zhongwen-world.netlify.app';
  
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
    // ai-gateway may return image_base64 or url — normalize
    if (data.image_base64) return data.image_base64;
    if (data.image_url) {
      // Fetch the URL and convert to base64
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

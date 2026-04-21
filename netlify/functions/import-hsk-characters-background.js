// netlify/functions/import-hsk-characters-background.js
//
// AI 直接生成 HSK 标准字表 + 填详情 + 入库
// BACKGROUND FUNCTION — 处理多个 level 可能需要 5-15 分钟
// 前端轮询 character_extraction_jobs 看进度
//
// 输入 (POST body):
//   {
//     levels: [1, 2, 3],           // 要导入的 HSK 级别
//     exclude_existing: true,       // 跳过已在库的字 (默认 true)
//     hsk_version: "2021"           // 默认 "2021" 新版标准
//   }
//
// 流程:
//   1. 创建 extraction job (status=extracting)
//   2. 对每个 level, 分批让 Claude 生成字表
//      - 每批 80 字 (token budget)
//      - 每字带 pinyin/strokes/radical/meaning/example
//   3. 收集所有字到 job.candidates (status=ready_for_review)
//   4. 前端可直接确认入库, 或跳过 review 直接 auto-import
//
// 标签: source_label="HSK {level}", subject_slug="hsk", collection_slug="hsk"

import { createClient } from '@supabase/supabase-js';

const HSK_2021_COUNTS = {
  1: 300,   // 新版 HSK 1 约 300 字 (2021 标准)
  2: 300,   // 2 累计 600
  3: 300,   // 3 累计 900
  4: 300,   // 4 累计 1200
  5: 300,   // 5 累计 1500
  6: 300,   // 6 累计 1800
  7: 1200,  // 7-9 累计 3000
};

const BATCH_SIZE = 60;  // Claude 一次生成 60 字

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
    levels = [1],
    exclude_existing = true,
    hsk_version = '2021',
  } = body;

  if (!Array.isArray(levels) || levels.length === 0) {
    return json({ error: 'levels array required' }, 400);
  }

  // 校验级别
  const validLevels = levels.filter(l => l >= 1 && l <= 9);
  if (validLevels.length === 0) {
    return json({ error: 'no valid levels (1-9)' }, 400);
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. 创建 job
  const { data: job, error: jobErr } = await supabase
    .from('character_extraction_jobs')
    .insert({
      source_type: 'hsk_official',
      source_label: `HSK ${validLevels.join(',')} (${hsk_version})`,
      extraction_method: 'hsk_ai',
      status: 'extracting',
      config: { levels: validLevels, hsk_version, exclude_existing },
    })
    .select()
    .single();

  if (jobErr) return json({ error: 'create job: ' + jobErr.message }, 500);

  try {
    // 2. 对每个 level 生成字表
    const allCandidates = [];
    
    for (const level of validLevels) {
      console.log(`[HSK ${level}] generating...`);
      const charsForLevel = await generateHSKLevel(level, hsk_version);
      console.log(`[HSK ${level}] got ${charsForLevel.length} chars`);
      
      for (const c of charsForLevel) {
        allCandidates.push({
          ...c,
          hsk_level: level,           // 保证正确
          level_source: `HSK ${level}`,
          lesson_name: `HSK ${level}`,
        });
      }
    }

    // 3. 去重 (同一字不重复)
    const seen = new Set();
    const unique = [];
    for (const c of allCandidates) {
      if (!seen.has(c.char)) {
        seen.add(c.char);
        unique.push(c);
      }
    }

    // 4. 如果 exclude_existing, 标记已有字符
    if (exclude_existing) {
      const chars = unique.map(c => c.char);
      const { data: existing } = await supabase
        .from('jgw_characters')
        .select('id, glyph_modern')
        .in('glyph_modern', chars);

      const existingMap = new Map();
      (existing || []).forEach(e => existingMap.set(e.glyph_modern, e.id));

      for (const c of unique) {
        c.already_in_db = existingMap.has(c.char);
        c.existing_character_id = existingMap.get(c.char) || null;
      }
    }

    // 5. 更新 job, 状态 ready_for_review
    await supabase
      .from('character_extraction_jobs')
      .update({
        status: 'ready_for_review',
        total_candidates: unique.length,
        candidates: unique,
      })
      .eq('id', job.id);

    return json({
      job_id: job.id,
      total_candidates: unique.length,
      already_in_db_count: unique.filter(c => c.already_in_db).length,
      new_count: unique.filter(c => !c.already_in_db).length,
      levels: validLevels,
    });

  } catch (err) {
    console.error('HSK import error:', err);
    await supabase
      .from('character_extraction_jobs')
      .update({
        status: 'error',
        error_message: err.message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    return json({ error: err.message, job_id: job.id }, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────
// 调 Claude 生成 HSK 级字表 (分批)
// ─────────────────────────────────────────────────────────────────────

async function generateHSKLevel(level, version) {
  const expectedCount = HSK_2021_COUNTS[level] || 300;
  const batches = Math.ceil(expectedCount / BATCH_SIZE);
  
  const allChars = [];
  const seen = new Set();
  
  for (let batchIdx = 0; batchIdx < batches; batchIdx++) {
    const startRank = batchIdx * BATCH_SIZE + 1;
    const endRank = Math.min((batchIdx + 1) * BATCH_SIZE, expectedCount);
    
    try {
      const chars = await generateHSKBatch(level, version, startRank, endRank, [...seen]);
      
      for (const c of chars) {
        if (!seen.has(c.char)) {
          seen.add(c.char);
          allChars.push(c);
        }
      }
      
      console.log(`[HSK ${level}] batch ${batchIdx+1}/${batches}: +${chars.length} (total ${allChars.length})`);
    } catch (err) {
      console.error(`[HSK ${level}] batch ${batchIdx+1} failed:`, err.message);
      // 继续下一批,不让一批失败阻塞全部
    }
  }
  
  return allChars;
}

async function generateHSKBatch(level, version, startRank, endRank, excludeChars) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const excludeNote = excludeChars.length > 0 
    ? `\n\nEXCLUDE these characters (already provided): ${excludeChars.slice(-100).join('、')}`
    : '';

  const prompt = `You are providing HSK ${level} (HSK ${version} standard) character reference data.

Return the next batch of HSK ${level} characters (positions ${startRank}-${endRank} in the frequency-ordered list).
Exclude any character that is in HSK 1-${level-1 > 0 ? level-1 : 1} (only include NEW characters at level ${level}).

Return ONLY a JSON array (no markdown, no explanation). Schema:
[
  {
    "char": "我",
    "pinyin": "wǒ",
    "pinyin_tone": 3,
    "strokes": 7,
    "stroke_count": 7,
    "radical": "戈",
    "meaning_en": "I, me",
    "meaning_zh": "自己；我",
    "example_word_zh": "我们",
    "example_word_en": "we, us",
    "ai_confidence": 0.99
  }
]

Rules:
- pinyin: with tone marks (wǒ not wo3)
- pinyin_tone: 1-5 (neutral=5, 0 if unclear)
- strokes: accurate stroke count
- radical: the 部首 character  
- meaning_en: short (≤ 6 words)
- meaning_zh: Chinese explanation (≤ 10 chars)
- example_word_zh: one common word containing this char
- example_word_en: translation
- ai_confidence: 0.5-1.0${excludeNote}

Provide ~${endRank - startRank + 1} characters starting at rank ${startRank} of HSK ${level}.

JSON:`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API ${res.status}: ${errText.substring(0, 300)}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '[]';

  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]);
    return parsed.filter(item => 
      item && typeof item.char === 'string' && item.char.length === 1
    );
  } catch (err) {
    console.error('Parse error:', err.message);
    return [];
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = { path: '/.netlify/functions/import-hsk-characters-background' };

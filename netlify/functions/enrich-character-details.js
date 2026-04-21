// netlify/functions/enrich-character-details.js
//
// 用 AI 批量填充字符详情 (Phase 1, Step 2/3)
//
// 输入 (POST body):
//   {
//     job_id: string (uuid),
//     characters: ["人", "口", "手"],         // 要填充的字
//     fields_to_fill: ['pinyin', 'strokes', 'radical', 'hsk_level', 
//                      'meaning_en', 'meaning_zh', 'examples'] // 可选, 默认全部
//   }
//
// 输出:
//   {
//     filled: [
//       { char, pinyin, pinyin_tone, strokes, radical, hsk_level,
//         meaning_en, meaning_zh, example_word_zh, example_word_en,
//         ai_confidence, needs_review }
//     ]
//   }
//
// 注意: 本 function 不写数据库 — 只返回 AI 填好的数据.
// 用户审核后, 再调 import-characters-batch 入库.

import { createClient } from '@supabase/supabase-js';

const BATCH_SIZE = 10;             // AI 一次处理 10 个字
const CONCURRENCY = 3;             // 并发多少批
const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

const DEFAULT_FIELDS = [
  'pinyin', 'pinyin_tone', 'strokes', 'radical',
  'hsk_level', 'meaning_en', 'meaning_zh', 'examples'
];

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  const {
    job_id,
    characters,
    fields_to_fill = DEFAULT_FIELDS,
  } = body;

  if (!Array.isArray(characters) || characters.length === 0) {
    return json({ error: 'characters array required' }, 400);
  }

  // 更新 job status
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (job_id) {
    await supabase
      .from('character_extraction_jobs')
      .update({ status: 'enriching' })
      .eq('id', job_id);
  }

  try {
    // 拆成批次
    const batches = [];
    for (let i = 0; i < characters.length; i += BATCH_SIZE) {
      batches.push(characters.slice(i, i + BATCH_SIZE));
    }

    // 并发处理批次
    const allFilled = [];
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const parallelBatches = batches.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        parallelBatches.map(b => enrichBatchWithAI(b, fields_to_fill))
      );
      for (const r of results) allFilled.push(...r);
    }

    // 标记需审核的
    for (const item of allFilled) {
      item.needs_review = (item.ai_confidence || 1) < DEFAULT_CONFIDENCE_THRESHOLD;
    }

    return json({ filled: allFilled });

  } catch (err) {
    console.error('enrich error:', err);
    return json({ error: err.message }, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────
// AI 批量填充
// ─────────────────────────────────────────────────────────────────────

async function enrichBatchWithAI(chars, fields) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const fieldsDesc = describeFields(fields);

  const prompt = `For each Chinese character below, provide accurate reference data.
Return a JSON array (no prose, no markdown fences). Schema:
[
  {
    "char": "人",
    "pinyin": "rén",
    "pinyin_tone": 2,
    "strokes": 2,
    "radical": "人",
    "hsk_level": 1,
    "meaning_en": "person, human",
    "meaning_zh": "人类；个人",
    "example_word_zh": "中国人",
    "example_word_en": "Chinese person",
    "ai_confidence": 0.98
  }
]

Rules:
- pinyin: with tone marks (e.g., "rén" not "ren2")
- pinyin_tone: 1-4 for first-fourth tone, 5 for neutral (soft), 0 if unclear
- strokes: total stroke count (integer)
- radical: the 部首 character
- hsk_level: 1-6 if in HSK, otherwise null
- meaning_en: short English meaning, up to 5 words
- meaning_zh: short Chinese meaning, up to 10 chars
- example_word_zh: ONE common word containing this character
- example_word_en: English translation of that word
- ai_confidence: 0.0-1.0 — your confidence in the data for this char

${fieldsDesc}

CHARACTERS: ${chars.join('、')}

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
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '[]';

  // 提取 JSON (容忍 Claude 偶尔加 markdown 围栏)
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]);
    // 确保每个字只保留一次,且 char 对应输入
    const chars_set = new Set(chars);
    return parsed.filter(item => item && chars_set.has(item.char));
  } catch (err) {
    console.error('JSON parse error:', err.message, 'text:', text.substring(0, 500));
    return [];
  }
}

function describeFields(fields) {
  if (!fields || fields.length === 0) return '';
  const names = {
    pinyin: 'pinyin with tone marks',
    pinyin_tone: 'tone number (1-5)',
    strokes: 'stroke count',
    radical: 'radical (部首)',
    hsk_level: 'HSK level',
    meaning_en: 'English meaning',
    meaning_zh: 'Chinese meaning',
    meaning_it: 'Italian meaning',
    examples: 'example word',
    etymology: 'etymology',
    mnemonic_en: 'memory aid in English',
  };
  return 'Focus on these fields: ' + fields.map(f => names[f] || f).join(', ');
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = { path: '/.netlify/functions/enrich-character-details' };

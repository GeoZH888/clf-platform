// netlify/functions/extract-characters-candidates-background.js
//
// 从 corpus 中找候选字符列表 (Phase 1, Step 1/3)
// BACKGROUND FUNCTION — 立即返回 202 + job_id, 后台处理.
// 前端轮询 character_extraction_jobs.status 看进度.
//
// 输入 (POST body):
//   {
//     source_type: 'corpus_document' | 'corpus_collection' | 'frequency',
//     source_id: string (uuid),
//     extraction_method: 'shizi_biao' | 'frequency' | 'ai_analysis',
//     config: { min_frequency?, max_candidates?, ... }
//   }
//
// 输出:
//   {
//     job_id,
//     total_candidates,
//     candidates: [
//       { char, pinyin_hint, lesson_name, page_num, context_snippet,
//         already_in_db, existing_sources },
//       ...
//     ]
//   }

import { createClient } from '@supabase/supabase-js';

const MAX_CANDIDATES_DEFAULT = 200;
const CHUNKS_PER_RAG_SEARCH = 20;
const SHIZI_SEARCH_TERMS = ['识字表', '生字表', '识字', '生字', '字表', '汉字', '要求会写', '要求会认'];

// Regex 匹配单个 CJK 汉字 (排除标点符号、数字、英文)
const CJK_CHAR_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

// ─────────────────────────────────────────────────────────────────────
// 噪音过滤 — 排除元数据 (封面/版权页/页眉页脚)
// ─────────────────────────────────────────────────────────────────────

// 元数据 chunk 识别词 — 包含这些词的 chunk 很可能是封面/版权/前言
const METADATA_CHUNK_MARKERS = [
  '出版社', '出版发行', '编辑', '主编', '副主编', '责任编辑',
  '图书在版编目', 'CIP 数据', 'CIP数据', 'ISBN',
  '印刷', '印次', '印数', '印张',
  '版次', '第一版', '再版',
  '定价', '售价',
  '书号', '统一书号', '中国版本图书馆',
  '封面设计', '内文设计', '装帧设计',
  '总发行', '经销', '新华书店',
  '版权所有', '侵权必究', '翻印必究',
  '编写说明', '前言', '序言',
];

// 元数据字符黑名单 — 这些字如果是**单独出现**(不在实义词中)通常是噪音
// 注意: 这些字在课文里正常出现时不影响 (如"年"在"去年"中)
const METADATA_WORDS = new Set([
  '出版社', '出版', '版权', '编辑', '主编', '副主编', '责任编辑',
  '印刷', '印次', '印数', '印张',
  '版次', '书号', '定价', '售价',
  '图书', '图书馆', '图书在版编目', '书店',
  '新华书店', '新华', '发行',
  '开本', '字数', '页数',
  '北京', '上海', '广州',
  '有限公司', '公司', 
  '封面', '装帧', '设计',
  '责任', '所有', '必究', '侵权',
  '编者', '作者', '译者',
  '联系', '电话', '邮箱', '邮编',
  '网址', '地址',
]);

// 判断一个 chunk 是否为元数据
function isMetadataChunk(content) {
  if (!content) return true;
  const text = content.replace(/\s/g, '');   // 去掉字间空格
  
  // 检查元数据标记词
  const markerHits = METADATA_CHUNK_MARKERS.filter(m => text.includes(m)).length;
  if (markerHits >= 2) return true;   // 2+ 标记词 → 肯定是元数据
  if (markerHits >= 1 && text.length < 200) return true;  // 短 chunk + 有标记 → 元数据
  
  // 检查 ISBN / CIP 数字串
  if (/\b978[-\s]?\d/.test(text)) return true;   // ISBN
  if (/CIP/.test(text) && /\d{6,}/.test(text)) return true;  // CIP 编号
  
  return false;
}

// 判断一个字符是否为元数据词的一部分
function isMetadataCharacter(char, context) {
  if (!context) return false;
  const text = context.replace(/\s/g, '');
  
  // 在 context 窗口里找这个字, 看它周围的词
  const idx = text.indexOf(char);
  if (idx < 0) return false;
  
  // 取这个字周围 ±6 字窗口
  const window = text.substring(Math.max(0, idx - 6), Math.min(text.length, idx + 7));
  
  // 如果窗口里包含任何元数据词 → 这个字很可能是噪音
  for (const word of METADATA_WORDS) {
    if (window.includes(word)) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────
// 乱码检测 — PDF 字体编码错误产生的假字
// ─────────────────────────────────────────────────────────────────────

// 常见乱码序列 — PDF 内部字体编码错误的典型产物
// 这些字符组合在正常中文里几乎不可能出现
const GARBLED_SEQUENCES = [
  '皂蚤', '蚤佗', '佗燥', '燥赠', '蚤侑', '佟伲', '倮灶', '伽佟',
  '燥曾', '侑赠', '曾蚤', '倮伽',
];

// 判断一个 chunk 是否是乱码 (PDF 字体编码错误)
function isGarbledChunk(content) {
  if (!content) return false;
  const text = content.replace(/\s/g, '');
  
  // 检查乱码序列
  const garbledHits = GARBLED_SEQUENCES.filter(s => text.includes(s)).length;
  if (garbledHits >= 1) return true;
  
  // 检查是否密集 CJK Extension A 字符 (3400-4DBF)
  // 但我们已经用 CJK_CHAR_RE 包含了 3400-4DBF. 这里改成只看基本 CJK 里的"怪字"
  // 简单启发: 如果 chunk 里的"单字符词"比例极高 (如 "A B C D E F"), 可能是乱码
  const chars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || [];
  if (chars.length < 10) return false;
  
  // 基本启发: 如果某 chunk 里 "生僻字" 比例 > 50%, 认为乱码
  const rareCount = chars.filter(c => isRareChar(c)).length;
  if (rareCount / chars.length > 0.5) return true;
  
  return false;
}

// 常用字表 (HSK 1-6 + 常见次常用字, ~3500 字)
// 数据来源: 现代汉语常用字表 + HSK 核心字
// 这里只列最关键的字, 作为快速判断基准
// 完整字表太长, 这里用 Unicode 范围 + 启发式规则代替
function isRareChar(char) {
  if (!char) return false;
  const code = char.charCodeAt(0);
  
  // CJK Extension A (U+3400-U+4DBF): 基本都是生僻字
  if (code >= 0x3400 && code <= 0x4DBF) return true;
  
  // 基本 CJK 区的"末段" (U+9000 以后) 大部分是罕见字
  // 但也有"高"之类的常用字, 所以只过滤更窄
  // U+9FA0-U+9FFF 基本都是罕见字
  if (code >= 0x9FA0 && code <= 0x9FFF) return true;
  
  return false;
}

// ─────────────────────────────────────────────────────────────────────


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
    return json({ error: 'invalid JSON body' }, 400);
  }

  const {
    source_type,
    source_id,
    extraction_method = 'shizi_biao',
    config = {}
  } = body;

  if (!source_type || !source_id) {
    return json({ error: 'source_type and source_id required' }, 400);
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. 创建 job 记录
  const { data: job, error: jobErr } = await supabase
    .from('character_extraction_jobs')
    .insert({
      source_type,
      source_id,
      extraction_method,
      config,
      status: 'extracting',
    })
    .select()
    .single();

  if (jobErr) return json({ error: 'failed to create job: ' + jobErr.message }, 500);

  try {
    // 2. 获取 corpus chunks
    const chunks = await fetchChunks(supabase, source_type, source_id);
    if (chunks.length === 0) {
      await updateJob(supabase, job.id, {
        status: 'error',
        error_message: 'No chunks found for this source',
      });
      return json({ error: 'No corpus chunks found' }, 404);
    }

    // 3. 根据 method 提取候选
    let candidates;
    if (extraction_method === 'shizi_biao') {
      candidates = await extractFromShiziBiao(chunks, supabase);
    } else if (extraction_method === 'frequency') {
      candidates = extractByFrequency(chunks, config);
    } else {
      return json({ error: 'unsupported extraction_method: ' + extraction_method }, 400);
    }

    // 4. 限制候选数量
    const max = config.max_candidates || MAX_CANDIDATES_DEFAULT;
    if (candidates.length > max) {
      candidates = candidates.slice(0, max);
    }

    // 5. 查每个候选是否已在 jgw_characters (批量)
    const chars = [...new Set(candidates.map(c => c.char))];
    const { data: existing } = await supabase
      .from('jgw_characters')
      .select('id, glyph_modern, glyph_trad')
      .or(chars.map(c => `glyph_modern.eq.${c}`).join(','));

    const existingMap = new Map();
    (existing || []).forEach(e => {
      existingMap.set(e.glyph_modern, e.id);
      if (e.glyph_trad) existingMap.set(e.glyph_trad, e.id);
    });

    // 6. 查每个已存在字符的已有来源
    const existingIds = [...new Set([...existingMap.values()])];
    let sourceMap = new Map();
    if (existingIds.length > 0) {
      const { data: sources } = await supabase
        .from('character_source_occurrences')
        .select('character_id, source_label')
        .in('character_id', existingIds);
      
      (sources || []).forEach(s => {
        if (!sourceMap.has(s.character_id)) sourceMap.set(s.character_id, new Set());
        sourceMap.get(s.character_id).add(s.source_label);
      });
    }

    // 7. 合并信息
    for (const cand of candidates) {
      const existingId = existingMap.get(cand.char);
      cand.already_in_db = !!existingId;
      cand.existing_character_id = existingId || null;
      cand.existing_sources = existingId 
        ? [...(sourceMap.get(existingId) || [])]
        : [];
    }

    // 8. 更新 job — 存 candidates, 状态改 ready_for_review
    await updateJob(supabase, job.id, {
      status: 'ready_for_review',
      total_candidates: candidates.length,
      candidates: candidates,
    });

    // 9. 返回
    return json({
      job_id: job.id,
      total_candidates: candidates.length,
      already_in_db_count: candidates.filter(c => c.already_in_db).length,
      new_count: candidates.filter(c => !c.already_in_db).length,
      candidates: candidates,
    });

  } catch (err) {
    console.error('extract error:', err);
    await updateJob(supabase, job.id, {
      status: 'error',
      error_message: err.message,
    });
    return json({ error: err.message, job_id: job.id }, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

async function fetchChunks(supabase, sourceType, sourceId) {
  if (sourceType === 'corpus_document') {
    // 单文档
    const { data, error } = await supabase
      .from('corpus_chunks')
      .select('id, chunk_index, content, metadata')
      .eq('document_id', sourceId)
      .order('chunk_index');
    if (error) throw new Error('fetch chunks: ' + error.message);
    return data || [];
  }

  if (sourceType === 'corpus_collection') {
    // 整个 collection 所有文档
    const { data, error } = await supabase
      .from('corpus_chunks')
      .select('id, chunk_index, content, metadata')
      .eq('collection_id', sourceId)
      .order('chunk_index');
    if (error) throw new Error('fetch chunks: ' + error.message);
    return data || [];
  }

  throw new Error('unsupported source_type: ' + sourceType);
}

// 识字表抽取 — 找 "识字表"/"生字表" 相关 chunks, 用 AI 解析
async function extractFromShiziBiao(chunks, supabase) {
  // 0. 先排除元数据 chunks (封面、版权、前言等) + 乱码 chunks
  const stage1 = chunks.filter(c => !isMetadataChunk(c.content));
  const nonMetaChunks = stage1.filter(c => !isGarbledChunk(c.content));
  console.log(`[shizi] ${chunks.length} total, ${chunks.length - stage1.length} metadata, ${stage1.length - nonMetaChunks.length} garbled filtered`);
  
  // 1. 找包含识字表关键字的 chunks
  const relevantChunks = nonMetaChunks.filter(c => {
    const text = c.content || '';
    return SHIZI_SEARCH_TERMS.some(term => text.includes(term));
  });

  if (relevantChunks.length === 0) {
    // 如果找不到识字表,降级到频率模式
    console.log('no shizi_biao found, falling back to frequency');
    return extractByFrequency(nonMetaChunks, { min_frequency: 3 });
  }

  // 2. 对每个相关 chunk, 让 AI 提取字符列表
  const allCandidates = [];
  const maxChunks = Math.min(relevantChunks.length, 15);
  
  for (let i = 0; i < maxChunks; i++) {
    const chunk = relevantChunks[i];
    try {
      const chars = await parseShiziChunkWithAI(chunk);
      for (const item of chars) {
        // 过滤 AI 可能错误返回的元数据字符
        if (isMetadataCharacter(item.char, chunk.content)) {
          console.log('filter metadata char:', item.char);
          continue;
        }
        // 过滤生僻字
        if (isRareChar(item.char)) {
          console.log('filter rare char:', item.char);
          continue;
        }
        allCandidates.push({
          char: item.char,
          pinyin_hint: item.pinyin || null,
          lesson_name: item.lesson || `chunk ${chunk.chunk_index}`,
          page_num: item.page || null,
          context_snippet: chunk.content.substring(0, 150),
          chunk_id: chunk.id,
        });
      }
    } catch (err) {
      console.log('AI parse failed for chunk', chunk.chunk_index, ':', err.message);
    }
  }

  // 3. 去重 (同一字符只保留第一条)
  const seen = new Set();
  const unique = [];
  for (const c of allCandidates) {
    if (!seen.has(c.char)) {
      seen.add(c.char);
      unique.push(c);
    }
  }

  return unique;
}

// 让 Claude 解析 chunk, 提取字符列表
async function parseShiziChunkWithAI(chunk) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const prompt = `You are parsing a Chinese textbook page to extract the "识字表" (character list for learning).

Below is text from a Chinese textbook. Find all the characters listed as 识字 (characters to learn).
Return ONLY a JSON array of objects, no explanation. Schema:
[{"char": "人", "pinyin": "rén", "lesson": "第1课"}, ...]

CRITICAL RULES — EXCLUDE:
- Publisher metadata: 出版社, 编辑, 主编, 责任编辑, 印刷, 印张, 印次, 印数, 版次
- Book metadata: 图书, 书店, 书号, ISBN, CIP, 定价, 售价, 版权
- Addresses/companies: 公司, 有限公司, 北京, 上海, 发行
- Anything clearly part of a colophon, copyright page, or CIP block

INCLUDE only:
- Characters from 识字表/生字表 sections
- Characters explicitly labeled as 要求会写 / 要求会认 / 识字
- Actual lesson content characters (课文)

Other rules:
- If no clear 识字表 is found, return [].
- Only include single Chinese characters (no multi-char words, no punctuation).
- If the chunk has character spacing like "人 口 手", that's a character list — extract each.
- If you see lesson numbers like "第1课" or "课1", include them.

TEXT:
${chunk.content.substring(0, 4000)}

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
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error('claude api: ' + res.status);
  const data = await res.json();
  const text = data.content?.[0]?.text || '[]';
  
  // 提取 JSON
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  
  try {
    const parsed = JSON.parse(match[0]);
    // Sanity check: each item must have a valid single CJK char
    return parsed.filter(item => 
      item && typeof item.char === 'string' && 
      item.char.length === 1 && 
      CJK_CHAR_RE.test(item.char)
    );
  } catch {
    return [];
  }
}

// 频率抽取 — 扫描所有 chunks, 统计每个汉字出现次数
function extractByFrequency(chunks, config) {
  const minFreq = config.min_frequency || 5;
  
  // 统计所有汉字的出现次数
  const freqMap = new Map();  // char -> { count, first_chunk }
  
  // 先过滤元数据 chunks
  const stage1 = chunks.filter(c => !isMetadataChunk(c.content));
  // 再过滤乱码 chunks (PDF 字体编码错误)
  const stage2 = stage1.filter(c => !isGarbledChunk(c.content));
  console.log(`[freq] ${chunks.length} total, ${chunks.length - stage1.length} metadata, ${stage1.length - stage2.length} garbled filtered`);
  
  for (const chunk of stage2) {
    const text = chunk.content || '';
    const chars = text.match(CJK_CHAR_RE) || [];
    for (const c of chars) {
      // 过滤乱码/生僻字
      if (isRareChar(c)) continue;
      
      if (!freqMap.has(c)) {
        freqMap.set(c, { count: 0, first_chunk: chunk });
      }
      freqMap.get(c).count++;
    }
  }

  // 过滤 + 排序 (高频在前)
  const candidates = [];
  for (const [char, info] of freqMap.entries()) {
    if (info.count >= minFreq) {
      // 过滤元数据字符 (如果该字符出现的上下文都是元数据词里的)
      if (isMetadataCharacter(char, info.first_chunk.content)) {
        continue;
      }
      candidates.push({
        char,
        pinyin_hint: null,
        lesson_name: `frequency (${info.count}x)`,
        page_num: null,
        context_snippet: info.first_chunk.content.substring(0, 100),
        chunk_id: info.first_chunk.id,
        frequency: info.count,
      });
    }
  }

  candidates.sort((a, b) => (b.frequency || 0) - (a.frequency || 0));
  return candidates;
}

async function updateJob(supabase, jobId, fields) {
  await supabase
    .from('character_extraction_jobs')
    .update({
      ...fields,
      ...(fields.status === 'complete' || fields.status === 'error' 
        ? { completed_at: new Date().toISOString() }
        : {}),
    })
    .eq('id', jobId);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = { path: '/.netlify/functions/extract-characters-candidates-background' };

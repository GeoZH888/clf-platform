// netlify/functions/parse-manual-characters.js
//
// 解析管理员手动输入的字符 (三种输入类型)
// SYNC function — 快速响应 (不需要 AI, 只解析文本)
//
// 输入 (POST body):
//   {
//     input_type: 'list' | 'csv' | 'text',
//     raw_text: string,
//     source_label: "Geo 2026 家庭字" (可选, 用户自己标)
//   }
//
// list 格式: 一行一字 或 逗号/空格分隔
//   例: "人口手" 或 "人\n口\n手" 或 "人, 口, 手"
//
// csv 格式: 第一列 char, 其他列可选 (pinyin/meaning_en/hsk_level)
//   例:
//     char,pinyin,meaning_en
//     人,rén,person
//     口,kǒu,mouth
//
// text 格式: 任意中文文本, 提取所有唯一汉字
//   例: 整段课文 "今天我去学校..."
//
// 输出:
//   {
//     characters: [
//       { char, pinyin?, meaning_en?, hsk_level? },
//       ...
//     ],
//     stats: { total_extracted, duplicates_removed, warnings: [] }
//   }

const CJK_CHAR_RE = /[\u4e00-\u9fff]/g;

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

  const { input_type, raw_text, source_label } = body;
  
  if (!raw_text || typeof raw_text !== 'string') {
    return json({ error: 'raw_text required' }, 400);
  }

  let result;
  try {
    if (input_type === 'list') {
      result = parseList(raw_text);
    } else if (input_type === 'csv') {
      result = parseCSV(raw_text);
    } else if (input_type === 'text') {
      result = parseFreeText(raw_text);
    } else {
      return json({ error: `unknown input_type: ${input_type}` }, 400);
    }

    return json({
      characters: result.characters,
      stats: {
        total_extracted: result.characters.length,
        duplicates_removed: result.duplicatesRemoved,
        warnings: result.warnings,
      },
      source_label: source_label || '手动导入',
    });
  } catch (err) {
    return json({ error: err.message }, 400);
  }
};

// ─────────────────────────────────────────────────────────────────────
// 解析: 列表格式 — 用户粘贴一串字符
// ─────────────────────────────────────────────────────────────────────

function parseList(text) {
  const chars = new Set();
  const warnings = [];
  let duplicatesRemoved = 0;
  
  // 按多种分隔符 split: 换行、逗号、空格、中文标点
  const tokens = text.split(/[\s,，、；;]+/).filter(t => t.length > 0);
  
  for (const token of tokens) {
    // 每个 token 里再提取汉字
    const matches = token.match(CJK_CHAR_RE) || [];
    for (const c of matches) {
      if (chars.has(c)) {
        duplicatesRemoved++;
      } else {
        chars.add(c);
      }
    }
  }
  
  if (chars.size === 0) {
    warnings.push('未找到任何汉字');
  }
  
  return {
    characters: [...chars].map(char => ({ char })),
    duplicatesRemoved,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 解析: CSV 格式 — 第一列 char, 其他列可选
// ─────────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) {
    return { characters: [], duplicatesRemoved: 0, warnings: ['空 CSV'] };
  }
  
  // Parse header
  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const charIdx = header.findIndex(h => h === 'char' || h === 'character' || h === '字');
  
  if (charIdx < 0) {
    return { 
      characters: [], 
      duplicatesRemoved: 0, 
      warnings: ['CSV 第一行必须是表头, 且必须含 "char" 或 "字" 列'] 
    };
  }
  
  const pinyinIdx = header.findIndex(h => h === 'pinyin' || h === '拼音');
  const meaningEnIdx = header.findIndex(h => h === 'meaning_en' || h === 'meaning' || h === '意思');
  const meaningZhIdx = header.findIndex(h => h === 'meaning_zh' || h === '释义');
  const hskIdx = header.findIndex(h => h === 'hsk_level' || h === 'hsk' || h === 'level');
  
  const seen = new Set();
  const chars = [];
  let duplicatesRemoved = 0;
  const warnings = [];
  
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const rawChar = (cols[charIdx] || '').trim();
    
    // 取第一个汉字 (防止 "人x" 这种)
    const match = rawChar.match(CJK_CHAR_RE);
    if (!match) {
      warnings.push(`第 ${i+1} 行: "${rawChar}" 不是有效汉字`);
      continue;
    }
    const char = match[0];
    
    if (seen.has(char)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(char);
    
    const entry = { char };
    if (pinyinIdx >= 0 && cols[pinyinIdx]) entry.pinyin = cols[pinyinIdx].trim();
    if (meaningEnIdx >= 0 && cols[meaningEnIdx]) entry.meaning_en = cols[meaningEnIdx].trim();
    if (meaningZhIdx >= 0 && cols[meaningZhIdx]) entry.meaning_zh = cols[meaningZhIdx].trim();
    if (hskIdx >= 0 && cols[hskIdx]) {
      const lv = parseInt(cols[hskIdx]);
      if (!isNaN(lv) && lv >= 1 && lv <= 9) entry.hsk_level = lv;
    }
    
    chars.push(entry);
  }
  
  if (chars.length === 0 && warnings.length === 0) {
    warnings.push('CSV 里没有找到有效的汉字行');
  }
  
  return { characters: chars, duplicatesRemoved, warnings };
}

function parseCSVLine(line) {
  // 简单 CSV 解析, 支持引号包裹
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && (i === 0 || line[i-1] !== '\\')) {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

// ─────────────────────────────────────────────────────────────────────
// 解析: 自由文本 — 提取所有唯一汉字
// ─────────────────────────────────────────────────────────────────────

function parseFreeText(text) {
  const seen = new Set();
  const chars = [];
  let duplicatesRemoved = 0;
  
  const matches = text.match(CJK_CHAR_RE) || [];
  for (const c of matches) {
    if (seen.has(c)) {
      duplicatesRemoved++;
    } else {
      seen.add(c);
      chars.push({ char: c });
    }
  }
  
  const warnings = [];
  if (chars.length === 0) {
    warnings.push('文本里没有汉字');
  } else if (chars.length > 500) {
    warnings.push(`提取到 ${chars.length} 个独立字符, 建议审核`);
  }
  
  return { characters: chars, duplicatesRemoved, warnings };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = { path: '/.netlify/functions/parse-manual-characters' };

// netlify/functions/process-zip-corpus-background.js
//
// BACKGROUND FUNCTION — extracts a ZIP in Supabase Storage, walks every
// file inside, uses folder path + filename + AI to auto-detect subject/grade,
// creates a corpus_documents row for each, and fires process-document-background
// for each individual file.
//
// Request body:
//   {
//     zip_storage_path: "renjiao/2025-01-01_textbooks.zip",
//     collection_id:    "uuid",
//     auto_detect:      true  // use AI to guess subject/grade from path
//   }
//
// Returns: 202 immediately, status tracked via a parent corpus_documents row.

import { createClient } from '@supabase/supabase-js';
import AdmZip from 'adm-zip';

const SUPPORTED_EXTS = ['pdf','docx','doc','xlsx','xls','txt','json','csv','md'];

const MIME_BY_EXT = {
  pdf:  'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc:  'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls:  'application/vnd.ms-excel',
  txt:  'text/plain',
  md:   'text/markdown',
  json: 'application/json',
  csv:  'text/csv',
};

// ── Rule-based subject detection from path ──────────────────────────────
// Fast first pass before consulting AI
const SUBJECT_PATTERNS = [
  { slug: 'yuwen',    zh: '语文',  patterns: [/语文|yuwen|chinese.*language|汉语/i] },
  { slug: 'shuxue',   zh: '数学',  patterns: [/数学|shuxue|math/i] },
  { slug: 'yingyu',   zh: '英语',  patterns: [/英语|yingyu|english/i] },
  { slug: 'kexue',    zh: '科学',  patterns: [/科学|kexue|science/i] },
  { slug: 'lishi',    zh: '历史',  patterns: [/历史|lishi|history/i] },
  { slug: 'dili',     zh: '地理',  patterns: [/地理|dili|geography/i] },
  { slug: 'yinyue',   zh: '音乐',  patterns: [/音乐|yinyue|music/i] },
  { slug: 'meishu',   zh: '美术',  patterns: [/美术|meishu|art/i] },
  { slug: 'tiyu',     zh: '体育',  patterns: [/体育|tiyu|physical.*ed|p\.?e\b/i] },
  { slug: 'hsk',      zh: 'HSK',   patterns: [/\bhsk\b/i] },
  { slug: 'chengyu',  zh: '成语',  patterns: [/成语|chengyu|idiom/i] },
  { slug: 'wenhua',   zh: '文化',  patterns: [/文化|wenhua|culture/i] },
  { slug: 'wenxue',   zh: '文学',  patterns: [/文学|wenxue|literature/i] },
  { slug: 'shige',    zh: '诗歌',  patterns: [/诗歌|shige|poetry|古诗/i] },
  { slug: 'hanzi',    zh: '汉字',  patterns: [/汉字|hanzi|character/i] },
];

// ── Rule-based grade detection from path ────────────────────────────────
const GRADE_PATTERNS = [
  // Chinese primary grades
  { pattern: /一年级\s*上/i,  grade: '一年级上册' },
  { pattern: /一年级\s*下/i,  grade: '一年级下册' },
  { pattern: /二年级\s*上/i,  grade: '二年级上册' },
  { pattern: /二年级\s*下/i,  grade: '二年级下册' },
  { pattern: /三年级\s*上/i,  grade: '三年级上册' },
  { pattern: /三年级\s*下/i,  grade: '三年级下册' },
  { pattern: /四年级\s*上/i,  grade: '四年级上册' },
  { pattern: /四年级\s*下/i,  grade: '四年级下册' },
  { pattern: /五年级\s*上/i,  grade: '五年级上册' },
  { pattern: /五年级\s*下/i,  grade: '五年级下册' },
  { pattern: /六年级\s*上/i,  grade: '六年级上册' },
  { pattern: /六年级\s*下/i,  grade: '六年级下册' },
  { pattern: /七年级\s*上/i,  grade: '七年级上册' },
  { pattern: /七年级\s*下/i,  grade: '七年级下册' },
  { pattern: /八年级\s*上/i,  grade: '八年级上册' },
  { pattern: /八年级\s*下/i,  grade: '八年级下册' },
  { pattern: /九年级\s*上/i,  grade: '九年级上册' },
  { pattern: /九年级\s*下/i,  grade: '九年级下册' },
  // HSK levels 1-9 (new standard)
  { pattern: /hsk\s*[- ]?\s*([1-9])/i,  grade: (m) => `HSK ${m[1]}` },
  // High school
  { pattern: /高一/i,  grade: '高一' },
  { pattern: /高二/i,  grade: '高二' },
  { pattern: /高三/i,  grade: '高三' },
  // Chapter/lesson (fallback — gets stored in metadata not grade)
];

function detectSubjectFromPath(path) {
  const full = path.toLowerCase();
  for (const s of SUBJECT_PATTERNS) {
    if (s.patterns.some(p => p.test(full))) return s.slug;
  }
  return null;
}

function detectGradeFromPath(path) {
  for (const g of GRADE_PATTERNS) {
    const m = path.match(g.pattern);
    if (m) return typeof g.grade === 'function' ? g.grade(m) : g.grade;
  }
  return null;
}

// ── AI fallback detection (for ambiguous file names) ────────────────────
async function aiDetectMetadata(fileName, folderPath, apiKey) {
  if (!apiKey) return { subject: null, grade: null };
  try {
    const prompt = `Analyze this Chinese education file path and suggest subject and grade level.

File path: ${folderPath}/${fileName}

Return ONLY a JSON object (no markdown, no explanation):
{"subject_slug": "...", "grade_level": "..."}

Valid subject_slug values: yuwen, shuxue, yingyu, kexue, lishi, dili, yinyue, meishu, tiyu, hsk, chengyu, wenhua, wenxue, shige, hanzi
Valid grade_level examples: "一年级上册", "二年级下册", "HSK 4", "高一", or null if unclear

Use null for either field if you can't determine confidently.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return { subject: null, grade: null };
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { subject: null, grade: null };
    const parsed = JSON.parse(match[0]);
    return {
      subject: parsed.subject_slug || null,
      grade: parsed.grade_level || null,
    };
  } catch {
    return { subject: null, grade: null };
  }
}

// ── MAIN HANDLER ────────────────────────────────────────────────────────
export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing Supabase env vars' }) };
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { zip_storage_path, collection_id, auto_detect = true } = body;
  if (!zip_storage_path || !collection_id) {
    return {
      statusCode: 400, headers,
      body: JSON.stringify({ error: 'Need zip_storage_path and collection_id' }),
    };
  }

  // Get collection slug for storage paths
  const { data: coll } = await supabase.from('corpus_collections')
    .select('slug').eq('id', collection_id).single();
  if (!coll) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Collection not found' }) };
  }

  try {
    // 1. Download ZIP from Storage
    const { data: blob, error: dlErr } = await supabase.storage
      .from('corpus-files').download(zip_storage_path);
    if (dlErr) throw new Error(`Download ZIP: ${dlErr.message}`);

    const buffer = Buffer.from(await blob.arrayBuffer());
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries().filter(e => !e.isDirectory);

    if (entries.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'ZIP is empty' }) };
    }

    // 2. Process each file inside the ZIP
    const results = { total: entries.length, created: 0, skipped: 0, errors: [] };

    for (const entry of entries) {
      try {
        const fullPath = entry.entryName;  // e.g. '人教版语文/一年级上册/第1课.pdf'

        // Skip hidden/system files
        const baseName = fullPath.split('/').pop();
        if (baseName.startsWith('.') || baseName.startsWith('__MACOSX')) {
          results.skipped++; continue;
        }

        const ext = baseName.toLowerCase().split('.').pop();
        if (!SUPPORTED_EXTS.includes(ext)) {
          results.skipped++; continue;
        }

        // 3. Detect subject + grade from path
        const folderPath = fullPath.substring(0, fullPath.lastIndexOf('/')) || '';
        let subject = detectSubjectFromPath(fullPath);
        let grade   = detectGradeFromPath(fullPath);

        // 4. AI fallback for ambiguous cases
        if (auto_detect && ANTHROPIC_KEY && (!subject || !grade)) {
          const ai = await aiDetectMetadata(baseName, folderPath, ANTHROPIC_KEY);
          if (!subject) subject = ai.subject;
          if (!grade)   grade   = ai.grade;
        }

        // 5. Upload the extracted file to Storage with safe path
        const fileData = entry.getData();
        const safeBase = baseName.replace(/[^\w.\-]/g, '_');
        const storagePath = `${coll.slug}/${Date.now()}_${results.created}_${safeBase}`;
        const mimeType = MIME_BY_EXT[ext] || 'application/octet-stream';

        const { error: upErr } = await supabase.storage
          .from('corpus-files')
          .upload(storagePath, fileData, { contentType: mimeType, upsert: false });
        if (upErr) {
          results.errors.push({ file: fullPath, error: upErr.message });
          continue;
        }

        // 6. Create document row with AI-detected metadata
        const { data: doc, error: docErr } = await supabase.from('corpus_documents')
          .insert({
            collection_id,
            title:         baseName.replace(/\.\w+$/, ''),
            storage_path:  storagePath,
            file_size:     fileData.length,
            mime_type:     mimeType,
            subject_slug:  subject,
            grade_level:   grade,
            status:        'pending',
            status_message: `来自 ZIP: ${folderPath || '(root)'}`,
          })
          .select()
          .single();

        if (docErr) {
          results.errors.push({ file: fullPath, error: docErr.message });
          continue;
        }

        // 7. Fire off individual processing (fire-and-forget background)
        fetch(`${process.env.URL || 'https://zhongwen-world.netlify.app'}/.netlify/functions/process-document-background`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_id:   doc.id,
            storage_path:  storagePath,
            mime_type:     mimeType,
            collection_id,
          }),
        }).catch(() => { /* fire and forget */ });

        results.created++;

        // Small delay to avoid overwhelming downstream
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        results.errors.push({ file: entry.entryName, error: err.message });
      }
    }

    // 8. Clean up ZIP file from storage (it's been extracted)
    await supabase.storage.from('corpus-files').remove([zip_storage_path]);

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, ...results }),
    };

  } catch (err) {
    console.error('process-zip-corpus error:', err);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

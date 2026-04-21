// netlify/functions/process-document-background.js
//
// BACKGROUND FUNCTION (15-min timeout) with smart hybrid OCR.
//
// PDF processing strategy:
//   1. Try pdf2json to extract text from each page
//   2. Pages with < MIN_TEXT_PER_PAGE chars → rendered to PNG and OCR'd
//   3. Pages with enough text → kept as-is
//
// OCR provider is auto-detected from env vars (aliyun preferred, tencent fallback).
// If no OCR provider configured, pages without text are logged as '[image page N]'
// so the document can still be chunked/embedded with partial content.
//
// The client receives an immediate 202 Accepted response.
// The real completion signal is the status field in corpus_documents (polled by UI).
//
// Processes a previously-uploaded document in Supabase Storage:
//   1. Downloads file from storage-path
//   2. Extracts text (PDF/DOCX/XLSX/TXT)
//   3. Chunks into ~800-char pieces with paragraph/chapter metadata
//   4. Calls Voyage for 1024-dim embeddings (batch 32)
//   5. Writes chunks + embeddings to corpus_chunks
//
// Frontend calls this AFTER uploading to Supabase Storage with service-role auth.
//
// Request body:
//   {
//     document_id: "uuid",      // already created row in corpus_documents
//     storage_path: "renjiao/grade3_vol1.pdf",
//     mime_type:   "application/pdf",
//     collection_id: "uuid"
//   }
//
// Returns: { success, chunk_count, processed_at, error? }

// NOTE: OCR rendering currently disabled — canvas/pdf-to-img had serverless
// dependency issues. Scanned pages will get placeholders instead of text.
// To re-enable OCR later: use a WebAssembly-based renderer like mupdf-js.

import { createClient } from '@supabase/supabase-js';
import { ocrPageImage, isOcrAvailable, getActiveProvider } from './ocr/ocr-router.js';

// Lazy imports — only load parser libs when actually needed
async function parseContent(buffer, mimeType) {
  // PDF — smart hybrid: try text extraction first, OCR pages that lack text
  if (mimeType === 'application/pdf') {
    return await parsePdfHybrid(buffer);
  }

  // DOCX
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = (await import('mammoth')).default;
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, pages: null };
  }

  // XLSX / XLS — extract cell text, one "sheet · row" per line
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) {
    const XLSX = (await import('xlsx')).default;
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const lines = [];
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      for (const row of rows) {
        const rowText = row.filter(cell => String(cell).trim()).join(' · ');
        if (rowText) lines.push(`[${sheetName}] ${rowText}`);
      }
    }
    return { text: lines.join('\n'), pages: null };
  }

  // Plain text / CSV / JSON
  if (mimeType?.startsWith('text/') || mimeType === 'application/json') {
    return { text: buffer.toString('utf-8'), pages: null };
  }

  throw new Error(`Unsupported mime type: ${mimeType}`);
}

// ── Chunk with structural awareness ─────────────────────────────────────
// Splits on Chinese/English paragraphs, preserving chapter/section headings
// seen in text (lines like "第三课 美丽的自然" or "Chapter 3 ...").
function chunkText(fullText, maxChars = 800, minChars = 200) {
  const lines = fullText.split(/\r?\n/).map(l => l.trim());
  const chunks = [];
  let current = { content: '', chapter: null, chapter_num: null, section: null, section_num: null };
  let charOffset = 0;

  // Regex for Chinese headings
  const chapterRe = /^第\s*([一二三四五六七八九十百\d]+)\s*[课章讲节单元]\s*(.+)?$/;
  const sectionRe = /^(\d+)[.、)]\s*(.+)$/;
  const engChapterRe = /^Chapter\s+(\d+)[:\.]?\s*(.*)$/i;

  function flush() {
    const content = current.content.trim();
    if (content.length >= minChars) {
      chunks.push({
        content,
        metadata: {
          chapter: current.chapter,
          chapter_num: current.chapter_num,
          section: current.section,
          section_num: current.section_num,
          char_start: charOffset - content.length,
          char_end: charOffset,
        },
      });
    }
    current.content = '';
  }

  for (const line of lines) {
    charOffset += line.length + 1;

    // Detect chapter heading
    const chMatch = line.match(chapterRe) || line.match(engChapterRe);
    if (chMatch) {
      flush();
      current.chapter = line;
      current.chapter_num = parseChineseNumber(chMatch[1]);
      current.section = null;
      current.section_num = null;
      continue;
    }

    // Detect section heading
    const secMatch = line.match(sectionRe);
    if (secMatch && line.length < 40) {
      flush();
      current.section = line;
      current.section_num = parseInt(secMatch[1]);
      continue;
    }

    // Add line to current chunk
    if (current.content.length + line.length > maxChars && current.content.length >= minChars) {
      flush();
    }
    current.content += (current.content ? '\n' : '') + line;
  }
  flush();

  return chunks;
}

function parseChineseNumber(s) {
  if (!s) return null;
  const n = parseInt(s);
  if (!isNaN(n)) return n;
  const map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,
                '十一':11,'十二':12,'十三':13,'十四':14,'十五':15,'二十':20,'三十':30 };
  return map[s] || null;
}

// ── Hybrid PDF parser (text + OCR fallback per-page) ──────────────────
const MIN_TEXT_PER_PAGE = 80;   // less than this → assume scanned, OCR it
const MAX_OCR_PAGES     = 400;  // safety cap per document

// Safe decodeURIComponent — some PDFs have malformed percent-encoded chars
// (e.g. scanned pages with corrupt font references). Instead of crashing,
// we decode what we can and keep the raw string for the rest.
function safeDecodeURIComponent(str) {
  if (!str) return '';
  try {
    return decodeURIComponent(str);
  } catch {
    // Decode character-by-character, keep the raw byte if one fails
    return str.replace(/%[0-9A-Fa-f]{2}/g, (m) => {
      try { return decodeURIComponent(m); }
      catch { return m; }
    });
  }
}

async function parsePdfHybrid(buffer) {
  const PDFParser = (await import('pdf2json')).default;

  // First pass: extract text per-page from pdf2json
  const textByPage = await new Promise((resolve, reject) => {
    const parser = new PDFParser(null, 1);
    parser.on('pdfParser_dataError', err => reject(new Error(err.parserError || 'PDF parse failed')));
    parser.on('pdfParser_dataReady', () => {
      try {
        const pages = parser.data?.Pages || [];
        const rawAll = (() => {
          try { return parser.getRawTextContent() || ''; }
          catch { return ''; }  // some corrupt PDFs throw here too
        })();
        const pageTexts = rawAll.split(/\x0c/).map(t => t.trim());
        if (pageTexts.length < pages.length || rawAll.length === 0) {
          // Fallback: walk the per-page structure manually, skipping bad chars
          const alt = pages.map(p =>
            (p.Texts || []).map(t =>
              (t.R || []).map(r => safeDecodeURIComponent(r.T || '')).join('')
            ).join(' ')
          );
          resolve({ pages: alt, pageCount: pages.length });
          return;
        }
        resolve({ pages: pageTexts.slice(0, pages.length), pageCount: pages.length });
      } catch (e) { reject(e); }
    });
    parser.parseBuffer(buffer);
  });

  const { pages: textPages, pageCount } = textByPage;

  // Identify pages needing OCR
  const pagesToOcr = [];
  const finalPages = new Array(pageCount);
  for (let i = 0; i < pageCount; i++) {
    const text = (textPages[i] || '').trim();
    if (text.length >= MIN_TEXT_PER_PAGE) {
      finalPages[i] = text;
    } else {
      pagesToOcr.push(i);
    }
  }

  // If no OCR needed, we're done
  if (pagesToOcr.length === 0) {
    return { text: finalPages.join('\n\n'), pages: pageCount, ocr_pages: 0 };
  }

  // OCR needed but no provider configured → leave placeholders
  if (!isOcrAvailable()) {
    console.log(`⚠ ${pagesToOcr.length} pages need OCR but no provider configured`);
    for (const i of pagesToOcr) {
      finalPages[i] = `[image-only page ${i + 1} — OCR not configured]`;
    }
    return {
      text: finalPages.join('\n\n'),
      pages: pageCount,
      ocr_pages: 0,
      ocr_skipped: pagesToOcr.length,
    };
  }

  // OCR temporarily disabled — falling back to placeholders
  // (canvas/pdf-to-img serverless deps are unstable)
  console.log(`Skipping OCR for ${pagesToOcr.length} pages (OCR renderer disabled)`);
  for (const i of pagesToOcr) {
    finalPages[i] = `[image-only page ${i + 1} — OCR disabled, render with external tool]`;
  }
  return {
    text: finalPages.join('\n\n'),
    pages: pageCount,
    ocr_pages: 0,
    ocr_skipped: pagesToOcr.length,
  };

}


// ── Voyage embeddings ─────────────────────────────────────────────────
async function embedBatch(texts, apiKey, maxRetries = 4) {
  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
        model: 'voyage-3',
        input_type: 'document',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.data.map(d => d.embedding);
    }
    const err = await res.text();
    lastErr = `Voyage API ${res.status}: ${err.slice(0, 200)}`;
    // On 429 (rate limit), wait 20s / 25s / 30s / 35s and retry
    if (res.status === 429 && attempt < maxRetries) {
      const waitMs = 20000 + attempt * 5000;
      console.log(`Rate limit hit, waiting ${waitMs}ms before retry ${attempt + 1}/${maxRetries}`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    // Other errors or max retries exceeded — throw
    throw new Error(lastErr);
  }
  throw new Error(lastErr || 'Max retries exceeded');
}

// Simple SHA-256 for dedup
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────
export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const VOYAGE_KEY   = process.env.VOYAGE_API_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY || !VOYAGE_KEY) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({
        error: 'Missing env: needs VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VOYAGE_API_KEY',
      }),
    };
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { document_id, storage_path, mime_type, collection_id } = body;
  if (!document_id || !storage_path) {
    return {
      statusCode: 400, headers,
      body: JSON.stringify({ error: 'Need document_id and storage_path' }),
    };
  }

  try {
    // Update status → processing
    await supabase.from('corpus_documents')
      .update({ status: 'processing', status_message: 'Downloading…' })
      .eq('id', document_id);

    // 1. Download file from Supabase Storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('corpus-files')
      .download(storage_path);
    if (dlErr) throw new Error(`Download: ${dlErr.message}`);

    const buffer = Buffer.from(await fileData.arrayBuffer());
    await supabase.from('corpus_documents')
      .update({ status_message: `Parsing ${(buffer.length/1024/1024).toFixed(1)}MB…` })
      .eq('id', document_id);

    // 2. Extract text (with OCR if needed for scanned pages)
    const parseResult = await parseContent(buffer, mime_type);
    const { text, pages, ocr_pages, ocr_failed, ocr_skipped } = parseResult;

    if (!text || text.trim().length < 50) {
      throw new Error('Extracted text too short — document may be blank or unreadable');
    }

    // Log OCR stats if applicable
    if (ocr_pages > 0 || ocr_skipped > 0) {
      const ocrMsg = `OCR: ${ocr_pages || 0} ok, ${ocr_failed || 0} failed, ${ocr_skipped || 0} skipped`;
      await supabase.from('corpus_documents')
        .update({ status_message: ocrMsg })
        .eq('id', document_id);
    }

    // 3. Chunk
    const chunks = chunkText(text);
    await supabase.from('corpus_documents')
      .update({ status_message: `Chunked into ${chunks.length} pieces, embedding…`, page_count: pages })
      .eq('id', document_id);

    if (chunks.length === 0) throw new Error('No chunks produced from text');

    // 4. Delete old chunks (idempotent re-processing)
    await supabase.from('corpus_chunks').delete().eq('document_id', document_id);

    // 5. Embed in batches of 32 (Voyage max batch size) and insert.
    // For large documents + rate-limited Voyage tier, this can take many minutes.
    // Each batch of 32 chunks uses 1 Voyage API call.
    const BATCH = 32;
    let inserted = 0;
    const startTime = Date.now();
    const TIMEOUT_SAFETY_MS = 13 * 60 * 1000;  // stop before 14min function limit (fallback)

    for (let i = 0; i < chunks.length; i += BATCH) {
      // Safety: stop before function times out
      if (Date.now() - startTime > TIMEOUT_SAFETY_MS) {
        await supabase.from('corpus_documents').update({
          status: 'partial',
          status_message: `部分完成 ${inserted}/${chunks.length} — 点 ↺ 继续`,
          chunk_count: inserted,
        }).eq('id', document_id);
        return {
          statusCode: 200, headers,
          body: JSON.stringify({
            success: true,
            partial: true,
            chunk_count: inserted,
            total_chunks: chunks.length,
            message: 'Partial completion — click retry to continue',
          }),
        };
      }

      const batch = chunks.slice(i, i + BATCH);
      const embeddings = await embedBatch(batch.map(c => c.content), VOYAGE_KEY);

      const rows = [];
      for (let j = 0; j < batch.length; j++) {
        const hash = await sha256(batch[j].content);
        rows.push({
          document_id,
          collection_id,
          chunk_index: i + j,
          content: batch[j].content,
          content_hash: hash,
          token_count: Math.ceil(batch[j].content.length / 2.5),
          metadata: batch[j].metadata,
          embedding: embeddings[j],
        });
      }

      const { error: insErr } = await supabase.from('corpus_chunks').insert(rows);
      if (insErr) throw new Error(`Insert chunk ${i}: ${insErr.message}`);
      inserted += rows.length;

      await supabase.from('corpus_documents')
        .update({ status_message: `${inserted}/${chunks.length} chunks embedded…`, chunk_count: inserted })
        .eq('id', document_id);
    }

    // 6. Mark ready
    await supabase.from('corpus_documents')
      .update({
        status: 'ready',
        status_message: null,
        chunk_count: inserted,
        processed_at: new Date().toISOString(),
      })
      .eq('id', document_id);

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success: true,
        chunk_count: inserted,
        page_count: pages,
      }),
    };

  } catch (err) {
    console.error('process-document error:', err);
    await supabase.from('corpus_documents')
      .update({
        status: 'error',
        status_message: err.message.slice(0, 500),
      })
      .eq('id', document_id);

    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

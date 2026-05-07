// netlify/functions/embed-chunk.js
// Phase G.5 — Embedding pipeline.
// Takes { chunk_id } (or { chunks: [...] } for batch), calls OpenAI
// text-embedding-3-small, writes vector to clf_chunk_embeddings.
//
// Required env vars:
//   OPENAI_API_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY (NOT anon — needs to write to clf_chunk_embeddings)

import { createClient } from '@supabase/supabase-js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EMBED_MODEL = 'text-embedding-3-small';
const EMBED_DIM = 1536;

const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

async function embedTexts(texts) {
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texts,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI embed error ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  return data.data.map(d => d.embedding);
}

export default async function handler(req) {
  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not set' }),
      { status: 500, headers: { 'Content-Type': 'application/json' }});
  }
  if (!supabase) {
    return new Response(JSON.stringify({ error: 'Supabase service key not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' }});
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' }});
  }

  // Resolve list of chunk_ids to embed
  let chunkIds = [];
  if (body.chunk_id) chunkIds = [body.chunk_id];
  else if (body.chunks && Array.isArray(body.chunks)) chunkIds = body.chunks;
  else {
    return new Response(JSON.stringify({ error: 'Provide chunk_id or chunks[]' }),
      { status: 400, headers: { 'Content-Type': 'application/json' }});
  }
  if (chunkIds.length === 0) {
    return new Response(JSON.stringify({ error: 'No chunk_ids' }),
      { status: 400, headers: { 'Content-Type': 'application/json' }});
  }
  if (chunkIds.length > 100) {
    return new Response(JSON.stringify({ error: 'Max 100 chunks per call' }),
      { status: 400, headers: { 'Content-Type': 'application/json' }});
  }

  // Fetch chunks
  const { data: chunks, error: fetchErr } = await supabase
    .from('clf_corpus_chunks')
    .select('id, content, title')
    .in('id', chunkIds);
  if (fetchErr) {
    return new Response(JSON.stringify({ error: 'Fetch chunks failed: ' + fetchErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' }});
  }
  if (!chunks || chunks.length === 0) {
    return new Response(JSON.stringify({ error: 'No chunks found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' }});
  }

  // Build text inputs (prefer content, fallback to title)
  const texts = chunks.map(c => (c.content || c.title || '').slice(0, 8000));

  // Get embeddings
  let embeddings;
  try {
    embeddings = await embedTexts(texts);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Embedding API failed: ' + e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' }});
  }

  if (embeddings.length !== chunks.length) {
    return new Response(JSON.stringify({
      error: `Embedding count mismatch (got ${embeddings.length}, expected ${chunks.length})`,
    }), { status: 500, headers: { 'Content-Type': 'application/json' }});
  }

  // Upsert into clf_chunk_embeddings
  const rows = chunks.map((c, i) => ({
    chunk_id: c.id,
    embedding: embeddings[i],
    model: EMBED_MODEL,
    embedded_at: new Date().toISOString(),
  }));
  const { error: upsertErr } = await supabase
    .from('clf_chunk_embeddings')
    .upsert(rows, { onConflict: 'chunk_id' });
  if (upsertErr) {
    return new Response(JSON.stringify({ error: 'Upsert failed: ' + upsertErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' }});
  }

  return new Response(JSON.stringify({
    ok: true,
    embedded: rows.length,
    model: EMBED_MODEL,
    dim: EMBED_DIM,
  }), { status: 200, headers: { 'Content-Type': 'application/json' }});
}

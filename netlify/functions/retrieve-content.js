// netlify/functions/retrieve-content.js
// Phase G.10 — RAG retrieval API.
// Updated to use Voyage AI (voyage-3, 1024 dim) instead of OpenAI.
//
// POST { query: "...", hsk_level: 2, max_results: 10, threshold: 0.4 }
// Returns { ok: true, results: [{chunk_id, content, title, hsk_level, similarity}] }

import { createClient } from '@supabase/supabase-js';

const VOYAGE_KEY = process.env.VOYAGE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMBED_MODEL = 'voyage-3';

const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

async function embedQuery(text) {
  const resp = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VOYAGE_KEY}`,
    },
    body: JSON.stringify({
      input: [text],
      model: EMBED_MODEL,
      input_type: 'query',
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Voyage embed error ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  return data.data[0].embedding;
}

export default async function handler(req) {
  if (!VOYAGE_KEY || !supabase) {
    return new Response(JSON.stringify({
      error: 'VOYAGE_API_KEY or Supabase not configured',
    }), { status: 500, headers: { 'Content-Type': 'application/json' }});
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' }});
  }

  const query = (body.query || '').trim();
  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing query' }),
      { status: 400, headers: { 'Content-Type': 'application/json' }});
  }

  const hsk_level = body.hsk_level ?? null;
  const max_results = Math.min(body.max_results ?? 10, 50);
  const threshold = body.threshold ?? 0.4;

  let embedding;
  try {
    embedding = await embedQuery(query);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Embed failed: ' + e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' }});
  }

  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: max_results,
    filter_hsk_level: hsk_level,
  });

  if (error) {
    return new Response(JSON.stringify({ error: 'RPC failed: ' + error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' }});
  }

  return new Response(JSON.stringify({
    ok: true,
    query,
    results: data || [],
    count: (data || []).length,
    model: EMBED_MODEL,
  }), { status: 200, headers: { 'Content-Type': 'application/json' }});
}

// netlify/functions/rag-search.js
//
// Retrieves corpus chunks similar to a query + optionally synthesizes
// an answer with Claude citing sources.
//
// Request body:
//   {
//     query:           "HSK 4 的语法点有哪些?",
//     collection_slug: "hsk" | "renjiao" | "chengyu" | null,  // optional filter
//     match_count:     10,                  // how many chunks to retrieve
//     match_threshold: 0.6,                 // min cosine similarity
//     synthesize:      true,                // if true, Claude summarizes
//     system_prompt:   "..."                // optional custom Claude prompt
//   }
//
// Returns:
//   {
//     success: true,
//     chunks: [ { content, document_title, collection_slug, metadata, similarity } ],
//     answer: "..."        // only if synthesize=true
//   }

import { createClient } from '@supabase/supabase-js';

async function embedQuery(text, apiKey) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: [text],
      model: 'voyage-3',
      input_type: 'query',    // queries use different embedding than documents
    }),
  });
  if (!res.ok) {
    throw new Error(`Voyage embed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return data.data[0].embedding;
}

// Build the source context block (used by all providers)
function buildContext(chunks) {
  return chunks.map((c, i) => {
    const src = [
      c.document_title,
      c.metadata?.chapter,
      c.metadata?.section,
    ].filter(Boolean).join(' · ');
    return `[Source ${i + 1}] (${src})\n${c.content}`;
  }).join('\n\n---\n\n');
}

const DEFAULT_SYSTEM_PROMPT = `You are an expert Chinese language teacher helping an admin curate teaching content. Answer the question based ONLY on the provided sources. Cite sources inline like [Source 1], [Source 2]. If the sources don't contain the answer, say so plainly. Respond in the same language as the question.`;

// Universal AI dispatcher — each provider has its own call implementation
async function askAI(provider, question, chunks, systemPrompt) {
  const sys = systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const context = buildContext(chunks);
  const userMsg = `Sources:\n\n${context}\n\n---\n\nQuestion: ${question}`;

  switch (provider) {
    case 'claude':
    case 'anthropic': {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 1500,
          system: sys,
          messages: [{ role: 'user', content: userMsg }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      return data.content?.[0]?.text || '';
    }

    case 'deepseek': {
      const key = process.env.DEEPSEEK_API_KEY;
      if (!key) throw new Error('DEEPSEEK_API_KEY not configured');
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'deepseek-chat',
          max_tokens: 1500,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: userMsg },
          ],
        }),
      });
      if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }

    case 'openai':
    case 'gpt-4o': {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error('OPENAI_API_KEY not configured');
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 1500,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: userMsg },
          ],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }

    case 'gemini': {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error('GEMINI_API_KEY not configured');
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: `${sys}\n\n${userMsg}` }],
          }],
          generationConfig: { maxOutputTokens: 1500 },
        }),
      });
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    case 'qwen':
    case 'tongyi': {
      const key = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
      if (!key) throw new Error('QWEN_API_KEY not configured');
      const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen-turbo',
          max_tokens: 1500,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: userMsg },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Qwen ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ── Check which providers have API keys configured ──────────────────
function getProviderStatus() {
  return {
    claude:   !!process.env.ANTHROPIC_API_KEY,
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    openai:   !!process.env.OPENAI_API_KEY,
    gemini:   !!process.env.GEMINI_API_KEY,
    qwen:     !!(process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY),
  };
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────
export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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
        error: 'Missing env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VOYAGE_API_KEY required',
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

  const {
    query,
    collection_slug   = null,
    subject_slug      = null,
    grade_level       = null,
    match_count       = 8,
    match_threshold   = 0.5,
    synthesize        = false,
    provider          = 'claude',   // which AI synthesizes the answer
    system_prompt     = null,
    list_status       = false,      // just return provider status, no search
  } = body;

  // Special mode: admin just wants to know which providers have keys
  if (list_status) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, provider_status: getProviderStatus() }),
    };
  }

  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return {
      statusCode: 400, headers,
      body: JSON.stringify({ error: 'query required (min 2 chars)' }),
    };
  }

  try {
    // 1. Embed the query
    const queryEmbedding = await embedQuery(query, VOYAGE_KEY);

    // 2. Vector search via RPC
    const { data: chunks, error: searchErr } = await supabase.rpc('match_chunks', {
      query_embedding:        queryEmbedding,
      match_threshold:        match_threshold,
      match_count:            match_count,
      filter_collection_slug: collection_slug,
      filter_subject_slug:    subject_slug,
      filter_grade_level:     grade_level,
    });

    if (searchErr) {
      throw new Error(`Vector search: ${searchErr.message}`);
    }

    if (!chunks || chunks.length === 0) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          success: true,
          chunks: [],
          answer: synthesize ? '没有在语料库中找到相关内容 · No relevant content found in the corpus.' : null,
        }),
      };
    }

    // 3. Optional multi-provider synthesis
    let answer = null;
    let usedProvider = null;
    if (synthesize) {
      try {
        answer = await askAI(provider, query, chunks, system_prompt);
        usedProvider = provider;
      } catch (err) {
        answer = `⚠ 合成失败 (${provider}): ${err.message}`;
        usedProvider = provider;
      }
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success: true,
        chunks: chunks.map(c => ({
          content:         c.content,
          document_title:  c.document_title,
          collection_slug: c.collection_slug,
          subject_slug:    c.subject_slug,
          grade_level:     c.grade_level,
          metadata:        c.metadata,
          similarity:      Math.round(c.similarity * 1000) / 1000,
        })),
        answer,
        provider: usedProvider,
        match_count: chunks.length,
      }),
    };

  } catch (err) {
    console.error('rag-search error:', err);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

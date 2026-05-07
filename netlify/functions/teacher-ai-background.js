// netlify/functions/teacher-ai-background.js
// Background function — runs up to 15 min, no timeout
// Frontend polls /.netlify/functions/teacher-ai-status?id=xxx for result

const { createClient } = require('@supabase/supabase-js');

let supabase = null;
try {
  const url = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (url && key) {
    const { createClient: cc } = require('@supabase/supabase-js');
    supabase = cc(url, key);
  }
} catch {}

// ── Smart AI Router ──────────────────────────────────────
// Each task type has different optimal requirements:
//   PPT       → needs creativity + structure → Claude Sonnet > GPT-4o > DeepSeek
//   Quiz      → needs accuracy + format      → GPT-4o-mini > DeepSeek > Claude Haiku
//   Worksheet → needs variety + accuracy     → DeepSeek > GPT-4o-mini > Qwen
//   Chat/QA   → needs speed + conversational → DeepSeek > Claude Haiku > GPT-4o-mini
//
// Priority: use best available key for each task
function resolveKeys() {
  return {
    openai:    process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    deepseek:  process.env.DEEPSEEK_API_KEY,
    qwen:      process.env.QWEN_API_KEY,
  };
}

// Task → ordered list of [provider, model] preferences
const TASK_PREFERENCE = {
  generate_ppt: [
    // PPT: needs rich structure, creativity, teaching pedagogy
    // Claude Sonnet is best for structured educational content
    ['anthropic', 'claude-sonnet-4-20250514'],
    ['openai',    'gpt-4o'],
    ['openai',    'gpt-4o-mini'],
    ['deepseek',  'deepseek-chat'],
    ['qwen',      'qwen-plus'],
  ],
  generate_quiz: [
    // Quiz: needs precise JSON output, factual accuracy
    // GPT-4o-mini is best at structured JSON + factual
    ['openai',    'gpt-4o-mini'],
    ['openai',    'gpt-4o'],
    ['deepseek',  'deepseek-chat'],
    ['anthropic', 'claude-haiku-4-5-20251001'],
    ['qwen',      'qwen-turbo'],
  ],
  generate_worksheet: [
    // Worksheet: needs variety, language accuracy, Chinese expertise
    // DeepSeek excels at Chinese language tasks
    ['deepseek',  'deepseek-chat'],
    ['openai',    'gpt-4o-mini'],
    ['qwen',      'qwen-plus'],
    ['anthropic', 'claude-haiku-4-5-20251001'],
  ],
  chat: [
    // Chat: needs speed above all
    ['deepseek',  'deepseek-chat'],
    ['anthropic', 'claude-haiku-4-5-20251001'],
    ['openai',    'gpt-4o-mini'],
    ['qwen',      'qwen-turbo'],
  ],
  qa: [
    // Q&A: needs accuracy + speed
    ['deepseek',  'deepseek-chat'],
    ['openai',    'gpt-4o-mini'],
    ['anthropic', 'claude-haiku-4-5-20251001'],
    ['qwen',      'qwen-turbo'],
  ],
};

function pickBestProvider(action, keys) {
  const prefs = TASK_PREFERENCE[action] || TASK_PREFERENCE.chat;
  for (const [provider, model] of prefs) {
    if (keys[provider]) return { provider, model, key: keys[provider] };
  }
  return null;
}

exports.handler = async (event) => {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return; }

  const { job_id, action } = body;
  if (!job_id) return;

  // Resolve all available API keys
  const keys = resolveKeys();

  // Smart routing: pick best provider for this task
  const best = pickBestProvider(action, keys);

  // Fallback: use whatever was passed in body
  const ai_provider = best?.provider || body.ai_provider || 'openai';
  const ai_model    = best?.model    || body.ai_model    || 'gpt-4o-mini';
  const ai_api_key  = best?.key      || body.ai_api_key;

  const embedding_provider = process.env.EMBEDDING_PROVIDER || body.embedding_provider || 'voyage';
  const embedding_model    = process.env.EMBEDDING_MODEL    || body.embedding_model    || 'voyage-3';
  const embKeyMap = {
    voyage:   process.env.VOYAGE_API_KEY || process.env.VOYAGE_AI_KEY,
    jina:     process.env.JINA_API_KEY,
    openai:   process.env.OPENAI_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
  };
  const embedding_api_key = embKeyMap[embedding_provider] || body.embedding_api_key;

  console.log(`[teacher-ai] Action: ${action} → Using: ${ai_provider}/${ai_model}`);

  async function saveResult(status, data) {
    if (!supabase) return;
    try {
      await supabase.from('ai_jobs').upsert({
        id: job_id, status, result: data,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch (e) { console.error('saveResult failed:', e.message); }
  }

  try {
    await saveResult('running', null);

    const params = { ...body, ai_provider, ai_api_key, ai_model,
      embedding_provider, embedding_api_key, embedding_model };

    let result;
    switch (action) {
      case 'generate_ppt':       result = await generatePPT(params);       break;
      case 'generate_quiz':      result = await generateQuiz(params);      break;
      case 'generate_worksheet': result = await generateWorksheet(params); break;
      case 'chat':               result = await chat(params);              break;
      case 'qa':                 result = await qa(params);                break;
      default: throw new Error(`Unknown action: ${action}`);
    }

    result._provider_used = `${ai_provider}/${ai_model}`;
    await saveResult('done', result);
  } catch (err) {
    await saveResult('error', { error: err.message });
  }
};

// ── All AI generation functions (same as teacher-ai.js) ──

async function getRAGContext(query, { embedding_provider, embedding_api_key, embedding_model, kb_id, top_k = 6 }) {
  if (!embedding_api_key || !supabase || !kb_id) return '';
  try {
    const embedding = await generateEmbedding(query, { embedding_provider, embedding_api_key, embedding_model });
    if (!embedding) return '';
    const { data } = await supabase.rpc('match_rag_chunks', {
      query_embedding: embedding, match_threshold: 0.65, match_count: top_k,
    });
    return (data || []).map(c => c.content).join('\n\n---\n\n');
  } catch { return ''; }
}

async function generatePPT({ topic, hsk_level, slide_count=10, style='educational',
  include_exercises, language='zh', kb_id, ai_provider, ai_api_key, ai_model,
  embedding_provider, embedding_api_key, embedding_model }) {

  const context = await getRAGContext(`${topic} HSK${hsk_level} 教学内容`,
    { embedding_provider, embedding_api_key, embedding_model, kb_id });

  const prompt = `你是资深中文教师，为HSK${hsk_level}学生准备"${topic}"的教学PPT。
${context ? `知识库参考内容：\n${context}\n---` : ''}
生成${slide_count}张幻灯片大纲，风格：${style}。${include_exercises?'包含练习。':''}
输出纯JSON（无markdown），格式：
{"title":"标题","hsk_level":${hsk_level},"estimated_duration":"45分钟","slides":[{"index":1,"type":"title","title":"","content":"","notes":"","vocabulary":[],"exercises":[]}],"teaching_tips":[]}`;

  const response = await callAI({ provider:ai_provider, api_key:ai_api_key, model:ai_model, prompt, max_tokens:2500 });
  return { type:'ppt', ...parseJSON(response), context_used:!!context };
}

async function generateQuiz({ topic, hsk_level, question_count=10, question_types=['multiple_choice','fill_blank'],
  difficulty='medium', language='zh', kb_id, ai_provider, ai_api_key, ai_model,
  embedding_provider, embedding_api_key, embedding_model }) {

  const context = await getRAGContext(`${topic} HSK${hsk_level} 测验词汇语法`,
    { embedding_provider, embedding_api_key, embedding_model, kb_id });

  const prompt = `为HSK${hsk_level}学生生成"${topic}"测验题。
${context ? `参考知识库：\n${context}\n---` : ''}
${question_count}题，类型：${question_types.join('、')}，难度：${difficulty}。
输出纯JSON：{"title":"","hsk_level":${hsk_level},"total_points":100,"questions":[{"id":1,"type":"multiple_choice","question":"","options":["A.","B.","C.","D."],"answer":"","explanation":"","points":10}],"answer_key":{}}`;

  const response = await callAI({ provider:ai_provider, api_key:ai_api_key, model:ai_model, prompt, max_tokens:2500 });
  return { type:'quiz', ...parseJSON(response), context_used:!!context };
}

async function generateWorksheet({ topic, hsk_level, exercise_count=10, include_answers=true,
  worksheet_type='vocabulary', language='zh', kb_id, ai_provider, ai_api_key, ai_model,
  embedding_provider, embedding_api_key, embedding_model }) {

  const context = await getRAGContext(`${topic} HSK${hsk_level} 练习`,
    { embedding_provider, embedding_api_key, embedding_model, kb_id });

  const prompt = `为HSK${hsk_level}学生生成"${topic}"练习册（${worksheet_type}）。
${context ? `参考：\n${context}\n---` : ''}
${exercise_count}题，${include_answers?'含答案':'不含答案'}。
输出纯JSON：{"title":"","instructions":"","sections":[{"name":"","type":"","instructions":"","exercises":[{"id":1,"question":"","answer":"","hint":""}]}]}`;

  const response = await callAI({ provider:ai_provider, api_key:ai_api_key, model:ai_model, prompt, max_tokens:2000 });
  return { type:'worksheet', ...parseJSON(response), context_used:!!context };
}

async function qa({ question, hsk_level, language='zh', kb_id,
  ai_provider, ai_api_key, ai_model, embedding_provider, embedding_api_key, embedding_model }) {

  const context = await getRAGContext(question,
    { embedding_provider, embedding_api_key, embedding_model, kb_id, top_k:5 });

  const prompt = `你是专业中文教学助手。${language==='zh'?'用中文回答':'Answer in English'}。
${context ? `知识库内容：\n${context}\n---\n` : ''}
问题：${question}${hsk_level?`（学生水平HSK${hsk_level}）`:''}`;

  const answer = await callAI({ provider:ai_provider, api_key:ai_api_key, model:ai_model, prompt, max_tokens:1000 });
  return { type:'qa', question, answer, context_used:!!context };
}

async function chat({ messages, hsk_level, language='zh', kb_id,
  ai_provider, ai_api_key, ai_model, embedding_provider, embedding_api_key, embedding_model }) {

  const lastUser = [...messages].reverse().find(m=>m.role==='user');
  const context = lastUser
    ? await getRAGContext(lastUser.content, { embedding_provider, embedding_api_key, embedding_model, kb_id, top_k:4 })
    : '';

  const system = `你是大卫学中文平台专业中文教学助手。${language==='zh'?'用中文回答':'Answer in English'}。${hsk_level?`学生水平HSK${hsk_level}。`:''}${context?`\n知识库参考：\n${context}`:''}`;

  const answer = await callAI({ provider:ai_provider, api_key:ai_api_key, model:ai_model,
    messages, system, max_tokens:1200 });
  return { type:'chat', answer, context_used:!!context };
}

async function callAI({ provider, api_key, model, prompt, messages, system, max_tokens=2000 }) {
  if (provider==='anthropic'||provider==='claude') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':api_key,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({ model:model||'claude-haiku-4-5-20251001', max_tokens, system:system||'You are a helpful Chinese teaching assistant.', messages:messages||[{role:'user',content:prompt}] }),
    });
    if(!res.ok){const e=await res.json();throw new Error(e.error?.message||`Claude ${res.status}`);}
    const d=await res.json(); return d.content?.[0]?.text||'';
  }
  const urls={openai:'https://api.openai.com',deepseek:'https://api.deepseek.com',qwen:'https://dashscope.aliyuncs.com/compatible-mode'};
  const url=`${urls[provider]||'https://api.openai.com'}/v1/chat/completions`;
  const msgs=messages?(system?[{role:'system',content:system},...messages]:messages):[{role:'user',content:prompt}];
  const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${api_key}`},body:JSON.stringify({model:model||'gpt-4o-mini',messages:msgs,max_tokens,temperature:0.7})});
  if(!res.ok){const e=await res.json();throw new Error(e.error?.message||`AI ${res.status}`);}
  const d=await res.json(); return d.choices?.[0]?.message?.content||'';
}

async function generateEmbedding(text, { embedding_provider, embedding_api_key, embedding_model }) {
  if (!embedding_api_key) return null;
  try {
    if (embedding_provider==='voyage') {
      const res=await fetch('https://api.voyageai.com/v1/embeddings',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${embedding_api_key}`},body:JSON.stringify({model:embedding_model||'voyage-3',input:[text.slice(0,8000)],input_type:'query'})});
      const d=await res.json(); return d.data?.[0]?.embedding||null;
    }
    if (embedding_provider==='jina') {
      const res=await fetch('https://api.jina.ai/v1/embeddings',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${embedding_api_key}`},body:JSON.stringify({model:embedding_model||'jina-embeddings-v3',input:[text.slice(0,8000)]})});
      const d=await res.json(); return d.data?.[0]?.embedding||null;
    }
    const res=await fetch('https://api.openai.com/v1/embeddings',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${embedding_api_key}`},body:JSON.stringify({model:embedding_model||'text-embedding-3-small',input:text.slice(0,8000)})});
    const d=await res.json(); return d.data?.[0]?.embedding||null;
  } catch { return null; }
}

function parseJSON(text) {
  try {
    const clean = text.replace(/```json\n?|\n?```/g,'').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return { raw: text };
}

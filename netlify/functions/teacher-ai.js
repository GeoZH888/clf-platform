// netlify/functions/teacher-ai.js
// Direct fast generation — optimized prompts finish in <10s with DeepSeek
// Smart auto-router picks best available model per task type

const { createClient } = require('@supabase/supabase-js');

let supabase = null;
try {
  const url = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (url && key) { const { createClient: cc } = require('@supabase/supabase-js'); supabase = cc(url, key); }
} catch {}

// ── Smart router: best provider per task ─────────────────
function resolveKeys() {
  return {
    openai:    process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    deepseek:  process.env.DEEPSEEK_API_KEY,
    qwen:      process.env.QWEN_API_KEY,
  };
}

const TASK_PREFS = {
  generate_ppt:       [['anthropic','claude-haiku-4-5-20251001'],['deepseek','deepseek-chat'],['openai','gpt-4o-mini'],['qwen','qwen-turbo']],
  generate_quiz:      [['deepseek','deepseek-chat'],['openai','gpt-4o-mini'],['anthropic','claude-haiku-4-5-20251001'],['qwen','qwen-turbo']],
  generate_worksheet: [['deepseek','deepseek-chat'],['openai','gpt-4o-mini'],['qwen','qwen-turbo'],['anthropic','claude-haiku-4-5-20251001']],
  chat:               [['deepseek','deepseek-chat'],['anthropic','claude-haiku-4-5-20251001'],['openai','gpt-4o-mini'],['qwen','qwen-turbo']],
  qa:                 [['deepseek','deepseek-chat'],['openai','gpt-4o-mini'],['anthropic','claude-haiku-4-5-20251001'],['qwen','qwen-turbo']],
};

function pickBest(action, keys) {
  for (const [p, m] of (TASK_PREFS[action] || TASK_PREFS.chat)) {
    if (keys[p]) return { provider:p, model:m, key:keys[p] };
  }
  return null;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type',
    'Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json',
  };
  if (event.httpMethod==='OPTIONS') return {statusCode:200,headers,body:''};
  if (event.httpMethod!=='POST') return {statusCode:405,headers,body:JSON.stringify({error:'Method not allowed'})};

  let body;
  try { body=JSON.parse(event.body||'{}'); }
  catch { return {statusCode:400,headers,body:JSON.stringify({error:'Invalid JSON'})}; }

  const { action } = body;
  const keys = resolveKeys();
  const best = pickBest(action, keys);
  const ai_provider = best?.provider || body.ai_provider || 'openai';
  const ai_model    = best?.model    || body.ai_model    || 'gpt-4o-mini';
  const ai_api_key  = best?.key      || body.ai_api_key;

  const embedding_provider = process.env.EMBEDDING_PROVIDER || body.embedding_provider || 'voyage';
  const embedding_model    = process.env.EMBEDDING_MODEL    || body.embedding_model    || 'voyage-3';
  const embKeys = { voyage:process.env.VOYAGE_API_KEY||process.env.VOYAGE_AI_KEY, jina:process.env.JINA_API_KEY, openai:process.env.OPENAI_API_KEY, deepseek:process.env.DEEPSEEK_API_KEY };
  const embedding_api_key = embKeys[embedding_provider] || body.embedding_api_key;

  if (!ai_api_key) return {statusCode:400,headers,body:JSON.stringify({
    error:`No API key found. Add DEEPSEEK_API_KEY or OPENAI_API_KEY or ANTHROPIC_API_KEY in Netlify environment variables.`
  })};

  console.log(`[teacher-ai] ${action} → ${ai_provider}/${ai_model}`);

  try {
    const params = { ...body, ai_provider, ai_api_key, ai_model, embedding_provider, embedding_api_key, embedding_model };
    let result;
    switch(action) {
      case 'generate_ppt':       result = await generatePPT(params);       break;
      case 'generate_quiz':      result = await generateQuiz(params);      break;
      case 'generate_worksheet': result = await generateWorksheet(params); break;
      case 'chat':               result = await chat(params);              break;
      case 'qa':                 result = await qa(params);                break;
      case 'transcribe':         result = await transcribe(params);        break;
      default: return {statusCode:400,headers,body:JSON.stringify({error:`Unknown action: ${action}`})};
    }
    result._provider_used = `${ai_provider}/${ai_model}`;
    return {statusCode:200,headers,body:JSON.stringify(result)};
  } catch(err) {
    return {statusCode:500,headers,body:JSON.stringify({error:err.message})};
  }
};

// ── RAG context ───────────────────────────────────────────
async function getRAGContext(query, {embedding_provider,embedding_api_key,embedding_model,kb_id,top_k=5}) {
  if (!embedding_api_key||!supabase||!kb_id) return '';
  try {
    const emb = await generateEmbedding(query,{embedding_provider,embedding_api_key,embedding_model});
    if (!emb) return '';
    const {data} = await supabase.rpc('match_rag_chunks',{query_embedding:emb,match_threshold:0.65,match_count:top_k});
    return (data||[]).map(c=>c.content).join('\n---\n').slice(0,3000);
  } catch { return ''; }
}

// ── PPT — fast compact prompt ────────────────────────────
async function generatePPT({topic,hsk_level,slide_count=8,style='educational',include_exercises,include_illustrations,language='zh',kb_id,ai_provider,ai_api_key,ai_model,embedding_provider,embedding_api_key,embedding_model}) {
  const ctx = await getRAGContext(`${topic} HSK${hsk_level}`,{embedding_provider,embedding_api_key,embedding_model,kb_id});
  const imgNote = include_illustrations
    ? '，每张幻灯片加"image_prompt"字段(英文，描述适合该幻灯片的教育配图场景，无文字，Stability AI风格)'
    : '';
  const imgField = include_illustrations
    ? ',"image_prompt":"cute Chinese classroom illustration showing [topic], educational style, no text"'
    : '';
  const prompt = `中文教师，为HSK${hsk_level}学生制作"${topic}" PPT，${slide_count}张，${style}风格。${include_exercises?'含练习。':''}${imgNote}
${ctx?`知识库：${ctx}\n`:''}
输出JSON（无markdown）:{"title":"","hsk_level":${hsk_level},"estimated_duration":"45分钟","teaching_tips":["建议1"],"slides":[{"index":1,"type":"title","title":"","content":"内容（\n分行）","notes":"教师备注","vocabulary":["词 pīnyīn - 意思"],"exercises":["练习题"]${imgField}}]}
每张幻灯片content简洁（3-6行），type可选title/vocabulary/grammar/dialogue/culture/exercise/summary`;
  const r = await callAI({provider:ai_provider,api_key:ai_api_key,model:ai_model,prompt,max_tokens:2200});
  return {type:'ppt',...parseJSON(r),context_used:!!ctx,include_illustrations:!!include_illustrations};
}


// ── Quiz — fast compact prompt ───────────────────────────
async function generateQuiz({topic,hsk_level,question_count=10,question_types=['multiple_choice','fill_blank'],difficulty='medium',language='zh',kb_id,ai_provider,ai_api_key,ai_model,embedding_provider,embedding_api_key,embedding_model}) {
  const ctx = await getRAGContext(`${topic} HSK${hsk_level} 词汇语法`,{embedding_provider,embedding_api_key,embedding_model,kb_id});
  const prompt = `HSK${hsk_level}"${topic}"测验，${question_count}题(${question_types.join('/')})，${difficulty}难度。
${ctx?`参考：${ctx}\n`:''}
输出JSON:{"title":"测验标题","hsk_level":${hsk_level},"total_points":100,"questions":[{"id":1,"type":"multiple_choice","question":"题目","options":["A.选项","B.选项","C.选项","D.选项"],"answer":"A","explanation":"解析","points":10}],"answer_key":{"1":"A"}}`;
  const r = await callAI({provider:ai_provider,api_key:ai_api_key,model:ai_model,prompt,max_tokens:2000});
  return {type:'quiz',...parseJSON(r),context_used:!!ctx};
}

// ── Worksheet ────────────────────────────────────────────
async function generateWorksheet({topic,hsk_level,exercise_count=10,include_answers=true,worksheet_type='vocabulary',language='zh',kb_id,ai_provider,ai_api_key,ai_model,embedding_provider,embedding_api_key,embedding_model}) {
  const ctx = await getRAGContext(`${topic} HSK${hsk_level}`,{embedding_provider,embedding_api_key,embedding_model,kb_id});
  const prompt = `HSK${hsk_level}"${topic}"练习册(${worksheet_type})，${exercise_count}题，${include_answers?'含答案':'无答案'}。
${ctx?`参考：${ctx}\n`:''}
JSON:{"title":"","instructions":"说明","sections":[{"name":"部分名","type":"fill_blank","instructions":"本节说明","exercises":[{"id":1,"question":"题目","answer":"答案","hint":"提示"}]}]}`;
  const r = await callAI({provider:ai_provider,api_key:ai_api_key,model:ai_model,prompt,max_tokens:1800});
  return {type:'worksheet',...parseJSON(r),context_used:!!ctx};
}

// ── Q&A ──────────────────────────────────────────────────
async function qa({question,hsk_level,language='zh',kb_id,ai_provider,ai_api_key,ai_model,embedding_provider,embedding_api_key,embedding_model}) {
  const ctx = await getRAGContext(question,{embedding_provider,embedding_api_key,embedding_model,kb_id,top_k:4});
  const prompt = `你是专业中文教学助手。${language==='zh'?'用中文回答。':'Answer in English.'}\n${ctx?`知识库：${ctx}\n`:''}问题：${question}${hsk_level?`(HSK${hsk_level})`:''}`;
  const answer = await callAI({provider:ai_provider,api_key:ai_api_key,model:ai_model,prompt,max_tokens:800});
  return {type:'qa',question,answer,context_used:!!ctx};
}

// ── Chat ─────────────────────────────────────────────────
async function chat({messages,hsk_level,language='zh',kb_id,ai_provider,ai_api_key,ai_model,embedding_provider,embedding_api_key,embedding_model}) {
  const last = [...messages].reverse().find(m=>m.role==='user');
  const ctx = last ? await getRAGContext(last.content,{embedding_provider,embedding_api_key,embedding_model,kb_id,top_k:3}) : '';
  const system = `专业中文教学助手。${language==='zh'?'用中文':'In English'}。${hsk_level?`HSK${hsk_level}。`:''}${ctx?`参考：${ctx}`:''}`;
  const answer = await callAI({provider:ai_provider,api_key:ai_api_key,model:ai_model,messages,system,max_tokens:1000});
  return {type:'chat',answer,context_used:!!ctx};
}

// ── callAI ───────────────────────────────────────────────
async function callAI({provider,api_key,model,prompt,messages,system,max_tokens=2000}) {
  if (provider==='anthropic'||provider==='claude') {
    const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':api_key,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:model||'claude-haiku-4-5-20251001',max_tokens,system:system||'You are a helpful Chinese teaching assistant.',messages:messages||[{role:'user',content:prompt}]})});
    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error?.message||`Anthropic ${res.status}`);}
    const d=await res.json();return d.content?.[0]?.text||'';
  }
  const baseUrls={openai:'https://api.openai.com',deepseek:'https://api.deepseek.com',qwen:'https://dashscope.aliyuncs.com/compatible-mode'};
  const url=`${baseUrls[provider]||'https://api.openai.com'}/v1/chat/completions`;
  const msgs=messages?(system?[{role:'system',content:system},...messages]:messages):[{role:'user',content:prompt}];
  const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${api_key}`},body:JSON.stringify({model:model||'gpt-4o-mini',messages:msgs,max_tokens,temperature:0.7})});
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error?.message||`${provider} ${res.status}`);}
  const d=await res.json();return d.choices?.[0]?.message?.content||'';
}

// ── Embedding ────────────────────────────────────────────
async function generateEmbedding(text,{embedding_provider,embedding_api_key,embedding_model}) {
  if(!embedding_api_key)return null;
  try{
    if(embedding_provider==='voyage'){const res=await fetch('https://api.voyageai.com/v1/embeddings',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${embedding_api_key}`},body:JSON.stringify({model:embedding_model||'voyage-3',input:[text.slice(0,8000)],input_type:'query'})});const d=await res.json();return d.data?.[0]?.embedding||null;}
    if(embedding_provider==='jina'){const res=await fetch('https://api.jina.ai/v1/embeddings',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${embedding_api_key}`},body:JSON.stringify({model:embedding_model||'jina-embeddings-v3',input:[text.slice(0,8000)]})});const d=await res.json();return d.data?.[0]?.embedding||null;}
    const res=await fetch('https://api.openai.com/v1/embeddings',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${embedding_api_key}`},body:JSON.stringify({model:embedding_model||'text-embedding-3-small',input:text.slice(0,8000)})});
    const d=await res.json();return d.data?.[0]?.embedding||null;
  }catch{return null;}
}

// ── Transcribe audio via OpenAI Whisper ─────────────────
async function transcribe({audio_base64, audio_type, filename}) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey || !audio_base64) return { type:'transcribe', transcript:'' };

  try {
    // Convert base64 to buffer
    const buffer = Buffer.from(audio_base64, 'base64');
    const blob = new Blob([buffer], { type: audio_type || 'audio/mpeg' });

    const form = new FormData();
    form.append('file', blob, filename || 'audio.mp3');
    form.append('model', 'whisper-1');
    form.append('language', 'zh'); // auto-detect Chinese, fallback to auto
    form.append('response_format', 'text');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}` },
      body: form,
    });

    if (!res.ok) {
      const e = await res.json().catch(()=>({}));
      throw new Error(e.error?.message || `Whisper ${res.status}`);
    }

    const transcript = await res.text();
    return { type:'transcribe', transcript };
  } catch(err) {
    return { type:'transcribe', transcript:'', error: err.message };
  }
}

function parseJSON(text) {
  try{const c=text.replace(/```json\n?|\n?```/g,'').trim();const m=c.match(/\{[\s\S]*\}/);if(m)return JSON.parse(m[0]);}catch{}
  return {raw:text};
}

// netlify/functions/clf-teacher-ai.js
// Multi-provider AI gateway for teacher panel.
// Tasks: knowledge_map | lesson_outline | quiz

const { createClient } = require('@supabase/supabase-js');

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const { task, course_id, provider = 'claude', payload = {} } = body;
  if (!task || !course_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'task and course_id required' }) };
  }

  try {
    if (!SUPA_URL || !SUPA_KEY) throw new Error('Supabase env vars missing');
    const supa = createClient(SUPA_URL, SUPA_KEY);
    const { data: course } = await supa.from('clf_courses').select('*').eq('id', course_id).single();
    if (!course) throw new Error('course not found');

    const prompt = buildPrompt(task, course, payload);
    const text = await callProvider(provider, prompt);

    let data;
    try { data = JSON.parse(text); }
    catch { data = text; }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, task, provider, data }),
    };
  } catch (err) {
    console.error('[clf-teacher-ai]', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

function buildPrompt(task, course, payload) {
  const ctx = `Title: ${course.title}\nTopic: ${course.topic}\nLevel: ${course.level}`;

  if (task === 'knowledge_map') {
    return {
      system: 'You are a Chinese-language teaching assistant. Build a knowledge map for the given course. Return ONLY a JSON object with shape: { nodes: [{ id, label_zh, label_en, type }], edges: [{ from, to, relation }] }. Cover characters, vocab, grammar relationships. 8-15 nodes.',
      user: `Course context:\n${ctx}\n\nReturn the knowledge map JSON.`,
    };
  }
  if (task === 'lesson_outline') {
    return {
      system: 'You are a Chinese-language teaching assistant. Generate a 45-minute lesson plan in Simplified Chinese. Return JSON with: { goals, warm_up, core_teaching, practice, assessment, homework }. Each section is a string of concrete instructions.',
      user: `Course context:\n${ctx}\n\nReturn the lesson outline JSON.`,
    };
  }
  if (task === 'quiz') {
    return {
      system: 'You are a Chinese-language teaching assistant. Generate 5 quiz questions for the course level. Return JSON with shape: { questions: [{ q_zh, q_en, type: "mc"|"fill", options?, answer, explanation }] }.',
      user: `Course context:\n${ctx}\n\nReturn the quiz JSON.`,
    };
  }
  throw new Error(`Unknown task: ${task}`);
}

async function callProvider(provider, { system, user }) {
  if (provider === 'claude') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 2000,
        system, messages: [{ role: 'user', content: user }],
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `Claude ${r.status}`);
    return j.content[0].text;
  }
  if (provider === 'gpt-4o' || provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o', max_tokens: 2000,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `OpenAI ${r.status}`);
    return j.choices[0].message.content;
  }
  if (provider === 'deepseek') {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat', max_tokens: 2000,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `DeepSeek ${r.status}`);
    return j.choices[0].message.content;
  }
  if (provider === 'gemini') {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: 2000 },
        }),
      });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `Gemini ${r.status}`);
    return j.candidates[0].content.parts[0].text;
  }
  throw new Error(`Unknown provider: ${provider}`);
}

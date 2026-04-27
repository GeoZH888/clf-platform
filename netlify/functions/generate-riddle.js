// netlify/functions/generate-riddle.js
//
// 猜灯谜 — adaptive riddle generator
//
// Flow:
//   1. Try cache: pull an approved riddle at the requested level the user
//      hasn't seen. If found, return it (fast path, no AI call).
//   2. Cache miss / force_new: pull seed examples from clf_riddles as RAG
//      context, ask Claude to generate a fresh riddle in JSON.
//   3. Self-check: ask Claude to solve its own riddle. If the answer matches,
//      mark approved; else mark pending (admin will review).
//   4. Save to clf_riddles. Return riddle to client.
//
// Env vars required:
//   ANTHROPIC_API_KEY           — Claude API key (already set in Netlify)
//   SUPABASE_URL                — your project URL
//   SUPABASE_SERVICE_ROLE_KEY   — service role key (NOT the anon key — service
//                                 role bypasses RLS so the function can write
//                                 even when called from anon/student session)

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase  = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

const MODEL = 'claude-opus-4-7';

// ── Main handler ─────────────────────────────────────────────────────────────
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: HEADERS });
  if (req.method !== 'POST')    return json(405, { error: 'Method not allowed' });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      level       = 1,
      user_id     = null,
      session_id  = null,
      force_new   = false,
      action      = 'play',   // 'play' (cache-first) | 'generate' (always AI)
    } = body;

    const targetLevel = Math.max(1, Math.min(6, parseInt(level) || 1));

    // 1. Fast path — pull an approved unseen riddle from the cache
    if (action === 'play' && !force_new) {
      const cached = await findUnseen(targetLevel, user_id, session_id);
      if (cached) return json(200, { riddle: cached, source: 'cache' });
    }

    // 2. Cache miss — generate via AI with RAG context
    const examples = await pullExamples(targetLevel);
    const generated = await generateRiddle(targetLevel, examples);
    if (!generated) return json(500, { error: 'Generation failed (parse error)' });

    // 3. Self-check
    const selfCheckPassed = await selfCheck(generated);
    const status = selfCheckPassed ? 'approved' : 'pending';

    // 4. Persist
    const { data: saved, error: saveErr } = await supabase
      .from('clf_riddles')
      .insert({
        riddle_text:     generated.riddle_text,
        answer:          generated.answer,
        answer_type:     generated.answer_type || 'character',
        category_hint:   generated.category_hint,
        explanation:     generated.explanation,
        level:           targetLevel,
        hints:           generated.hints || [],
        source:          'ai_generated',
        status,
        generated_by:    MODEL,
        generation_meta: {
          examples_used:     examples.length,
          self_check_passed: selfCheckPassed,
          requested_level:   targetLevel,
        },
      })
      .select()
      .single();

    if (saveErr) return json(500, { error: `DB save failed: ${saveErr.message}` });

    // If self-check failed, don't show this riddle — fall back to cache
    if (status === 'pending') {
      const fallback = await findUnseen(targetLevel, user_id, session_id);
      return json(200, {
        riddle:    fallback || null,
        source:    fallback ? 'cache_fallback' : 'no_riddle',
        note:      fallback
          ? 'AI生成的灯谜未通过自检，已加入待审核队列；返回缓存中的另一条灯谜'
          : '暂无可用灯谜，请稍后再试',
        rejected:  saved,
      });
    }

    return json(200, { riddle: saved, source: 'ai_generated' });
  } catch (err) {
    console.error('[generate-riddle]', err);
    return json(500, { error: err.message || String(err) });
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function findUnseen(level, user_id, session_id) {
  // What has this user already seen?
  let seenIds = [];
  if (user_id || session_id) {
    let q = supabase.from('clf_riddle_attempts').select('riddle_id').limit(500);
    if (user_id)         q = q.eq('user_id', user_id);
    else if (session_id) q = q.eq('session_id', session_id);
    const { data: attempts } = await q;
    seenIds = (attempts || []).map(a => a.riddle_id);
  }

  // Pool of approved riddles at this level
  const { data: pool } = await supabase
    .from('clf_riddles')
    .select('*')
    .eq('status', 'approved')
    .eq('level', level)
    .order('created_at', { ascending: false })
    .limit(100);

  if (!pool?.length) return null;

  const unseen = seenIds.length
    ? pool.filter(r => !seenIds.includes(r.id))
    : pool;
  if (!unseen.length) return null;

  return unseen[Math.floor(Math.random() * unseen.length)];
}

async function pullExamples(level) {
  // Pull 6-8 seed examples around target level (level ± 1) for in-context learning.
  const { data } = await supabase
    .from('clf_riddles')
    .select('riddle_text, answer, answer_type, category_hint, explanation, level')
    .eq('source', 'seed')
    .gte('level', Math.max(1, level - 1))
    .lte('level', Math.min(6, level + 1))
    .limit(8);
  return data || [];
}

async function generateRiddle(level, examples) {
  const examplesText = examples.length
    ? examples.map((e, i) =>
        `${i + 1}. 谜面: ${e.riddle_text}\n   谜目: ${e.category_hint}\n   谜底: ${e.answer}\n   解释: ${e.explanation || '(无)'}`
      ).join('\n\n')
    : '(无样例)';

  const levelGuide = {
    1: 'HSK 1 级 — 词汇极简单，谜面短（10字以内），答案是常用单字（如 日 月 山 水）',
    2: 'HSK 2 级 — 简单字谜，可用基础拆字法，答案为常见汉字',
    3: 'HSK 3-4 级 — 双字词谜或简单成语谜，可用谐音、会意',
    4: 'HSK 4 级 — 成语谜或词谜，需要一定文化理解',
    5: 'HSK 5 级 — 文化典故，复杂成语，可用多重意象',
    6: 'HSK 6 级 — 文学性强，需要深厚文化背景',
  }[level] || 'HSK 初级';

  const prompt = `你是一位精通中国传统灯谜的老师。请创作一条**新的、原创的**灯谜，难度为 ${levelGuide}。

参考样例（请学习这些灯谜的拆字、谐音、会意、象形等创作手法，但**不要照抄**）:

${examplesText}

要求:
1. 必须是**原创**，不能照抄上面的样例
2. 谜面要有趣，符合传统灯谜风格
3. 谜底必须**唯一、明确**，没有歧义（这点最重要）
4. explanation 必须解释为什么谜底正确（拆字、会意等机制）
5. 难度严格符合 ${levelGuide}
6. answer_type 必须是: "character"(单字) / "word"(词) / "idiom"(成语) / "object"(物品/概念) 之一
7. category_hint 例如: "打一字" / "打一词" / "打一成语" / "打一水果" 等

只返回 JSON，**不要任何其他文字**（不要 markdown 代码块，不要前后说明）:
{
  "riddle_text": "谜面（不含谜目）",
  "answer": "谜底",
  "answer_type": "character",
  "category_hint": "打一字",
  "explanation": "为什么这个谜底正确，详细解释机制",
  "hints": [
    {"type": "category", "text": "提示一：和...有关"},
    {"type": "structure", "text": "提示二：由...组成"}
  ]
}`;

  const resp = await anthropic.messages.create({
    model:      MODEL,
    max_tokens: 1000,
    messages:   [{ role: 'user', content: prompt }],
  });

  const text  = resp.content?.[0]?.text || '';
  const clean = text.replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(clean);
    // Minimal validation
    if (!parsed.riddle_text || !parsed.answer) return null;
    return parsed;
  } catch (e) {
    console.error('[generate-riddle] JSON parse failed:', text);
    return null;
  }
}

async function selfCheck(riddle) {
  // Ask Claude to solve its own riddle in a fresh context.
  const prompt = `请解答下面的中文灯谜，只需给出谜底（一个字、词或成语），不要解释，不要标点:

谜面: ${riddle.riddle_text}
${riddle.category_hint ? `谜目: ${riddle.category_hint}` : ''}

只输出谜底:`;

  try {
    const resp = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 50,
      messages:   [{ role: 'user', content: prompt }],
    });

    const guess = (resp.content?.[0]?.text || '').trim();
    const normalized = guess
      .replace(/[。，、？！\s"'""\.\?\!,]/g, '')
      .slice(0, 20);

    // Match if either contains the other (handles minor wording variation)
    return normalized.includes(riddle.answer) || riddle.answer.includes(normalized);
  } catch (err) {
    console.error('[self-check]', err);
    return false;
  }
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

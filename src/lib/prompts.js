// src/lib/prompts.js
// ═══════════════════════════════════════════════════════════════════════════
// DB-backed prompt fetcher with code-side fallback.
//
// Usage:
//   const prompt = await getPrompt('chengyu_text', { count: 5, theme: 'animals', hsk: 4 });
//
// Edits live in clf_prompt_templates (Supabase). DEFAULTS below are the safety
// net used if the DB row is missing or the network fails.
//
// ⚠️ Keep DEFAULTS in sync with the seed in clf_prompt_templates_setup.sql
//    whenever you intentionally change defaults.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from './supabase.js';

// Shared SYSTEM_RULES block for grammar prompts — kept here as a constant
// so the two grammar templates can include it without duplication in code.
// (The DB rows store the FULLY expanded text; this constant only matters
// for the code-side fallback path.)
const GRAMMAR_SYSTEM_RULES = `You generate grammar-topic entries for a Chinese learning
platform aimed at heritage learners (Chinese diaspora children in Italy) and
Italian L2 learners.

LEVELING (5 tiers, calibrated against HSK + heritage learner reality):
L1 — HSK1. 是/有 sentences, basic SVO, pronouns, numbers, dates, 吗 questions.
L2 — HSK2-3. Comparison (A 比 B), aspect particles (了/过/着), 是…的, basic complements.
L3 — HSK3-4. 把字句, reduplication, directional/result complements, 要是…就…, 因为…所以….
L4 — HSK4-5. 被字句, 虽然…但是…, 越…越…, 不但…而且…, purpose/concession structures.
L5 — HSK5-6+. Formal/written register, 之所以…是因为, advanced subordination, idiomatic 4-char patterns.

For each grammar topic output ONE JSON object with EXACTLY these fields:
- id          : lowercase pinyin slug, words joined by underscores (e.g. "ba_zi_ju").
                This is also the database primary key. Must be unique.
- title_zh    : Chinese title, short (e.g. "把字句")
- title_en    : English title (e.g. "Disposal: 把")
- title_it    : Italian title (e.g. "Frase con 把")
- level       : integer 1–5 (use the LEVELING guide above)
- order_idx   : integer, default 0
- explanation : 2–4 lines of Markdown. Start with **结构**: <pattern>, then a
                one-line usage note. Tight — students read on phones.
- examples    : array of 4 sentences. Each: { zh, pinyin, en, it }.

QUALITY RULES (non-negotiable):
- Pinyin uses tone marks (ā á ǎ à), never numbers.
- Examples must be natural, not textbook-awkward. Realistic settings:
  family, school, food, travel, friends.
- Italian translations: idiomatic Italian, not word-for-word.
- English translations: idiomatic, not literal.
- Order examples simple → varied use.
- Each example must clearly illustrate the target structure.

⚠️ JSON ESCAPING (critical — most failures come from this):
- Inner double quotes in string values MUST be backslash-escaped.
  Example: "explanation": "这是 \\"被\\" 字句的结构..."
- Do NOT use Chinese curly quotes “ ” 『 』 anywhere — only ASCII " for JSON syntax.
- Use ASCII commas , and colons : in the JSON structure (not ， ：).

Output ONLY a JSON array. No markdown fences. No preamble. No trailing prose.`;

export const DEFAULTS = {
  // ─── Chengyu (成语) ─────────────────────────────────────────────────────
  chengyu_text: `生成 {count} 条中文成语，要求：
- 主题：{theme}
- HSK等级：{hsk}
- 每条包含：成语、拼音、中文意思、英语意思、意大利语意思、历史典故（中文，200字以内）、例句（中文）、难度（1-4）
- 返回纯 JSON 数组，不要任何 markdown 或说明文字
- ⚠️ 字符串中的双引号必须用反斜杠转义（例如 "他说\\"你好\\""），不要使用中文引号 " " 『 』
格式：[{"idiom":"...","pinyin":"...","meaning_zh":"...","meaning_en":"...","meaning_it":"...","story_zh":"...","example_zh":"...","difficulty":2,"theme":"{theme}","hsk_level":{hsk}}]`,

  chengyu_image: `Children's book illustration depicting this scene from a Chinese fable:

{story}

Visual focus: the narrative moment from this story. Show characters, setting, and action clearly. A single coherent scene, not a collage of symbols.

Style: {style}.

STRICTLY AVOID: any Chinese text, calligraphy, or written characters; Chinese New Year decorations (red lanterns, couplets, firecrackers, gold ingots); holiday motifs; symbolic objects unrelated to the story. No text or watermarks anywhere in the image.

Composition: square format, balanced, focal subject centered, soft natural lighting, period-appropriate ancient Chinese rural or village setting.`,

  // ─── Grammar (语法) ─────────────────────────────────────────────────────
  // {avoid_block}, {level_hint}, {count_hint} are optional fragments built
  // by the caller. Empty string when not applicable.
  grammar_text: `${GRAMMAR_SYSTEM_RULES}
{avoid_block}{level_hint}{count_hint}

User request:
"""
{user_input}
"""

If the request is a list of ids/slugs, generate one entry per id.
If the request is a theme or empty (auto-fill mode), invent appropriate
grammar topics for the target level that AREN'T in the avoid list.

Return ONLY the JSON array.`,

  grammar_single: `${GRAMMAR_SYSTEM_RULES}

AVOID these ids: {avoid_ids}

Regenerate the grammar topic with id "{id}" at level L{level}.
Return a JSON array with exactly ONE object.`,

  // ─── Word illustration (词语插图) ──────────────────────────────────────
  // 5 styles + custom (custom doesn't go through getPrompt). Variables:
  //   {word_zh}     — the Chinese word, always provided
  //   {meaning_en}  — English meaning (caller falls back to meaning_zh, then "")
  word_image_flashcard: `Clean educational flashcard illustration of "{meaning_en}" (Chinese: {word_zh}) for vocabulary learners. Single central subject, white background, bright primary colors, bold clean shapes, no text, suitable for language-learning app. Simple and instantly recognizable.`,

  word_image_photo: `High-quality educational photograph of "{meaning_en}" (Chinese: {word_zh}). Clear focus, neutral background, well-lit studio style, single subject. Suitable for language-learning flashcard. Photorealistic, no text.`,

  word_image_emoji: `Large emoji-style illustration of "{meaning_en}" on a plain white background. Round, friendly, glossy aesthetic similar to Apple/Google emoji design. Single centered subject, bright colors, soft shadow, no text.`,

  word_image_cartoon: `Cute cartoon illustration of "{meaning_en}" (Chinese: {word_zh}) for children's Chinese textbook. Friendly characters or objects, pastel colors, rounded shapes, playful style, white background, no text. Evokes warmth and fun.`,

  word_image_abstract: `Abstract minimalist illustration evoking the concept of "{meaning_en}". Geometric shapes, muted color palette, flat design, symbolic rather than literal. Suitable for modern educational material. No text.`,
};

/**
 * Fetch prompt template by key, substitute {var} placeholders.
 * Falls back to DEFAULTS[key] if DB read fails or row is missing.
 */
export async function getPrompt(key, vars = {}) {
  let tpl;
  try {
    const { data, error } = await supabase
      .from('clf_prompt_templates')
      .select('template')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    tpl = data?.template;
  } catch (e) {
    console.warn(`[prompts] DB fetch failed for "${key}", falling back to DEFAULT:`, e.message);
  }

  tpl = tpl || DEFAULTS[key];
  if (!tpl) throw new Error(`No prompt template found for key "${key}"`);

  for (const [k, v] of Object.entries(vars)) {
    tpl = tpl.replaceAll(`{${k}}`, String(v ?? ''));
  }
  return tpl;
}

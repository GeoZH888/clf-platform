// src/admin/lib/storyAi.js
//
// AI helpers for 故事会 admin.
//
// aiFields.js handles flat records — one row, N columns. A story is a row
// plus an ordered list of pages, so it needs its own shape:
//
//   draftStory()      idea → whole story (titles, summaries, N pages, trilingual)
//   translatePages()  zh pages → fill missing text_en / text_it
//   pinyinForPages()  zh pages → tone-marked pinyin
//
// All three go through the same ai-gateway as every other admin tab.

import { askAIForJSON, LANG_BY_CODE } from './aiFields.js';

const hasText = v => typeof v === 'string' && v.trim().length > 0;

export const DIFFICULTY_BRIEF = {
  1: 'HSK1 — 150 most common words. Very short sentences (6–10 characters). Present tense, no subordinate clauses.',
  2: 'HSK2–3 — everyday vocabulary. Short sentences (10–16 characters). Simple connectors like 然后, 因为.',
  3: 'HSK3–4 — sentences of 16–24 characters. Some idiomatic phrasing and time/aspect markers.',
  4: 'HSK4+ — richer vocabulary, 20–30 character sentences, some 成语 where they fit naturally.',
};

/** Normalise whatever the model returned for one page into our column shape. */
function normalisePage(raw = {}) {
  return {
    text_zh: hasText(raw.text_zh) ? raw.text_zh.trim() : '',
    pinyin:  hasText(raw.pinyin)  ? raw.pinyin.trim()  : '',
    text_en: hasText(raw.text_en) ? raw.text_en.trim() : '',
    text_it: hasText(raw.text_it) ? raw.text_it.trim() : '',
  };
}

/** Fallback slug when the model returns something unusable. */
function slugify(s = '') {
  const clean = String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return clean || `story-${Date.now().toString(36)}`;
}

/**
 * Draft a complete story from a one-line idea.
 *
 * @param {string} idea       '小猫钓鱼' or 'a fox who wants grapes' — any language
 * @param {number} pageCount  how many pages to write
 * @param {number} difficulty 1–4, keyed to DIFFICULTY_BRIEF
 * @returns {{slug,title_zh,title_en,title_it,summary_zh,summary_en,summary_it,difficulty,pages:[]}}
 */
export async function draftStory({
  idea,
  pageCount = 6,
  difficulty = 1,
  provider = 'claude',
} = {}) {
  if (!hasText(idea)) {
    throw new Error('请先写一句故事灵感 · Describe the story idea first.');
  }
  const n = Math.max(1, Math.min(20, Number(pageCount) || 6));
  const level = DIFFICULTY_BRIEF[difficulty] || DIFFICULTY_BRIEF[1];

  const prompt = `You are a children's author writing graded readers for a platform that teaches Chinese to English- and Italian-speaking children.

Write a complete illustrated story based on this idea:
${idea}

Level: ${level}

Structure it as exactly ${n} pages. Each page is one illustration plus 1–3 sentences — a single beat of the story. Page 1 sets the scene, the last page resolves it. The story must be complete and satisfying within ${n} pages.

Rules:
- Use ONLY Simplified Chinese (简体字). Never Traditional.
- pinyin: tone-marked (nǐ hǎo, not ni3 hao3), one space between syllables, capitalised at sentence start, keeping the sentence punctuation.
- text_en and text_it are natural translations for a child, not word-for-word glosses.
- Recycle key vocabulary across pages — repetition is what makes a graded reader work.
- slug: lowercase English words joined by hyphens, no spaces, e.g. kitten-goes-fishing
- Never use double quotes inside a value — use 「」 for Chinese speech and rephrase elsewhere.

Return ONLY a valid JSON object, no markdown fences, no text before or after:
{
  "slug": "...",
  "title_zh": "...",
  "title_en": "...",
  "title_it": "...",
  "summary_zh": "one sentence, what the story is about",
  "summary_en": "one sentence",
  "summary_it": "one sentence",
  "pages": [
    { "text_zh": "...", "pinyin": "...", "text_en": "...", "text_it": "..." }
  ]
}`;

  // ~220 tokens per trilingual page, plus the story-level fields and slack.
  const parsed = await askAIForJSON({
    prompt, provider, maxTokens: Math.min(8000, 1200 + n * 320),
  });

  const pages = Array.isArray(parsed?.pages) ? parsed.pages.map(normalisePage) : [];
  if (!pages.length) {
    throw new Error('AI 没有返回故事页 · The model returned no pages. Try again or switch provider.');
  }

  return {
    slug:       hasText(parsed.slug) ? slugify(parsed.slug) : slugify(parsed.title_en || idea),
    title_zh:   parsed.title_zh   || '',
    title_en:   parsed.title_en   || '',
    title_it:   parsed.title_it   || '',
    summary_zh: parsed.summary_zh || '',
    summary_en: parsed.summary_en || '',
    summary_it: parsed.summary_it || '',
    difficulty,
    pages: pages.filter(p => hasText(p.text_zh)),
  };
}

/**
 * Fill missing translations across a story's pages in one request.
 *
 * Pages are translated together rather than one call each so the model keeps
 * names and recurring phrases consistent down the whole story.
 *
 * @param {array}   pages      rows from clf_story_pages (need id + text_*)
 * @param {string}  sourceLang 'zh' | 'en' | 'it'
 * @param {boolean} overwrite  false → only fill empty targets
 * @returns {object} { [pageId]: { text_en?, text_it? } } — only pages that changed
 */
export async function translatePages({
  pages = [],
  sourceLang = 'zh',
  overwrite = false,
  storyTitle = '',
  provider = 'claude',
} = {}) {
  const srcCol  = `text_${sourceLang}`;
  const targets = ['zh', 'en', 'it'].filter(c => c !== sourceLang);

  // Only send pages that have a source AND are missing at least one target.
  const todo = pages
    .filter(p => hasText(p[srcCol]))
    .map(p => ({
      page: p,
      need: targets.filter(t => overwrite || !hasText(p[`text_${t}`])),
    }))
    .filter(x => x.need.length);

  if (!todo.length) return {};

  const payload = todo.map((x, i) => ({
    i,
    order: x.page.page_order,
    text: x.page[srcCol].trim(),
    into: x.need,
  }));

  const targetNames = targets.map(c => `${LANG_BY_CODE[c].name} (${c})`).join(', ');

  const prompt = `You are translating a children's story for a platform that teaches Chinese to English and Italian speakers.

${storyTitle ? `Story: ${storyTitle}\n` : ''}Below are the pages of one story, in order, in ${LANG_BY_CODE[sourceLang].name}. Translate each page into the languages listed in its "into" array. Possible targets: ${targetNames}.

Rules:
- Read all the pages first. Keep character names, recurring phrases and tense consistent across the whole story.
- Translate for a child: natural, simple, read-aloud friendly. Not word-for-word.
- One page in, one page out — do not merge, split, or reorder pages.
- Use ONLY Simplified Chinese (简体字) for any "zh" output. Never Traditional.
- Never use double quotes inside a value — rephrase instead.

Pages (JSON):
${JSON.stringify(payload, null, 2)}

Return ONLY a valid JSON array, no markdown fences, no text before or after. One entry per input page, echoing its "i", with a key for each requested target language:
[ { "i": 0, "en": "...", "it": "..." } ]`;

  const parsed = await askAIForJSON({
    prompt, provider, maxTokens: Math.min(8000, 800 + todo.length * 260),
  });

  const rows = Array.isArray(parsed) ? parsed : (parsed?.pages || []);
  const patches = {};
  for (const row of rows) {
    const entry = todo[Number(row?.i)];
    if (!entry) continue;
    const patch = {};
    for (const lang of entry.need) {
      const v = row[lang];
      if (hasText(v)) patch[`text_${lang}`] = String(v).trim();
    }
    if (Object.keys(patch).length) patches[entry.page.id] = patch;
  }
  return patches;
}

/**
 * Generate tone-marked pinyin for pages that lack it.
 *
 * @returns {object} { [pageId]: { pinyin } }
 */
export async function pinyinForPages({
  pages = [],
  overwrite = false,
  provider = 'claude',
} = {}) {
  const todo = pages.filter(p => hasText(p.text_zh) && (overwrite || !hasText(p.pinyin)));
  if (!todo.length) return {};

  const payload = todo.map((p, i) => ({ i, text: p.text_zh.trim() }));

  const prompt = `Transcribe each Simplified Chinese sentence below into Hanyu Pinyin.

Rules:
- Tone marks, not tone numbers: "nǐ hǎo", never "ni3 hao3".
- One space between syllables; group syllables of a single word together (e.g. "māma", "diàoyú").
- Apply tone sandhi as it is actually read aloud for 不 and 一 (yì tiān, bú shì).
- Neutral tone gets no mark (e.g. "de", "le", "ma").
- Capitalise the first letter of each sentence and keep the original punctuation in place.
- Return the pinyin only — no Chinese characters, no translation.

Sentences (JSON):
${JSON.stringify(payload, null, 2)}

Return ONLY a valid JSON array, no markdown fences, no text before or after, echoing each "i":
[ { "i": 0, "pinyin": "..." } ]`;

  const parsed = await askAIForJSON({
    prompt, provider, maxTokens: Math.min(6000, 600 + todo.length * 180),
  });

  const rows = Array.isArray(parsed) ? parsed : (parsed?.pages || []);
  const patches = {};
  for (const row of rows) {
    const page = todo[Number(row?.i)];
    if (page && hasText(row?.pinyin)) patches[page.id] = { pinyin: String(row.pinyin).trim() };
  }
  return patches;
}

// ─── Voices — must match VOICE_MAP in netlify/functions/story-tts.js ──────
export const STORY_VOICES = [
  { id: 'xiaoxiao-story', label: '📖 晓晓·讲故事' },
  { id: 'xiaoxiao',       label: '🌸 晓晓·亲切'   },
  { id: 'xiaoyi',         label: '🌟 晓伊·活泼'   },
  { id: 'yunxi-story',    label: '📖 云希·娓娓道来' },
  { id: 'yunxi',          label: '☁️ 云希·清亮'   },
  { id: 'yunyang',        label: '🍂 云扬·成熟'   },
  { id: 'xiaochen',       label: '🌅 晓辰·温暖'   },
];

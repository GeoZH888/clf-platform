// src/admin/lib/aiFields.js
//
// Shared AI field engine for the admin panel.
//
// Two jobs, one gateway:
//   translateFields() — one language is filled → fill the others
//   generateFields()  — nothing is filled → generate from a subject
//
// The platform stores multilingual content as parallel columns with a
// language suffix: meaning_zh / meaning_en / meaning_it. Everything here is
// built on detecting those groups, so any admin tab can opt in without
// declaring its schema by hand.

export const LANGS = [
  { code: 'zh', label: '中文',     name: 'Simplified Chinese' },
  { code: 'en', label: 'English',  name: 'English' },
  { code: 'it', label: 'Italiano', name: 'Italian' },
];
export const LANG_CODES = LANGS.map(l => l.code);
export const LANG_BY_CODE = LANGS.reduce((a, l) => { a[l.code] = l; return a; }, {});

// Columns that end in a language suffix but are not translatable prose.
const NOT_TRANSLATABLE = /^(pinyin|audio|image|url|slug|code|id)_/;

/**
 * Find multilingual field groups in a set of column names.
 * ['meaning_en','meaning_zh','stroke_count'] → [{ base:'meaning', fields:{en,zh} }]
 */
export function detectLangGroups(keys = []) {
  const groups = {};
  for (const key of keys) {
    const m = /^(.+)_(zh|en|it)$/.exec(key);
    if (!m) continue;
    const [, base, lang] = m;
    if (NOT_TRANSLATABLE.test(key)) continue;
    (groups[base] ||= { base, fields: {} }).fields[lang] = key;
  }
  // A group is only useful if it spans more than one language
  return Object.values(groups).filter(g => Object.keys(g.fields).length > 1);
}

const hasText = v => typeof v === 'string' && v.trim().length > 0;

/**
 * Per-language coverage across all groups.
 * → { zh:{filled:2,total:3}, en:{filled:3,total:3}, it:{filled:0,total:3} }
 */
export function langCoverage(values = {}, groups = []) {
  const out = {};
  for (const code of LANG_CODES) {
    const applicable = groups.filter(g => g.fields[code]);
    out[code] = {
      total:  applicable.length,
      filled: applicable.filter(g => hasText(values[g.fields[code]])).length,
    };
  }
  return out;
}

/**
 * Best source language = the one with the most filled fields.
 * Ties break by LANG_CODES order (zh first — it is the authoring language).
 */
export function bestSourceLang(values = {}, groups = []) {
  const cov = langCoverage(values, groups);
  let best = null;
  for (const code of LANG_CODES) {
    if (!cov[code].filled) continue;
    if (!best || cov[code].filled > cov[best].filled) best = code;
  }
  return best;
}

// ── Gateway ───────────────────────────────────────────────────────
// Mirrors the server-side extractor in netlify/functions/ai-gateway.js —
// models wrap JSON in prose or fences often enough to need both sides.
function extractJSON(raw) {
  let text = String(raw || '')
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(text); } catch { /* keep trying */ }
  const match = text.match(/(\{[\s\S]*\})/) || text.match(/(\[[\s\S]*\])/);
  if (match) {
    try { return JSON.parse(match[1]); } catch { /* keep trying */ }
  }
  throw new Error(`AI 返回的不是合法 JSON · Could not parse AI response. Raw: ${String(raw).slice(0, 200)}`);
}

/**
 * Send a prompt through the shared ai-gateway and parse a JSON reply.
 * Throws with a readable message — callers surface it in the UI.
 */
export async function askAIForJSON({ prompt, provider = 'claude', maxTokens = 2000 }) {
  const res = await fetch('/.netlify/functions/ai-gateway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'generate_text', provider, prompt, max_tokens: maxTokens }),
  });
  const bodyText = await res.text();
  if (!bodyText) throw new Error('AI 网关返回空响应 · Empty response from ai-gateway.');
  if (bodyText.trimStart().startsWith('<')) {
    throw new Error(`AI 网关错误 (${res.status}) · Check the Netlify function logs.`);
  }
  let payload;
  try { payload = JSON.parse(bodyText); }
  catch { throw new Error(`AI 网关响应无法解析 · ${bodyText.slice(0, 200)}`); }
  if (!res.ok || payload.error) throw new Error(payload.error || `HTTP ${res.status}`);
  return extractJSON(payload.result ?? payload.content ?? payload.text ?? '');
}

// ── Translate ─────────────────────────────────────────────────────
/**
 * Translate every group that has a source value into the target languages.
 *
 * @param {object}   values      current field values, keyed by column name
 * @param {array}    groups      from detectLangGroups(); defaults to auto-detect
 * @param {string}   sourceLang  'zh' | 'en' | 'it'; defaults to bestSourceLang()
 * @param {string[]} targetLangs defaults to the other two
 * @param {boolean}  overwrite   false → only fill empty targets
 * @param {string}   context     e.g. 'Chinese character 日 (rì)' — steers register
 * @returns {object} patch of { column: translatedText } — empty if nothing to do
 */
export async function translateFields({
  values = {},
  groups,
  sourceLang,
  targetLangs,
  overwrite = false,
  context = '',
  provider = 'claude',
} = {}) {
  const gs  = groups || detectLangGroups(Object.keys(values));
  const src = sourceLang || bestSourceLang(values, gs);
  if (!src) throw new Error('没有可作为翻译源的内容 · No filled language to translate from.');

  const targets = (targetLangs || LANG_CODES.filter(c => c !== src))
    .filter(c => c !== src && gs.some(g => g.fields[c]));
  if (!targets.length) throw new Error('没有可填充的目标语言 · No target language columns exist.');

  // Only send groups that have a source value AND at least one target to fill
  const payload = {};
  const wanted  = {};
  for (const g of gs) {
    const srcCol = g.fields[src];
    if (!srcCol || !hasText(values[srcCol])) continue;
    const need = targets.filter(t => g.fields[t] && (overwrite || !hasText(values[g.fields[t]])));
    if (!need.length) continue;
    payload[g.base] = values[srcCol].trim();
    wanted[g.base]  = need;
  }
  if (!Object.keys(payload).length) return {};

  const targetNames = targets.map(c => `${LANG_BY_CODE[c].name} (${c})`).join(', ');
  const prompt = `You are a content editor for a platform that teaches Chinese to English and Italian speakers.

Translate each field below from ${LANG_BY_CODE[src].name} into: ${targetNames}.

Rules:
- Use ONLY Simplified Chinese (简体字) for the "zh" output. Never Traditional.
- These strings are shown directly to learners. Match the source's length, tone and register — a one-line memory hook stays a one-line memory hook.
- Keep any Chinese characters, pinyin syllables, or quoted example sentences exactly as they appear in the source.
- Translate the meaning, not word-for-word. Do not add explanations, notes, or commentary.
- Never use double quotes inside a value — rephrase instead.
${context ? `\nContext for these fields: ${context}\n` : ''}
Fields to translate (JSON):
${JSON.stringify(payload, null, 2)}

Return ONLY a valid JSON object, no markdown fences, no text before or after, shaped exactly like:
${JSON.stringify(
  Object.fromEntries(Object.keys(payload).map(k => [k, Object.fromEntries(wanted[k].map(t => [t, '...']))])),
  null, 2)}`;

  const parsed = await askAIForJSON({ prompt, provider, maxTokens: 3000 });

  const patch = {};
  for (const [base, langs] of Object.entries(parsed || {})) {
    const group = gs.find(g => g.base === base);
    if (!group || !langs || typeof langs !== 'object') continue;
    for (const [lang, text] of Object.entries(langs)) {
      const col = group.fields[lang];
      if (!col || !wanted[base]?.includes(lang) || !hasText(text)) continue;
      patch[col] = String(text).trim();
    }
  }
  return patch;
}

// ── Generate ──────────────────────────────────────────────────────
/**
 * Generate values for empty fields from scratch.
 *
 * @param {string} subject  what the record is about, e.g. '成语「画蛇添足」'
 * @param {array}  fields   [{ key, label, hint }] — describe what each column holds
 * @param {object} values   current values; filled ones are shown as context and kept
 * @param {boolean} overwrite  false → only generate empty fields
 * @returns {object} patch of { column: value }
 */
export async function generateFields({
  subject,
  fields = [],
  values = {},
  overwrite = false,
  context = '',
  provider = 'claude',
} = {}) {
  if (!subject || !String(subject).trim()) {
    throw new Error('请先填写主词条 · Fill the main entry first (the AI needs a subject).');
  }
  const todo = fields.filter(f => overwrite || !hasText(values[f.key]));
  if (!todo.length) return {};

  const known = fields
    .filter(f => hasText(values[f.key]))
    .map(f => `- ${f.key}: ${values[f.key]}`)
    .join('\n');

  const spec = todo
    .map(f => `  "${f.key}": "${f.hint || f.label || f.key}"`)
    .join(',\n');

  const prompt = `You are an expert Chinese-language teacher writing content for a platform that teaches Chinese to English and Italian speakers.

Subject: ${subject}
${context ? `Context: ${context}\n` : ''}${known ? `\nAlready known — stay consistent with these, do not contradict them:\n${known}\n` : ''}
Fill in the following fields. Each value's description tells you what it must contain:
{
${spec}
}

Rules:
- Use ONLY Simplified Chinese (简体字) in Chinese fields. Never Traditional.
- Fields ending in _en are English, _it are Italian, _zh are Simplified Chinese.
- Keep values concise and learner-facing — this text is displayed in the app as-is.
- Never use double quotes inside a value — rephrase instead.
- If you genuinely cannot determine a field, use an empty string rather than inventing a fact.

Return ONLY a valid JSON object with exactly those keys, no markdown fences, no text before or after.`;

  const parsed = await askAIForJSON({ prompt, provider, maxTokens: 3000 });

  const patch = {};
  for (const f of todo) {
    const v = parsed?.[f.key];
    if (hasText(v)) patch[f.key] = String(v).trim();
    else if (typeof v === 'number') patch[f.key] = v;
  }
  return patch;
}

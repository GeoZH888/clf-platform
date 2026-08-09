-- ═══════════════════════════════════════════════════════════════════════════
-- clf_prompt_templates : ADD grammar prompts (incremental migration)
-- ═══════════════════════════════════════════════════════════════════════════
-- Run AFTER clf_prompt_templates_setup.sql.
-- Idempotent: existing rows untouched (on conflict do nothing).
-- If you want to OVERWRITE existing grammar_text/grammar_single rows, change
-- the conflict clause to `do update set template = excluded.template, ...`.

insert into clf_prompt_templates (key, name, description, template, variables) values
(
  'grammar_text',
  '语法批量生成',
  'GrammarPointBatchPanel 批量生成语法点（包含完整 LEVELING 指南 + JSON 转义规则）',
  $prompt$You generate grammar-topic entries for a Chinese learning
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
  Example: "explanation": "这是 \"被\" 字句的结构..."
- Do NOT use Chinese curly quotes “ ” 『 』 anywhere — only ASCII " for JSON syntax.
- Use ASCII commas , and colons : in the JSON structure (not ， ：).

Output ONLY a JSON array. No markdown fences. No preamble. No trailing prose.
{avoid_block}{level_hint}{count_hint}

User request:
"""
{user_input}
"""

If the request is a list of ids/slugs, generate one entry per id.
If the request is a theme or empty (auto-fill mode), invent appropriate
grammar topics for the target level that AREN'T in the avoid list.

Return ONLY the JSON array.$prompt$,
  $vars${
    "user_input":  {"type":"text",   "example":"ba_zi_ju\nbei_zi_ju\n或：二级里关于比较和对比的语法", "desc":"用户输入：id 列表 / 主题描述 / auto-fill"},
    "avoid_block": {"type":"text",   "example":"\nAVOID these ids (already in database): ba_zi_ju, le_aspect", "desc":"已存在的 ids 提示（前置 \\n，可空）"},
    "level_hint":  {"type":"text",   "example":"\nTarget level: L3.", "desc":"目标级别提示（前置 \\n，可空）"},
    "count_hint":  {"type":"text",   "example":"\nGenerate exactly 5 grammar topics.", "desc":"数量提示（前置 \\n，可空）"}
  }$vars$::jsonb
),
(
  'grammar_single',
  '语法单条重新生成',
  '单条语法点的 🔁 重生成按钮使用',
  $prompt$You generate grammar-topic entries for a Chinese learning
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
  Example: "explanation": "这是 \"被\" 字句的结构..."
- Do NOT use Chinese curly quotes “ ” 『 』 anywhere — only ASCII " for JSON syntax.
- Use ASCII commas , and colons : in the JSON structure (not ， ：).

Output ONLY a JSON array. No markdown fences. No preamble. No trailing prose.

AVOID these ids: {avoid_ids}

Regenerate the grammar topic with id "{id}" at level L{level}.
Return a JSON array with exactly ONE object.$prompt$,
  $vars${
    "id":         {"type":"text",   "example":"ba_zi_ju",                         "desc":"要重新生成的语法点 id"},
    "level":      {"type":"text",   "example":"3",                                 "desc":"目标级别 1-5（也接受 'auto'）"},
    "avoid_ids":  {"type":"text",   "example":"le_aspect, bei_zi_ju, bi_jiao",     "desc":"逗号分隔的现有 ids（不含正在重新生成的那个）"}
  }$vars$::jsonb
)
on conflict (key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verify
-- ═══════════════════════════════════════════════════════════════════════════
select key, name, length(template) as tpl_len
  from clf_prompt_templates
  order by key;

-- ═══════════════════════════════════════════════════════════════════════════
-- clf_prompt_templates : ADD poem prompts (incremental migration)
-- ═══════════════════════════════════════════════════════════════════════════
-- Run AFTER clf_prompt_templates_setup.sql.
-- Idempotent: existing rows untouched (on conflict do nothing).

insert into clf_prompt_templates (key, name, description, template, variables) values

-- ─── Image styles (5 + custom) ────────────────────────────────────────────
(
  'poem_image_ink',
  '诗词插图 · 水墨风',
  '诗词插图 - 传统水墨风（默认风格）',
  $prompt$Traditional Chinese ink wash painting (水墨画) illustrating the poem "{title}" by {author} ({dynasty} dynasty). Atmospheric, monochrome with subtle color washes, brush stroke texture, vertical scroll composition.

Poem theme: {theme_hint}

Style references: Song-dynasty landscape painting, Mi Fu and Xia Gui aesthetics. Soft mist, suggested forms, negative space prioritized over detail. Quiet, contemplative mood.

STRICT: no Chinese characters, calligraphy, or text anywhere in the image. No seal stamps. No people unless the poem explicitly describes one.$prompt$,
  $vars${
    "title":      {"type":"text", "example":"静夜思",        "desc":"诗题（中文）"},
    "author":     {"type":"text", "example":"李白",          "desc":"作者"},
    "dynasty":    {"type":"text", "example":"唐",            "desc":"朝代"},
    "theme_hint": {"type":"text", "example":"a traveler missing home, moonlight on bed, autumn night solitude", "desc":"主题提示（英文，由代码自动从 background_en 或 lines 推导）"}
  }$vars$::jsonb
),
(
  'poem_image_classical',
  '诗词插图 · 工笔风',
  '诗词插图 - 传统工笔重彩风',
  $prompt$Traditional Chinese gongbi (工笔) painting illustrating the poem "{title}" by {author} ({dynasty} dynasty). Fine outline, rich mineral pigments (azurite blue, malachite green, vermilion), meticulous detail, decorative composition.

Poem theme: {theme_hint}

Style references: Tang-dynasty palace paintings, Song-dynasty bird-and-flower studies. Refined, ornamental, slightly stylized. Saturated colors against soft cream background.

STRICT: no Chinese characters, calligraphy, or text anywhere in the image. No seal stamps. No watermarks.$prompt$,
  $vars${
    "title":      {"type":"text", "example":"春晓",          "desc":"诗题（中文）"},
    "author":     {"type":"text", "example":"孟浩然",        "desc":"作者"},
    "dynasty":    {"type":"text", "example":"唐",            "desc":"朝代"},
    "theme_hint": {"type":"text", "example":"spring morning, birds singing, scattered blossoms after rain", "desc":"主题提示（英文）"}
  }$vars$::jsonb
),
(
  'poem_image_atmospheric',
  '诗词插图 · 意境风',
  '诗词插图 - 现代意境氛围风（适合抽象/情感强烈的诗）',
  $prompt$Atmospheric, mood-driven illustration evoking the emotional core of the poem "{title}" by {author}. Painterly digital art, soft edges, dreamy lighting.

Emotional theme: {theme_hint}

Style: cinematic, painterly, slightly impressionistic. Muted color palette dominated by one or two atmospheric tones. Light is the main subject. Suitable as a contemplative backdrop.

STRICT: no Chinese characters, calligraphy, or text anywhere in the image. Avoid stereotypical "Asian-themed" decorative elements (lanterns, dragons, fans) unless the poem explicitly describes them.$prompt$,
  $vars${
    "title":      {"type":"text", "example":"登鹳雀楼",      "desc":"诗题（中文）"},
    "author":     {"type":"text", "example":"王之涣",        "desc":"作者"},
    "dynasty":    {"type":"text", "example":"唐",            "desc":"朝代"},
    "theme_hint": {"type":"text", "example":"vast horizon, sunset light fading over mountain river, sense of aspiration", "desc":"情感主题提示（英文）"}
  }$vars$::jsonb
),
(
  'poem_image_modern',
  '诗词插图 · 现代插画',
  '诗词插图 - 现代教材插画风（适合儿童/初学者教材）',
  $prompt$Modern children's textbook illustration of the poem "{title}" by {author} ({dynasty} dynasty). Friendly cartoon-illustration style, warm colors, scene-based.

Poem scene: {theme_hint}

Style: contemporary editorial illustration, flat shapes with subtle shading, friendly characters if any, clean composition. Suitable for elementary Chinese textbook for foreign learners.

STRICT: no Chinese characters or text. White or pastel background. No watermarks.$prompt$,
  $vars${
    "title":      {"type":"text", "example":"咏鹅",          "desc":"诗题（中文）"},
    "author":     {"type":"text", "example":"骆宾王",        "desc":"作者"},
    "dynasty":    {"type":"text", "example":"唐",            "desc":"朝代"},
    "theme_hint": {"type":"text", "example":"a child watching white geese swim on a pond, red feet paddling clear water", "desc":"场景描述（英文）"}
  }$vars$::jsonb
),

-- ─── Text generation ──────────────────────────────────────────────────────
(
  'poem_text_generate',
  '诗词批量生成',
  '批量生成新诗（指定朝代+体裁，自动避开已有的）',
  $prompt$You are a Chinese poetry expert. Generate exactly 1 famous {dynasty}代 Chinese {type} poem suitable for language learners.

{avoid_block}

Respond with ONLY a JSON object. No explanation, no markdown, no code fences.

⚠️ JSON ESCAPING (critical):
- Inner double quotes in string values MUST be backslash-escaped.
- Do NOT use Chinese curly quotes “ ” 『 』 — only ASCII " for JSON syntax.
- Use ASCII commas , and colons : in the JSON structure.

Fields required:
- title: poem title in Chinese
- title_en: English title
- title_it: Italian title (idiomatic, not literal)
- author: poet name
- dynasty: "{dynasty}"
- type: "{type}"
- difficulty: 2
- lines: array of poem lines (each line as a string)
- pinyin_map: object where key is line index (string), value is array of pinyin per character with tone marks (e.g. "0":["chuáng","qián","míng","yuè","guāng"])
- translation_zh: modern Chinese translation
- translation_en: English translation, idiomatic
- translation_it: Italian translation, idiomatic
- background_zh: historical context in Chinese, under 60 characters
- background_en: historical context in English, under 50 words
- background_it: historical context in Italian, under 50 words
- notes_zh: vocabulary notes in Chinese, under 30 characters
- notes_en: brief English notes
- notes_it: brief Italian notes
- image_prompt: a concise English description for an ink painting illustration of this poem, focused on visual scene (mountains, moon, traveler, etc.) — used later for image generation
- sort_order: {sort_order}$prompt$,
  $vars${
    "dynasty":     {"type":"text",   "example":"唐",         "desc":"朝代（中文，用于过滤）"},
    "type":        {"type":"text",   "example":"七言绝句",   "desc":"体裁"},
    "avoid_block": {"type":"text",   "example":"Do NOT use any of these (already in database): 静夜思、春晓、登鹳雀楼", "desc":"避开列表（前置文本，可空）"},
    "sort_order":  {"type":"number", "example":5,            "desc":"排序号"}
  }$vars$::jsonb
),
(
  'poem_text_complete',
  '诗词翻译/拼音/背景补全',
  '为已有诗词生成 翻译+拼音+背景+插图prompt',
  $prompt$For the Chinese poem "{title}" by {author}:
Lines: {lines_joined}

Return ONLY JSON (no markdown, no code fences).

⚠️ JSON ESCAPING (critical):
- Inner double quotes in string values MUST be backslash-escaped.
- Do NOT use Chinese curly quotes “ ” 『 』 — only ASCII " for JSON syntax.

{
  "pinyin_map":{"0":["pinyin","per","char"],"1":["..."]},
  "translation_zh":"现代汉语逐句译文",
  "translation_en":"English line-by-line translation",
  "translation_it":"Traduzione italiana verso per verso",
  "background_zh":"创作背景故事（100字，生动有趣）",
  "background_en":"Historical background and story (80 words)",
  "background_it":"Contesto storico e storia (80 parole)",
  "notes_zh":"字词注释",
  "notes_en":"vocabulary notes",
  "notes_it":"note sul vocabolario",
  "image_prompt":"A traditional Chinese ink painting illustrating this poem, atmospheric, no text"
}$prompt$,
  $vars${
    "title":        {"type":"text", "example":"静夜思",                 "desc":"诗题"},
    "author":       {"type":"text", "example":"李白",                   "desc":"作者"},
    "lines_joined": {"type":"text", "example":"床前明月光 / 疑是地上霜 / 举头望明月 / 低头思故乡", "desc":"诗句拼接（用 ' / ' 分隔）"}
  }$vars$::jsonb
)

on conflict (key) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- Verify
-- ───────────────────────────────────────────────────────────────────────────
-- Expected: 6 new rows, total 15 (chengyu 2 + grammar 2 + word 5 + poem 6)
select key, name from clf_prompt_templates
  where key like 'poem_%'
  order by key;

select count(*) as total_templates from clf_prompt_templates;

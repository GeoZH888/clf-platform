-- ═══════════════════════════════════════════════════════════════════════════
-- clf_prompt_templates : ADD word_image_* prompts (incremental migration)
-- ═══════════════════════════════════════════════════════════════════════════
-- Run AFTER clf_prompt_templates_setup.sql.
-- Idempotent: existing rows untouched (on conflict do nothing).

insert into clf_prompt_templates (key, name, description, template, variables) values
(
  'word_image_flashcard',
  '词语插图 · 闪卡风',
  '词语插图工作室 - flashcard 风格（教学闪卡，单一主体，白底，明亮色彩）',
  $prompt$Clean educational flashcard illustration of "{meaning_en}" (Chinese: {word_zh}) for vocabulary learners. Single central subject, white background, bright primary colors, bold clean shapes, no text, suitable for language-learning app. Simple and instantly recognizable.$prompt$,
  $vars${
    "word_zh":    {"type":"text", "example":"红色",  "desc":"中文词语，由代码自动填充"},
    "meaning_en": {"type":"text", "example":"Red",   "desc":"英文释义（fallback meaning_zh，再 fallback 空字符串）"}
  }$vars$::jsonb
),
(
  'word_image_photo',
  '词语插图 · 实景照',
  '词语插图工作室 - photo 风格（高质量教育摄影，写实风格）',
  $prompt$High-quality educational photograph of "{meaning_en}" (Chinese: {word_zh}). Clear focus, neutral background, well-lit studio style, single subject. Suitable for language-learning flashcard. Photorealistic, no text.$prompt$,
  $vars${
    "word_zh":    {"type":"text", "example":"苹果",  "desc":"中文词语，由代码自动填充"},
    "meaning_en": {"type":"text", "example":"Apple", "desc":"英文释义（fallback meaning_zh，再 fallback 空字符串）"}
  }$vars$::jsonb
),
(
  'word_image_emoji',
  '词语插图 · 表情符',
  '词语插图工作室 - emoji 风格（Apple/Google 表情符美学，圆润友好）',
  $prompt$Large emoji-style illustration of "{meaning_en}" on a plain white background. Round, friendly, glossy aesthetic similar to Apple/Google emoji design. Single centered subject, bright colors, soft shadow, no text.$prompt$,
  $vars${
    "word_zh":    {"type":"text", "example":"开心",  "desc":"中文词语，由代码自动填充"},
    "meaning_en": {"type":"text", "example":"Happy", "desc":"英文释义（fallback meaning_zh，再 fallback 空字符串）"}
  }$vars$::jsonb
),
(
  'word_image_cartoon',
  '词语插图 · 卡通画',
  '词语插图工作室 - cartoon 风格（儿童中文教材风，柔和色彩，圆角）',
  $prompt$Cute cartoon illustration of "{meaning_en}" (Chinese: {word_zh}) for children's Chinese textbook. Friendly characters or objects, pastel colors, rounded shapes, playful style, white background, no text. Evokes warmth and fun.$prompt$,
  $vars${
    "word_zh":    {"type":"text", "example":"小狗",   "desc":"中文词语，由代码自动填充"},
    "meaning_en": {"type":"text", "example":"Puppy",  "desc":"英文释义（fallback meaning_zh，再 fallback 空字符串）"}
  }$vars$::jsonb
),
(
  'word_image_abstract',
  '词语插图 · 抽象画',
  '词语插图工作室 - abstract 风格（极简几何象征性表达，适合抽象概念词）',
  $prompt$Abstract minimalist illustration evoking the concept of "{meaning_en}". Geometric shapes, muted color palette, flat design, symbolic rather than literal. Suitable for modern educational material. No text.$prompt$,
  $vars${
    "word_zh":    {"type":"text", "example":"自由",     "desc":"中文词语，由代码自动填充"},
    "meaning_en": {"type":"text", "example":"Freedom",  "desc":"英文释义（fallback meaning_zh，再 fallback 空字符串）"}
  }$vars$::jsonb
)
on conflict (key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verify
-- ═══════════════════════════════════════════════════════════════════════════
-- Should return 9 rows total: 2 chengyu + 2 grammar + 5 word_image
select key, name, length(template) as tpl_len
  from clf_prompt_templates
  order by key;

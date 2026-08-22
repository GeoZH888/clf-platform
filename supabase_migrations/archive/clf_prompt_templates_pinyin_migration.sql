-- ═══════════════════════════════════════════════════════════════════════════
-- clf_prompt_templates : ADD poem_pinyin_regen (incremental)
-- ═══════════════════════════════════════════════════════════════════════════
-- For the "✨ AI 重新生成拼音" button in PoetryAdminTab edit panel.
-- Idempotent: existing row untouched.

insert into clf_prompt_templates (key, name, description, template, variables) values
(
  'poem_pinyin_regen',
  '诗词拼音重新生成',
  '为已有诗词的每一行重新生成带声调的拼音 (pinyin_map jsonb)',
  $prompt$For the Chinese poem with these lines (each line is one entry, character by character):

{lines_numbered}

Generate accurate Hanyu Pinyin with TONE MARKS for every character.

Return ONLY a JSON object with this exact structure (no markdown, no preamble):
{
  "0": ["pinyin1", "pinyin2", ...],
  "1": ["pinyin1", "pinyin2", ...],
  ...
}

CRITICAL RULES:
- Tone marks ONLY (ā á ǎ à), never numbers (a1 a2 a3 a4).
- One pinyin syllable per character. Punctuation is skipped.
- Multi-character poems: one array per line, line index as string key.
- Use polyphonic readings appropriate to classical Chinese poetry context
  (e.g. 行 may be háng or xíng depending on meaning).
- For 一/不 sandhi rules, use the SURFACE tone as actually pronounced
  (e.g. 一片 → yí piàn, not yī piàn).

⚠️ JSON ESCAPING: ASCII double quotes only, no Chinese curly quotes.

Example output for "床前明月光 / 疑是地上霜":
{"0":["chuáng","qián","míng","yuè","guāng"],"1":["yí","shì","dì","shàng","shuāng"]}$prompt$,
  $vars${
    "lines_numbered": {"type":"text", "example":"Line 0: 床前明月光\nLine 1: 疑是地上霜\nLine 2: 举头望明月\nLine 3: 低头思故乡", "desc":"诗句按行编号（前端拼接）"}
  }$vars$::jsonb
)
on conflict (key) do nothing;

-- Verify
select key, name from clf_prompt_templates
  where key = 'poem_pinyin_regen';

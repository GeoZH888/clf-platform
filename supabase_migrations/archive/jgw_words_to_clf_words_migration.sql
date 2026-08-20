-- ═══════════════════════════════════════════════════════════════════
-- Merge legacy jgw_words data into clf_words (CLF consolidation)
--
-- Strategy: INSERT ... ON CONFLICT DO UPDATE with COALESCE.
--   - New words from jgw_words are inserted into clf_words
--   - Overlapping words_zh are updated with legacy values WHERE those
--     values are not null (so legacy image_url fills in, but won't blank
--     out any clf_words fields already set)
--   - jgw_words is NOT modified; remains as read-only backup
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO clf_words (
  word_zh, pinyin,
  meaning_en, meaning_it, meaning_zh,
  example_zh, example_en, example_it,
  image_url, theme, hsk_level
)
SELECT
  word_zh, pinyin,
  meaning_en, meaning_it, meaning_zh,
  example_zh, example_en, example_it,
  image_url, theme, hsk_level
FROM jgw_words
WHERE word_zh IS NOT NULL
ON CONFLICT (word_zh) DO UPDATE SET
  pinyin     = COALESCE(EXCLUDED.pinyin,     clf_words.pinyin),
  meaning_en = COALESCE(EXCLUDED.meaning_en, clf_words.meaning_en),
  meaning_it = COALESCE(EXCLUDED.meaning_it, clf_words.meaning_it),
  meaning_zh = COALESCE(EXCLUDED.meaning_zh, clf_words.meaning_zh),
  example_zh = COALESCE(EXCLUDED.example_zh, clf_words.example_zh),
  example_en = COALESCE(EXCLUDED.example_en, clf_words.example_en),
  example_it = COALESCE(EXCLUDED.example_it, clf_words.example_it),
  image_url  = COALESCE(EXCLUDED.image_url,  clf_words.image_url),
  theme      = COALESCE(EXCLUDED.theme,      clf_words.theme),
  hsk_level  = COALESCE(EXCLUDED.hsk_level,  clf_words.hsk_level);

-- Re-apply greetings → not illustratable (preserves prior pedagogical decision)
UPDATE clf_words SET illustratable = false
WHERE theme = 'greetings';

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT COUNT(*) AS total,
       COUNT(image_url) AS with_image,
       COUNT(DISTINCT theme) AS themes
FROM clf_words;

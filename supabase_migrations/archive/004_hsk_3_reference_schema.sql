-- ═══════════════════════════════════════════════════════════════════════
--  大卫学中文 — HSK 3.0 Reference Schema
--
--  基于国际中文教育中文水平等级标准 GF 0025-2021,四张表:
--    1. hanzi_reference        — 3,000 字
--    2. hanzi_pronunciations   — 字的读音(多音字每个读音一行)
--    3. ci_reference           — 11,092 词
--    4. ci_chars               — 词 ↔ 字 连接表(一个词由几个字组成)
--    5. hsk_syllables          — 412 音节
--    6. hsk_grammar            — 572 语法点
--
--  HSK 等级: 1-9
--    初等 (Elementary):   1, 2, 3
--    中等 (Intermediate): 4, 5, 6
--    高等 (Advanced):     7, 8, 9
--
--  Safe to run multiple times. Does NOT touch existing jgw_characters /
--  jgw_words — those stay as teaching-overlay tables.
-- ═══════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 1. 字表 (Characters) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hanzi_reference (
  glyph              text PRIMARY KEY,          -- '七' (简体)
  glyph_trad         text,                       -- '七' (繁体,可能相同)
  stroke_count       int,
  radical            text,                       -- 部首
  radical_strokes    int,
  unicode_hex        text,                       -- 'U+4E03'
  hsk_level          int,                        -- 1-9, NULL if not in HSK
  hsk_band           text,                       -- 'elementary' | 'intermediate' | 'advanced'
  frequency_rank     int,                        -- 频率排名 (越小越常用)
  pictograph_type    text,                       -- 象形/指事/会意/形声
  etymology          jsonb DEFAULT '{}'::jsonb,  -- 字源信息
  created_at         timestamptz DEFAULT now()
);

-- idempotent column adds
ALTER TABLE hanzi_reference ADD COLUMN IF NOT EXISTS glyph_trad      text;
ALTER TABLE hanzi_reference ADD COLUMN IF NOT EXISTS stroke_count    int;
ALTER TABLE hanzi_reference ADD COLUMN IF NOT EXISTS radical         text;
ALTER TABLE hanzi_reference ADD COLUMN IF NOT EXISTS radical_strokes int;
ALTER TABLE hanzi_reference ADD COLUMN IF NOT EXISTS unicode_hex     text;
ALTER TABLE hanzi_reference ADD COLUMN IF NOT EXISTS hsk_level       int;
ALTER TABLE hanzi_reference ADD COLUMN IF NOT EXISTS hsk_band        text;
ALTER TABLE hanzi_reference ADD COLUMN IF NOT EXISTS frequency_rank  int;
ALTER TABLE hanzi_reference ADD COLUMN IF NOT EXISTS pictograph_type text;
ALTER TABLE hanzi_reference ADD COLUMN IF NOT EXISTS etymology       jsonb DEFAULT '{}'::jsonb;
ALTER TABLE hanzi_reference ADD COLUMN IF NOT EXISTS created_at      timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_hanzi_hsk_level   ON hanzi_reference(hsk_level);
CREATE INDEX IF NOT EXISTS idx_hanzi_hsk_band    ON hanzi_reference(hsk_band);
CREATE INDEX IF NOT EXISTS idx_hanzi_frequency   ON hanzi_reference(frequency_rank);
CREATE INDEX IF NOT EXISTS idx_hanzi_radical     ON hanzi_reference(radical);

-- ── 2. 字的读音(多音字) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hanzi_pronunciations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  glyph              text REFERENCES hanzi_reference(glyph) ON DELETE CASCADE,
  pinyin             text,                       -- 'qī' (带声调符号)
  pinyin_numbered    text,                       -- 'qi1' (数字声调)
  tone               int,                        -- 1-4, 0 (轻声)
  ipa                text,                       -- IPA 音标
  is_primary         boolean DEFAULT false,      -- 主要读音
  meaning_zh         text,
  meaning_en         text,
  meaning_it         text,
  sort_order         int DEFAULT 0,
  UNIQUE (glyph, pinyin)
);

ALTER TABLE hanzi_pronunciations ADD COLUMN IF NOT EXISTS ipa             text;
ALTER TABLE hanzi_pronunciations ADD COLUMN IF NOT EXISTS is_primary      boolean DEFAULT false;
ALTER TABLE hanzi_pronunciations ADD COLUMN IF NOT EXISTS pinyin_numbered text;
ALTER TABLE hanzi_pronunciations ADD COLUMN IF NOT EXISTS tone            int;
ALTER TABLE hanzi_pronunciations ADD COLUMN IF NOT EXISTS meaning_it      text;
ALTER TABLE hanzi_pronunciations ADD COLUMN IF NOT EXISTS sort_order      int DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pron_glyph  ON hanzi_pronunciations(glyph);
CREATE INDEX IF NOT EXISTS idx_pron_pinyin ON hanzi_pronunciations(pinyin);

-- ── 3. 词表 (Words) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ci_reference (
  word               text PRIMARY KEY,           -- '老师'
  word_trad          text,                        -- 繁体 '老師'
  pinyin             text,                        -- 'lǎo shī'
  pinyin_numbered    text,                        -- 'lao3 shi1'
  hsk_level          int,                         -- 1-9
  hsk_band           text,                        -- elementary/intermediate/advanced
  pos                text,                        -- 词性: noun, verb, adj, ...
  meaning_zh         text,
  meaning_en         text,
  meaning_it         text,
  example_zh         text,
  example_en         text,
  example_it         text,
  frequency_rank     int,
  char_count         int,                         -- 词长 (字数)
  created_at         timestamptz DEFAULT now()
);

ALTER TABLE ci_reference ADD COLUMN IF NOT EXISTS word_trad       text;
ALTER TABLE ci_reference ADD COLUMN IF NOT EXISTS pinyin_numbered text;
ALTER TABLE ci_reference ADD COLUMN IF NOT EXISTS hsk_level       int;
ALTER TABLE ci_reference ADD COLUMN IF NOT EXISTS hsk_band        text;
ALTER TABLE ci_reference ADD COLUMN IF NOT EXISTS pos             text;
ALTER TABLE ci_reference ADD COLUMN IF NOT EXISTS meaning_zh      text;
ALTER TABLE ci_reference ADD COLUMN IF NOT EXISTS meaning_en      text;
ALTER TABLE ci_reference ADD COLUMN IF NOT EXISTS meaning_it      text;
ALTER TABLE ci_reference ADD COLUMN IF NOT EXISTS example_zh      text;
ALTER TABLE ci_reference ADD COLUMN IF NOT EXISTS example_en      text;
ALTER TABLE ci_reference ADD COLUMN IF NOT EXISTS example_it      text;
ALTER TABLE ci_reference ADD COLUMN IF NOT EXISTS frequency_rank  int;
ALTER TABLE ci_reference ADD COLUMN IF NOT EXISTS char_count      int;
ALTER TABLE ci_reference ADD COLUMN IF NOT EXISTS created_at      timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ci_hsk_level ON ci_reference(hsk_level);
CREATE INDEX IF NOT EXISTS idx_ci_hsk_band  ON ci_reference(hsk_band);
CREATE INDEX IF NOT EXISTS idx_ci_freq      ON ci_reference(frequency_rank);
CREATE INDEX IF NOT EXISTS idx_ci_pos       ON ci_reference(pos);

-- ── 4. 词 ↔ 字 连接 ────────────────────────────────────────────────────
-- 让我们能查询: "有哪些 HSK 词含有 '七' 这个字?"
CREATE TABLE IF NOT EXISTS ci_chars (
  word               text REFERENCES ci_reference(word) ON DELETE CASCADE,
  position           int,                         -- 第几个字 (1-indexed)
  glyph              text REFERENCES hanzi_reference(glyph) ON DELETE RESTRICT,
  PRIMARY KEY (word, position)
);

CREATE INDEX IF NOT EXISTS idx_ci_chars_glyph ON ci_chars(glyph);

-- ── 5. 音节表 (Syllables) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hsk_syllables (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syllable           text UNIQUE,                 -- 'ā' (带声调) 或 'a' (不带)
  pinyin_numbered    text,                        -- 'a1'
  tone               int,                         -- 0-4
  initial            text,                        -- 声母 'y', 'sh', NULL
  final              text,                        -- 韵母 'ang', 'i'
  ipa                text,
  example_chars      text,                        -- 示例字 '阿 啊 锕'
  notes              text                         -- 备注
);

ALTER TABLE hsk_syllables ADD COLUMN IF NOT EXISTS initial      text;
ALTER TABLE hsk_syllables ADD COLUMN IF NOT EXISTS final        text;
ALTER TABLE hsk_syllables ADD COLUMN IF NOT EXISTS example_chars text;

CREATE INDEX IF NOT EXISTS idx_syll_initial ON hsk_syllables(initial);
CREATE INDEX IF NOT EXISTS idx_syll_final   ON hsk_syllables(final);

-- ── 6. 语法表 (Grammar points) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hsk_grammar (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  point_id           text UNIQUE,                 -- 官方编号 (如果有)
  pattern            text,                        -- '是...的'
  title_zh           text,
  title_en           text,
  title_it           text,
  hsk_level          int,                         -- 1-9
  hsk_band           text,                        -- elementary/intermediate/advanced
  category           text,                        -- 句型/虚词/连词...
  explanation_zh     text,
  explanation_en     text,
  explanation_it     text,
  examples           jsonb DEFAULT '[]'::jsonb,   -- [{zh, en, it}]
  sort_order         int DEFAULT 0,
  created_at         timestamptz DEFAULT now()
);

ALTER TABLE hsk_grammar ADD COLUMN IF NOT EXISTS point_id       text;
ALTER TABLE hsk_grammar ADD COLUMN IF NOT EXISTS pattern        text;
ALTER TABLE hsk_grammar ADD COLUMN IF NOT EXISTS title_zh       text;
ALTER TABLE hsk_grammar ADD COLUMN IF NOT EXISTS title_en       text;
ALTER TABLE hsk_grammar ADD COLUMN IF NOT EXISTS title_it       text;
ALTER TABLE hsk_grammar ADD COLUMN IF NOT EXISTS hsk_level      int;
ALTER TABLE hsk_grammar ADD COLUMN IF NOT EXISTS hsk_band       text;
ALTER TABLE hsk_grammar ADD COLUMN IF NOT EXISTS category       text;
ALTER TABLE hsk_grammar ADD COLUMN IF NOT EXISTS explanation_zh text;
ALTER TABLE hsk_grammar ADD COLUMN IF NOT EXISTS explanation_en text;
ALTER TABLE hsk_grammar ADD COLUMN IF NOT EXISTS explanation_it text;
ALTER TABLE hsk_grammar ADD COLUMN IF NOT EXISTS examples       jsonb DEFAULT '[]'::jsonb;
ALTER TABLE hsk_grammar ADD COLUMN IF NOT EXISTS sort_order     int DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_grammar_hsk   ON hsk_grammar(hsk_level);
CREATE INDEX IF NOT EXISTS idx_grammar_band  ON hsk_grammar(hsk_band);
CREATE INDEX IF NOT EXISTS idx_grammar_cat   ON hsk_grammar(category);

-- ── RLS: 参考数据所有人可读,只有 admin 能改 ──────────────────────────
ALTER TABLE hanzi_reference        ENABLE ROW LEVEL SECURITY;
ALTER TABLE hanzi_pronunciations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ci_reference           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ci_chars               ENABLE ROW LEVEL SECURITY;
ALTER TABLE hsk_syllables          ENABLE ROW LEVEL SECURITY;
ALTER TABLE hsk_grammar            ENABLE ROW LEVEL SECURITY;

-- Drop old policies if re-running
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname, tablename FROM pg_policies
    WHERE schemaname='public' AND tablename IN (
      'hanzi_reference','hanzi_pronunciations','ci_reference','ci_chars',
      'hsk_syllables','hsk_grammar'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Public read
CREATE POLICY "pub_read_hanzi_ref"  ON hanzi_reference      FOR SELECT USING (true);
CREATE POLICY "pub_read_hanzi_pron" ON hanzi_pronunciations FOR SELECT USING (true);
CREATE POLICY "pub_read_ci_ref"     ON ci_reference         FOR SELECT USING (true);
CREATE POLICY "pub_read_ci_chars"   ON ci_chars             FOR SELECT USING (true);
CREATE POLICY "pub_read_syll"       ON hsk_syllables        FOR SELECT USING (true);
CREATE POLICY "pub_read_grammar"    ON hsk_grammar          FOR SELECT USING (true);

-- Admin write
CREATE POLICY "adm_write_hanzi"    ON hanzi_reference      FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "adm_write_pron"     ON hanzi_pronunciations FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "adm_write_ci"       ON ci_reference         FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "adm_write_ci_chars" ON ci_chars             FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "adm_write_syll"     ON hsk_syllables        FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "adm_write_grammar"  ON hsk_grammar          FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ── Useful views / helper queries ─────────────────────────────────────

-- View: jgw_characters + canonical reference joined
CREATE OR REPLACE VIEW v_characters_enriched AS
SELECT
  jgw.id,
  jgw.glyph_modern                        AS glyph,
  jgw.set_id,
  jgw.difficulty                          AS teaching_difficulty,
  jgw.mnemonic_en, jgw.mnemonic_zh, jgw.mnemonic_it,
  jgw.visual_description,
  jgw.image_url,
  -- Canonical from HSK reference
  ref.stroke_count,
  ref.radical,
  ref.unicode_hex,
  ref.hsk_level,
  ref.hsk_band,
  ref.frequency_rank,
  -- Primary pronunciation
  prim.pinyin,
  prim.pinyin_numbered,
  prim.tone,
  prim.meaning_zh  AS primary_meaning_zh,
  prim.meaning_en  AS primary_meaning_en,
  prim.meaning_it  AS primary_meaning_it
FROM jgw_characters jgw
LEFT JOIN hanzi_reference ref ON ref.glyph = jgw.glyph_modern
LEFT JOIN hanzi_pronunciations prim
  ON prim.glyph = ref.glyph AND prim.is_primary = true;

-- View: 所有含某字的词 (一个字相关的词汇)
CREATE OR REPLACE VIEW v_words_containing_char AS
SELECT
  cc.glyph,
  w.word,
  w.pinyin,
  w.hsk_level,
  w.hsk_band,
  w.meaning_zh,
  w.meaning_en,
  w.frequency_rank
FROM ci_chars cc
JOIN ci_reference w ON w.word = cc.word;

-- ── 完成验证 ──────────────────────────────────────────────────────────
-- SELECT COUNT(*) FROM hanzi_reference;       -- 预期 ~3000
-- SELECT COUNT(*) FROM hanzi_pronunciations;  -- 预期 ~3500 (含多音字)
-- SELECT COUNT(*) FROM ci_reference;          -- 预期 ~11092
-- SELECT COUNT(*) FROM ci_chars;              -- 预期 ~20000+ (词 × 字长)
-- SELECT COUNT(*) FROM hsk_syllables;         -- 预期 412
-- SELECT COUNT(*) FROM hsk_grammar;           -- 预期 572

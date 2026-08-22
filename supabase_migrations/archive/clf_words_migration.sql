-- ═══════════════════════════════════════════════════════════════════
--  Migration: 词语 (Vocabulary) module
--  Creates clf_words table + progress log + seeds 20 HSK-1 words
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Words table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clf_words (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word_zh       text NOT NULL UNIQUE,
  pinyin        text,
  meaning_en    text,
  meaning_it    text,
  meaning_zh    text,                  -- Chinese explanation for advanced learners
  example_zh    text,
  example_en    text,
  example_it    text,
  image_url     text,
  theme         text,                  -- 'greetings','family','food',...
  hsk_level     int,                   -- 1-6
  renjiao_grade int,                   -- 1-12 for 暨南中文 path filtering
  audio_url     text,                  -- future custom recording (pinyin-audio pattern)
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clf_words_theme     ON clf_words(theme);
CREATE INDEX IF NOT EXISTS idx_clf_words_hsk       ON clf_words(hsk_level);
CREATE INDEX IF NOT EXISTS idx_clf_words_renjiao   ON clf_words(renjiao_grade);

ALTER TABLE clf_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read clf_words"
  ON clf_words FOR SELECT USING (true);
CREATE POLICY "Authenticated write clf_words"
  ON clf_words FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── 2. User progress log ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clf_words_log (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  word_zh     text NOT NULL,
  mode        text,                    -- 'flashcard' | 'listen' | 'fill'
  correct     boolean,
  score       int,
  attempts    int DEFAULT 1,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clf_words_log_user     ON clf_words_log(user_id);
CREATE INDEX IF NOT EXISTS idx_clf_words_log_user_w   ON clf_words_log(user_id, word_zh);
CREATE INDEX IF NOT EXISTS idx_clf_words_log_created  ON clf_words_log(user_id, created_at DESC);

ALTER TABLE clf_words_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own progress"
  ON clf_words_log FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users write own progress"
  ON clf_words_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── 3. Touch updated_at trigger ──────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at_words() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_clf_words_updated_at ON clf_words;
CREATE TRIGGER t_clf_words_updated_at
  BEFORE UPDATE ON clf_words
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at_words();

-- ── 4. Seed data: 20 HSK-1 words (from Miaohong STARTER_WORDS) ───
INSERT INTO clf_words (word_zh, pinyin, meaning_en, meaning_it, theme, hsk_level) VALUES
  ('你好',   'nǐ hǎo',       'Hello',         'Ciao',              'greetings', 1),
  ('谢谢',   'xiè xie',      'Thank you',     'Grazie',            'greetings', 1),
  ('再见',   'zài jiàn',     'Goodbye',       'Arrivederci',       'greetings', 1),
  ('对不起', 'duì bu qǐ',    'Sorry',         'Mi dispiace',       'greetings', 1),
  ('没关系', 'méi guān xi',  'It''s OK',      'Non importa',       'greetings', 1),
  ('爸爸',   'bà ba',        'Father',        'Papà',              'family',    1),
  ('妈妈',   'mā ma',        'Mother',        'Mamma',             'family',    1),
  ('哥哥',   'gē ge',        'Older brother', 'Fratello maggiore', 'family',    1),
  ('姐姐',   'jiě jie',      'Older sister',  'Sorella maggiore',  'family',    1),
  ('米饭',   'mǐ fàn',       'Rice',          'Riso',              'food',      1),
  ('面条',   'miàn tiáo',    'Noodles',       'Spaghetti cinesi',  'food',      1),
  ('水',     'shuǐ',         'Water',         'Acqua',             'food',      1),
  ('茶',     'chá',          'Tea',           'Tè',                'food',      1),
  ('一',     'yī',           'One',           'Uno',               'numbers',   1),
  ('二',     'èr',           'Two',           'Due',               'numbers',   1),
  ('三',     'sān',          'Three',         'Tre',               'numbers',   1),
  ('红色',   'hóng sè',      'Red',           'Rosso',             'colors',    1),
  ('蓝色',   'lán sè',        'Blue',         'Blu',               'colors',    1),
  ('今天',   'jīn tiān',     'Today',         'Oggi',              'time',      1),
  ('明天',   'míng tiān',    'Tomorrow',      'Domani',            'time',      1)
ON CONFLICT (word_zh) DO NOTHING;

-- ── 5. Refresh PostgREST schema cache ────────────────────────────
NOTIFY pgrst, 'reload schema';

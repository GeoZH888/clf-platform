-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS jgw_words (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word_zh      text NOT NULL,          -- 词组 e.g. 你好
  pinyin       text NOT NULL,          -- nǐ hǎo
  meaning_en   text NOT NULL,          -- hello
  meaning_it   text,                   -- ciao
  meaning_zh   text,                   -- 打招呼用语
  theme        text DEFAULT 'general', -- family/food/numbers/colors/greetings/body/time/travel
  hsk_level    integer DEFAULT 1,      -- 1-6
  audio_hint   text,                   -- optional extra pronunciation note
  example_zh   text,                   -- 你好，我叫大卫。
  example_en   text,                   -- Hello, my name is David.
  example_it   text,                   -- Ciao, mi chiamo David.
  difficulty   integer DEFAULT 1,      -- 1=easy 2=medium 3=hard
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_words_theme ON jgw_words(theme);
CREATE INDEX IF NOT EXISTS idx_words_hsk   ON jgw_words(hsk_level);

ALTER TABLE jgw_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read words"   ON jgw_words FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert words" ON jgw_words FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update words" ON jgw_words FOR UPDATE TO anon USING (true);
CREATE POLICY "anon delete words" ON jgw_words FOR DELETE TO anon USING (true);

-- Practice log for words
CREATE TABLE IF NOT EXISTS jgw_words_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token text NOT NULL,
  word_zh      text NOT NULL,
  mode         text NOT NULL,  -- flashcard/listen/fill
  correct      boolean DEFAULT false,
  attempts     integer DEFAULT 1,
  score        integer DEFAULT 0,
  practiced_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_words_log_device ON jgw_words_log(device_token);

ALTER TABLE jgw_words_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon all words_log" ON jgw_words_log
  FOR ALL TO anon USING (true) WITH CHECK (true);

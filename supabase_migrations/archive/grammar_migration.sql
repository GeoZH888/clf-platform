-- ═══════════════════════════════════════════════════════════════════
--  Grammar module — Phase 1 migration
--  Tables: topics, exercises, user progress (mastery-keyed)
--  Seed: 2 topics (是字句, 有字句) + 10 exercises
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Tables ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clf_grammar_topics (
  id            text PRIMARY KEY,             -- slug, e.g. 'shi_zi_ju'
  title_zh      text NOT NULL,
  title_en      text,
  title_it      text,
  level         int NOT NULL DEFAULT 1,       -- 1=basic, 5=advanced
  prereq_ids    text[] DEFAULT '{}',
  explanation   text,                         -- markdown
  examples      jsonb DEFAULT '[]',           -- [{zh, pinyin, en, it}, ...]
  order_idx     int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grammar_topics_level ON clf_grammar_topics(level, order_idx);

CREATE TABLE IF NOT EXISTS clf_grammar_exercises (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id      text NOT NULL REFERENCES clf_grammar_topics(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN ('fill', 'choose')),
  difficulty    int NOT NULL DEFAULT 0 CHECK (difficulty IN (0, 1, 2)),
  question      text NOT NULL,                -- use ___ as blank placeholder
  options       jsonb,                        -- for choose: ['A', 'B', ...]
  answer        text NOT NULL,                -- canonical answer
  explanation   text,                         -- post-answer rationale
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grammar_exercises_topic ON clf_grammar_exercises(topic_id, difficulty);

CREATE TABLE IF NOT EXISTS clf_grammar_progress (
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id       text NOT NULL REFERENCES clf_grammar_topics(id) ON DELETE CASCADE,
  mastery        real NOT NULL DEFAULT 0,     -- 0.0–1.0
  total_attempts int NOT NULL DEFAULT 0,
  correct_count  int NOT NULL DEFAULT 0,
  last_seen_at   timestamptz,
  history        jsonb DEFAULT '[]',          -- last 20 attempts
  PRIMARY KEY (user_id, topic_id)
);
CREATE INDEX IF NOT EXISTS idx_grammar_progress_user ON clf_grammar_progress(user_id, last_seen_at DESC);

-- ── RLS ────────────────────────────────────────────────────────

ALTER TABLE clf_grammar_topics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_grammar_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_grammar_progress  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone reads topics"    ON clf_grammar_topics;
DROP POLICY IF EXISTS "Admins write topics"      ON clf_grammar_topics;
DROP POLICY IF EXISTS "Everyone reads exercises" ON clf_grammar_exercises;
DROP POLICY IF EXISTS "Admins write exercises"   ON clf_grammar_exercises;
DROP POLICY IF EXISTS "Users read own progress"  ON clf_grammar_progress;
DROP POLICY IF EXISTS "Users write own progress" ON clf_grammar_progress;

CREATE POLICY "Everyone reads topics"
  ON clf_grammar_topics FOR SELECT USING (true);

CREATE POLICY "Admins write topics"
  ON clf_grammar_topics FOR ALL
  USING (
    EXISTS (SELECT 1 FROM jgw_admins WHERE user_id = auth.uid())
    OR (auth.jwt()->'user_metadata'->>'role') = 'superadmin'
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM jgw_admins WHERE user_id = auth.uid())
    OR (auth.jwt()->'user_metadata'->>'role') = 'superadmin'
  );

CREATE POLICY "Everyone reads exercises"
  ON clf_grammar_exercises FOR SELECT USING (true);

CREATE POLICY "Admins write exercises"
  ON clf_grammar_exercises FOR ALL
  USING (
    EXISTS (SELECT 1 FROM jgw_admins WHERE user_id = auth.uid())
    OR (auth.jwt()->'user_metadata'->>'role') = 'superadmin'
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM jgw_admins WHERE user_id = auth.uid())
    OR (auth.jwt()->'user_metadata'->>'role') = 'superadmin'
  );

CREATE POLICY "Users read own progress"
  ON clf_grammar_progress FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users write own progress"
  ON clf_grammar_progress FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Seed topics ────────────────────────────────────────────────

INSERT INTO clf_grammar_topics (id, title_zh, title_en, title_it, level, order_idx, explanation, examples)
VALUES
('shi_zi_ju', '是字句', '"Shì" Sentence (A is B)', 'Frase con "Shì"', 1, 1,
$md$**是字句**是最基础的判断句式，表示 **A 是 B** 的关系。

**结构**：主语 + 是 + 宾语

- 否定用"不是"（不用"没是"）
- 问句加"吗"或把"是"重复成"是不是"
$md$,
'[
  {"zh": "我是学生。", "pinyin": "Wǒ shì xuéshēng.", "en": "I am a student.", "it": "Sono uno studente."},
  {"zh": "他是中国人。", "pinyin": "Tā shì Zhōngguórén.", "en": "He is Chinese.", "it": "Lui è cinese."},
  {"zh": "这不是我的书。", "pinyin": "Zhè bú shì wǒ de shū.", "en": "This is not my book.", "it": "Questo non è il mio libro."},
  {"zh": "你是不是老师？", "pinyin": "Nǐ shì bu shì lǎoshī?", "en": "Are you a teacher?", "it": "Sei un insegnante?"}
]'::jsonb),

('you_zi_ju', '有字句', '"Yǒu" Sentence (Have / There is)', 'Frase con "Yǒu"', 1, 2,
$md$**有字句**表示**拥有**或**存在**。

**结构**：主语 + 有 + 宾语

- 否定用"没有"（**不用"不有"**）
- 可以表示存在："这里有一本书"
$md$,
'[
  {"zh": "我有一个姐姐。", "pinyin": "Wǒ yǒu yí ge jiějie.", "en": "I have an older sister.", "it": "Ho una sorella maggiore."},
  {"zh": "桌子上有很多书。", "pinyin": "Zhuōzi shàng yǒu hěn duō shū.", "en": "There are many books on the table.", "it": "Ci sono molti libri sul tavolo."},
  {"zh": "我没有钱。", "pinyin": "Wǒ méi yǒu qián.", "en": "I don''t have money.", "it": "Non ho soldi."},
  {"zh": "你有没有问题？", "pinyin": "Nǐ yǒu méi yǒu wèntí?", "en": "Do you have any questions?", "it": "Hai domande?"}
]'::jsonb)

ON CONFLICT (id) DO UPDATE SET
  title_zh = EXCLUDED.title_zh,
  explanation = EXCLUDED.explanation,
  examples = EXCLUDED.examples;

-- ── Seed exercises: 是字句 (5 items) ────────────────────────────

INSERT INTO clf_grammar_exercises (topic_id, type, difficulty, question, options, answer, explanation) VALUES
('shi_zi_ju', 'fill',   0, '我___ 学生。',                               NULL,                                  '是',     '是字句：A 是 B。'),
('shi_zi_ju', 'choose', 0, '"他___ 老师。" 选择正确的词：',              '["是","有","在","好"]'::jsonb,        '是',     '"是" 用来表明身份。'),
('shi_zi_ju', 'fill',   1, '这本书 ___ 我的。',                          NULL,                                  '不是',   '否定用"不是"。'),
('shi_zi_ju', 'choose', 1, '"你___老师？" 问句选哪个？',                 '["是吗","是不是","没是","不是"]'::jsonb, '是不是', '疑问句用"是不是"是自然方式。'),
('shi_zi_ju', 'fill',   2, '那位 ___ ___ 我的朋友，___ 我的同事。',      NULL,                                  '不 是 是', '复合句：否定 + 肯定。');

-- ── Seed exercises: 有字句 (5 items) ────────────────────────────

INSERT INTO clf_grammar_exercises (topic_id, type, difficulty, question, options, answer, explanation) VALUES
('you_zi_ju', 'fill',   0, '我 ___ 一本书。',                            NULL,                                  '有',     '"有" 表示拥有。'),
('you_zi_ju', 'choose', 0, '"桌子上 ___ 很多书。" 选对的：',              '["有","是","在","的"]'::jsonb,        '有',     '存在句用"有"。'),
('you_zi_ju', 'fill',   1, '我 ___ ___ 钱。',                            NULL,                                  '没 有',  '否定用"没有"，不用"不有"。'),
('you_zi_ju', 'choose', 1, '正确的疑问句：',                             '["你有吗钱？","你有没有钱？","你不有钱？","你是有钱？"]'::jsonb, '你有没有钱？', '"有没有" 是自然的正反问句。'),
('you_zi_ju', 'fill',   2, '教室里 ___ 老师，___ 学生。',                NULL,                                  '有 有',  '两个存在关系并列。');

NOTIFY pgrst, 'reload schema';

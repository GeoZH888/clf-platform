-- ============================================================
-- 猜灯谜 (Riddles) module — schema + seed corpus
-- Save as: supabase/migrations/<timestamp>_clf_riddles.sql
--   or just paste into Supabase SQL editor.
-- Idempotent: safe to re-run.
-- ============================================================

-- 1. Riddles table ------------------------------------------------
CREATE TABLE IF NOT EXISTS clf_riddles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  riddle_text     text NOT NULL,                                    -- 谜面
  answer          text NOT NULL,                                    -- 谜底
  answer_type     text NOT NULL DEFAULT 'character'
                  CHECK (answer_type IN ('character','word','idiom','object')),
  category_hint   text,                                             -- 谜目 e.g. "打一字"
  explanation     text,                                             -- why the answer fits
  level           integer NOT NULL CHECK (level BETWEEN 1 AND 6),   -- ~HSK level
  hints           jsonb DEFAULT '[]'::jsonb,                        -- progressive hints
  source          text NOT NULL DEFAULT 'seed'
                  CHECK (source IN ('seed','ai_generated','manual')),
  status          text NOT NULL DEFAULT 'approved'
                  CHECK (status IN ('pending','approved','rejected')),
  upvotes         integer DEFAULT 0,
  downvotes       integer DEFAULT 0,
  generated_by    text,
  generation_meta jsonb,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  approved_at     timestamptz,
  approved_by     uuid
);

CREATE INDEX IF NOT EXISTS idx_clf_riddles_level_status ON clf_riddles (level, status);
CREATE INDEX IF NOT EXISTS idx_clf_riddles_status      ON clf_riddles (status);
CREATE INDEX IF NOT EXISTS idx_clf_riddles_source      ON clf_riddles (source);

-- 2. Attempt log (for de-dup + ratings) --------------------------
CREATE TABLE IF NOT EXISTS clf_riddle_attempts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid,
  session_id    text,
  riddle_id     uuid NOT NULL REFERENCES clf_riddles(id) ON DELETE CASCADE,
  success       boolean NOT NULL DEFAULT false,
  hints_used    integer DEFAULT 0,
  attempts      integer DEFAULT 1,
  time_spent_ms integer,
  vote          smallint CHECK (vote IN (-1, 0, 1)),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_riddle_attempts_user    ON clf_riddle_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_riddle_attempts_session ON clf_riddle_attempts (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_riddle_attempts_riddle  ON clf_riddle_attempts (riddle_id);

-- 3. RLS ----------------------------------------------------------
ALTER TABLE clf_riddles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_riddle_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read approved riddles" ON clf_riddles;
CREATE POLICY "public read approved riddles" ON clf_riddles
  FOR SELECT USING (status = 'approved');

DROP POLICY IF EXISTS "auth manage riddles" ON clf_riddles;
CREATE POLICY "auth manage riddles" ON clf_riddles
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "anyone log attempts" ON clf_riddle_attempts;
CREATE POLICY "anyone log attempts" ON clf_riddle_attempts
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "users read own attempts" ON clf_riddle_attempts;
CREATE POLICY "users read own attempts" ON clf_riddle_attempts
  FOR SELECT USING (
    user_id = auth.uid() OR
    (user_id IS NULL AND session_id IS NOT NULL)
  );

-- 4. Triggers -----------------------------------------------------
CREATE OR REPLACE FUNCTION clf_riddles_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clf_riddles_updated ON clf_riddles;
CREATE TRIGGER trg_clf_riddles_updated
  BEFORE UPDATE ON clf_riddles
  FOR EACH ROW EXECUTE FUNCTION clf_riddles_set_updated_at();

CREATE OR REPLACE FUNCTION clf_riddles_recount_votes()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.vote IS NOT NULL AND NEW.vote != 0 THEN
    UPDATE clf_riddles SET
      upvotes   = upvotes   + CASE WHEN NEW.vote =  1 THEN 1 ELSE 0 END,
      downvotes = downvotes + CASE WHEN NEW.vote = -1 THEN 1 ELSE 0 END
    WHERE id = NEW.riddle_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_riddle_attempt_vote ON clf_riddle_attempts;
CREATE TRIGGER trg_riddle_attempt_vote
  AFTER INSERT ON clf_riddle_attempts
  FOR EACH ROW EXECUTE FUNCTION clf_riddles_recount_votes();

-- ============================================================
-- 5. SEED CORPUS — 25 traditional 灯谜
-- ============================================================
INSERT INTO clf_riddles (riddle_text, answer, answer_type, category_hint, explanation, level, source, status) VALUES
  -- Level 1 (10) — basic 字谜
  ('一口咬掉牛尾巴',                   '告', 'character', '打一字', '"牛"字去掉竖（尾巴），加上"口" → 告',                                  1, 'seed', 'approved'),
  ('七十二小时',                       '晶', 'character', '打一字', '七十二小时 = 三天 = 三个"日" → 晶',                                    1, 'seed', 'approved'),
  ('太阳西边下，月亮东边挂',           '明', 'character', '打一字', '"日"在西（左），"月"在东（右） → 明',                                  1, 'seed', 'approved'),
  ('田中',                             '十', 'character', '打一字', '"田"字中间是"十"',                                                     1, 'seed', 'approved'),
  ('二人土上坐',                       '坐', 'character', '打一字', '两个"人"坐在"土"上 → 坐',                                              1, 'seed', 'approved'),
  ('弓长',                             '张', 'character', '打一字', '"弓" + "长" → 张',                                                     1, 'seed', 'approved'),
  ('言午',                             '许', 'character', '打一字', '"言" + "午" → 许',                                                     1, 'seed', 'approved'),
  ('四面都是山，山山都相连',           '田', 'character', '打一字', '"田"字四边像四座相连的山',                                              1, 'seed', 'approved'),
  ('一加一',                           '王', 'character', '打一字', '"一" + "一" 竖着相连 → 王（三横一竖）',                                1, 'seed', 'approved'),
  ('古时候的月亮',                     '胡', 'character', '打一字', '"古" + "月" → 胡',                                                     1, 'seed', 'approved'),

  -- Level 2 (10) — 字谜 with wordplay
  ('大雨落在横山上',                   '雪', 'character', '打一字', '"雨"字头 + "彐"（像横置的山） → 雪',                                   2, 'seed', 'approved'),
  ('池中没有水，地上没有泥',           '也', 'character', '打一字', '"池"去"氵"得"也"，"地"去"土"得"也"',                                   2, 'seed', 'approved'),
  ('半部春秋',                         '秦', 'character', '打一字', '"春"的上半 + "秋"的下半 → 秦',                                          2, 'seed', 'approved'),
  ('加倍才算多',                       '夕', 'character', '打一字', '"多" = "夕" + "夕"，加倍才是多，所以原本是"夕"',                       2, 'seed', 'approved'),
  ('千里相逢',                         '重', 'character', '打一字', '"千" + "里" → 重',                                                     2, 'seed', 'approved'),
  ('一火一火又一火',                   '焱', 'character', '打一字', '三个"火"叠成 → 焱',                                                    2, 'seed', 'approved'),
  ('心字头上一把刀',                   '必', 'character', '打一字', '"心"上加一撇（像刀） → 必',                                            2, 'seed', 'approved'),
  ('一人一张口，口下长只手',           '拿', 'character', '打一字', '"合"（人+一+口）+ "手" → 拿',                                          2, 'seed', 'approved'),
  ('一字十三点，难在如何点',           '汁', 'character', '打一字', '"氵"（三点） + "十" → 汁，加上字谜本身有十三个点',                     2, 'seed', 'approved'),
  ('上不在上，下不在下',               '一', 'character', '打一字', '"上"和"下"两字共有的笔画 → 一（横）',                                  2, 'seed', 'approved'),

  -- Level 3 (5) — 成语谜 / 词谜
  ('五个手指',                         '三长两短',     'idiom', '打一成语',   '五指中三根较长（中、食、无名）、两根较短（拇指、小指）',          3, 'seed', 'approved'),
  ('最长的一天',                       '度日如年',     'idiom', '打一成语',   '一天感觉像一年那么长',                                            3, 'seed', 'approved'),
  ('最远的距离',                       '天涯海角',     'idiom', '打一成语',   '天的尽头、海的角落，形容极远的地方',                              3, 'seed', 'approved'),
  ('拔河比赛',                         '不分胜负',     'idiom', '打一成语',   '两队势均力敌，难分高下',                                          3, 'seed', 'approved'),
  ('哑巴吃黄连',                       '有苦说不出',   'idiom', '打一歇后语', '黄连很苦，哑巴想说却说不出来',                                   3, 'seed', 'approved')
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';

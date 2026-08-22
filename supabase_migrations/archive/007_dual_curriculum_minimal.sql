-- ═══════════════════════════════════════════════════════════════════════
--  大卫学中文 — Dual-Curriculum Character Labels (minimal, no UI changes)
--
--  加字段让同一个字符能同时属于 HSK 体系 + 人教版体系.
--  Admin 端暂时不变. Learner-side path logic 以后再建.
--
--  Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 字符表 (jgw_characters) 加双体系标签 ───────────────────────────
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS hsk_level       int;          -- 1-9 for HSK 3.0
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS renjiao_grade   text;         -- '一年级上册' / '二年级下册' / ...
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS renjiao_lesson  int;          -- 1-40 per grade
ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS renjiao_type    text;         -- '识字表' / '写字表' / '课文生字'

-- ── Indexes ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jgw_chars_hsk   ON jgw_characters(hsk_level);
CREATE INDEX IF NOT EXISTS idx_jgw_chars_grade ON jgw_characters(renjiao_grade);

-- ── 自动同步已有数据 (只在 hanzi_reference 存在时执行) ─────────────
-- 如果 004 migration 还没跑, 这段安全跳过, 不会报错
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='hanzi_reference') THEN
    UPDATE jgw_characters j
    SET hsk_level = r.hsk_level
    FROM hanzi_reference r
    WHERE j.glyph_modern = r.glyph
      AND j.hsk_level IS NULL
      AND r.hsk_level IS NOT NULL;
    RAISE NOTICE '✓ Synced HSK levels from hanzi_reference';
  ELSE
    RAISE NOTICE '⊘ Skipped HSK sync (hanzi_reference not yet created — run 004 first if you want this)';
  END IF;
END $$;

-- ── 词表 (ci_reference 或 jgw_words) 双标签 ──────────────────────
-- 同样处理词表, 让词也能两套体系并存
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS renjiao_grade  text;
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS renjiao_lesson int;
-- jgw_words 应该已经有 hsk_level, 如果没有就加:
ALTER TABLE jgw_words ADD COLUMN IF NOT EXISTS hsk_level int;

CREATE INDEX IF NOT EXISTS idx_jgw_words_hsk   ON jgw_words(hsk_level);
CREATE INDEX IF NOT EXISTS idx_jgw_words_grade ON jgw_words(renjiao_grade);

-- ── 预备 learner-side schema (只建表, 不用) ──────────────────────
-- user_profiles 的 learning_path 字段, 将来 onboarding 后写入
CREATE TABLE IF NOT EXISTS user_learning_paths (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  path              text NOT NULL DEFAULT 'mixed',    -- 'hsk' | 'renjiao' | 'mixed'
  target_hsk_level  int,                               -- if path='hsk': goal 1-9
  current_grade     text,                              -- if path='renjiao': '一年级上册'
  onboarding_done   boolean DEFAULT false,
  selected_at       timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE user_learning_paths ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "user_own_path_read"   ON user_learning_paths;
  DROP POLICY IF EXISTS "user_own_path_write"  ON user_learning_paths;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "user_own_path_read"  ON user_learning_paths FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_own_path_write" ON user_learning_paths FOR ALL    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 验证 ─────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'jgw_characters'
--   AND column_name IN ('hsk_level','renjiao_grade','renjiao_lesson','renjiao_type');
-- -- 预期 4 行

-- SELECT
--   COUNT(*) AS total,
--   COUNT(hsk_level) AS with_hsk,
--   COUNT(renjiao_grade) AS with_renjiao
-- FROM jgw_characters;

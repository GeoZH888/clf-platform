-- ═══════════════════════════════════════════════════════════════════════
--  修复: 补上缺失的 corpus_subjects 条目
--  
--  问题: AI 识别出 'yuwen' 但 corpus_subjects 里没这个 slug → FK violation
-- ═══════════════════════════════════════════════════════════════════════

-- 1. 先看现在 corpus_subjects 有啥
SELECT slug, name_zh, name_en FROM corpus_subjects ORDER BY sort_order;

-- 2. 补齐所有常用学科 (对应 AI 自动识别 pattern 里的 slug)
-- ON CONFLICT DO NOTHING 确保已有的不覆盖
INSERT INTO corpus_subjects (slug, name_zh, name_en, icon, sort_order) VALUES
  ('yuwen',    '语文',  'Chinese Language', '📖', 10),
  ('shuxue',   '数学',  'Mathematics',       '🔢', 20),
  ('yingyu',   '英语',  'English',           '🔤', 30),
  ('kexue',    '科学',  'Science',           '🔬', 40),
  ('lishi',    '历史',  'History',           '📜', 50),
  ('dili',     '地理',  'Geography',         '🗺️', 60),
  ('yinyue',   '音乐',  'Music',             '🎵', 70),
  ('meishu',   '美术',  'Art',               '🎨', 80),
  ('tiyu',     '体育',  'P.E.',              '⚽', 90),
  ('hsk',      'HSK',   'HSK Standard',      '🎓', 100),
  ('chengyu',  '成语',  'Idioms',            '📜', 110),
  ('wenhua',   '文化',  'Culture',           '🏮', 120),
  ('wenxue',   '文学',  'Literature',        '📚', 130),
  ('shige',    '诗歌',  'Poetry',            '✍️', 140),
  ('hanzi',    '汉字',  'Characters',        '漢', 150)
ON CONFLICT (slug) DO NOTHING;

-- 3. 验证
SELECT slug, name_zh FROM corpus_subjects ORDER BY sort_order;
-- 预期 至少 15 行

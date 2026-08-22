-- ═══════════════════════════════════════════════════════════════════
--  012_phase3a_set_id_assignment.sql
--
--  Phase 3A: 让今天导入的字符在学生端可见
--  (学生端按 set_id 分组, 新导入的 HSK 字 set_id=NULL 就会被隐藏)
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────
-- 1. HSK 字符 — 按 hsk_level 设 set_id
-- ─────────────────────────────────────────────────────

-- HSK 1-6 都统一处理
UPDATE jgw_characters
SET set_id = 'hsk_' || hsk_level
WHERE hsk_level IN (1, 2, 3, 4, 5, 6)
  AND set_id IS NULL
  AND ai_filled_at IS NOT NULL;   -- 只处理今天 AI 导入的,不碰老数据

-- ─────────────────────────────────────────────────────
-- 2. 暨南教材字符 — 按 occurrence 的 collection_slug + grade_level
-- ─────────────────────────────────────────────────────

-- 如果你将来有暨南字符入库,下面这段会处理
-- 暂时不会影响(还没有 jinan 来源的字)

UPDATE jgw_characters c
SET set_id = CASE
  WHEN o.grade_level = '第一册' OR o.grade_level = '第1册' THEN 'jinan_1'
  WHEN o.grade_level = '第二册' OR o.grade_level = '第2册' THEN 'jinan_2'
  WHEN o.grade_level = '第三册' OR o.grade_level = '第3册' THEN 'jinan_3'
  WHEN o.grade_level = '第四册' OR o.grade_level = '第4册' THEN 'jinan_4'
  WHEN o.grade_level = '第五册' OR o.grade_level = '第5册' THEN 'jinan_5'
  ELSE c.set_id
END
FROM character_source_occurrences o
WHERE c.id = o.character_id
  AND o.collection_slug = 'jinan'
  AND c.set_id IS NULL;

-- ─────────────────────────────────────────────────────
-- 3. 验证结果
-- ─────────────────────────────────────────────────────

-- 看每个 set_id 有多少字
SELECT 
  COALESCE(set_id, '(未分组)') AS set_id, 
  COUNT(*) AS chars
FROM jgw_characters
GROUP BY set_id
ORDER BY set_id;

-- 期望看到 (如果你今天导入了 HSK 1):
-- hsk_1           | 156
-- nature          | 10+ (原有)
-- simple_pictograms | 5+ (原有)
-- ...

-- ─────────────────────────────────────────────────────
-- 4. (可选) 给 set_id 加索引, 让学生端查询更快
-- ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_jgw_characters_set_id 
  ON jgw_characters(set_id) 
  WHERE set_id IS NOT NULL;

-- ─────────────────────────────────────────────────────
-- 5. (可选) 查看 jgw_characters 里的字在 set_id 内排序
-- 确保 difficulty 字段有值 (决定同 set 内字符先后顺序)
-- ─────────────────────────────────────────────────────

-- 看没 difficulty 的字 (用于判断是否需要补数据)
SELECT COUNT(*) AS chars_without_difficulty
FROM jgw_characters
WHERE set_id LIKE 'hsk_%'
  AND (difficulty IS NULL OR difficulty = 0);

-- 如果数量很多, 按 stroke_count 自动填 difficulty
-- (笔画越少越简单, 难度越低)
UPDATE jgw_characters
SET difficulty = CASE
  WHEN strokes <= 3 THEN 1
  WHEN strokes <= 6 THEN 2
  WHEN strokes <= 9 THEN 3
  WHEN strokes <= 12 THEN 4
  ELSE 5
END
WHERE set_id LIKE 'hsk_%'
  AND (difficulty IS NULL OR difficulty = 0);

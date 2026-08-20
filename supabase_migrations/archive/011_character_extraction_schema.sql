-- ═══════════════════════════════════════════════════════════════════════
--  011_character_extraction_schema.sql
--  生字管理模块 Phase 1 — 长期架构
--
--  建新表:
--    1. character_source_occurrences  — 字符 × 来源 多对多表
--    2. character_extraction_jobs      — 抽取任务记录
--
--  建视图:
--    3. character_with_sources          — 便捷查询字符+所有来源
--
--  注意: jgw_characters 已有 ai_filled_at / human_edited_at / ai_confidence / 
--        needs_review / first_source_label / hsk_level / renjiao_*, 不需要修改.
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. character_source_occurrences
--    记录"字"在"来源"的多次出现 (多对多关系表)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS character_source_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES jgw_characters(id) ON DELETE CASCADE,
  
  -- 来源标识
  source_type TEXT NOT NULL,       -- 'corpus_document' | 'hsk_official' | 'manual'
  source_id UUID,                  -- corpus_documents.id 等
  source_label TEXT NOT NULL,      -- "暨南二册第3课" (人类可读)
  
  -- 分类标签 (冗余, 便于过滤)
  subject_slug TEXT,               -- 'yuwen' | 'hsk' | 'chengyu'
  collection_slug TEXT,            -- 'renjiao' | 'jinan' | 'hsk'
  grade_level TEXT,                -- "第二册" | "一年级上册" | "HSK 2"
  lesson_name TEXT,                -- "第3课 我的家"
  
  -- 位置信息 (可选)
  page_num INTEGER,
  chunk_id UUID,                   -- corpus_chunks.id (可选, 用于溯源)
  
  -- 元数据
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  job_id UUID,                     -- 哪次 extraction_job 创建的
  
  -- 约束: 同一个字在同一个来源的同一课只记录一次
  CONSTRAINT uq_char_source_lesson
    UNIQUE (character_id, source_type, source_id, lesson_name)
);

CREATE INDEX IF NOT EXISTS idx_char_source_by_char 
  ON character_source_occurrences(character_id);
CREATE INDEX IF NOT EXISTS idx_char_source_by_label 
  ON character_source_occurrences(source_label);
CREATE INDEX IF NOT EXISTS idx_char_source_by_subject 
  ON character_source_occurrences(subject_slug);
CREATE INDEX IF NOT EXISTS idx_char_source_by_collection 
  ON character_source_occurrences(collection_slug);
CREATE INDEX IF NOT EXISTS idx_char_source_by_job 
  ON character_source_occurrences(job_id);

COMMENT ON TABLE character_source_occurrences IS 
  '字符×来源多对多表. 一个字可以出现在多个教材/课文中, 每次出现一条记录. 查询 "某教材里的字" 或 "某字在哪些教材" 用这张表.';


-- ─────────────────────────────────────────────────────────────────────
-- 2. character_extraction_jobs
--    记录每次批量抽取的运行状态 (审计 + 进度跟踪)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS character_extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 来源范围
  source_type TEXT NOT NULL,       -- 'corpus_document' | 'corpus_collection' | 'frequency'
  source_id UUID,                  -- 单文档或 collection 的 id
  source_label TEXT,               -- "暨南二册" 或 "暨南中文全部"
  
  -- 抽取方式
  extraction_method TEXT NOT NULL DEFAULT 'shizi_biao',
                                   -- 'shizi_biao' | 'frequency' | 'ai_analysis'
  
  -- 状态机
  status TEXT NOT NULL DEFAULT 'pending',
                                   -- 'pending' | 'extracting' | 'ready_for_review' 
                                   -- | 'enriching' | 'complete' | 'error'
  
  -- 统计
  total_candidates INTEGER DEFAULT 0,
  total_added INTEGER DEFAULT 0,    -- 新入库字符数
  total_updated INTEGER DEFAULT 0,  -- 已存在, 加 occurrence 的数
  total_skipped INTEGER DEFAULT 0,  -- 用户跳过的
  
  -- 候选字符列表 (extract 完成后存这, 给用户审核)
  candidates JSONB DEFAULT '[]'::jsonb,
                                   -- [{char, lesson, page, context, already_in_db, ...}]
  
  -- 配置
  config JSONB DEFAULT '{}'::jsonb,
  
  -- 元数据
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  started_by UUID REFERENCES auth.users(id),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_by_status 
  ON character_extraction_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_by_user 
  ON character_extraction_jobs(started_by);
CREATE INDEX IF NOT EXISTS idx_jobs_by_source 
  ON character_extraction_jobs(source_id);

COMMENT ON TABLE character_extraction_jobs IS 
  '批量字符抽取任务记录. 每次管理员点"从 corpus 抽取"创建一条. 状态流转: pending -> extracting -> ready_for_review -> enriching -> complete.';


-- ─────────────────────────────────────────────────────────────────────
-- 3. character_with_sources (VIEW)
--    便捷查询: 每个字符附带所有来源标签数组
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW character_with_sources AS
SELECT 
  c.*,
  COALESCE(
    (SELECT array_agg(DISTINCT o.source_label ORDER BY o.source_label)
     FROM character_source_occurrences o 
     WHERE o.character_id = c.id),
    ARRAY[]::text[]
  ) AS all_source_labels,
  
  (SELECT COUNT(DISTINCT o.source_label) 
   FROM character_source_occurrences o 
   WHERE o.character_id = c.id) AS source_count,
   
  (SELECT array_agg(DISTINCT o.subject_slug) 
   FROM character_source_occurrences o 
   WHERE o.character_id = c.id 
     AND o.subject_slug IS NOT NULL) AS subjects,
     
  (SELECT array_agg(DISTINCT o.collection_slug) 
   FROM character_source_occurrences o 
   WHERE o.character_id = c.id 
     AND o.collection_slug IS NOT NULL) AS collections

FROM jgw_characters c;

COMMENT ON VIEW character_with_sources IS 
  '便捷查询: 每个字符 + 所有来源标签. 用于字符管理 UI 显示 "这个字在哪些教材里出现过".';


-- ─────────────────────────────────────────────────────────────────────
-- RLS (Row Level Security) 配置
-- ─────────────────────────────────────────────────────────────────────

-- character_source_occurrences
ALTER TABLE character_source_occurrences ENABLE ROW LEVEL SECURITY;

-- 所有认证用户可读 (查询字符用)
DROP POLICY IF EXISTS "Authenticated users can read occurrences" 
  ON character_source_occurrences;
CREATE POLICY "Authenticated users can read occurrences" 
  ON character_source_occurrences
  FOR SELECT
  TO authenticated
  USING (true);

-- 只 service_role 能写 (通过后端 function)
DROP POLICY IF EXISTS "Service role can write occurrences" 
  ON character_source_occurrences;
CREATE POLICY "Service role can write occurrences" 
  ON character_source_occurrences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- character_extraction_jobs
ALTER TABLE character_extraction_jobs ENABLE ROW LEVEL SECURITY;

-- 用户能看自己的 job
DROP POLICY IF EXISTS "Users can view own jobs" ON character_extraction_jobs;
CREATE POLICY "Users can view own jobs" 
  ON character_extraction_jobs
  FOR SELECT
  TO authenticated
  USING (started_by = auth.uid());

-- service_role 全权限
DROP POLICY IF EXISTS "Service role full access jobs" ON character_extraction_jobs;
CREATE POLICY "Service role full access jobs" 
  ON character_extraction_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────
-- 验证
-- ─────────────────────────────────────────────────────────────────────

-- 检查表建成功
SELECT 
  tablename,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = tablename) AS cols
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('character_source_occurrences', 'character_extraction_jobs');

-- 检查视图
SELECT viewname FROM pg_views 
WHERE schemaname = 'public' AND viewname = 'character_with_sources';

-- 应该看到:
-- character_source_occurrences | 12
-- character_extraction_jobs     | 13
-- character_with_sources        (view)

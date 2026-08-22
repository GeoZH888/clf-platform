-- ═══════════════════════════════════════════════════════════════════════
--  大卫学中文 — RAG Corpus v2
--
--  v2 新增:
--    - corpus_subjects 表 (学科分类,独立于 collection)
--    - corpus_documents 加 subject_slug + grade_level 字段
--    - match_chunks RPC 支持 subject + grade 过滤
--    - 预定义中文直关 subjects (HSK/成语/文化),其它让 admin 自加
--
--  安全运行多次。不会破坏已上传的 HSK 文档(如果有)。
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Subjects 表 (学科,独立) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS corpus_subjects (
  slug          text PRIMARY KEY,               -- 'hsk', 'chengyu', 'wenhua', 'yuwen'
  name_zh       text NOT NULL,
  name_en       text,
  icon          text DEFAULT '📖',
  color         text DEFAULT '#6b4c2a',
  sort_order    int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- 预定义中文直关 subjects (其它学科 admin 自己加)
INSERT INTO corpus_subjects (slug, name_zh, name_en, icon, color, sort_order) VALUES
  ('hsk',      'HSK 标准',   'HSK Standard',           '🎓', '#2E7D32', 1),
  ('chengyu',  '成语',        'Chinese Idioms',         '📜', '#8B4513', 2),
  ('wenhua',   '文化',        'Chinese Culture',        '🏮', '#C62828', 3),
  ('wenxue',   '文学',        'Chinese Literature',     '📚', '#6A1B9A', 4),
  ('shige',    '诗歌',        'Poetry',                 '🖋️', '#AD1457', 5),
  ('hanzi',    '汉字',        'Chinese Characters',     '字', '#00796B', 6)
ON CONFLICT (slug) DO NOTHING;

-- ── 2. 给 corpus_documents 加新字段 ───────────────────────────────────
ALTER TABLE corpus_documents ADD COLUMN IF NOT EXISTS subject_slug text
  REFERENCES corpus_subjects(slug) ON DELETE SET NULL;
ALTER TABLE corpus_documents ADD COLUMN IF NOT EXISTS grade_level  text;
-- grade_level 是自由文本: '一年级上册' / 'HSK 4' / 'Primary 3' 都可以

CREATE INDEX IF NOT EXISTS idx_doc_subject ON corpus_documents(subject_slug);
CREATE INDEX IF NOT EXISTS idx_doc_grade2  ON corpus_documents(grade_level);

-- ── 3. RLS for subjects 表 ─────────────────────────────────────────────
ALTER TABLE corpus_subjects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "pub_read_subjects" ON corpus_subjects;
  DROP POLICY IF EXISTS "adm_all_subjects"  ON corpus_subjects;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "pub_read_subjects" ON corpus_subjects FOR SELECT USING (true);
CREATE POLICY "adm_all_subjects"  ON corpus_subjects FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ── 4. 更新 match_chunks RPC - 支持 subject + grade 过滤 ────────────────
DROP FUNCTION IF EXISTS match_chunks(vector, float, int, text);
DROP FUNCTION IF EXISTS match_chunks(vector, float, int, text, text, text);

CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding         vector(1024),
  match_threshold         float DEFAULT 0.5,
  match_count             int   DEFAULT 10,
  filter_collection_slug  text  DEFAULT NULL,
  filter_subject_slug     text  DEFAULT NULL,
  filter_grade_level      text  DEFAULT NULL
)
RETURNS TABLE (
  chunk_id        uuid,
  document_id     uuid,
  document_title  text,
  collection_slug text,
  subject_slug    text,
  grade_level     text,
  content         text,
  metadata        jsonb,
  similarity      float
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    c.id               AS chunk_id,
    c.document_id,
    d.title            AS document_title,
    col.slug           AS collection_slug,
    d.subject_slug,
    d.grade_level,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM corpus_chunks c
  JOIN corpus_documents d    ON d.id = c.document_id
  JOIN corpus_collections col ON col.id = c.collection_id
  WHERE
    (filter_collection_slug IS NULL OR col.slug           = filter_collection_slug)
    AND (filter_subject_slug    IS NULL OR d.subject_slug     = filter_subject_slug)
    AND (filter_grade_level     IS NULL OR d.grade_level      = filter_grade_level)
    AND c.embedding IS NOT NULL
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_chunks TO authenticated;

-- ── 5. Helper RPC - 返回 distinct grade_levels (for dropdown) ──────────
CREATE OR REPLACE FUNCTION list_grade_levels()
RETURNS TABLE (grade_level text, doc_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT grade_level, COUNT(*)::bigint
  FROM corpus_documents
  WHERE grade_level IS NOT NULL AND grade_level <> ''
  GROUP BY grade_level
  ORDER BY grade_level;
$$;
GRANT EXECUTE ON FUNCTION list_grade_levels TO authenticated;

-- ── 验证 ──────────────────────────────────────────────────────────────
-- SELECT slug, name_zh FROM corpus_subjects ORDER BY sort_order;  -- 预期 6 行
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='corpus_documents' AND column_name IN ('subject_slug','grade_level');  -- 2 行

# 生字管理模块 — 完整架构文档 (Phase 1)

## 目标

建立一个**长期架构**,使"生字管理"成为 CLF 平台的核心学习系统之一。
支持:
- 管理员从 corpus 批量抽取字符 (识字表 + 频率统计)
- 字符自动去重,累积来源标签
- AI 自动填充详情 (读音/笔画/部首/HSK/例句)
- 人工审核和编辑
- USER 端按用户进度/教材/HSK 级别自适应推荐

## 架构分层

```
┌───────────────────────────────────────┐
│ Layer 1: Corpus                       │
│ corpus_documents + corpus_chunks      │ (已有)
└──────────────────┬────────────────────┘
                   ↓  抽取
┌───────────────────────────────────────┐
│ Layer 2: Extraction (新)              │
│ character_extraction_jobs              │ (新表)
└──────────────────┬────────────────────┘
                   ↓  去重、填充、入库
┌───────────────────────────────────────┐
│ Layer 3: Enriched Characters           │
│ jgw_characters (已有, 加字段)           │
│ character_source_occurrences (新表)    │
└──────────────────┬────────────────────┘
                   ↓  USER 端消费
┌───────────────────────────────────────┐
│ Layer 4: Learning                     │
│ user_character_progress (Phase 3)     │
└───────────────────────────────────────┘
```

## 数据库设计

### 新表 1: `character_source_occurrences`

**用途**: 记录"字"在"来源"的多次出现 (多对多关系表)

```sql
CREATE TABLE character_source_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES jgw_characters(id) ON DELETE CASCADE,
  
  -- 来源标识
  source_type TEXT NOT NULL,       -- 'corpus_document' | 'hsk_official' | 'manual'
  source_id UUID,                  -- corpus_documents.id 等
  source_label TEXT NOT NULL,      -- "暨南二册第3课" (人读的)
  
  -- 分类标签
  subject_slug TEXT,               -- 'yuwen' | 'hsk' | 'chengyu'
  collection_slug TEXT,            -- 'renjiao' | 'jinan' | 'hsk'
  grade_level TEXT,                -- "二册" | "一年级上册" | "HSK 2"
  lesson_name TEXT,                -- "第3课 我的家"
  
  -- 元数据
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  job_id UUID,                     -- 哪个 extraction_job 创建的
  
  UNIQUE (character_id, source_type, source_id, lesson_name)
);

CREATE INDEX idx_char_source_by_char ON character_source_occurrences(character_id);
CREATE INDEX idx_char_source_by_label ON character_source_occurrences(source_label);
CREATE INDEX idx_char_source_by_subject ON character_source_occurrences(subject_slug);
```

### 新表 2: `character_extraction_jobs`

**用途**: 记录每次批量抽取的运行状态

```sql
CREATE TABLE character_extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 来源范围
  source_type TEXT,                -- 'corpus_document' | 'corpus_collection' | 'frequency'
  source_id UUID,                  -- 单文档或 collection 的 id
  source_label TEXT,               -- "暨南二册" 或 "暨南中文全部"
  
  -- 方法
  extraction_method TEXT,          -- 'shizi_biao' | 'frequency' | 'ai_analysis'
  
  -- 状态
  status TEXT DEFAULT 'pending',   -- 'pending' | 'extracting' | 'enriching' | 'complete' | 'error'
  
  -- 统计
  total_candidates INT DEFAULT 0,
  total_added INT DEFAULT 0,       -- 新入库字符数
  total_updated INT DEFAULT 0,     -- 已存在, 加 tag 的数
  total_skipped INT DEFAULT 0,     -- 用户跳过的
  
  -- 候选字符列表 (Step 3 预览时存这里)
  candidates JSONB,                -- [{char, lesson, page, context}, ...]
  
  -- 元数据
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  started_by UUID REFERENCES auth.users(id),
  error_message TEXT,
  
  -- 配置
  config JSONB DEFAULT '{}'        -- 存 wizard 的配置
);

CREATE INDEX idx_jobs_by_status ON character_extraction_jobs(status);
CREATE INDEX idx_jobs_by_user ON character_extraction_jobs(started_by);
```

### jgw_characters 加字段

```sql
ALTER TABLE jgw_characters
  ADD COLUMN IF NOT EXISTS ai_filled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS human_edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(3,2),  -- 0.00 - 1.00
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_extracted_from TEXT;   -- "暨南一册" (首次出现)
```

### 视图: `character_with_sources`

**用途**: 便捷查询 — 每个字符带所有来源

```sql
CREATE OR REPLACE VIEW character_with_sources AS
SELECT 
  c.*,
  COALESCE(
    (SELECT array_agg(DISTINCT o.source_label ORDER BY o.source_label)
     FROM character_source_occurrences o 
     WHERE o.character_id = c.id),
    ARRAY[]::text[]
  ) AS source_labels,
  (SELECT COUNT(DISTINCT source_label) 
   FROM character_source_occurrences 
   WHERE character_id = c.id) AS source_count
FROM jgw_characters c;
```

## 后端 Functions (Phase 1 核心)

### Function 1: `extract-characters-candidates`

**路径**: `/netlify/functions/extract-characters-candidates.js`

**用途**: 从 corpus 找候选字符列表 (Step 1 of 3)

**输入**:
```json
{
  "source_type": "corpus_document",       // 或 "corpus_collection"
  "source_id": "uuid",                    // corpus_documents.id
  "extraction_method": "shizi_biao",      // 或 "frequency"
  "config": {
    "min_frequency": 5,                   // frequency 模式用
    "max_candidates": 200
  }
}
```

**输出**:
```json
{
  "job_id": "uuid",
  "total_candidates": 127,
  "candidates": [
    {
      "char": "人",
      "pinyin_hint": "rén",
      "lesson_name": "第1课 你好",
      "page_num": 3,
      "context_snippet": "你好, 我是中国人...",
      "already_in_db": true,
      "existing_sources": ["人教一上", "HSK 1"]
    },
    // ...
  ]
}
```

**逻辑**:
1. 从 corpus_chunks 搜指定 document
2. 如果 method='shizi_biao':
   - 用 RAG 搜 "识字表 生字表 字表"
   - 对 top chunks, 让 AI 解析出字符列表
3. 如果 method='frequency':
   - 扫描所有 chunks 的 content
   - 统计每个汉字出现次数
   - 过滤 >= min_frequency 的
4. 对每个字符查 jgw_characters 是否已存在
5. 存 candidates 到 character_extraction_jobs
6. 返回 job_id + candidates

### Function 2: `enrich-character-details`

**路径**: `/netlify/functions/enrich-character-details.js`

**用途**: 用 AI 填充字符详情 (Step 2 of 3, 批量)

**输入**:
```json
{
  "job_id": "uuid",                      // 对应 job
  "characters": ["人", "口", "手"],      // 要填充的字
  "fields_to_fill": ["pinyin", "strokes", "radical", "hsk_level", "meaning", "examples"]
}
```

**输出**:
```json
{
  "filled": [
    {
      "char": "人",
      "pinyin": "rén",
      "strokes": 2,
      "radical": "人",
      "hsk_level": 1,
      "meaning": "person, human being",
      "examples": [
        {"cn": "这个人很好。", "en": "This person is nice."},
        {"cn": "我是中国人。", "en": "I am Chinese."},
        {"cn": "两个人。", "en": "Two people."}
      ],
      "ai_confidence": 0.98
    },
    // ...
  ]
}
```

**逻辑**:
1. 拿 characters 批处理 (每批 10 个)
2. 调 Claude API,给出明确 prompt:
   ```
   For each character in this list, provide accurate:
   - pinyin with tone marks
   - stroke count
   - radical
   - HSK level (1-6, or null if not in HSK)
   - English meaning (short)
   - 3 example sentences (Chinese + English)
   
   Characters: 人, 口, 手
   Format: JSON
   ```
3. 解析 AI 返回, 带 confidence score
4. **不写数据库** — 只返回结果,让用户审核
5. 如果 confidence < 0.7, 标记 needs_review

### Function 3: `import-characters-batch`

**路径**: `/netlify/functions/import-characters-batch.js`

**用途**: 批量入库 (Step 3 of 3, 用户最终确认后)

**输入**:
```json
{
  "job_id": "uuid",
  "characters": [
    {
      "char": "人",
      "pinyin": "rén",
      "strokes": 2,
      "radical": "人",
      "hsk_level": 1,
      "meaning": "person",
      "examples": [...],
      "ai_confidence": 0.98,
      "occurrence": {
        "source_type": "corpus_document",
        "source_id": "uuid",
        "source_label": "暨南一册",
        "lesson_name": "第1课 你好",
        "page_num": 3
      }
    },
    // ...
  ]
}
```

**输出**:
```json
{
  "job_id": "uuid",
  "total_added": 85,
  "total_updated": 42,
  "errors": []
}
```

**逻辑**:
```js
for (const charData of characters) {
  // 1. UPSERT 到 jgw_characters
  const existing = await findByChar(charData.char);
  let charId;
  
  if (existing) {
    // 只更新 AI 置信度低的字段 (不覆盖 human_edited 的)
    if (existing.human_edited_at === null) {
      await updateFields(existing.id, charData);
    }
    charId = existing.id;
    updated++;
  } else {
    // 新字符,完整 INSERT
    charId = await insert({
      ...charData,
      ai_filled_at: new Date(),
      needs_review: charData.ai_confidence < 0.7,
    });
    added++;
  }
  
  // 2. 总是 INSERT character_source_occurrences (可重复出现)
  await insertOccurrence({
    character_id: charId,
    ...charData.occurrence,
    job_id,
  });
}

// 3. 更新 job 状态
await updateJob(job_id, { status: 'complete', total_added, total_updated });
```

## Phase 1 交付内容

### 文件清单

```
/mnt/user-data/outputs/
  ├─ 011_character_extraction_schema.sql      (SQL migration)
  ├─ extract-characters-candidates.js         (Function 1)
  ├─ enrich-character-details.js              (Function 2)
  ├─ import-characters-batch.js               (Function 3)
  └─ README_character_extraction.md            (本文档)
```

### 部署步骤 (Phase 1)

```powershell
cd C:\Users\Lun_z\Desktop\coding_assistant\clf-platform

# 1. 下载所有文件到项目
Copy-Item "$env:USERPROFILE\Downloads\011_character_extraction_schema.sql" .\supabase\migrations\ -Force
Copy-Item "$env:USERPROFILE\Downloads\extract-characters-candidates.js" .\netlify\functions\ -Force
Copy-Item "$env:USERPROFILE\Downloads\enrich-character-details.js" .\netlify\functions\ -Force
Copy-Item "$env:USERPROFILE\Downloads\import-characters-batch.js" .\netlify\functions\ -Force

# 2. Supabase SQL Editor 跑 migration

# 3. 部署
netlify deploy --build --prod
```

### Phase 1 测试方法

部署后, 直接用 curl 测试,不需要 UI:

```bash
# Step 1: 从暨南二册找候选字符
curl -X POST https://zhongwen-world.netlify.app/.netlify/functions/extract-characters-candidates \
  -H "Content-Type: application/json" \
  -d '{
    "source_type": "corpus_document",
    "source_id": "第二册的 document id",
    "extraction_method": "shizi_biao"
  }'

# 返回 job_id 和 candidates 列表

# Step 2: 给候选字符填详情
curl -X POST https://zhongwen-world.netlify.app/.netlify/functions/enrich-character-details \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "...",
    "characters": ["人", "口", "手"]
  }'

# Step 3: 入库 (只入几个, 测试)
curl -X POST https://zhongwen-world.netlify.app/.netlify/functions/import-characters-batch \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "...",
    "characters": [...]
  }'
```

## Phase 2 (明天)

- Admin 端 Wizard UI (React 组件)
- "字符管理" tab 增强 (过滤/行内编辑)
- 字符详情 Modal

## Phase 3 (后天或之后)

- user_character_progress 表
- USER 端 "我的生字" tab
- 自适应推荐算法
- 学习进度可视化

---

## Phase 1 当前 TODO

☐ 跑 SQL 看 jgw_characters schema, 确认字段
☐ 写 migration SQL
☐ 写 3 个 Netlify functions
☐ 部署 + curl 测试

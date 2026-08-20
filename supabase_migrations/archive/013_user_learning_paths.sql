-- ═══════════════════════════════════════════════════════════════════
--  013_user_learning_paths.sql
--
--  Phase 3B: 记录用户的当前学习路径
--  (可选 — PathSelector 也 works with localStorage only)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_learning_paths (
  device_token TEXT PRIMARY KEY,
  current_path TEXT,               -- 'hsk' | 'jinan' | 'theme' | 'all'
  current_level TEXT,              -- 'hsk_1' | 'jinan_2' | NULL (可选, 细分级别)
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- RLS — 公开读写, 靠 device_token 分离
ALTER TABLE user_learning_paths ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read their own path" ON user_learning_paths;
CREATE POLICY "Anyone can read their own path" 
  ON user_learning_paths
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can write their own path" ON user_learning_paths;
CREATE POLICY "Anyone can write their own path" 
  ON user_learning_paths
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update their own path" ON user_learning_paths;
CREATE POLICY "Anyone can update their own path" 
  ON user_learning_paths
  FOR UPDATE
  USING (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_paths_token 
  ON user_learning_paths(device_token);

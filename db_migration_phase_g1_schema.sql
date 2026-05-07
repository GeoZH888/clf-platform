-- =========================================================
-- Phase G.1 - Unified Learning Architecture Schema
-- Companion to LEARNING_DECISIONS_LOCKED.md (Q1-Q7 answered)
--
-- Run in Supabase SQL Editor. All idempotent (safe to re-run).
-- =========================================================

-- Enable pgvector extension (Q2: text-embedding-3-small = 1536 dim)
CREATE EXTENSION IF NOT EXISTS vector;

-- =========================================================
-- 1. ATOMS REGISTRY
-- The smallest unit of "thing to learn".
-- Mirrors existing tables (clf_characters, clf_words, etc.)
-- via ref_table + ref_id pointer.
-- =========================================================
CREATE TABLE IF NOT EXISTS clf_atoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  -- 'character' | 'word' | 'pinyin' | 'grammar' | 'chengyu' | 'poem' | 'topic'
  ref_table TEXT,
  ref_id TEXT,
  display_text TEXT NOT NULL,
  level INT,                          -- 1-6 for HSK level (NULL otherwise)
  category TEXT,                      -- 'core'|'cultural'|'practice'|'future'
  difficulty FLOAT DEFAULT 1200,      -- Elo-style (Q6 mastery algorithm)
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (type, ref_table, ref_id)
);
CREATE INDEX IF NOT EXISTS idx_atoms_type_level ON clf_atoms(type, level);
CREATE INDEX IF NOT EXISTS idx_atoms_difficulty ON clf_atoms(difficulty);

-- Seed initial difficulty from level (Elo-style: HSK1=1000, HSK2=1200, ..., HSK6=2000)
-- Will be overridden by atom-seeding step.
-- 800 + level*200: HSK1=1000, HSK2=1200, HSK3=1400, HSK4=1600, HSK5=1800, HSK6=2000

-- =========================================================
-- 2. ATTEMPTS LOG
-- Each row = one practice event. Source of truth for
-- recency-weighted mastery score (Q6 Component 1).
-- =========================================================
CREATE TABLE IF NOT EXISTS clf_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES clf_user_profiles(user_id) ON DELETE CASCADE,
  atom_id UUID NOT NULL REFERENCES clf_atoms(id) ON DELETE CASCADE,
  outcome FLOAT NOT NULL,             -- 0.0 (wrong), 0.5 (partial), 1.0 (correct)
  context TEXT,                       -- 'flashcard'|'quiz'|'homework'|'spelling'|'listen'
  difficulty INT,                     -- 1-5: 1=hints shown, 5=hard mode
  attempt_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attempts_user_atom_recent
  ON clf_attempts(user_id, atom_id, attempt_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_user_recent
  ON clf_attempts(user_id, attempt_at DESC);

-- =========================================================
-- 3. PER-USER LEARNING STATE
-- Cached/derived state. Rebuilt nightly + on attempt.
-- =========================================================
CREATE TABLE IF NOT EXISTS clf_user_learning_state (
  user_id UUID NOT NULL REFERENCES clf_user_profiles(user_id) ON DELETE CASCADE,
  atom_id UUID NOT NULL REFERENCES clf_atoms(id) ON DELETE CASCADE,
  state TEXT DEFAULT 'unseen',
  -- 'unseen' | 'exposed' | 'practicing' | 'mastered' | 'forgotten'

  -- Counts (Q6 raw counters)
  exposure_count INT DEFAULT 0,
  practice_count INT DEFAULT 0,
  correct_count INT DEFAULT 0,

  -- Mastery (Q6 Component 1: recency-weighted, computed from clf_attempts)
  stored_mastery FLOAT DEFAULT 0,     -- the value at last review
  mastery_score FLOAT DEFAULT 0,      -- alias of stored_mastery for compat

  -- Forgetting curve (Q6 Component 2: Ebbinghaus stability)
  stability_days FLOAT DEFAULT 1.0,

  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,

  -- SM-2 spaced repetition (Q4: only flashcard atoms)
  next_review_at TIMESTAMPTZ,
  ease_factor FLOAT DEFAULT 2.5,
  interval_days INT DEFAULT 1,

  PRIMARY KEY (user_id, atom_id)
);
CREATE INDEX IF NOT EXISTS idx_uls_user_state
  ON clf_user_learning_state(user_id, state);
CREATE INDEX IF NOT EXISTS idx_uls_due
  ON clf_user_learning_state(user_id, next_review_at)
  WHERE next_review_at IS NOT NULL;

-- =========================================================
-- 4. CORPUS REGISTRY
-- Top-level container for content (HSK official, Jinan textbook, etc.)
-- =========================================================
CREATE TABLE IF NOT EXISTS clf_corpus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                 -- e.g. 'HSK 2025 Standard Wordlist'
  source TEXT,                        -- 'hsk_official'|'jinan_zhongwen'|'custom'
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================================================
-- 5. CORPUS CHUNKS (TREE)
-- Hierarchical structure: corpus -> book -> chapter -> lesson -> ...
-- =========================================================
CREATE TABLE IF NOT EXISTS clf_corpus_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corpus_id UUID NOT NULL REFERENCES clf_corpus(id) ON DELETE CASCADE,
  parent_chunk_id UUID REFERENCES clf_corpus_chunks(id) ON DELETE CASCADE,
  level INT NOT NULL,                 -- 1=book 2=chapter 3=lesson 4=paragraph 5=sentence
  ord INT DEFAULT 0,                  -- order within parent
  title TEXT,                         -- 'Chapter 1: Greetings' etc.
  content TEXT,                       -- actual text (for leaves)
  hsk_level INT,                      -- 1-6 estimated difficulty
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chunks_parent
  ON clf_corpus_chunks(parent_chunk_id);
CREATE INDEX IF NOT EXISTS idx_chunks_corpus_level
  ON clf_corpus_chunks(corpus_id, level);
CREATE INDEX IF NOT EXISTS idx_chunks_hsk
  ON clf_corpus_chunks(hsk_level);

-- =========================================================
-- 6. CHUNKS <-> ATOMS (many-to-many)
-- Records which atoms appear in which chunks.
-- =========================================================
CREATE TABLE IF NOT EXISTS clf_chunk_atoms (
  chunk_id UUID NOT NULL REFERENCES clf_corpus_chunks(id) ON DELETE CASCADE,
  atom_id UUID NOT NULL REFERENCES clf_atoms(id) ON DELETE CASCADE,
  occurrences INT DEFAULT 1,
  PRIMARY KEY (chunk_id, atom_id)
);
CREATE INDEX IF NOT EXISTS idx_chunk_atoms_atom
  ON clf_chunk_atoms(atom_id);

-- =========================================================
-- 7. CHUNK EMBEDDINGS (RAG)
-- One vector per chunk. Used for similarity search.
-- =========================================================
CREATE TABLE IF NOT EXISTS clf_chunk_embeddings (
  chunk_id UUID PRIMARY KEY REFERENCES clf_corpus_chunks(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  model TEXT DEFAULT 'text-embedding-3-small',
  embedded_at TIMESTAMPTZ DEFAULT now()
);
-- IVFFlat index for cosine similarity (good general-purpose default).
-- Tune lists count after corpus is populated:
--   <10k chunks: lists=10
--   10k-100k:    lists=100
--   >100k:       lists=1000
CREATE INDEX IF NOT EXISTS idx_chunk_emb_cosine
  ON clf_chunk_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =========================================================
-- 8. USER SKILL RATING (Elo-style; Q6 Component 3)
-- Lives on clf_user_profiles.
-- =========================================================
ALTER TABLE clf_user_profiles
  ADD COLUMN IF NOT EXISTS skill_rating FLOAT DEFAULT 1200;
  -- Default 1200 = HSK 2 baseline.
  -- Adjusts via Elo updates after each attempt.

-- =========================================================
-- 9. ROW-LEVEL SECURITY
-- =========================================================

-- 9a. clf_atoms: everyone reads, super_admin writes
ALTER TABLE clf_atoms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS atoms_read ON clf_atoms;
CREATE POLICY atoms_read ON clf_atoms
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS atoms_admin_write ON clf_atoms;
CREATE POLICY atoms_admin_write ON clf_atoms
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM clf_user_profiles
            WHERE user_id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM clf_user_profiles
            WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- 9b. clf_attempts: users write their own; teachers + admin read
ALTER TABLE clf_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attempts_own ON clf_attempts;
CREATE POLICY attempts_own ON clf_attempts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS attempts_admin_read ON clf_attempts;
CREATE POLICY attempts_admin_read ON clf_attempts
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM clf_user_profiles
            WHERE user_id = auth.uid()
            AND role IN ('super_admin', 'teacher', 'school_master'))
  );

-- 9c. clf_user_learning_state: user reads/writes own; teacher reads class students; admin all
ALTER TABLE clf_user_learning_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uls_own ON clf_user_learning_state;
CREATE POLICY uls_own ON clf_user_learning_state
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS uls_admin_read ON clf_user_learning_state;
CREATE POLICY uls_admin_read ON clf_user_learning_state
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM clf_user_profiles
            WHERE user_id = auth.uid()
            AND role IN ('super_admin', 'teacher', 'school_master'))
  );
-- NOTE: teacher class-membership scoping deferred to Phase G.9 (teacher knowledge map).
-- For now, teachers can read all student state. Tighten later.

-- 9d. clf_corpus / clf_corpus_chunks / clf_chunk_atoms / clf_chunk_embeddings:
--     all authenticated read; super_admin writes.
ALTER TABLE clf_corpus ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_corpus_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_chunk_atoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_chunk_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS corpus_read ON clf_corpus;
CREATE POLICY corpus_read ON clf_corpus FOR SELECT TO authenticated
  USING (is_active = true OR
         EXISTS (SELECT 1 FROM clf_user_profiles
                 WHERE user_id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS corpus_admin_write ON clf_corpus;
CREATE POLICY corpus_admin_write ON clf_corpus FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clf_user_profiles
                 WHERE user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM clf_user_profiles
                      WHERE user_id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS chunks_read ON clf_corpus_chunks;
CREATE POLICY chunks_read ON clf_corpus_chunks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS chunks_admin_write ON clf_corpus_chunks;
CREATE POLICY chunks_admin_write ON clf_corpus_chunks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clf_user_profiles
                 WHERE user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM clf_user_profiles
                      WHERE user_id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS chunk_atoms_read ON clf_chunk_atoms;
CREATE POLICY chunk_atoms_read ON clf_chunk_atoms FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS chunk_atoms_admin_write ON clf_chunk_atoms;
CREATE POLICY chunk_atoms_admin_write ON clf_chunk_atoms FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clf_user_profiles
                 WHERE user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM clf_user_profiles
                      WHERE user_id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS embeddings_read ON clf_chunk_embeddings;
CREATE POLICY embeddings_read ON clf_chunk_embeddings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS embeddings_admin_write ON clf_chunk_embeddings;
CREATE POLICY embeddings_admin_write ON clf_chunk_embeddings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clf_user_profiles
                 WHERE user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM clf_user_profiles
                      WHERE user_id = auth.uid() AND role = 'super_admin'));

-- =========================================================
-- 10. EFFECTIVE-MASTERY VIEW (Q6 Component 2: forgetting curve applied on read)
-- =========================================================
CREATE OR REPLACE VIEW clf_user_learning_state_effective AS
SELECT
  u.*,
  CASE
    WHEN u.last_seen_at IS NULL THEN 0
    WHEN u.stability_days IS NULL OR u.stability_days <= 0 THEN u.stored_mastery
    ELSE u.stored_mastery * exp(
      -EXTRACT(EPOCH FROM (now() - u.last_seen_at)) / 86400.0 / u.stability_days
    )
  END AS effective_mastery
FROM clf_user_learning_state u;

-- =========================================================
-- DONE
-- Verify with:
--   SELECT 'clf_atoms' AS tbl, count(*) FROM clf_atoms
--   UNION SELECT 'clf_attempts', count(*) FROM clf_attempts
--   UNION SELECT 'clf_user_learning_state', count(*) FROM clf_user_learning_state
--   UNION SELECT 'clf_corpus', count(*) FROM clf_corpus
--   UNION SELECT 'clf_corpus_chunks', count(*) FROM clf_corpus_chunks
--   UNION SELECT 'clf_chunk_atoms', count(*) FROM clf_chunk_atoms
--   UNION SELECT 'clf_chunk_embeddings', count(*) FROM clf_chunk_embeddings;
-- =========================================================

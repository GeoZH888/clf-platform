# Learning Architecture — Decisions Locked

**Resolved:** May 06 2026 end of session
**Decided by:** User (Geo)
**Companion to:** `LEARNING_ARCHITECTURE_SPEC.md`

These 7 decisions unblock Phase G.1+ (the learning data layer + RAG + knowledge map). Schema and code in next session must follow these.

---

## Q1 — Corpus source for v1

**LOCKED: HSK first. 暨南《中文》12-volume + custom curated sets layer on later.**

Implications for build:
- First corpus seed = HSK official wordlists (HSK 1-6) — start with HSK 1 + HSK 2 (~150 + ~300 words = ~450 atoms) as MVP corpus
- HSK provides built-in level taxonomy → maps directly to `clf_atoms.level` (1-6) and `clf_corpus_chunks.hsk_level`
- 暨南 ingestion = Phase G.4+ task (after v1 ships with HSK working)
- Source of truth for HSK wordlists: official PDFs from Hanban / digital wordlist on hsk.academy or similar

Action item for next session: identify which HSK wordlist source to ingest (CSV/JSON ready vs scraped).

---

## Q2 — Embedding model

**LOCKED: OpenAI `text-embedding-3-small` (1536 dim).**

Implications:
- Schema: `clf_chunk_embeddings.embedding vector(1536)`
- Schema: `clf_chunk_embeddings.model = 'text-embedding-3-small'` (allows future migration tracking)
- Need: OpenAI API key in Netlify env (`OPENAI_API_KEY`)
- Cost estimate: HSK 1-6 full corpus ≈ 5M tokens to embed = $0.10 one-time
- Re-embed strategy: batch process via Netlify scheduled function

Future migration path documented: add new column `embedding_v2 vector(N)` with new model, dual-write during transition, swap when ready.

---

## Q3 — Atom granularity

**LOCKED: Word-level only for v1. Character cascading deferred to later phase.**

Implications:
- When user reads "你好" → only atom `word:你好` gets exposure_count incremented
- Atoms `character:你` and `character:好` do NOT get credited
- `clf_chunk_atoms` mapping: each chunk links to atoms it contains, no cascade rules in v1
- Phase G.5 review will revisit: do users complain that character mastery doesn't grow? If yes, add cascade in v2.

Schema simplification: no need for atom-to-atom relationships table in v1.

---

## Q4 — SM-2 spaced repetition scope

**LOCKED: SM-2 applies to flashcard atoms only (字 + 词 + 拼音). v1.**

Implications:
- SM-2 columns (`next_review_at`, `ease_factor`, `interval_days`) only meaningful for atom types: character, word, pinyin
- For other atom types (grammar, chengyu, poem, topic), these columns stay NULL
- "Up next" widget on personal dashboard: queries only flashcard atoms with next_review_at <= now
- Other atom types tracked via mastery_score + exposure_count, no due dates

Phase G.7+ may add type-specific review patterns (e.g. "review grammar pattern weekly" without per-atom SM-2).

---

## Q5 — Privacy model for teacher view

**LOCKED: Per-student names visible by default. No anonymization.**

Implications:
- Teacher knowledge map view: drill-down to individual student names directly
- RLS policy: teacher reads `clf_user_learning_state` for students enrolled in their classes (via `clf_class_members`)
- UI: each cell/atom in teacher map can show "5/8 students mastered (Marco ✓, Sarah ✓, Wei ✗, ...)"
- Teacher actions: click a struggling student → open their personal page or schedule remediation

No anonymization layer in v1. Can add as opt-in setting later if needed.

---

## Q6 — Mastery definition

**LOCKED: `mastery_score >= 0.85 AND last_seen_at >= now() - 30 days`.**

Implications:
- Computed nightly via Postgres function `compute_mastery_state(user_id, atom_id)` returning enum
- Stored in `clf_user_learning_state.state` for fast queries (no need to recompute on every dashboard load)
- mastery_score formula (v1): `correct_count / NULLIF(practice_count, 0)` with no decay yet
- "Last seen" = `last_seen_at` updated on any exposure or practice event
- 30-day window is a tunable: stored as constant `MASTERY_WINDOW_DAYS = 30` in mastery.js, easy to adjust

Edge cases:
- `practice_count = 0`: state = 'unseen' or 'exposed' (not 'mastered' regardless of mastery_score)
- `practice_count > 0` and `mastery_score < 0.85`: state = 'practicing'
- `last_seen > 30 days ago`: state = 'forgotten' (even if previously mastered)

---

## Q7 — Knowledge map visualization

**LOCKED: Multiple views with user toggle. Tree + Bubble + Galaxy.**

Implications:
- 3 separate visualization components, sharing same underlying data feed:
  - `KnowledgeTreeMap.jsx` — nested rectangles, dense, scannable
  - `KnowledgeBubbleMap.jsx` — clustered bubbles, mid-density, attractive
  - `KnowledgeGalaxy.jsx` — constellation/star metaphor, polished, gorgeous
- View toggle in top corner: 树状图 / 气泡图 / 星系图
- User preference (last selected) persisted in localStorage
- Default for first visit: 树状图 (most informative)

Build sequence:
- Phase G.8a: Tree map (priority — most useful)
- Phase G.8b: Bubble map (when tree works)
- Phase G.8c: Galaxy (when others work)
- Each is ~half a session if data layer is solid

Library choices to evaluate:
- Tree map: D3.js treemap layout (you've used D3 before)
- Bubble map: D3 force-directed graph
- Galaxy: Three.js or pure SVG with custom positioning

Possibly use `react-d3-tree` / `nivo` / `recharts` for faster start instead of raw D3.

---

## Combined implications for schema (Phase G.1)

Final schema for first migration:

```sql
-- Atoms registry
CREATE TABLE clf_atoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,             -- 'character'|'word'|'pinyin'|'grammar'|'chengyu'|'poem'|'topic'
  ref_table TEXT,
  ref_id TEXT,
  display_text TEXT NOT NULL,
  level INT,                      -- 1-6 for HSK, NULL otherwise
  category TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_atoms_type_level ON clf_atoms(type, level);

-- Learning state per (user, atom)
CREATE TABLE clf_user_learning_state (
  user_id UUID NOT NULL REFERENCES clf_user_profiles(user_id),
  atom_id UUID NOT NULL REFERENCES clf_atoms(id),
  state TEXT DEFAULT 'unseen',    -- 'unseen'|'exposed'|'practicing'|'mastered'|'forgotten'
  exposure_count INT DEFAULT 0,
  practice_count INT DEFAULT 0,
  correct_count INT DEFAULT 0,
  mastery_score FLOAT DEFAULT 0,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  -- SM-2 fields (NULL for non-flashcard atoms per Q4)
  next_review_at TIMESTAMPTZ,
  ease_factor FLOAT DEFAULT 2.5,
  interval_days INT DEFAULT 1,
  PRIMARY KEY (user_id, atom_id)
);
CREATE INDEX idx_uls_user_state ON clf_user_learning_state(user_id, state);
CREATE INDEX idx_uls_due ON clf_user_learning_state(user_id, next_review_at)
  WHERE next_review_at IS NOT NULL;

-- Corpus structure
CREATE TABLE clf_corpus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,             -- e.g. 'HSK 2025 Standard'
  source TEXT,                    -- 'hsk_official'|'jinan_zhongwen'|'custom'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE clf_corpus_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corpus_id UUID NOT NULL REFERENCES clf_corpus(id),
  parent_chunk_id UUID REFERENCES clf_corpus_chunks(id),
  level INT NOT NULL,             -- 1=book, 2=chapter, 3=lesson, 4=paragraph, 5=sentence
  ord INT DEFAULT 0,
  title TEXT,
  content TEXT,
  hsk_level INT,                  -- 1-6 estimated difficulty
  metadata JSONB DEFAULT '{}'
);
CREATE INDEX idx_chunks_parent ON clf_corpus_chunks(parent_chunk_id);
CREATE INDEX idx_chunks_hsk ON clf_corpus_chunks(hsk_level);

-- Many-to-many: chunks contain atoms
CREATE TABLE clf_chunk_atoms (
  chunk_id UUID NOT NULL REFERENCES clf_corpus_chunks(id),
  atom_id  UUID NOT NULL REFERENCES clf_atoms(id),
  PRIMARY KEY (chunk_id, atom_id)
);

-- Embeddings for RAG
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE clf_chunk_embeddings (
  chunk_id UUID PRIMARY KEY REFERENCES clf_corpus_chunks(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  model TEXT DEFAULT 'text-embedding-3-small',
  embedded_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_chunk_emb ON clf_chunk_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS policies (simplified; full versions in migration script)
ALTER TABLE clf_user_learning_state ENABLE ROW LEVEL SECURITY;
-- Users read their own state
CREATE POLICY uls_own ON clf_user_learning_state
  FOR ALL USING (user_id = auth.uid());
-- Teachers read state for their class students
CREATE POLICY uls_teacher_read ON clf_user_learning_state
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clf_class_members cm
      JOIN clf_classes c ON c.id = cm.class_id
      WHERE cm.student_id = clf_user_learning_state.user_id
      AND c.teacher_id = auth.uid()
    )
  );
-- Super admin reads all
CREATE POLICY uls_admin_read ON clf_user_learning_state
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM clf_user_profiles
            WHERE user_id = auth.uid() AND role = 'super_admin')
  );

ALTER TABLE clf_atoms ENABLE ROW LEVEL SECURITY;
CREATE POLICY atoms_read ON clf_atoms FOR SELECT TO authenticated USING (true);
CREATE POLICY atoms_admin_write ON clf_atoms FOR INSERT, UPDATE, DELETE
  USING (
    EXISTS (SELECT 1 FROM clf_user_profiles
            WHERE user_id = auth.uid() AND role = 'super_admin')
  );
-- Similar for clf_corpus, clf_corpus_chunks, etc.
```

This is the schema for **Phase G.1's migration file**.

---

## Combined implications for Phase G build sequence

Updated with locked decisions:

| Phase | What | Estimated time |
|---|---|---|
| **G.1** | Schema migration + pgvector + RLS | 1 session |
| **G.2** | Atom seeding from existing tables (clf_characters → atoms etc.) | 0.5 session |
| **G.3** | Activity tracking hooks in existing 社区 modules | 1 session |
| **G.4** | HSK corpus ingestion (Q1) — wordlist → atoms + chunks | 1 session |
| **G.5** | Embedding pipeline + Netlify function | 0.5 session |
| **G.6** | Mastery computation function (Q6 formula) | 0.5 session |
| **G.7** | Personal dashboard card on /community | 1 session |
| **G.8a** | Tree map visualization (Q7 priority) | 1 session |
| **G.8b** | Bubble map | 0.5 session |
| **G.8c** | Galaxy view | 0.5-1 session |
| **G.9** | Teacher knowledge map (Q5 — full names visible) | 1 session |
| **G.10** | RAG retrieval API + wire into one 社区 module | 1 session |
| **G.11+** | Wire RAG into remaining 社区 modules | 2-3 sessions |

**Total: 10-13 sessions** for full Phase G.

---

## Resume checklist for next session (Phase G.1)

When you return:

- [ ] Open `LEARNING_ARCHITECTURE_SPEC.md` + this decisions doc
- [ ] Confirm Supabase plan supports pgvector (most do)
- [ ] Have `OPENAI_API_KEY` available in Netlify env
- [ ] First task: write `db_migration_phase_g1_atoms.sql` — the schema above
- [ ] Run migration in Supabase SQL Editor
- [ ] Second task: write `seed_atoms.sql` to populate clf_atoms from existing clf_characters / clf_words / etc.
- [ ] Verify atoms table has rows
- [ ] Stop. Don't move to G.2 in same session.

Allocate 90 minutes. Don't try to squeeze in.

---

## End of decisions doc

All 7 questions answered. Schema is concrete. Build sequence is concrete. Phase G can start cleanly next session.

---

## APPENDIX A — Mastery Algorithm (added late session)

This section refines Q6 with a **comprehensive mastery algorithm** that combines:
- Refined mastery score formula (weighted by recency)
- Forgetting curve (Ebbinghaus-style decay)
- Difficulty-adjusted scoring (Elo-style)

Replaces the simpler Q6 formula. v1 implementation in Phase G.6.

---

### Why comprehensive

Simple formula `correct_count / practice_count >= 0.85` has three known problems:

1. **No recency weighting**: Getting 4/5 right last year is treated like 4/5 right today. Memory fades; the algorithm should reflect that.
2. **No forgetting**: A user who mastered an atom 6 months ago and hasn't seen it likely doesn't remember it. Without decay, they appear to "know" things they've forgotten.
3. **No difficulty signal**: Getting 5 HSK 6 words right correctly is much harder than 5 HSK 1 words. Treating them as equal mastery is misleading.

The algorithm below addresses all three.

---

### Component 1 — Recency-weighted mastery score

Replace simple `correct_count / practice_count` with **exponentially-weighted moving average**:

```
mastery_score = sum(w_i * outcome_i) / sum(w_i)

where:
  outcome_i = 1.0 if correct, 0.0 if incorrect
  w_i = exp(-λ * days_since_attempt_i)
  λ = 0.05  (decay rate constant — tunable)
```

**What this means:**
- Recent attempts weight more than old attempts
- A correct answer today contributes ~1.0 weight
- A correct answer 30 days ago contributes ~0.22 weight
- A correct answer 90 days ago contributes ~0.011 weight (nearly zero)
- λ = 0.05 gives "half-life" of ~14 days for an attempt's weight

**Implementation:** Stored attempts table required. Each row: `(user_id, atom_id, attempt_at, outcome)`. Mastery score computed by aggregating recent attempts. For efficiency, cache result in `clf_user_learning_state.mastery_score` and recompute nightly or on each new attempt.

```sql
-- New table for individual attempts (replaces simple correct_count++)
CREATE TABLE clf_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES clf_user_profiles(user_id),
  atom_id UUID NOT NULL REFERENCES clf_atoms(id),
  outcome FLOAT NOT NULL,           -- 0.0 = wrong, 0.5 = partial, 1.0 = correct
  context TEXT,                     -- 'flashcard'|'quiz'|'homework'|'spelling' etc
  difficulty INT,                   -- 1=easy hint shown, 5=no hints, hard mode
  attempt_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_attempts_user_atom_recent
  ON clf_attempts(user_id, atom_id, attempt_at DESC);
```

---

### Component 2 — Forgetting curve

Even without practice, mastery decays over time. Apply Ebbinghaus-style decay to mastery_score when computing current state:

```
effective_mastery(t) = stored_mastery * exp(-t / S)

where:
  t = days since last_seen_at
  S = stability factor (depends on practice history)
```

**Stability factor S** grows with successful reviews:
- Initial: S = 1 day
- After each correct review at appropriate interval: S *= ease_factor (default 2.5)
- After incorrect review: S = max(1, S * 0.5)

This is equivalent to the SM-2 algorithm's spacing logic, but reframed as "how long memory lasts" rather than "when to schedule next review."

**Forgetting state threshold:** an atom moves to `state = 'forgotten'` when `effective_mastery < 0.4` (was previously `>= 0.85`).

**Implementation:** Two columns on `clf_user_learning_state`:
- `stored_mastery` — what the user achieved at last review
- `stability_days` — current memory stability factor

`effective_mastery` is computed on read, never stored (always derived from stored_mastery + stability + last_seen_at).

```sql
ALTER TABLE clf_user_learning_state
  ADD COLUMN stored_mastery FLOAT DEFAULT 0,
  ADD COLUMN stability_days FLOAT DEFAULT 1.0;

-- View that computes effective mastery on read
CREATE OR REPLACE VIEW clf_user_learning_state_effective AS
SELECT
  *,
  CASE
    WHEN last_seen_at IS NULL THEN 0
    ELSE stored_mastery * exp(
      -EXTRACT(EPOCH FROM (now() - last_seen_at)) / 86400.0 / stability_days
    )
  END AS effective_mastery
FROM clf_user_learning_state;
```

---

### Component 3 — Difficulty-adjusted scoring (Elo-style)

Each atom has an inherent difficulty rating. Each user has an inherent skill rating. After each attempt, both adjust:

```
expected_outcome = 1 / (1 + 10^((atom_difficulty - user_skill) / 400))
actual_outcome = 0.0 or 1.0 (the result)

K = 32 (learning rate — tunable)

new_user_skill = user_skill + K * (actual_outcome - expected_outcome)
new_atom_difficulty = atom_difficulty - K * (actual_outcome - expected_outcome)
```

**What this means:**
- User correctly answers a hard atom (difficulty > skill) → big skill gain, big difficulty drop
- User correctly answers an easy atom (difficulty < skill) → small skill gain, small difficulty drop
- User wrong on an easy atom → big skill drop, big difficulty rise
- User wrong on a hard atom → small skill drop, small difficulty rise

Initial values:
- `atom_difficulty` seeded from HSK level: HSK1=1000, HSK2=1200, ..., HSK6=2000
- `user_skill` initialized at 1200 (HSK 2 baseline) and adjusts from there

```sql
ALTER TABLE clf_atoms
  ADD COLUMN difficulty FLOAT DEFAULT 1200;

ALTER TABLE clf_user_profiles
  ADD COLUMN skill_rating FLOAT DEFAULT 1200;

-- Initial atom difficulty seeded from HSK level (one-time migration)
UPDATE clf_atoms
  SET difficulty = 800 + (level * 200)
  WHERE level IS NOT NULL;
```

**Why this matters for the system:**
- "Mastery" can require a higher absolute mastery_score for hard atoms (e.g. mastered = effective_mastery >= 0.85 AND user_skill > atom_difficulty - 200)
- Recommendations: serve atoms where `atom_difficulty ≈ user_skill + 100` (sweet spot — challenging but not impossible)
- Adaptive level (Q1) becomes natural: user_skill rises → next session shows harder atoms

---

### Combined mastery state computation

The full state machine:

```javascript
// In src/lib/mastery.js
const MASTERY_THRESHOLD = 0.85;
const FORGOTTEN_THRESHOLD = 0.4;
const PRACTICE_THRESHOLD = 0.5;
const SKILL_GAP_FOR_MASTERY = -200; // user must be within 200 Elo of atom

export function computeState(state, atom, user) {
  if (state.practice_count === 0 && state.exposure_count === 0) {
    return 'unseen';
  }
  if (state.practice_count === 0) {
    return 'exposed';
  }

  // Compute effective mastery with forgetting curve
  const daysSinceLastSeen = (Date.now() - state.last_seen_at) / 86400000;
  const effectiveMastery = state.stored_mastery *
    Math.exp(-daysSinceLastSeen / state.stability_days);

  // Forgotten check
  if (effectiveMastery < FORGOTTEN_THRESHOLD) {
    return 'forgotten';
  }

  // Mastered check (with difficulty adjustment)
  const skillGap = user.skill_rating - atom.difficulty;
  if (effectiveMastery >= MASTERY_THRESHOLD && skillGap >= SKILL_GAP_FOR_MASTERY) {
    return 'mastered';
  }

  // Default: practicing
  return 'practicing';
}
```

---

### Tunable constants (all in one place)

For ease of future tuning, all algorithm constants live in `src/lib/mastery.js` as named exports:

```javascript
export const MASTERY_CONFIG = {
  // Recency weighting (Component 1)
  RECENCY_LAMBDA: 0.05,           // half-life ~14 days

  // Forgetting curve (Component 2)
  INITIAL_STABILITY_DAYS: 1.0,    // memory lasts 1 day after first correct
  STABILITY_MULTIPLIER: 2.5,      // SM-2 ease factor on success
  STABILITY_PENALTY: 0.5,         // halved on failure

  // Elo-style difficulty (Component 3)
  ELO_K: 32,                      // learning rate
  HSK_DIFFICULTY_BASE: 800,       // HSK1 = 1000, HSK2 = 1200, etc.
  HSK_DIFFICULTY_STEP: 200,
  USER_SKILL_DEFAULT: 1200,       // starts at HSK 2 level

  // Thresholds for state classification
  MASTERY_SCORE_THRESHOLD: 0.85,
  FORGOTTEN_THRESHOLD: 0.4,
  SKILL_GAP_FOR_MASTERY: -200,    // user can be 200 Elo below atom and still master
};
```

These can be A/B tested per cohort once you have data.

---

### Performance considerations

This algorithm runs constantly (every dashboard view, every practice session). Performance matters.

**Strategy:**
1. **Hot path (per atom view):** Read `stored_mastery + stability_days + last_seen_at + atom.difficulty + user.skill_rating`. All scalar fields, fast.
2. **Compute effective_mastery in-memory** (single exp() call). Cache result for the request.
3. **State classification (computeState)** is O(1) per atom.
4. **Update path (after attempt):** Insert into `clf_attempts`, recompute `mastery_score` from recent attempts (window of ~20), update `stored_mastery + stability_days`. Write back to `clf_user_learning_state`. Single transaction.
5. **Don't recompute mastery for ALL atoms nightly** — only for atoms a user has practiced. Lazy evaluation.

**Cache invalidation:**
- `effective_mastery` is never cached (always derived). Avoids stale-cache bugs.
- `state` is cached in `clf_user_learning_state.state` for fast filter queries (e.g. "show all atoms in 'forgotten' state"). Recomputed on attempt + nightly cron.

---

### Honest limitations of this algorithm

**What it does well:**
- Captures recency, forgetting, and difficulty in one model
- Each component has empirical/academic backing
- Tunable constants in one place
- O(1) per-atom queries

**What it doesn't do:**
- **No interaction effects between atoms.** Knowing 你 might help you remember 你好 — this algorithm doesn't model that.
- **No transfer learning.** Mastery of HSK words doesn't speed mastery of grammar patterns even if related.
- **No individual user variation.** Two users get the same forgetting rate; some people forget faster than others.
- **No content quality signal.** A poorly-written quiz that confuses everyone shouldn't penalize users — but this algorithm treats their wrong answers as "they don't know."
- **Not a Bayesian model.** True P(knows atom | history) would be richer but requires more training data.

**v2 enhancements** (after months of v1 data):
- Item Response Theory (IRT) for difficulty calibration
- Bayesian Knowledge Tracing (BKT) for state estimation
- DeepKT or transformer-based models if you have 1M+ attempts logged

For v1 (no data yet): the comprehensive 3-component algorithm above is the right balance — sophisticated enough to give meaningful signal, simple enough to ship.

---

### Build sequence updated for Phase G

| Phase | What | Time |
|---|---|---|
| G.1 (unchanged) | Schema migration including atoms + corpus + chunks + embeddings | 1 session |
| **G.2 (new)** | **Add `clf_attempts` table + difficulty/skill columns + mastery library** | **+0.5 session** |
| G.3 | Activity tracking (writes to clf_attempts) | 1 session |
| G.4 | HSK corpus ingestion | 1 session |
| G.5 | Embedding pipeline | 0.5 session |
| **G.6 (updated)** | **Mastery algorithm implementation in mastery.js + nightly cron** | **1 session (was 0.5)** |
| G.7 | Personal dashboard | 1 session |
| G.8a | Tree map | 1 session |
| G.8b | Bubble map | 0.5 session |
| G.8c | Galaxy view | 0.5-1 session |
| G.9 | Teacher knowledge map | 1 session |
| G.10 | RAG retrieval | 1 session |
| G.11+ | Wire RAG into 社区 modules | 2-3 sessions |

**Updated total: 11-14 sessions** for Phase G (was 10-13).

---

### End of mastery algorithm appendix

Algorithm is designed for v1 ship. Tunable constants for refinement. v2 enhancements possible once data exists.

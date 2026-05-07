# Unified Learning Architecture Spec

**Status:** Architecture spec. No code yet. Drafted at end of session May 06 2026.
**Covers:** Three deeply interconnected systems —
- [1] Personal learning dashboard (entrance card)
- [2] Knowledge map (teacher + student views)
- [3] Corpus-driven adaptive content (RAG-powered 社区 modules)

These were initially asked as three features. They share so much underlying data that designing them in isolation would create incompatibilities. This spec unifies them.

---

## Why these three are one system

The three pieces look separate but they share a single underlying truth: **what is the user's relationship to a piece of content?**

| Piece | Reads from | Writes to |
|---|---|---|
| Personal dashboard | learning state | (read-only, but triggers updates from activity) |
| Knowledge map (student view) | learning state + corpus structure | (read-only) |
| Knowledge map (teacher view) | aggregated learning state across students + corpus structure | (read-only) |
| Corpus-driven 社区 content | corpus + retrieval index | learning state (when user interacts) |

All three orbit around two core concepts:

- **Corpus structure** — what content exists, organized into chunks at multiple granularities (book → chapter → lesson → paragraph → sentence)
- **Learning state** — for each (user, content) pair, what's the relationship: never seen, exposed, practiced, mastered, forgotten

If those two are designed correctly, all three features fall out naturally. If designed wrong, all three fight each other.

---

## Core data model

### Concept 1: Knowledge atoms

The smallest unit of "thing to learn." Each atom has a stable ID and a type.

```
clf_atoms
  id              UUID PK
  type            'character' | 'word' | 'pinyin' | 'grammar' | 'chengyu' | 'poem' | 'topic'
  ref_table       'clf_characters' | 'clf_words' | 'clf_pinyin_lessons' | etc.
  ref_id          UUID/text — points into the type-specific table
  display_text    text — what the user sees (e.g. "你好" or "把字句")
  level           int — HSK1=1 ... HSK6=6 ... advanced=7+
  category        'core' | 'cultural' | 'practice' | etc.
  metadata        jsonb — type-specific extra info
  created_at, updated_at
```

This is the **registry of all learnable things across the platform**. 词语 in 社区, 成语 in 成语 module, 字 imported via wizard — all become atoms here. Existing tables stay untouched; this is a thin layer pointing into them.

### Concept 2: Learning state per user per atom

```
clf_user_learning_state
  user_id         UUID FK → clf_user_profiles
  atom_id         UUID FK → clf_atoms
  state           'unseen' | 'exposed' | 'practicing' | 'mastered' | 'forgotten'
  exposure_count  int — how many times shown
  practice_count  int — how many times practiced/answered
  correct_count   int — correct answers
  last_seen_at    timestamptz
  next_review_at  timestamptz — SM-2 spaced repetition
  ease_factor     float — SM-2
  interval_days   int — SM-2
  mastery_score   float 0-1 — derived (correct_count/practice_count, decayed by time)
  PRIMARY KEY (user_id, atom_id)
```

This is the **single source of truth** for "what does this user know."

When user does anything — reads a flashcard, takes a quiz, gets a homework graded — relevant atoms get updated here.

### Concept 3: Corpus structure

```
clf_corpus
  id              UUID PK
  name            text — e.g. "暨南《中文》第三册"
  source          text — 'jinan_zhongwen' | 'hsk_official' | 'custom'
  metadata        jsonb

clf_corpus_chunks
  id              UUID PK
  corpus_id       UUID FK
  parent_chunk_id UUID FK — null for top-level
  level           int — 1=book, 2=chapter, 3=lesson, 4=paragraph, 5=sentence
  ord             int — order within parent
  title           text — chapter name etc.
  content         text — actual text content
  hsk_level       int — estimated difficulty
  metadata        jsonb

clf_chunk_atoms
  chunk_id        UUID FK
  atom_id         UUID FK
  PRIMARY KEY (chunk_id, atom_id)
```

This represents the corpus as a tree, with atoms linked to chunks where they appear. Reverse lookup: "show me everywhere 你好 appears in the corpus."

### Concept 4: Embeddings (for RAG)

```
clf_chunk_embeddings
  chunk_id        UUID FK PK
  embedding       vector(1536) — OpenAI ada-002 dimension
  model           text — 'text-embedding-3-small' etc.
  created_at      timestamptz
```

Requires Supabase **pgvector** extension. Enable with:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Embedding model choice: `text-embedding-3-small` (OpenAI) is the default — cheap, multilingual, 1536 dim. Alternatives: BGE-M3 (open source, multilingual), Cohere multilingual.

### Concept 5: Teacher → student relationship

(Already exists in some form via classes.) Reused for knowledge map teacher view:
```
clf_classes
  teacher_id, student_ids[] (or via clf_class_members)
```

When teacher views knowledge map, they see aggregated `clf_user_learning_state` for students in their classes.

---

## RAG architecture

### Decision: Supabase pgvector vs external

**Recommendation: Supabase pgvector.** Reasons:
- Already on Supabase, no new infrastructure
- Sufficient for thousands-of-chunks scale (your corpus, even a 12-volume textbook, is < 100K chunks at sentence level)
- Built-in similarity search via SQL
- No extra API keys / no rate limits beyond Supabase's
- Cheaper than dedicated vector DBs at this scale

Alternatives (if scale grows): Pinecone, Weaviate, Qdrant.

### Embedding pipeline

1. Super_admin uploads/edits corpus content via admin tool
2. On save, a Netlify function `embed-chunk` is triggered:
   - Calls OpenAI embedding API (or chosen model)
   - Stores vector in `clf_chunk_embeddings`
3. Re-embedding happens when content changes (mark stale, re-embed in batch)

### Retrieval flow

When a 社区 module needs content for a user:
```
INPUT: user_id, atom_type, optional level, optional topic
↓
1. Fetch user's learning state — what they know vs need
2. Compute target chunk level (HSK level user is at + 1)
3. Run similarity search filtered by level + atom_type
4. Filter chunks the user has seen too many times
5. Return ranked list
```

Done client-side via Supabase RPC. Or as Netlify function.

### "Self-adaptive" levels

User's current level inferred from their `clf_user_learning_state`:
- Take last 30 days of practiced atoms
- Compute median HSK level of practiced atoms with mastery >= 0.7
- That's their "current level"
- Serve content at level+1 (challenge) and level (consolidation)
- Mix 70% level / 30% level+1

---

## UI surfaces

### Surface 1: Personal dashboard card (entrance)

**Where:** 6th card on `/community` entrance, alongside 教学/社区/HSK/游戏/非遗.
**Card name:** "我的" or "学习" — pick one. Use 我的 (cleaner mental model: "my stuff").
**Color:** Pink/rose to distinguish from existing 5.

When clicked, expands inline (mutual exclusion with others) showing:
- **Streak** — consecutive days of activity
- **Today's progress bar** — atoms practiced today / daily goal
- **Mastery summary by type** — characters: 234 mastered / 1500 total · words: 89 mastered / 800 total · etc.
- **Recently learned** — last 5 atoms with quick-review buttons
- **Up next** — 5 atoms due for review (SM-2)
- **Activity heatmap** — last 90 days of activity (GitHub-style green grid)

Clicking any item opens the relevant practice view in 社区.

### Surface 2: Knowledge map — student view

**Where:** Inside personal dashboard, "知识地图" link, OR via /knowledge-map.

Visualization choices (pick one in implementation):
- **Tree map** — corpus structure as nested rectangles, color-coded by mastery
- **Bubble map** — atoms as bubbles, size = importance, color = mastery
- **Galaxy/constellation** — visually appealing, atoms as stars, "constellations" = topics, brightness = mastery

Recommendation: tree map first (clearest, easiest to render). Galaxy as future polish.

Per-atom hover/click shows: mastery score, last seen, "practice now" button.

### Surface 3: Knowledge map — teacher view

**Where:** /admin-v2 → 模块内容 → 教学 → "知识地图" sub-tab (within teaching dashboard).

Same tree-map structure, but data is **aggregated across teacher's students**:
- Color = average class mastery
- Heat scale: red = class struggling here, green = class doing well
- Click a topic → see per-student breakdown

This is what makes it "integrated" — teacher and student see the SAME structure with SAME atoms, just from different angles.

### Surface 4: Corpus-driven 社区 content

Each 社区 module (汉字, 词语, 拼音, etc.) gets a "level" header:
- "你目前学到 HSK 3 第 4 课"
- "本节练习从《暨南中文》第三册第 4 课"

Content (flashcards, exercises) is dynamically pulled from corpus chunks at the user's level.

Super_admin can override defaults: choose corpus, level, specific chapter range.

---

## Decision points (must answer before building)

These are the architecture questions you must answer:

### Q1. Corpus source for v1

Which corpus do you want as the seed?
- (a) 暨南《中文》12-volume series (you've referenced this before)
- (b) HSK official wordlists/syllabi
- (c) Custom curated set
- (d) All of the above

This determines the first content ingestion pipeline.

### Q2. Embedding model

- (a) OpenAI text-embedding-3-small (default — needs API key)
- (b) BGE-M3 (open source, requires hosting or HF inference API)
- (c) Cohere multilingual

### Q3. Atom granularity

When a user sees the word "你好" in a story:
- Should that count as exposure for the atom "你好" only?
- Or also for atoms "你" and "好" individually?

Affects how learning state propagates.

### Q4. SM-2 scope

Spaced repetition due dates apply to:
- (a) All atom types uniformly
- (b) Only flashcard-style atoms (characters, words)
- (c) User-configurable per type

### Q5. Privacy model for teacher view

When teacher sees aggregated student knowledge map:
- (a) Anonymized by default (just %)
- (b) Per-student names visible (current default elsewhere)
- (c) Teacher chooses per session

### Q6. "Mastery" definition

A user has "mastered" an atom when:
- (a) Practiced N times correctly (e.g. N=5)
- (b) Practiced correctly N times in a row
- (c) Mastery score >= threshold (e.g. 0.85) AND last_seen within last 30d (no decay)
- (d) SM-2 ease factor >= threshold

Recommend (c) — most rigorous, accounts for forgetting curve.

### Q7. Visualization for knowledge map

Tree map / bubble map / galaxy map / multiple options? Pick one for v1.

---

## Build sequence (8-12 sessions estimated)

### Phase G.1 — Foundation schema (1 session)
- Create `clf_atoms`, `clf_user_learning_state`, `clf_corpus`, `clf_corpus_chunks`, `clf_chunk_atoms`, `clf_chunk_embeddings` tables
- Enable pgvector
- Seed clf_atoms by mirroring existing clf_characters / clf_words / clf_pinyin_lessons / etc.
- RLS policies (user reads own state; super_admin reads all)

### Phase G.2 — Activity tracking (1 session)
- Add hooks in existing 社区 modules to write to clf_user_learning_state on user actions:
  - Character flashcard view → exposure_count++
  - Quiz answer correct → practice_count++ correct_count++
  - Etc.
- Compute mastery_score nightly via Postgres function

### Phase G.3 — Personal dashboard card (1-2 sessions)
- Add "我的" card to /community entrance (6th card)
- Build dashboard component with stats + heatmap + recent + up-next
- Wire to clf_user_learning_state queries

### Phase G.4 — Corpus structure + admin (2 sessions)
- Build corpus admin (in /admin-v2 → RAG 管理) for super_admin to upload/edit corpus chunks
- Build embedding pipeline (Netlify function + batch re-embed)
- First corpus seed: pick whichever from Q1

### Phase G.5 — RAG retrieval API (1 session)
- Supabase RPC for similarity search by level + atom type + user state
- Test with sample queries

### Phase G.6 — Wire RAG into one 社区 module (1 session)
- Pick one module first (recommend 词语) — replace its content source with RAG retrieval
- Verify adaptive level works
- Use as template for other modules

### Phase G.7 — Wire RAG into remaining 社区 modules (2-3 sessions)
- Repeat G.6 pattern for 汉字/拼音/语法/成语/诗歌/故事会/场景对话
- Each takes ~30 min if pattern holds

### Phase G.8 — Knowledge map (student view) (1-2 sessions)
- Build tree-map visualization
- Wire to clf_user_learning_state + clf_atoms
- Place in personal dashboard

### Phase G.9 — Knowledge map (teacher view) (1 session)
- Aggregate across class members
- Wire into 教学 dashboard

---

## Files to be created

```
db_migration_phase_g_atoms.sql
db_migration_phase_g_corpus.sql
db_migration_phase_g_embeddings.sql

netlify/functions/
  embed-chunk.js
  retrieve-content.js
  compute-mastery.js (cron)

src/lib/
  learningState.js          ← read/write to clf_user_learning_state
  corpus.js                 ← retrieve chunks, similarity search
  mastery.js                ← compute scores, SM-2 logic

src/community/dashboard/
  PersonalDashboard.jsx     ← the entrance card content
  ActivityHeatmap.jsx
  MasterySummary.jsx
  RecentlyLearned.jsx
  UpNext.jsx

src/knowledge/
  KnowledgeMap.jsx          ← tree-map root
  KnowledgeMapNode.jsx
  StudentView.jsx
  TeacherView.jsx

src/admin/v2/pillars/
  RagManagement.jsx (replace placeholder)
    ├─ CorpusEditor.jsx
    ├─ ChunkBrowser.jsx
    └─ EmbeddingStatus.jsx

src/community/modules/
  (each module gets a thin RAG adapter that replaces its content source)
```

Roughly 30-40 new files across the build.

---

## Out of scope for first build

These are real but later:
- Voice/audio learning state (separate from text)
- Cross-language learning (Chinese-English-Italian alignment in atoms)
- Adaptive difficulty within an exercise (vs at content-selection level)
- Recommendation engine for "what to learn next" beyond SM-2
- Social features (compare progress with friends, leaderboards)
- Gamification (XP, levels, achievements) — would build on top of mastery_score
- Forgetting curve visualization
- Export learning state for portability

---

## Resume checklist

When starting Phase G.1 in next session:

- [ ] Open this doc + V2_MIGRATION_PLAN.md + PHASE_E2_ROADMAP.md
- [ ] Answer Q1-Q7 above (architectural decisions)
- [ ] Confirm Supabase has pgvector available (it does on standard plans)
- [ ] Decide whether to also enable real-time subscriptions for live dashboard updates
- [ ] Start with G.1 schema migrations — these are foundational, must land before anything else
- [ ] Verify schema in Supabase before any frontend code
- [ ] Allocate 2 hours minimum for G.1 — schema + atom seeding + RLS

---

## Five planning documents now stacked

| Document | Status | Phase |
|---|---|---|
| PHASE_E2_ROADMAP.md | Active | E.x — original 8 items |
| FEIYI_CONTENT_SPEC.md | Active | F.x — heritage content |
| TEACHING_DASHBOARD_SPEC.md | Active | E.x continuation |
| V2_MIGRATION_PLAN.md | Active | E.x admin migration |
| **LEARNING_ARCHITECTURE_SPEC.md** (this) | **New** | **G.x — learning data layer** |

Together these define ~25-30 future sessions. That's months of work. Pick a session at a time, finish it, verify, move on.

---

## End of spec

This is the foundation. Everything else builds on the data model defined here.

When you come back, start with **Q1-Q7 decisions** before any code. Schema for atoms/state/corpus depends on those answers.

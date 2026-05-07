# 教学助手 Phase 1 — Co-Teacher Design Doc

**Status:** awaiting approval before code
**Author:** drafted with Claude, decisions by Geo
**Last edited:** 2026-05-07

---

## 1. What we're building, in plain language

When a teacher logs in and clicks **课堂教学**, they see a sidebar of their classes (plus a "试用 Practice" entry). They click a class — the screen splits into three:

- **Left:** class list (sticky, always visible)
- **Center:** chat with the AI, scoped to that class
- **Right:** *living workspace* — a structured lesson plan that the AI fills in as the conversation progresses (title, objectives, vocab, key sentences, slide outline, worksheet items, quiz questions)

The teacher can:
- Talk to the AI in any language (Chinese / Italian / English) — the AI replies in the same language
- See the lesson plan take shape on the right *while* they're chatting
- Edit any panel on the right directly (the AI sees the edits)
- Save the lesson when satisfied — the chat, the structured plan, and downloadable artifacts (PPT / worksheet PDF / quiz) are all preserved
- Return later and continue the conversation, or open a saved lesson and revise it

In Phase 1, we ship the chat + living workspace + save. Downloadable artifacts come in Phase 2 of this same product (a different "phase 2" from the b→a→c→d ordering — to avoid confusion I'll call it **stage**: Stage 1 of Phase b, Stage 2 of Phase b, etc.).

**Stage scope for first deliverable:**
- ✅ Sidebar with classes + playground
- ✅ Chat (text only, no streaming — streaming added in Stage 1.5)
- ✅ Living workspace updates via Claude tool-calling
- ✅ Save chat + structured plan to DB
- ✅ Editable workspace panels (right-side text fields the user can edit; AI sees the edits)
- ⏸ Downloadable PPT / PDF / quiz → Stage 2
- ⏸ Streaming responses → Stage 1.5
- ⏸ Voice input → Phase 1.5+ (way later)

This keeps Stage 1 to roughly one focused session (3–4 hours).

---

## 2. Data model

Three new tables, one new column. All `dwxz_*` namespace, consistent with the rest.

```sql
-- 2.1 — The conversation thread (one per click of a class in the sidebar, or resumed)
CREATE TABLE dwxz_teacher_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id        UUID REFERENCES dwxz_classes(id) ON DELETE SET NULL,
  -- class_id NULL = playground conversation (not tied to a real class)
  title           TEXT,
  -- short title generated from first message ("把 sentences for HSK3", etc.)
  language        TEXT DEFAULT 'zh',
  -- detected from first message; persists for whole conversation
  status          TEXT NOT NULL DEFAULT 'active',
  -- 'active' | 'archived'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_teacher_conv_teacher ON dwxz_teacher_conversations(teacher_id, updated_at DESC);
CREATE INDEX idx_teacher_conv_class   ON dwxz_teacher_conversations(class_id, updated_at DESC);

-- 2.2 — Individual chat messages
CREATE TABLE dwxz_teacher_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES dwxz_teacher_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  -- 'user' | 'assistant' | 'system' | 'tool'
  content         TEXT,
  -- For 'tool' role: JSON of tool call/result. For others: raw text.
  tool_calls      JSONB,
  -- Tool calls made by the assistant in this turn (Claude tool-use schema)
  metadata        JSONB,
  -- Token counts, model used, latency, etc.
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_teacher_msg_conv ON dwxz_teacher_messages(conversation_id, created_at);

-- 2.3 — The structured lesson plan (the "living workspace" state)
CREATE TABLE dwxz_lesson_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID UNIQUE REFERENCES dwxz_teacher_conversations(id) ON DELETE CASCADE,
  -- one lesson plan per conversation
  teacher_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id        UUID REFERENCES dwxz_classes(id) ON DELETE SET NULL,

  -- Top-level metadata
  title           TEXT,
  hsk_level       TEXT,            -- 'HSK1' .. 'HSK6' or 'mixed'
  duration_min    INTEGER,         -- planned class minutes
  topic           TEXT,            -- "把 sentences", "Travel vocabulary", etc.

  -- The living workspace panels (each is a JSONB block; AI updates via tool calls)
  objectives      JSONB,           -- ["By end of class students can ..."]
  vocab           JSONB,           -- [{ char, pinyin, meaning_zh, meaning_it, example }]
  key_sentences   JSONB,           -- [{ zh, pinyin, it, en, note }]
  outline         JSONB,           -- [{ minute, activity, notes }]
  slides          JSONB,           -- [{ slide_n, title, body, notes }]  (Stage 2 hydrates this)
  worksheet       JSONB,           -- [{ question, type, answer }]       (Stage 2)
  quiz            JSONB,           -- [{ question, options, answer }]    (Stage 2)
  homework        JSONB,           -- [{ task, due }]                    (Stage 2)

  -- Lifecycle
  status          TEXT DEFAULT 'draft',
  -- 'draft' | 'ready' | 'taught' | 'archived'
  taught_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_lesson_teacher ON dwxz_lesson_plans(teacher_id, updated_at DESC);
CREATE INDEX idx_lesson_class   ON dwxz_lesson_plans(class_id, updated_at DESC);

-- 2.4 — User preference (sticky language per teacher; lives on existing user profile)
ALTER TABLE dwxz_teacher_teaching_profiles
  ADD COLUMN preferred_chat_language TEXT DEFAULT 'zh';
-- 'zh' | 'it' | 'en' — used as fallback when no message yet detects language
```

### RLS policies (sketched, not finalized)

```sql
-- Teachers can read/write only their own conversations + plans
ALTER TABLE dwxz_teacher_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY teacher_own_convs ON dwxz_teacher_conversations
  FOR ALL TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

ALTER TABLE dwxz_teacher_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY teacher_own_msgs ON dwxz_teacher_messages
  FOR ALL TO authenticated USING (
    conversation_id IN (SELECT id FROM dwxz_teacher_conversations WHERE teacher_id = auth.uid())
  );

ALTER TABLE dwxz_lesson_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY teacher_own_plans ON dwxz_lesson_plans
  FOR ALL TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
```

Super admins keep their `is_admin()` override for monitoring.

---

## 3. UI layout (text mockup)

```
┌─ TeacherLayout ─────────────────────────────────────────────────────────────┐
│ [logo] 教师工作台                                                            │
├──────────────┬──────────────────────────────────────────────────────────────┤
│ 班级管理     │                                                              │
│ 作业         │   ┌─ ClassroomPage with sidebar ─────────────────────────┐   │
│ 课堂教学  ←  │   │                                                       │   │
│ 消息通知     │   │  ┌─ MyClasses ───┬─ ChatPanel ─┬─ WorkspacePanel ──┐ │   │
│ 个人资料     │   │  │ 🎓 试用 (Play)│             │  📋 Lesson Plan   │ │   │
│              │   │  │               │ AI: 你好！   │  ─────────────    │ │   │
│              │   │  │ 📚 Class 3B   │             │  Title: ________  │ │   │
│              │   │  │   HSK3 · 12人 │ Me: 明天教  │  Class: 3B        │ │   │
│              │   │  │   ← active    │   把句子    │  HSK: HSK3        │ │   │
│              │   │  │               │             │  Duration: 30min  │ │   │
│              │   │  │ 📚 Class 4A   │ AI: 好的!   │                   │ │   │
│              │   │  │   HSK4 · 8人  │   计划是... │  📌 Objectives    │ │   │
│              │   │  │               │             │  • Students can.. │ │   │
│              │   │  │ + New Class   │ ┌────────┐  │  • By end of...   │ │   │
│              │   │  │               │ │ Type…  │  │                   │ │   │
│              │   │  │               │ └────────┘  │  📝 Key Vocab     │ │   │
│              │   │  │               │   [Send]    │  把 bǎ — disposal │ │   │
│              │   │  │               │             │  [+ Add row]      │ │   │
│              │   │  │               │             │                   │ │   │
│              │   │  │               │             │  💬 Sentences     │ │   │
│              │   │  │               │             │  我把书放在桌上   │ │   │
│              │   │  │               │             │                   │ │   │
│              │   │  │               │             │  📋 Outline       │ │   │
│              │   │  │               │             │  0–5  Warm-up     │ │   │
│              │   │  │               │             │  5–15 Intro 把    │ │   │
│              │   │  │               │             │  15–25 Practice   │ │   │
│              │   │  │               │             │  25–30 Wrap       │ │   │
│              │   │  │               │             │                   │ │   │
│              │   │  │               │             │  [💾 Save Plan]   │ │   │
│              │   │  └───────────────┴─────────────┴───────────────────┘ │   │
│              │   └───────────────────────────────────────────────────────┘   │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

### Behavior

- **Sidebar** loads from `dwxz_classes WHERE teacher_id = me`. Plus a hardcoded "🎓 试用 Practice" entry at top (always present). Each class shows: name, HSK level badge, student count, last lesson date.
- **Click class** → loads (or creates) most recent active conversation for that class. If none exists, starts a new one.
- **Chat panel** — standard chat UI. Plain text input. Send button. Messages stream in (Stage 1.5; for Stage 1 they appear all at once after AI responds).
- **Workspace panel** — each section (Objectives / Vocab / Sentences / Outline) is editable. User typing into a field is sent as a tool result back to the AI on next turn ("user manually edited objectives to: ..."), so the AI knows about manual edits.
- **Save button** — flips `dwxz_lesson_plans.status` to `ready`. Shows a toast.
- **Empty state** (playground or new conversation) — workspace shows "Tell me what you'd like to teach. I'll help build the lesson together." Chat input has a placeholder: "明天我想教 HSK3 的把字句..."

### Responsive note (Stage 1+ later)

On narrow screens (< 1024px), the workspace panel becomes a tab instead of a side panel. Mobile is not a Stage 1 priority but the layout should not break.

---

## 4. AI architecture — how conversation produces structured state

### The flow per chat turn

```
User types message
       ↓
Frontend POSTs to /.netlify/functions/teacher-coteacher-chat
       ↓
Backend constructs request:
  - System prompt (with current lesson plan state attached)
  - Conversation history (last N messages from DB)
  - User message
  - Tool definitions (update_objectives, add_vocab, etc.)
       ↓
Anthropic API call (Claude with tools)
       ↓
Claude responds with one or more of:
  - Plain text (assistant message)
  - Tool calls (e.g., update_outline({ outline: [...] }))
       ↓
Backend:
  - Persists assistant message to dwxz_teacher_messages
  - Applies each tool call to dwxz_lesson_plans
  - Returns to frontend: { message, plan_diff }
       ↓
Frontend:
  - Appends assistant message to chat
  - Animates updated workspace panels (highlight what changed)
```

### Tool schema (what Claude can do)

Six tools, all targeting the lesson plan record. Each takes a partial update; the backend merges into the existing JSONB.

```typescript
// Pseudocode, real types in code
update_lesson_meta(args: {
  title?: string,
  topic?: string,
  hsk_level?: string,
  duration_min?: number,
})

update_objectives(args: { objectives: string[] })

set_vocab(args: {
  vocab: Array<{
    char: string, pinyin: string,
    meaning_zh?: string, meaning_it?: string, meaning_en?: string,
    example?: string
  }>
})

set_key_sentences(args: {
  sentences: Array<{
    zh: string, pinyin?: string, it?: string, en?: string, note?: string
  }>
})

set_outline(args: {
  outline: Array<{ minute: string, activity: string, notes?: string }>
})

ask_clarifying_question(args: { question: string })
// This one doesn't update state — it's a hint to the frontend to highlight
// the question in the chat. Lets the AI pause and gather info before drafting.
```

### System prompt, sketched

```
You are a co-teaching assistant for {teacher_name}, a Chinese-language teacher
in Italy. You help plan classes by conversing with the teacher and
progressively building a structured lesson plan.

Current class context:
  Class: {class_name} ({class.hsk_level}, {class.student_count} students)
  Last lesson: {last_lesson.topic} on {last_lesson.taught_at}
  [In Stage 3 (Phase c): students still struggling with: ...]

Current lesson plan (the workspace the teacher sees):
  {lesson_plan_state_as_json}

Your job:
  - Have a natural conversation in {language}.
  - Use tool calls to update the lesson plan as ideas firm up.
  - Don't update fields prematurely — ask clarifying questions when needed.
  - When proposing new content (vocab, sentences), prefer authoritative
    examples; cite if drawing from textbook chapters the class has covered.
  - Always include pinyin and Italian translation for student-facing material.

Conversational style:
  - Match the teacher's energy. Brief if they're brief.
  - Treat the teacher as expert. Don't over-explain pedagogy.
  - When uncertain, propose two options and let them pick.
```

### Backend file: `netlify/functions/teacher-coteacher-chat.js`

Single function, ~200 lines. Handles:
- Auth (verify caller is a teacher)
- Conversation lookup / creation
- Building the request
- Anthropic API call
- Persisting messages
- Applying tool calls to the lesson plan
- Returning the result

Reuses the existing pattern from `teacher-ai.js` but with proper tool support and structured state.

---

## 5. File layout

All under `src/teacher/` — the canonical home.

```
src/teacher/
├── TeacherApp.jsx                         (existing, add /classroom/:classId? route)
├── TeacherLayout.jsx                      (existing, no changes)
├── pages/
│   └── ClassroomPage.jsx                  (rewrite — currently empty placeholder)
└── classroom/                             (NEW subfolder for the co-teacher)
    ├── MyClasses.jsx                      (left sidebar — class list)
    ├── ChatPanel.jsx                      (center — chat UI)
    ├── WorkspacePanel.jsx                 (right — living lesson plan)
    ├── workspace/                         (sub-components per section)
    │   ├── ObjectivesEditor.jsx
    │   ├── VocabEditor.jsx
    │   ├── KeySentencesEditor.jsx
    │   └── OutlineEditor.jsx
    ├── useCoTeacher.js                    (the hook — state, send, save)
    └── classroom-styles.js                (shared style tokens)

netlify/functions/
└── teacher-coteacher-chat.js              (NEW — the chat endpoint)

supabase_migrations/
└── stage_b1_coteacher_tables.sql          (NEW — the 3 tables + RLS + ALTER)
```

---

## 6. Build sequence

Each session is ~2–4 hours of focused work. Stop after each, test, commit.

### Stage b1.1 — Plumbing & schema (this session, if you say go)
- Apply DB migration (3 tables, RLS, profile column)
- Build `useCoTeacher.js` hook (loads / creates conversation, holds state)
- Build minimal `ClassroomPage.jsx` with three-column layout
- Build `MyClasses.jsx` sidebar — loads from `dwxz_classes` + playground entry
- Build empty stubs for `ChatPanel.jsx` and `WorkspacePanel.jsx`
- Wire routing: `/teacher/classroom` and `/teacher/classroom/:classId`

**Test:** clicking a class in the sidebar creates a conversation row. No AI yet.

### Stage b1.2 — Chat round-trip (next session)
- Build `ChatPanel.jsx` UI (messages list + input)
- Build `teacher-coteacher-chat.js` Netlify function (no tools yet — just plain Claude conversation)
- Build `useCoTeacher.send()` to POST to the function
- Persist messages to `dwxz_teacher_messages`

**Test:** type a message, get a Claude reply, refresh — history persists.

### Stage b1.3 — Tool calling & living workspace (next session)
- Add the 6 tool definitions to the system prompt
- Backend applies tool calls to `dwxz_lesson_plans`
- Build `WorkspacePanel.jsx` reading from the lesson plan record
- Build the 4 section editors (Objectives, Vocab, KeySentences, Outline)
- Animate updates (highlight changed fields for ~1s)

**Test:** chat causes the right panel to fill in. Manual edits to the panel persist.

### Stage b1.4 — Save & resume (next session)
- "Save" button → flips status to `ready`
- "My Lessons" view (per class, list of saved plans)
- Load saved plan → resumes its conversation

**Test:** save a lesson today, log out, log back in tomorrow, find it, continue.

After b1.4, Phase 1 (b) is **functionally complete** for one teacher to use end-to-end.

Stage b2 (downloadable PPT/PDF/quiz) and Stage b1.5 (streaming) come after, but you'll have a working co-teacher you can hand to a real teacher and observe.

---

## 7. Open questions (places I'm guessing)

These are decisions I'm making that I want flagged so you can override:

**Q1.** I'm assuming `dwxz_classes` has a `teacher_id` column to filter "my classes." Need to verify — if it's a join table (`dwxz_class_teachers`?), the sidebar query changes. **Verify before b1.1.**

**Q2.** Anthropic key is in Netlify env vars (`ANTHROPIC_API_KEY`). Confirmed from yesterday's grep. Defaulting to **`claude-sonnet-4-20250514`** for the co-teacher (based on `teacher-ai-background.js` line 39). Worth allowing super admin to override per-teacher in Phase c, but Stage b1 hardcodes Sonnet.

**Q3.** Tool calls: Claude can return multiple tool calls in one turn. I'm assuming we apply them in order, then return final assistant message. If Claude wants to chain (call tool → see result → call again), Stage b1 doesn't support that. We'd need a multi-turn handler. Adding now would slow b1.1 — propose adding in b2 if it's a real need.

**Q4.** Conversation length. Without truncation, we'll send full history to Claude every turn. At ~30 turns, ~30k tokens, ~$0.10/turn at Sonnet pricing. For now, no truncation. After 50 turns, stage 2 should add summarization.

**Q5.** What if Claude makes up vocabulary or example sentences that don't exist? Stage b1 doesn't verify against your `clf_characters` / `clf_words` tables. Safe for prototyping; risky if a teacher actually trusts an output. Stage b2 should add a verification pass — for now, the workspace is editable so the teacher can fix.

**Q6.** Playground class — does the playground conversation persist across sessions? If yes, the teacher always has one ongoing playground convo. If no, every visit is fresh. Defaulting to **persistent** (same UX as real classes) — the teacher's "scratch book."

---

## 8. What I need from you to start b1.1

Just one thing: **Verify Q1.** Run this in Supabase SQL editor and paste the result:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'dwxz_classes' ORDER BY ordinal_position;
```

If there's a `teacher_id` column, we're good. If teacher-class linkage uses a join table, point me at it (e.g., `dwxz_class_teachers`) and I'll adjust the sidebar query in b1.1.

Once Q1 is answered, I write the SQL migration + the b1.1 code, you paste/run, we test, we commit.

---

**End of design doc. Ready when you are.**

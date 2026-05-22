# David-Chinese · AI Tutor Design Spec
### Confucius (Professor) + David (Fellow Student)

> A two-character AI guidance system for the CLF platform. Confucius is the
> teacher who instructs and corrects; David is the Western peer-learner who
> journeys alongside the real student. Built on data the platform already
> collects. **Prerequisite: clf-platform must be stabilized first (Supabase
> client, PostgREST 500s, mojibake, service worker). Do not build this on the
> current fragile foundation.**

---

## 1. Concept

Two mascot characters, distinct roles:

| Character | Role | Voice | Speaks about |
|-----------|------|-------|--------------|
| **孔子 Confucius** | Professor / 老师 | Warm-authoritative, classical, concise | What to study next, why it matters, corrections, cultural & linguistic insight |
| **大卫 David** | Fellow student / 同学 | Casual, encouraging, relatable peer | Solidarity, celebration, voicing the learner's confusion, "we're in this together" |

**Signature device — the dialogue:** David voices the student's likely question;
Confucius answers it. Turns dry points into memorable mini-scenes.

> David: 老师, why does 了 mean two different things?
> Confucius: Ah, David — observe when it sits at the sentence's end…

David is Western, learning Chinese in Florence — mirroring the real student's
position. This makes the journey feel achievable; Confucius gives both Davids
(character and student) something to aspire to.

---

## 2. Architecture — the core loop

```
[student's existing progress data]
        │  (read, no new tracking needed)
        ▼
[buildSnapshot()] ── compact per-student summary
        │
        ▼
[AI advice call] ── snapshot + persona prompt → structured guidance
        │
        ▼
[cache in clf_tutor_messages] ── regenerate sparingly, not per-pageview
        │
        ▼
[Mascot card on CommunityHome] ── Confucius advice + David encouragement
        │                              + tappable suggested_action button
        ▼
[deep-link into /learn?module=X]
```

---

## 3. Data — already collected, just needs reading

No new tracking required. The tutor reads existing tables:

- `clf_chengyu_progress` and other `*_progress` tables — mastery per item
- SM-2 spaced-repetition state (`useCredits.js`) — what's due for review
- `useAdaptiveLearning` outputs — weak items, level, due/new counts
- `usePoints` — points, streak
- `clf_user_modules` — which modules the student can access

### buildSnapshot(userId) → object

Pure data function. **Build and verify this BEFORE any AI is involved.**

```js
{
  name: "marco",
  level: 3,
  streak_days: 5,
  studied_today: 12,
  due_reviews: 8,
  mastered: 45,
  struggling: ["画蛇添足", "拼音 zh/ch/sh"],   // lowest-mastery items
  last_active: "2 days ago",
  module_activity: { chengyu: "high", pinyin: "low", poetry: "none" },
  recent_wins: ["completed HSK1 characters"]    // for David to celebrate
}
```

---

## 4. New table — clf_tutor_messages

Caches generated advice so the AI isn't called on every page load.

```sql
create table if not exists clf_tutor_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references clf_user_profiles(user_id),
  lang         text not null default 'zh',         -- zh | en | it
  confucius    jsonb,    -- { greeting, advice, suggested_action }
  david        jsonb,    -- { greeting, encouragement }
  snapshot     jsonb,    -- the snapshot used (for debugging/audit)
  created_at   timestamptz default now()
);

create index if not exists idx_tutor_msg_user
  on clf_tutor_messages (user_id, created_at desc);
```

**Regeneration policy:** generate once per session OR once per day per user,
whichever you prefer. Read the latest cached row on page load; only call the AI
if the cached row is older than the threshold. This controls cost and latency.

---

## 5. AI prompt templates

Use the existing multi-provider AI config (Claude / GPT / Gemini / etc).
Request **structured JSON output** so the UI can render buttons reliably.

### Confucius (professor) prompt

```
You are 孔子 (Confucius), a warm and wise Chinese teacher guiding a student
learning Mandarin. You are encouraging but give real, specific guidance.

Student snapshot:
{snapshot}

Produce, in {lang} (zh | en | it):
1. greeting — one warm line acknowledging their effort or streak
2. advice — ONE specific next-step based on their weak areas and due reviews
3. suggested_action — { module, label } pointing to the most useful next module

Keep it under 3 sentences total. Wise, never preachy. No empty praise —
the advice must reference their actual data.

Return ONLY JSON:
{ "greeting": "...", "advice": "...", "suggested_action": { "module": "chengyu", "label": "复习这8个成语 →" } }
```

### David (fellow student) prompt

```
You are 大卫 (David), a Western student in Florence also learning Mandarin —
a friendly PEER, not a teacher. You relate to the struggle and celebrate wins.

Student snapshot:
{snapshot}

Produce, in {lang}:
1. greeting — peer-to-peer, warm and casual
2. encouragement — relate to one of their struggling items as a fellow learner,
   or celebrate a recent win. Mention you found it hard too, if relevant.

Under 2 sentences. Sound like a supportive classmate, not a coach.

Return ONLY JSON:
{ "greeting": "...", "encouragement": "..." }
```

### Optional: the dialogue device

For a specific tricky concept the student is struggling with, a third prompt
generates a short David-asks / Confucius-answers exchange. Use sparingly (it's
an extra AI call) — e.g. only on the module home for their weakest topic.

---

## 6. UI — mascot card

Place at the top of CommunityHome (and optionally each module home).

- **Confucius portrait** + greeting + advice + the suggested_action button
  (tappable → deep-links to `/learn?module=X`)
- **David portrait** + peer encouragement, smaller, beside or below
- Trilingual — respects the current ZH/EN/IT flag
- Art: **start with a simple placeholder or the existing panda-style illustration.**
  Swap in LoRA-generated Confucius/David art LATER. Do not block the logic on art.

---

## 7. Build order (after stabilization)

| Step | What | Risk | Verify |
|------|------|------|--------|
| 1 | `buildSnapshot()` — pure data, no AI | Low | Returns correct per-student stats |
| 2 | Static mascot card showing snapshot ("8 reviews due") | Low | Renders real data, no AI |
| 3 | `clf_tutor_messages` table + caching read | Low | Reads/writes cache correctly |
| 4 | Confucius AI advice layer | Med | Returns valid JSON, sensible advice |
| 5 | David encouragement layer | Med | Peer tone, references real data |
| 6 | Trilingual + the dialogue device | Med | All 3 langs, dialogue reads naturally |
| 7 | LoRA art for both characters | Low | Consistent character, emotion variants |

**Each step: build on a branch, verify, commit, then next.** Same discipline as
the stabilization phase.

---

## 8. Cost & safety notes

- **Cache aggressively.** Never call the AI per page load. Once/session or
  once/day per user. AI calls cost money and add latency.
- **Validate the JSON** the AI returns before rendering — wrap parse in try/catch,
  fall back to a static friendly message if the AI returns malformed output.
- **suggested_action.module must be one the student actually has access to**
  (check against `clf_user_modules`) — don't suggest a locked module.
- **Child-appropriate always.** These are guides for students who may be minors.
  Keep all generated content warm, age-appropriate, educational. The prompts
  should never produce anything but learning encouragement.
- **David is a stylized original character** inspired by the name/spirit, NOT a
  reproduction of Michelangelo's sculpture. Keep the art original.

---

## 9. Claude Code prompts (when ready to build)

Hand these to Claude Code one at a time, after stabilization, on a feature branch.

**Step 1:**
```
Create a function buildTutorSnapshot(userId) in src/lib/ that reads the
student's progress from clf_chengyu_progress and other *_progress tables,
their streak/points from the points system, their level and weak items from
the adaptive learning logic, and which modules they can access from
clf_user_modules. Return the snapshot object documented in tutor-design.md
section 3. Pure data only — no AI, no UI. Add a quick test that logs the
snapshot for a given user id.
```

**Step 4 (after 1–3 work):**
```
Add the Confucius AI advice layer using the existing AI provider config.
Use the prompt template in tutor-design.md section 5. Call the AI with the
snapshot, parse the JSON response safely (try/catch, fallback to a static
message on malformed output), and cache the result in clf_tutor_messages.
Only regenerate if the cached row is older than the session threshold.
```

(Continue with David, trilingual, etc. following section 7.)

---

*Spec authored as a planning artifact. Build only after clf-platform foundation
is stabilized. Keep this file in the repo (e.g. /docs/tutor-design.md) as the
living spec.*

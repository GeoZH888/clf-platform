# Verification Checklist — Tomorrow Morning

**Purpose:** Before any new code, verify what was shipped today. Catches broken pieces while they're still isolated.

**Time required:** 30-45 minutes of clicking and reading.

**Mindset:** Not coding. Just clicking and noting what works.

---

## Setup (2 min)

```powershell
[Environment]::CurrentDirectory = "C:\Users\Lun_z\Desktop\coding_assistant\clf-platform"
Set-Location "C:\Users\Lun_z\Desktop\coding_assistant\clf-platform"
npm run build
```

If `npm run build` fails: paste the error in the next session, I'll fix.
If it succeeds: continue.

```powershell
npm run dev
```

Open http://localhost:5174.

---

## Round 1 — Login + routing (2 min)

- [ ] Login as `superadmin` → lands on `/admin-v2` (not `/community`)?
- [ ] Logout, login as `marco` (student) → lands on `/community`?
- [ ] Logout, login as `laoshi` (teacher) → lands on `/community`?

Note any role that redirects to the wrong place.

---

## Round 2 — V2 admin foundation tabs (5 min)

Logged in as superadmin, on `/admin-v2`:

- [ ] Sidebar shows 基础设施 group with 4 items: 账户管理 / AI 配置 / RAG 管理 / 系统日志
- [ ] Sidebar shows 模块内容 group with 6 items: 教学 / 社区 / HSK / 游戏 / 非遗 / 未来

Click each foundation tab and note:

- [ ] **账户管理** — does the page load? Are users listed with stat cards on top?
- [ ] **AI 配置** — does the page load? Are 3 sub-tabs visible?
- [ ] **RAG 管理** — does the page load? What does it show?
- [ ] **系统日志** — does the page load (placeholder is fine)?

For any tab that errors: note the exact error text (red box on screen, or browser console F12 → Console tab).

---

## Round 3 — Institution branding (3 min)

Still in `/admin-v2 → 账户管理`:

- [ ] Each user row has a 🏢 机构 button (orange = empty, green = filled)?
- [ ] Click marco's 机构 button → does a modal open?
- [ ] In the modal: type `佛罗伦萨中文学校` in the name field
- [ ] Click 保存 → does the modal close?
- [ ] Does marco's 机构 button now appear green?
- [ ] Logout, login as marco
- [ ] On `/community`, does the header show: `大卫学中文 | 佛罗伦萨中文学校` separated by a vertical line?

If yes to all: institution branding works end-to-end.
If something fails: note where.

---

## Round 4 — Module pillars (10 min)

Login as superadmin, `/admin-v2`:

- [ ] **HSK pillar** — click in sidebar → does HSKAdminTab render? (Don't need to test functionality, just that it loads)
- [ ] **游戏 pillar** — click → see 3 sub-tabs (猜灯谜 active, 字源记忆 / 拼字游戏 disabled)? Click 猜灯谜 → does RiddleAdminTab render?
- [ ] **社区 pillar** — click → see 8 sub-tabs (汉字 / 词语 / 拼音 / 语法 / 成语 / 诗歌 / 故事会 / 场景对话)?

For each of the 8 社区 sub-tabs, click and note one of:
- ✅ Renders cleanly with content
- ⚠ Renders but shows internal error
- ❌ Tab itself errors with the red error boundary

Specifically for 成语 (default): does ChengyuAdminTab render? `apiKeys={{}}` was passed — may show internal error if it requires real API keys.

For 汉字: should show a button "打开导入向导" — click it → modal should open.

---

## Round 5 — Phase E.1 homework workflow (10 min)

This is the deepest functionality shipped today. Worth testing properly.

Login as `laoshi` (teacher):
- [ ] On `/community`, click 教学 card → opens teacher panel?
- [ ] Find 作业 (homework) section — can you create a new homework?
- [ ] Try uploading a PDF as homework attachment — works?
- [ ] Try recording audio for the homework prompt — works?

Login as `marco` (student):
- [ ] Can you see laoshi's homework assigned to you?
- [ ] Can you record an audio submission?
- [ ] Submit the homework — does it save?

Login back as laoshi:
- [ ] Can you see marco's submission?
- [ ] Can you grade it (give a score / feedback)?

Note any step that fails or errors.

---

## Round 6 — Database verification (5 min)

In Supabase SQL Editor, run:

```sql
-- Atoms seeded correctly?
SELECT type, count(*) FROM clf_atoms GROUP BY type ORDER BY type;

-- Should be 5 rows: chengyu=13, grammar=14, poem=11, topic=36, word=80

-- Empty tables intact?
SELECT count(*) FROM clf_attempts;
SELECT count(*) FROM clf_user_learning_state;
-- Both should be 0 (we haven't recorded any attempts yet)

-- View works?
SELECT count(*) FROM clf_user_learning_state_effective;
-- Should be 0

-- Embeddings empty?
SELECT count(*) FROM clf_chunk_embeddings;
-- Should be 0
```

If any query errors: schema didn't fully apply, paste the error.

---

## Round 7 — New code files compile (3 min)

In your editor, open these 3 files just to confirm they exist and look reasonable:

- [ ] `src/lib/mastery.js` — should have ~200 lines, exports MASTERY_CONFIG and several functions
- [ ] `src/lib/learningState.js` — should have ~250 lines, imports from `mastery.js`
- [ ] `netlify/functions/embed-chunk.js` — should have ~120 lines, imports from `@supabase/supabase-js`

These files have NOT been wired into anything yet. Their existence isn't testable in the UI. The build verifies they compile (already done in Setup).

---

## After verification — assess the situation

Tomorrow's first session decision depends on what you found:

**If everything works** → start G.4 or G.7.
- G.4 needs HSK source data — find a public HSK 1+2 wordlist
- G.7 (personal dashboard) — uses the new mastery library, can ship without G.4

**If 1-2 things broke** → fix those first before adding more.

**If many things broke** → we may need a stabilization session before continuing forward.

---

## What NOT to do tomorrow

- Don't pile new phases on top until verification round is complete
- Don't add G.7-G.11 without first knowing what works
- Don't start a session at the end of a long day

---

## Note from yesterday's session

This session went on too long. Many things were shipped without verification. The verification round above is catching up on what we should have done at each step. Future sessions should verify-as-you-go rather than batching it.

End of checklist. Good morning when you read this.

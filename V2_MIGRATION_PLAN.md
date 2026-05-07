# V2 Admin Migration Plan

**Status:** Migration plan for AdminAppV2 module pillars. Drafted at end of session May 06, 2026.
**Goal:** Wire all 6 module pillars into V2's sidebar, retire old `/admin`.
**Strategy:** One pillar per session. Verify each before moving on.

---

## Where things stand right now

✓ AdminAppV2 shell deployed at `/admin-v2`
✓ Sidebar with two collapsible groups (基础设施 + 模块内容)
✓ super_admin login redirects to `/admin-v2` directly
✓ 4 foundation tabs working: 账户管理 (polished + institution editor), AI 配置 (3 sub-tabs), RAG 管理 (CorpusTab), 系统日志 (placeholder)
✓ Old `/admin` still works in parallel — accessible via "↩ 旧后台 /admin" sidebar button
✓ Institution branding live: SQL columns + storage bucket + admin editor + header rendering

⏸ 5 module pillars are placeholders showing component-name hints
⏸ 1 pillar (未来) stays as placeholder long-term

---

## Migration sequence (one pillar per session)

Each pillar follows the same template:
1. Diagnostic of existing component(s) — props, exports, auth pattern
2. Build wrapper page in `src/admin/v2/pillars/`
3. Wire into AdminAppV2's TabContent
4. Test in `npm run dev`
5. Build + deploy
6. Verify on production
7. Mark pillar as "migrated" in this doc

---

### Session N+1 — HSK pillar (smallest, recommended first)

**Component to wire:** `HSKAdminTab.jsx` (27 KB)

**Files to create:**
- `src/admin/v2/pillars/HskPillar.jsx` — wraps HSKAdminTab with optional pre/post chrome (e.g. tabs for "题库 / 等级 / 统计")

**Diagnostic to run first:**
```powershell
Select-String -Path src\admin\HSKAdminTab.jsx -Pattern '^export|^import|^function HSKAdminTab|currentUser|props' | Select-Object -First 10
```

**AdminAppV2 edit:**
```jsx
if (activeTab === 'pillar-hsk') {
  return (
    <div>
      <SectionHeader icon="🎯" title="HSK" subtitle="HSK1-HSK6 等级内容" color="#9333ea"/>
      <HskPillar/>
    </div>
  );
}
```

**Estimated time:** 15-20 minutes
**Risk:** Low. Single component.

---

### Session N+2 — 游戏 pillar

**Component to wire:** `RiddleAdminTab.jsx` (19 KB) + `RiddleImageEditorModal.jsx` (21 KB) (linked)

**Files to create:**
- `src/admin/v2/pillars/GamePillar.jsx`

**Future games (placeholders):**
Within GamePillar, add tabs:
- 猜灯谜 (active) → RiddleAdminTab
- 字源记忆 (placeholder)
- 拼字游戏 (placeholder)

**Estimated time:** 20 minutes
**Risk:** Low.

---

### Session N+3 — 教学 pillar (super_admin dashboard)

**Reference:** `TEACHING_DASHBOARD_SPEC.md` (already written this session)

**Files to create (per spec):**
- `src/admin/v2/pillars/TeachingPillar.jsx` (top-level)
- `src/admin/v2/pillars/teaching/ActivityOverviewSection.jsx`
- `src/admin/v2/pillars/teaching/PerSchoolSection.jsx`
- `src/admin/v2/pillars/teaching/PerTeacherSection.jsx`
- `src/admin/v2/pillars/teaching/ActivityFeedSection.jsx`
- `src/admin/v2/pillars/teaching/TopPerformersSection.jsx`

**Pre-requisites:**
- Run schema discovery: which clf_* tables exist?
- Decide 5 open design questions (see TEACHING_DASHBOARD_SPEC.md → "Open design questions")

**Estimated time:** 90-120 minutes (split across 1-2 sessions if needed)
**Risk:** Medium. New schema queries; may surface missing tables.

---

### Session N+4 — 社区 pillar (biggest)

**Components to wire (8):**
| Component | Size | Purpose |
|---|---|---|
| PinyinAdminTab | 30 KB | 拼音 management |
| ChengyuAdminTab | 35 KB | 成语 management |
| GrammarAdminTab | 26 KB | 语法 management |
| PoetryAdminTab | 54 KB | 诗歌 management |
| StoryAdminTab | 22 KB | 故事会 management |
| ScenarioAdminTab | 23 KB | 场景对话 management |
| CLFWordsAdminTab | 19 KB | 词语 management |
| CharacterImportWizard | 37 KB | 汉字 import |

**Plus supporting:**
- BatchIllustrationModal, BatchWordIllustrationModal, ChengyuImageEditorModal, etc.

**Files to create:**
- `src/admin/v2/pillars/CommunityPillar.jsx` — top with sub-tab navigation
- One sub-tab handler per component (likely just renders the existing component, possibly with adjusted styling)

**Sub-tab design decision needed:**
Top tabs vs second-level sidebar? With 8+ items, top tabs may wrap awkwardly. Recommend **top tabs with optional 2-row layout**.

**Estimated time:** 60-90 minutes (might split into 2 sessions)
**Risk:** Medium-high. Components built for old admin's auth/style context. Each may surface specific issues.

**Recommendation:** Wire 3-4 components per session, not all 8 at once. Verify each before next.

---

### Session N+5 onwards — 非遗 pillar (build from scratch)

**Reference:** `FEIYI_CONTENT_SPEC.md` (already written)

This is **6-7 sessions** of its own per the existing spec:
- F.1: Schema + admin CRUD shell
- F.2: AI draft generation + markdown editor
- F.3: AI translation flow zh/en/it
- F.4: Public hub with article grid
- F.5: Article detail + TTS + video
- F.6: Interactive elements (calendar, tutorial, etc.)

**Recommendation:** Don't tackle this until 教学/社区/HSK/游戏 are all done. 非遗 is the most ambitious and shouldn't bottleneck the simpler pillars.

---

### Session N+? — 未来 pillar

Stays as placeholder. May never be built — it's the catchall for shop/parents/etc. that may or may not happen.

---

### Final session — Retire `/admin`

After all 5 active pillars are migrated and verified:

1. Remove old `<AdminApp/>` from App.jsx routing
2. Remove `IS_ADMIN` constant (keep only `IS_ADMIN_V2`, possibly rename to `IS_ADMIN`)
3. Delete `src/admin/AdminApp.jsx` (80 KB old file)
4. Delete unused old admin imports from App.jsx
5. Optionally rename `/admin-v2` → `/admin` (cleanup URL)
6. Remove "↩ 旧后台 /admin" button from V2 sidebar

**This is the cleanup session.** Every old admin function should be reachable via V2 by this point.

---

## Decision points to think about between sessions

These come up in the migration. Decide before each relevant session:

### For 社区 pillar (Session N+4)
- Top tabs vs sidebar nav for 8 sub-modules?
- Should each sub-module's existing page (built for old admin) get a light-theme refresh, or stay as-is?
- What happens to "deprecated" tabs like AdminPinyinAudio (30 KB) — wire them or skip?

### For 教学 pillar (Session N+3)
- Open design questions from TEACHING_DASHBOARD_SPEC.md (5 of them)

### For institution/multi-school
- Separate `clf_institutions` table eventually? (Already noted as future improvement)
- School-master role: should they see institution data scoped to their school only?

### For old admin retirement (final session)
- Are there power-user admin features only in old `/admin` that don't have V2 equivalents? (Check before deleting AdminApp.jsx)

---

## File structure after full migration

```
src/admin/
  AdminAppV2.jsx              ← main shell (sidebar + tab routing)
  v2/
    AccountsManagement.jsx    ← already built
    pillars/
      TeachingPillar.jsx
      teaching/
        ActivityOverviewSection.jsx
        PerSchoolSection.jsx
        PerTeacherSection.jsx
        ActivityFeedSection.jsx
        TopPerformersSection.jsx
      CommunityPillar.jsx
      community/
        PinyinTab.jsx (wraps PinyinAdminTab)
        ChengyuTab.jsx (wraps ChengyuAdminTab)
        GrammarTab.jsx (wraps GrammarAdminTab)
        PoetryTab.jsx (wraps PoetryAdminTab)
        StoryTab.jsx (wraps StoryAdminTab)
        ScenarioTab.jsx (wraps ScenarioAdminTab)
        WordsTab.jsx (wraps CLFWordsAdminTab)
        CharactersTab.jsx (wraps CharacterImportWizard)
      HskPillar.jsx (wraps HSKAdminTab)
      GamePillar.jsx (wraps RiddleAdminTab + future)
      FeiyiPillar.jsx (built from scratch)
      FuturePillar.jsx (placeholder)
```

After retirement:
- `src/admin/AdminApp.jsx` (deleted)
- All old tab files (CharacterImportWizard etc.) stay where they are — V2 imports them
- `src/admin/v2/` becomes the new home of everything

---

## Resume checklist (for next session)

Before starting:
- [ ] Open this doc + TEACHING_DASHBOARD_SPEC.md + FEIYI_CONTENT_SPEC.md
- [ ] `cd C:\Users\Lun_z\Desktop\coding_assistant\clf-platform`
- [ ] `npm run dev` (port 5174)
- [ ] Login as `superadmin` (lands on /admin-v2)
- [ ] Confirm V2 still working (sidebar renders, accounts page loads)
- [ ] Pick which pillar to do (start with HSK — smallest)
- [ ] Run diagnostic for that pillar's components
- [ ] Build the wrapper file
- [ ] Wire into AdminAppV2's TabContent
- [ ] Test in browser at /admin-v2 → click pillar
- [ ] Stop dev server, npm run build, deploy
- [ ] Mark pillar complete in this doc

---

## Total estimate

Full migration: **8-12 sessions** depending on:
- Whether 非遗 is included (adds 6-7 sessions)
- Whether each pillar's wrapper needs deep customization or is a thin import
- How much polish work happens along the way
- Schema discovery surprises (missing tables, etc.)

**Realistic timeline:** 2-3 weeks at one session per day. Could compress with longer sessions.

---

## End of plan

Save this with PHASE_E2_ROADMAP.md, FEIYI_CONTENT_SPEC.md, TEACHING_DASHBOARD_SPEC.md.
Reference at start of each migration session. Update as pillars get completed.

# Phase 1.5 — Super-admin panel gap audit

> Inventory + gap list. No code yet — Phase 3 fills the gaps in 6 sequential sub-tasks.

## Verdict

The super-admin panel is **roughly 60% built**. Solid foundation for user list / role assignment / module permissions / AI config — but missing **school management** entirely, missing **RLS hardening** for privileged writes, missing **audit logs** for sensitive admin actions, and partially missing **global analytics**.

Per the requirement to "complete and harden the super-admin panel," this is real work — estimated **8–12 hours** spread across Phase 3.1 through 3.6.

## Canonical entry point

`/admin-v2` → `src/admin/AdminAppV2.jsx` (App.jsx:90-91). The old `/admin` (`AdminApp.jsx`) is a legacy content-management surface; not deprecated, but no new features should land there.

## Current tabs (AdminAppV2.jsx:27-68)

### Foundation tabs

| Tab | Status | Reads/writes |
|---|---|---|
| **accounts** 👥 | Working — `AccountsManagement.jsx` | `clf_user_profiles` |
| **ai-config** 🤖 | Working — three sub-tabs (providers, API keys, prompts) | `clf_ai_provider_config` |
| **rag** 📚 | Working — `CorpusTab` | `content_sources`, `content_chunks` |
| **logs** 📜 | **PLACEHOLDER** ("待建") | nothing |

### Pillar tabs (content modules)

| Tab | Status |
|---|---|
| **pillar-teaching** 🏫 | Working — `TeacherKnowledgeMap.jsx` |
| **pillar-community** 🌐 | Working — character/words/pinyin/grammar/chengyu/poetry/story/scenario admins |
| **pillar-hsk** 🎯 | Working — `HskPillar.jsx` |
| **pillar-game** 🎮 | Working — `GamePillar.jsx` |
| **pillar-feiyi** 🏮 | **PLACEHOLDER** ("待建") |
| **pillar-future** ✨ | **PLACEHOLDER** ("待建") |

## Capability-by-capability scoring (requirement #4)

### A. User management (CRUD) — **PARTIAL**

- ✅ **Read** — `AccountsManagement.jsx:26-38` lists users with search/filter
- ⚠️ **Create** — `CreateUserModal` referenced at line 145; backend ready (`netlify/functions/admin-create-user.js`); **frontend modal form completeness unclear** without deeper read
- ✅ **Delete** — `removeUser()` at line 84-95 with modal confirm
- ✅ **Edit institution fields** — lines 68-82
- ❌ **Edit name / email / other profile fields** — no UI path
- ❌ **Reset password** — no UI path

**Phase 3.1 scope:** verify CreateUserModal works end-to-end; add profile-edit UI; add password-reset UI (calls service-role `admin.updateUserById`).

### B. Role assignment — **YES (frontend), GAP (backend)**

- ✅ **Frontend UI** — `UserCard.jsx:266-276` has a `<select>` dropdown, `AccountsManagement.jsx:56-66` updates `clf_user_profiles.role`
- ❌ **Backend RLS check** — no policy found that limits role UPDATE to super_admin only. **Anyone with a valid JWT could UPDATE their own role to `super_admin`** unless RLS blocks it.
- ❌ **Confirmation dialog** — role change is a silent dropdown save. Admins can accidentally demote.
- ❌ **Audit log** — no record of who changed whose role when.

**Phase 3.2 scope:** add RLS policy `role_update_super_admin_only` (this is critical — verify or write it before anything else); add confirmation dialog; add audit log row insertion.

### C. Module permissions per user — **YES**

- ✅ **Working** — `UserModulesButton.jsx` modal at lines 82-322, save logic 157-186, presets, default reset
- ✅ **Respects `m.gateable`** so non-gateable modules can't be toggled
- ⚠️ **No bulk-apply across multiple users** — single user at a time

**Phase 3.3 scope:** mostly polish + add bulk-apply UI if needed. Verify RLS on `clf_user_modules` writes restricts to super_admin (or school_master for their own school's users).

### D. School management — **DEFERRED (sketch only, decision 2026-05-22)**

The schema sketch below stays as a future reference. Phase 3.4 is removed from the immediate build queue; reconsider when a second school is on the horizon.

- ❌ No `clf_schools` table in any migration in this repo
- ❌ No school CRUD UI
- ❌ No school enrollment model — `clf_user_profiles.school_id` exists but doesn't reference any table; `institution_name` is a free-text field
- ❌ school_master role can't actually be scoped to a school without this

This is **the biggest gap** for requirement #4. Without it, multi-school deployment is impossible.

**Phase 3.4 scope (largest single sub-task):**

```sql
-- Sketch for the migration Phase 3.4 will design + apply
create table public.clf_schools (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  name_zh      text,
  logo_url     text,
  city         text,
  country      text,
  principal_id uuid references auth.users(id),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Make school_id a real FK (currently free-form per the audit)
alter table public.clf_user_profiles
  drop constraint if exists clf_user_profiles_school_fkey,
  add constraint clf_user_profiles_school_fkey
    foreign key (school_id) references public.clf_schools(id) on delete set null;
```

Plus UI: school list, create/edit form, user-to-school attachment widget, school_master scoping (a school_master sees only their own school's users in admin views).

### E. Analytics — **PARTIAL**

- ✅ `AIAnalyticsTab.jsx` exists — module/level/hour heatmaps, per-student insights
- ❌ No global metrics: total users by role/tier/school, MAU, signup trends
- ❌ No credit-system analytics (since credits don't exist yet — Phase 2.B prerequisite)
- ❌ No school-level breakdowns

**Phase 3.5 scope:** add a "Platform" tab alongside "AI" — user counts by role/tier, signups over time, credit burn rate (after Phase 2.B), and per-school activity (after Phase 3.4).

### F. AI config — **MOSTLY YES**

- ✅ Three sub-tabs working: providers, API keys, prompts
- ⚠️ `ApiKeyManager.jsx` not deeply audited — may have completeness gaps

**Phase 3.6 scope:** read ApiKeyManager, fill any gaps, confirm key rotation works.

## Hardening concerns (critical for "harden the super-admin panel")

### Critical 🚨

1. **No backend RLS policy audit for `clf_user_profiles.role` UPDATE.** Phase 3.2 must add or verify a policy restricting role-update to super_admin. This is the single most important hardening item — without it, any authenticated user could potentially escalate their own role.

2. **No audit log of admin actions.** Role changes, user deletions, module permission edits all happen silently. Phase 3 should add a `clf_admin_audit_log` table with rows `{actor_user_id, target_user_id, action, before, after, created_at}` and write to it from every privileged action.

### Acceptable but worth noting

3. **Service-role key correctly server-side only** — verified clean per the audit. `netlify/functions/admin-create-user.js:9` uses it; no frontend exposure.

4. **InstitutionModal write scope is bounded** — only writes `institution_name` and `institution_logo_url`. No arbitrary-field write surface.

5. **Bulk operations on user_modules have presets without confirmation** — low-blast (toggling modules per user). Acceptable for now.

## Phase 3 task ordering (sequential, all on one branch)

Per the build-plan.md, Phase 3 must be sequential because all these tasks edit `src/admin/AdminAppV2.jsx` or its child tab components. Parallel would cause merge conflicts.

| Sub-task | What | Effort |
|---|---|---|
| 3.1 | User CRUD: verify CreateUserModal, add profile edit + password reset | 2–3h |
| 3.2 | Role assignment hardening: RLS policy + confirmation + audit row | 1–2h |
| 3.3 | Module permissions: bulk-apply UI, RLS verification | 1h |
| ~~3.4~~ | ~~School management~~ | **deferred** (decision 2026-05-22 — sketch only) |
| 3.5 | Analytics: add Platform tab, user/tier/credit/school metrics | 2–3h |
| 3.6 | AI config polish + ApiKeyManager completion | 1h |

**Total: 11–16 hours.** Best done as 6 small PRs for fine-grained review, or one larger PR if you trust the gate-keeping.

## Open decisions for Phase 3 (gate on user input)

1. **Should school_master see only their own school in admin views?** Recommendation: yes — that's the natural meaning of the role. Phase 3.4 enforces this via UI filtering AND RLS (`clf_user_profiles.school_id = (select school_id from clf_user_profiles where user_id = auth.uid())` style policies).

2. **Audit log retention?** Recommendation: keep forever, no auto-purge. Storage is cheap; lost audit trails are expensive.

3. **Password reset UX for admin-managed users?** Recommendation: admin sets a temporary password, gives it to user out-of-band, forces password change on next login. Need a `clf_user_profiles.must_change_password` boolean.

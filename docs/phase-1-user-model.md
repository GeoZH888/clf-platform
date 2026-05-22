# Phase 1.2 — User account model: canonical, legacy, transitional

> Decision doc. No code yet — but Phase 1.3 (credits) and Phase 1.4 (registration) depend on this being locked.

## Three identity systems exist today

| System | Key | State | Where used |
|---|---|---|---|
| **`auth.uid()` + `clf_user_profiles`** | UUID | **CANONICAL** — active, forward-facing | All `clf_*` tables, all role/tier/school logic, Supabase Auth login flow |
| **`device_token` + `jgw_*` family** | random string | **LEGACY** — write-preserved, effectively read-only in new code | `jgw_points`, `pinyin_practice_log`, legacy analytics |
| **`clf_*_progress` (dual-key)** | EITHER user_id OR device_token | **TRANSITIONAL** — bridges old and new | `clf_lianzi_progress`, `clf_chengyu_progress` — has both nullable columns |

## Evidence (file:line)

- **Canonical model:** `clf_user_profiles` keyed on `user_id REFERENCES auth.users`. Verified columns (from this conversation's earlier probe): `user_id, email, role, display_name, display_name_zh, school_id, is_active, created_at, updated_at, tier_id, ai_text_provider, ai_image_provider, ai_audio_provider, institution_name, institution_logo_url, skill_rating, module_order`.
- **`resolveIdentity()` pattern**, defining the precedence:
  - `src/hooks/usePracticeLog.js:20-26` — prefer auth.uid(), fall back to device_token
  - `src/hooks/useAdaptiveLearning.js:24-34` — same pattern
- **Synthetic email mapping:** `<username>@users.david-zhongwen.net` — consistent across:
  - `netlify/functions/admin-create-user.js:15,67`
  - `netlify/functions/student-auth.js:88`
  - `src/school/contexts/AuthContext.jsx:93-95`
- **Username extraction:** `session.user.email?.split('@')[0]` — `src/hooks/useStudentAuth.js:186-187`

## Decisions

### 1. Canonical model is `clf_user_profiles` keyed by `auth.uid()`

Every new feature (credits, registration, role assignment, school enrollment) writes to `auth.users` + `clf_user_profiles`. **Do not extend `jgw_*` or `device_token` patterns** in new code.

### 2. Legacy `jgw_*` tables stay frozen, read-only

`jgw_points` and `pinyin_practice_log` are kept for historical analytics. **No new writes from new features.** Existing dual-write in `usePracticeLog.js` continues as-is for backward compat — don't touch it in Phase 1, and don't add new dual-writes anywhere else.

### 3. Transitional `clf_*_progress` tables continue dual-key

`clf_lianzi_progress`, `clf_chengyu_progress` keep their nullable `user_id` + nullable `device_token` columns. This lets anonymous device users get progress tracked even before they sign up. **Do not invent new transitional tables** — anything new should be `user_id`-only.

### 4. No automatic account merging

If an anonymous device-token user signs up later, **their old device-token progress stays in the device-token rows**. The new auth account starts fresh. We accept this — building a merge tool is a Phase 3+ concern with real UX trade-offs (which set of progress wins on conflict?).

**Trade-off accepted:** Some users will see a "clean slate" after signup. Document this on the signup screen in Phase 2.C: "Your existing anonymous progress remains under guest mode. Logged-in progress is tracked separately."

### 5. The synthetic-email pattern stays — for now

`<username>@users.david-zhongwen.net` is the current uniqueness mechanism. It works for admin-created accounts where there's no real email infrastructure. **For self-registration in Phase 2.C**, we have a hard decision (see `docs/phase-1-registration.md`):

- Option A: keep synthetic emails (no email verification possible; need admin approval queue or trust)
- Option B: require real emails (need Supabase email infra; signups can self-verify)

Phase 1 doesn't lock this — Phase 1.4 / Phase 2.C does.

## What this unblocks

- **Phase 1.3 (credits):** all credit tables key off `user_id REFERENCES auth.users` only. No device_token columns. Anonymous users have no credits, full stop.
- **Phase 1.4 (registration):** signup writes `auth.users` + `clf_user_profiles` + `clf_user_modules` (default bundle). Never touches `jgw_*`.
- **Phase 3 (admin):** all role/school/permission edits flow through `clf_user_profiles` and related tables. No `jgw_*` UI ever.

## Risks

1. **A growing "two histories" problem** for users who practice anonymously then sign up. Documented; admin-side merge tool is future work.
2. **`jgw_*` analytics will drift further from `clf_*` analytics** as new features bypass `jgw_*` entirely. Admin analytics dashboard (Phase 3.5) needs to consciously decide which side to query for what.
3. **Synthetic emails block real password reset.** Supabase's password-reset emails go to the synthetic address and bounce. We need either (a) collect real email at signup as a separate column for resets, (b) admin-driven password resets only, or (c) custom flow. Phase 2.C decision.

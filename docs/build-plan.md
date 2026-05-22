# Build Plan — Post-Stabilization Feature Set

> Plan only. No feature code written yet. See user requirements at the top of this turn.

## Goals (from user)

1. **Feiyi content is fully PUBLIC** — no auth on `/feiyi/*`. Everything else requires login + RBAC.
2. **Credit/tier infrastructure now, no real payment processing** — DB columns, `clf_credit_transactions` table, deduction logic, clean integration points for Stripe later.
3. **Both admin-created and self-registered accounts** — users set their own username + password on self-reg.
4. **Harden super-admin panel** — user management, role assignment, module permissions, school management, analytics, AI config.

Plus carry-over: tutor steps 6 (trilingual) + 7 (LoRA art) sit *after* the above per `docs/tutor-design.md` §7.

## Prerequisite — Phase 0: stabilization actually deployed

Per your instruction, features depend on stabilization being **complete**. Right now stabilization is mostly *code-complete* but not *deployed*. Before any Phase 1 work hits main:

| Action | Who | Effort |
|---|---|---|
| Merge PRs: `prune-orphans`, `dedup-supabase` | You (GitHub UI) | 5 min |
| Push + merge `pwa-auto-update`, `vitest-rbac`, `docs/postgrest-order` | You | 10 min |
| Apply `supabase/migrations/003_clf_tutor_messages.sql` + `004_order_indexes.sql` in Supabase SQL editor | You | 5 min |
| Run `notify pgrst, 'reload schema';` after each migration | You | 1 min |
| Seed test users (one per role) and add creds to `.env` | You | 15 min |
| Run `VITE_RUN_RLS_TESTS=1 npm test` and fix any RLS gaps it surfaces | Me, after seeding | 1–4 hours depending on gaps |
| Build task #6 (cross-subdomain Supabase auth — cookie domain `.david-zhongwen.net`) | Me | 1–2 hours |
| Single deploy of everything stabilized to prod | You | 15 min |

**Gate:** I will not start Phase 1 until you confirm Phase 0 is done, or explicitly tell me to proceed without one of the items.

---

## Phase 1 — Foundation (sequential, all-Claude-can-do work)

Lays the data + decision groundwork. Cheap, fast, deterministic. No new product surface — all schema design, route gating, and decision-locking. Each task is small.

### 1.1 — Public-feiyi route gating decision

**What:** Pin down exactly how `/feiyi/*` becomes public.

- Decision: **client-side bypass** (LoginGate doesn't redirect on `/feiyi/*`) **AND** server-side RLS allowing `anon` read on `clf_feiyi_*` tables. Both are needed — client-side alone leaks behind devtools, server-side alone breaks the UX of "see content immediately, no login prompt."
- Audit: which routes already exist (`/feiyi/folklore`, `/feiyi/opera`, `/feiyi/crafts`, `/feiyi/festivals`, `/feiyi/tangka-2026june` — find every actual feiyi screen).
- Audit: which Supabase tables back the feiyi content. Confirm or define their RLS posture.

**Deliverable:** 1 short doc section + code-pointing list (no code).

### 1.2 — User account model consolidation

**What:** Reconcile the fragments. There are three concurrent paths for "who is a user":

1. `device_token` (anonymous device-bound progress — old PWA flow)
2. `clf_user_profiles` (Supabase Auth backed — newer schools / role flow)
3. The unknown — `jgw_*` tables that reference `device_token` while `clf_*` tables reference `auth.uid()`

Self-registration cannot be designed without locking down which of these survives, which becomes legacy, and how migration between them works.

**Deliverable:** Decision doc — name the canonical user model (likely `clf_user_profiles` keyed by `auth.uid()`), name the legacy fields (`device_token`-keyed `jgw_*` tables), define the migration path for existing device-token-only users.

### 1.3 — Credit + tier data model

**What:** Schema design for credits. Per requirement #2, the *infrastructure* lands now; Stripe lands later. The clean shape:

```
clf_credit_balances     (user_id, balance, updated_at)
clf_credit_transactions (id, user_id, delta, reason, ref_table, ref_id,
                          stripe_session_id, created_at)
clf_credit_costs        (action, cost) -- e.g. ai_tutor_advice = 1
```

Plus columns on existing tables:
- `clf_tiers` — `monthly_credit_grant int` (auto-refill per tier)
- `clf_user_modules` or new `clf_user_credits_grants` — provenance of credits

**Deliverable:** Migration `005_credit_system.sql` design (NOT applied), with RLS policies that:
- Users read **only** their own balance/transactions
- Only the deduction function (security-definer) writes transactions
- Super-admin can read/write all for support purposes

The deduction shape needs to be a server-side RPC, not client-side, so a malicious client can't fake a "free" deduction.

### 1.4 — Role-assignment + self-registration model

**What:** Decide the user-creation surfaces and their defaults.

- **Self-registration:** new route `/signup`. Default role: `student`. Email confirmation via Supabase Auth's built-in flow.
- **Admin-create:** AdminAppV2 form. Admin picks role at creation. Used for teachers, school_masters, parents (these typically have school-issued credentials, not self-signups).
- **Username uniqueness:** `clf_user_profiles.display_name` needs a uniqueness constraint OR usernames live in a separate column with one. The existing pattern uses synthetic emails (`<username>@users.david-zhongwen.net`) which has zero collision logic.

**Deliverable:** Decision doc — username rules, password requirements, default roles per signup channel, email confirmation policy (required? bypass-for-admin-create?), the username → synthetic-email mapping function.

### 1.5 — Super-admin panel scope

**What:** Inventory current AdminAppV2 capabilities and gap-list what requirement #4 implies.

Required surfaces (per requirement):
- User management (CRUD users)
- Role assignment (change role on existing user)
- Module permissions (per-user-per-module gating — already partly exists)
- School management (CRUD schools, attach users to schools)
- Analytics dashboard (already exists in some form — confirm scope)
- AI config (already exists — confirm completeness)

**Deliverable:** Gap doc — which surfaces already work, which need building, which need hardening (e.g., role assignment may already have a path but no UI).

### Phase 1 totals

- **5 sub-tasks**, all schema/decision/inventory work — no code beyond migration files
- **Mostly sequential** — 1.2 (user model) blocks 1.4 (registration). 1.1 (feiyi), 1.3 (credits), 1.5 (admin scope) are independent of each other.
- **Sub-agent opportunity:** 1.1, 1.3, 1.5 can run as three parallel research-Explore agents. 1.2 should be sequential because its output feeds 1.4. 1.4 follows after 1.2.
- **Total effort:** 2–3 hours of careful work. All deliverable is markdown + one SQL design file (not applied).
- **Stop point:** I commit the Phase 1 deliverables on a branch and ask you to review before Phase 2.

---

## Phase 2 — Independent builds (heavy parallelism)

Three feature streams that can be built independently and merged in any order. Each gets its own branch + PR. Each independently buildable + reviewable.

### 2.A — Public feiyi (small)

Apply Phase 1.1's decision:
- LoginGate skips on `/feiyi/*`
- RLS policies grant `anon` SELECT on `clf_feiyi_*`
- Build verification

**Effort:** 1–2 hours.

### 2.B — Credit infrastructure (medium)

Apply Phase 1.3's migration:
- Run `005_credit_system.sql`
- Server-side deduction RPC (Postgres function)
- Frontend hook `useCredits()` — reads balance, displays, calls deduct
- Stub Stripe integration points (Netlify function `netlify/functions/stripe-webhook.js` with TODO body)
- Wire one initial credit cost: the tutor AI call (already a real cost surface)

**Effort:** 4–6 hours. **No Stripe code** — just the integration shape and a clearly-marked TODO.

### 2.C — Self-registration + login improvements (medium)

Apply Phase 1.4's decisions:
- `/signup` route + form
- Username validation, password rules
- Synthetic-email mapping + uniqueness check
- Email confirmation flow (Supabase handles, just wire the UI)
- Tighten LoginPage error states
- Update Vitest auth-gate tests for the new signup path

**Effort:** 4–6 hours.

### Phase 2 parallelism

These three are file-independent (different routes, different tables, different concerns). All three can run as **parallel sub-agents** writing to separate branches. I'd open three concurrent sub-agents in one batch.

After all three return, I do a combined-diff review and surface conflicts (probably none — but `LoginGate.jsx` could see edits from both 2.A and 2.C).

---

## Phase 3 — Super-admin hardening (sequential, shared file)

All these edit `src/admin/AdminAppV2.jsx` and its child tabs, so parallelism is dangerous (merge conflicts). Sequential is honest.

Per the audit in this conversation, the existing admin has gaps in:

### 3.1 — User management
CRUD users via UI. Currently no UI path to *create* a user except via Supabase Auth admin. Tie into Phase 2.C's signup flow.

### 3.2 — Role assignment
Change role on an existing user. Currently nothing in code. Critical for the manual checklist's "promote/demote" scenarios.

### 3.3 — Module permissions per user
Already partly works via `clf_user_modules.available`/`selected`. Surface the table edits in admin UI.

### 3.4 — School management
CRUD schools, attach users (especially teachers + students) to schools. Foundational for school_master role to work correctly.

### 3.5 — Analytics dashboard
Audit what exists (`src/admin/AIAnalyticsTab.jsx` is one tab). Fill gaps — usage by role, AI cost by user/tier, credit consumption.

### 3.6 — AI config completeness
Verify `clf_ai_provider_config` integration is full-featured. Already exists per the earlier audit; this is a hardening pass, not new build.

**Effort:** 8–12 hours for Phase 3. Done as 6 sequential commits on one branch (or 6 small PRs if you prefer fine-grained review).

---

## Phase 4 — Tutor steps 6–7 (carry-over)

After Phase 3 lands. Per `docs/tutor-design.md` §7:

### 4.1 — Trilingual (tutor step 6)
The card already pulls `confucius` + `david` from a single AI call. Trilingual = read the user's current `LanguageContext` lang and pass it to the AI function. Server side already accepts the lang param. Client side: switch `TutorCard.jsx`'s hardcoded Chinese static-fallback strings to be lang-aware. Plus the dialogue device per spec §5.

**Effort:** 2–3 hours.

### 4.2 — LoRA art (tutor step 7)
Out of scope for code — needs LoRA training pipeline + Confucius/David character assets. Documenting only.

**Effort:** Asset production effort, not coding effort. I can document the integration points (file paths the React app expects) but can't produce the LoRA assets.

---

## Risks & uncertainties

1. **Schema fragmentation.** `clf_*` (auth.uid()) and `jgw_*` (device_token) exist concurrently. Phase 1.2 must resolve this or downstream credit + signup work will straddle both worlds and confuse users.
2. **Email infrastructure.** Self-registration with email confirmation requires Supabase email to be configured (custom domain or default Supabase sender). If your Supabase email is not set up, signup will silently fail. **You'll need to verify this before Phase 2.C.**
3. **Stripe integration shape.** I will design the credit table so the future Stripe webhook only needs to `insert into clf_credit_transactions`. The actual Stripe wiring (test mode keys, products, prices, webhook URL) is yours when you're ready.
4. **Admin role escalation.** Phase 3.2 (role assignment UI) is a privileged action. RLS on `clf_user_profiles.role` must explicitly restrict UPDATE to `super_admin` only. The current schema audit didn't find this RLS policy — Phase 1.5 should verify it exists and Phase 3.2 should add it if missing.
5. **No automated tests for credit deductions.** Phase 2.B should land with Vitest tests that exercise the RPC under concurrent dedupes (so a single click can't dedupe twice). Without these, I'd lose sleep over fraud.

---

## Parallelism summary

| Phase | Tasks | Parallelizable? |
|---|---|---|
| 0 | Stabilization deploy + #6 | Sequential (you handle most) |
| 1 | 5 foundation sub-tasks | 1.1 / 1.3 / 1.5 parallel; 1.2 → 1.4 sequential |
| 2 | 2.A / 2.B / 2.C | Fully parallel (separate files) |
| 3 | 3.1 → 3.6 | Sequential (shared admin file) |
| 4 | 4.1 / 4.2 | Independent but small |

Sub-agent opportunities (where I'd spawn Explore/Plan agents in parallel):
- **Phase 1.1 + 1.3 + 1.5** (three concurrent research tasks)
- **Phase 2.A + 2.B + 2.C** (three concurrent feature builds — each gets its own branch)

---

## Where I'd stop and wait for review

1. **End of Phase 1** — show you all 5 deliverables (4 decision docs + 1 SQL design). You confirm or correct before any feature code.
2. **End of Phase 2** — show you the three feature branches' diffs combined. You decide merge order and what (if anything) needs adjustment.
3. **Each Phase 3 sub-task** — small enough that single commit + review fits each.
4. **End of Phase 4.1** — tutor trilingual lands and we're done with the named scope.

---

## Open decisions for you (before Phase 1 starts)

1. Phase 0 — do you want me to genuinely wait for stabilization to be deployed, or treat code-complete-on-branches as sufficient and proceed?
2. Phase 1 — do you want me to spawn the three parallel research sub-agents (1.1, 1.3, 1.5) at once, or run them sequentially so you can see each as it lands?
3. Phase 2 — same question. Three parallel sub-agents per stream, or one at a time?
4. **Role-assignment authority** for self-registration: should brand-new self-signups default to `student`, or to a `pending` role that requires admin promotion? The latter is safer (less spam, less abuse), the former is friendlier.
5. **Email confirmation:** require for self-registration, or trust the synthetic-email approach and skip? The synthetic emails (`marco@users.david-zhongwen.net`) can't actually receive mail, so confirmation links go nowhere. Need real emails OR a different verification approach (e.g., admin must approve new signups in a queue).

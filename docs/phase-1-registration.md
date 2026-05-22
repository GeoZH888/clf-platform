# Phase 1.4 — Self-registration + admin-create model

> Decision doc. Depends on `phase-1-user-model.md` (canonical model is `clf_user_profiles` keyed by `auth.uid()`). No code yet — Phase 2.C builds.

## Two creation paths

| Path | Trigger | Default role | Approval flow |
|---|---|---|---|
| **Self-registration** | User on `/signup` enters username + password | `student` (LOCKED — decision 2026-05-22) | None — immediately active |
| **Admin-create** | super_admin / school_master uses admin UI | Whatever admin picks (student / teacher / parent / school_master) | None — immediately active |

## Default role: `student` (locked)

Phase 2.C sets new self-signups to `student` immediately — full access on first load, no admin approval step. Rationale per user decision: friendlier UX over spam/abuse mitigation; abuse risk can be addressed later via rate limiting (decision Q2 below) and CAPTCHA (decision Q3 below) if it becomes a real problem.

**If you ever want approval-gated signups,** add a `pending` role and route logic per the original sketch in this doc's git history. The infrastructure cleanly supports either.

## The signup flow (designed, not built)

### Frontend: `/signup` route

```
┌────────────────────────────────────────────┐
│           Create your account              │
│                                            │
│  Username  [_______________]   *required   │
│  (letters, numbers, underscore; 3–24 chars)│
│                                            │
│  Password  [_______________]   *required   │
│  (8+ chars, mix of letters and numbers)    │
│                                            │
│  Confirm   [_______________]               │
│                                            │
│              [ Create account ]            │
│                                            │
│  Already have an account?  → Log in        │
└────────────────────────────────────────────┘
```

### Backend: new Netlify function `netlify/functions/self-signup.js`

Why not call `supabase.auth.signUp()` directly from the browser? Because:

1. We need to write to `clf_user_profiles` immediately, atomically. The frontend can't guarantee both succeed.
2. We need to enforce username uniqueness against existing `clf_user_profiles.email` (not just `auth.users.email`), since both share the synthetic-email pattern.
3. We may want to seed the initial credit grant (per phase-1-credits.md open question #1) in the same transaction.

Function shape:

```js
// netlify/functions/self-signup.js
import { createClient } from '@supabase/supabase-js';
const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
  const { username, password } = JSON.parse(event.body);

  // 1. Validate inputs (regex, length, banned-words list)
  // 2. Normalize: lowercase, trim
  // 3. Check username uniqueness in clf_user_profiles
  // 4. Compose synthetic email: `${username}@users.david-zhongwen.net`
  // 5. admin.auth.admin.createUser({ email, password, email_confirm: true })
  //    — email_confirm:true bypasses the verification email (it can't deliver anyway)
  // 6. Insert into clf_user_profiles { user_id, email, display_name: username,
  //                                    role: 'student', is_active: true }
  // 7. Insert into clf_user_modules: ALWAYS_ON modules with selected=true
  // 8. (Optional, per credits doc Q1) Insert clf_credit_transactions
  //    { delta: 10, reason: 'signup_grant' } + bump clf_credit_balances
  // 9. Return success — frontend redirects to /login or auto-logs-in
};
```

### Why service-role key + Netlify function (not browser SDK)

- `supabase.auth.admin.createUser()` requires the service-role key. **Never** in browser code.
- Atomic multi-table writes need a single backend call.
- Future Stripe/email logic naturally lands in the same function.

This is the same pattern as the existing `netlify/functions/admin-create-user.js` — just without the role-picker (always `pending`) and without admin-auth (this endpoint accepts anonymous requests, naturally).

## Admin-create flow (already largely exists)

`netlify/functions/admin-create-user.js` already handles this. Phase 1 finding: confirm it works end-to-end. Phase 3.1 builds the UI side (currently `AccountsManagement.jsx` has the structure but the `CreateUserModal` form may be incomplete per the admin gap audit).

Differences from self-signup:
- Caller is super_admin or school_master (need server-side role verification before the privileged write)
- No `pending` step — admin picks final role
- Admin can set `email` to a real email if they collect one (paid customers' admins might have real emails for password resets)

## Username rules (lock these now)

- **Length:** 3–24 characters
- **Charset:** `a-z`, `A-Z`, `0-9`, `_`, `.` (no spaces, no `@`, no Chinese — Chinese in `display_name_zh` instead)
- **Case:** stored lowercase; uniqueness check is case-insensitive
- **Reserved:** block `admin`, `root`, `system`, `superadmin`, `support`, `moderator`, `bot`, `null`, `undefined`, `feiyi`, `community`, `learn` (any path segment that could route-collide)
- **Profanity:** out of scope for Phase 1 — Phase 2.C can use a simple banned-words list
- **Display:** `display_name = username` at signup; user can change later via profile (Phase 3.x)

## Password rules

- **Minimum:** 8 characters
- **Required:** at least one letter and one digit
- **No max** (let Supabase enforce its own ceiling)
- **No complexity beyond that** — the latest NIST guidance (SP 800-63B) recommends against forced symbol/case requirements. Length wins.
- **Storage:** Supabase Auth handles hashing — never see plaintext server-side beyond the signup call.

## Open decisions for Phase 2.C

These are written as recommendations; user override before Phase 2.C executes:

1. **Initial credit grant on signup?** **LOCKED: 50 credits.** Insert as a transaction with `reason='signup_grant'` in the same Netlify function. (Generous trial — matches user decision 2026-05-22.)
2. **Rate limiting on `/signup`?** Recommendation: **yes** — Netlify function rate-limits by IP at function level if available, OR add a simple per-IP counter in a Redis-like store. Minimum: throttle to ~5 signups per IP per hour.
3. **CAPTCHA on signup?** Recommendation: **defer to Phase 3+**, decide based on actual spam volume. hCaptcha or Cloudflare Turnstile both work in front of a Netlify function.
4. **Password reset for synthetic emails?** Recommendation: **admin-only reset** for now. Real email collection is a separate Phase 2.C+ feature. UX: "Forgot your password? Contact your school admin or support."
5. **Username vs email login?** Recommendation: **username only** — keeps the surface simple, matches existing AuthContext pattern that constructs synthetic emails from usernames.

## What Phase 2.C must verify

Since the default is `student` (already a valid role in production), no new role-constraint migration is needed. Phase 2.C just needs to confirm the live DB allows `student` to be assigned from the self-signup Netlify function (which uses the service-role key, so it bypasses any check constraints anyway).

(An earlier draft of this doc designed a `pending` approval flow. Removed per the 2026-05-22 decision — see git history if you ever revisit approval-gated signups.)

# Phase 1.3 — Credit/tier system design

> Schema + RPC design. The migration file `supabase/migrations/005_credit_system.sql` ships with this doc but is **not yet applied**. Phase 2.B applies + wires.

## Goals

1. Users have a credit balance.
2. AI-cost actions (tutor advice today; image gen, TTS, batch ops tomorrow) deduct credits server-side. **Never client-side** — a malicious client can't bypass deduction.
3. Tiers grant monthly credit budgets. (Free tier = small grant; paid tiers = bigger.)
4. Every credit movement is logged as a transaction with reason + reference + actor.
5. Future Stripe webhooks insert transactions; nothing else changes.

## Schema

### Three new tables + one column on `clf_tiers`

```sql
-- Current credit balance, one row per user
create table public.clf_credit_balances (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  balance      integer not null default 0 check (balance >= 0),
  updated_at   timestamptz not null default now()
);

-- Append-only ledger of every credit movement
create table public.clf_credit_transactions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  delta                integer not null,                  -- positive = grant, negative = deduction
  reason               text not null,                     -- 'monthly_grant' | 'tutor_advice' | 'stripe_purchase' | 'admin_adjustment' | ...
  ref_table            text,                              -- e.g. 'clf_tutor_messages' (what the deduction was for)
  ref_id               uuid,                              -- the row in ref_table
  actor_user_id        uuid references auth.users(id),    -- who triggered (self, admin, system)
  stripe_session_id    text,                              -- only for Stripe purchases
  created_at           timestamptz not null default now()
);

create index idx_credit_tx_user_time on public.clf_credit_transactions (user_id, created_at desc);

-- Costs per action, editable by super_admin (no code changes to retune pricing)
create table public.clf_credit_costs (
  action       text primary key,
  cost         integer not null check (cost >= 0),
  description  text,
  updated_at   timestamptz not null default now()
);

-- Initial cost catalog (Phase 1 ships this seed; Phase 2.B may extend)
insert into public.clf_credit_costs (action, cost, description) values
  ('tutor_advice',          1, 'Confucius + David daily advice card'),
  ('ai_illustration',       5, 'Stability AI image generation per call'),
  ('voice_score',           1, 'Azure TTS pronunciation scoring'),
  ('rag_answer',            2, 'RAG-backed Q&A response')
on conflict (action) do nothing;

-- Add monthly grant to existing tier table
alter table public.clf_tiers
  add column if not exists monthly_credit_grant integer not null default 0;
```

### RLS — strictly user-scoped reads, no client writes

```sql
alter table public.clf_credit_balances     enable row level security;
alter table public.clf_credit_transactions enable row level security;
alter table public.clf_credit_costs        enable row level security;

-- Users read their own balance only
create policy "credit_balance_read_own" on public.clf_credit_balances
  for select to authenticated using (user_id = auth.uid());

-- Users read their own transactions only
create policy "credit_tx_read_own" on public.clf_credit_transactions
  for select to authenticated using (user_id = auth.uid());

-- Cost catalog is publicly readable (it's just a price list)
create policy "credit_costs_read_all" on public.clf_credit_costs
  for select to anon, authenticated using (true);

-- NO INSERT/UPDATE/DELETE policies for authenticated users.
-- The deduction RPC is the ONLY way to write transactions.
-- super_admin gets write access for support adjustments.
create policy "credit_balance_admin_write" on public.clf_credit_balances
  for all to authenticated
  using (exists (select 1 from public.clf_user_profiles where user_id = auth.uid() and role = 'super_admin'))
  with check (exists (select 1 from public.clf_user_profiles where user_id = auth.uid() and role = 'super_admin'));

create policy "credit_tx_admin_write" on public.clf_credit_transactions
  for all to authenticated
  using (exists (select 1 from public.clf_user_profiles where user_id = auth.uid() and role = 'super_admin'))
  with check (exists (select 1 from public.clf_user_profiles where user_id = auth.uid() and role = 'super_admin'));

create policy "credit_costs_admin_write" on public.clf_credit_costs
  for all to authenticated
  using (exists (select 1 from public.clf_user_profiles where user_id = auth.uid() and role = 'super_admin'))
  with check (exists (select 1 from public.clf_user_profiles where user_id = auth.uid() and role = 'super_admin'));
```

### The deduction RPC — security-definer, atomic

```sql
create or replace function public.spend_credits(
  p_action text,
  p_ref_table text default null,
  p_ref_id uuid default null
)
returns table (new_balance integer, transaction_id uuid)
language plpgsql
security definer  -- runs with table owner privileges, bypasses caller RLS
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cost integer;
  v_old_balance integer;
  v_new_balance integer;
  v_tx_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Look up the cost
  select cost into v_cost from public.clf_credit_costs where action = p_action;
  if v_cost is null then
    raise exception 'unknown_action: %', p_action;
  end if;

  -- Lock the balance row to prevent concurrent double-deduct
  select balance into v_old_balance
    from public.clf_credit_balances
    where user_id = v_uid
    for update;

  if v_old_balance is null then
    -- No balance row yet → treat as 0
    v_old_balance := 0;
    insert into public.clf_credit_balances (user_id, balance) values (v_uid, 0);
  end if;

  if v_old_balance < v_cost then
    raise exception 'insufficient_credits: balance=% cost=%', v_old_balance, v_cost;
  end if;

  v_new_balance := v_old_balance - v_cost;

  update public.clf_credit_balances
    set balance = v_new_balance, updated_at = now()
    where user_id = v_uid;

  insert into public.clf_credit_transactions
    (user_id, delta, reason, ref_table, ref_id, actor_user_id)
    values (v_uid, -v_cost, p_action, p_ref_table, p_ref_id, v_uid)
    returning id into v_tx_id;

  return query select v_new_balance, v_tx_id;
end;
$$;

grant execute on function public.spend_credits(text, text, uuid) to authenticated;
```

**Why security-definer:** the RPC owner (table creator) has write access; the RLS-blocked authenticated caller doesn't. This is the safe pattern — the function logic is the only path that writes credits, and it always does so for `auth.uid()` (impossible to spend someone else's credits).

**Why `for update`:** prevents the classic double-deduct race where two concurrent requests both read balance=10, both deduct 5, both write 5. With `for update`, the second request blocks until the first commits, then reads the updated 5 and either succeeds at 0 or fails at insufficient.

## Grants (the other half)

Counterpart to `spend_credits` — monthly grant + Stripe purchase. These are NOT exposed to user-facing code; they're called by:

- **A scheduled job** (Supabase pg_cron, or a Netlify scheduled function) that runs monthly and grants `clf_tiers.monthly_credit_grant` to all users with that tier.
- **The Stripe webhook handler** (Phase 2.B writes this as a stub) — `netlify/functions/stripe-webhook.js`. It uses the **service role key** (server-side only) to insert directly into `clf_credit_transactions` and bump `clf_credit_balances`.

Phase 1 doesn't ship the Stripe webhook or the cron — Phase 2.B does. The schema and RPC ship now so they're ready when those land.

## Frontend integration shape (designed, not built in Phase 1)

```js
// src/lib/credits.js (Phase 2.B)
export async function spendCredits(action, refTable = null, refId = null) {
  const { data, error } = await supabase.rpc('spend_credits', {
    p_action: action,
    p_ref_table: refTable,
    p_ref_id: refId,
  });
  if (error) {
    if (error.message.startsWith('insufficient_credits')) {
      return { ok: false, code: 'insufficient' };
    }
    throw error;
  }
  return { ok: true, newBalance: data[0].new_balance, txId: data[0].transaction_id };
}

// Usage in tutor flow (Phase 2.B updates getOrComputeTutorData):
const credits = await spendCredits('tutor_advice', 'clf_tutor_messages', null);
if (!credits.ok) return staticFallback(); // gracefully degrade when out of credits
const advice = await fetchTutorAdvice(snapshot, lang);
// (the AI call itself runs only after credit was deducted)
```

## Stripe integration points (stubs only — Phase 2.B writes the empty function)

- `netlify/functions/stripe-webhook.js` — receives webhook, verifies HMAC, on `checkout.session.completed`:
  1. Extract `user_id` from session metadata
  2. Look up product → credit-pack mapping (a separate table TBD: `clf_credit_packs` with `stripe_product_id`, `credits_granted`)
  3. Insert into `clf_credit_transactions` with `reason='stripe_purchase'`, `stripe_session_id=<session.id>`
  4. Bump `clf_credit_balances` (use the same RPC pattern but inverse — add instead of subtract)

Phase 1 explicitly **does not** create `clf_credit_packs` or write the webhook. Those are Phase 2.B (just the function shell) and full Stripe (whenever you're ready).

## Open questions for review

1. **Initial credit grant on signup** — **LOCKED: 50 credits.** Generous trial. Seeded as a transaction with `reason='signup_grant'` in the self-signup Netlify function (Phase 2.C). Decision 2026-05-22.
2. **Tier defaults for `monthly_credit_grant`** — what values? My recommendation: free=20, school_basic=200, school_pro=1000. Tune in admin UI later.
3. **Negative balance prevention** — current design blocks at insufficient_credits with an exception. UI should preempt this by checking cost vs balance before calling. Acceptable.
4. **Transaction immutability** — the `clf_credit_transactions` table has no soft-delete or correction mechanism. If an admin needs to reverse a transaction, they insert a compensating one with `reason='admin_reversal'` referencing the original. Worth documenting in admin docs.

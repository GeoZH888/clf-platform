-- ═══════════════════════════════════════════════════════════════════════
--  005_credit_system.sql
--  Credit + tier infrastructure for the clf-platform.
--  Designed in docs/phase-1-credits.md — read that first.
--
--  This migration is DESIGNED in Phase 1 but NOT yet applied.
--  Phase 2.B applies it and wires the frontend deduction calls.
--
--  Safe to re-run — every CREATE uses IF NOT EXISTS.
--
--  After applying:
--      notify pgrst, 'reload schema';
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Balance ──────────────────────────────────────────────────────────
create table if not exists public.clf_credit_balances (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  balance     integer not null default 0 check (balance >= 0),
  updated_at  timestamptz not null default now()
);

-- ─── Append-only ledger ───────────────────────────────────────────────
create table if not exists public.clf_credit_transactions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  delta                integer not null,
  reason               text not null,
  ref_table            text,
  ref_id               uuid,
  actor_user_id        uuid references auth.users(id),
  stripe_session_id    text,
  created_at           timestamptz not null default now()
);

create index if not exists idx_credit_tx_user_time
  on public.clf_credit_transactions (user_id, created_at desc);

-- ─── Cost catalog (admin-editable) ────────────────────────────────────
create table if not exists public.clf_credit_costs (
  action       text primary key,
  cost         integer not null check (cost >= 0),
  description  text,
  updated_at   timestamptz not null default now()
);

insert into public.clf_credit_costs (action, cost, description) values
  ('tutor_advice',     1, 'Confucius + David daily advice card'),
  ('ai_illustration',  5, 'Stability AI image generation per call'),
  ('voice_score',      1, 'Azure TTS pronunciation scoring'),
  ('rag_answer',       2, 'RAG-backed Q&A response')
on conflict (action) do nothing;

-- ─── Tier monthly grant ───────────────────────────────────────────────
alter table public.clf_tiers
  add column if not exists monthly_credit_grant integer not null default 0;

-- ─── RLS ──────────────────────────────────────────────────────────────
alter table public.clf_credit_balances     enable row level security;
alter table public.clf_credit_transactions enable row level security;
alter table public.clf_credit_costs        enable row level security;

drop policy if exists "credit_balance_read_own" on public.clf_credit_balances;
create policy "credit_balance_read_own"
  on public.clf_credit_balances for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "credit_tx_read_own" on public.clf_credit_transactions;
create policy "credit_tx_read_own"
  on public.clf_credit_transactions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "credit_costs_read_all" on public.clf_credit_costs;
create policy "credit_costs_read_all"
  on public.clf_credit_costs for select to anon, authenticated
  using (true);

-- super_admin gets full write access for support/adjustments.
-- Regular users cannot write to balances or transactions directly —
-- the spend_credits() RPC below is the only path.
drop policy if exists "credit_balance_admin_write" on public.clf_credit_balances;
create policy "credit_balance_admin_write"
  on public.clf_credit_balances for all to authenticated
  using (exists (select 1 from public.clf_user_profiles
                  where user_id = auth.uid() and role = 'super_admin'))
  with check (exists (select 1 from public.clf_user_profiles
                       where user_id = auth.uid() and role = 'super_admin'));

drop policy if exists "credit_tx_admin_write" on public.clf_credit_transactions;
create policy "credit_tx_admin_write"
  on public.clf_credit_transactions for all to authenticated
  using (exists (select 1 from public.clf_user_profiles
                  where user_id = auth.uid() and role = 'super_admin'))
  with check (exists (select 1 from public.clf_user_profiles
                       where user_id = auth.uid() and role = 'super_admin'));

drop policy if exists "credit_costs_admin_write" on public.clf_credit_costs;
create policy "credit_costs_admin_write"
  on public.clf_credit_costs for all to authenticated
  using (exists (select 1 from public.clf_user_profiles
                  where user_id = auth.uid() and role = 'super_admin'))
  with check (exists (select 1 from public.clf_user_profiles
                       where user_id = auth.uid() and role = 'super_admin'));

-- ─── The deduction RPC ────────────────────────────────────────────────
-- Atomic deduct: locks balance row, checks cost, deducts, logs.
-- security definer → runs with owner privileges → bypasses caller RLS,
-- but always for auth.uid() so the caller can't spend someone else's credits.
create or replace function public.spend_credits(
  p_action     text,
  p_ref_table  text default null,
  p_ref_id     uuid default null
)
returns table (new_balance integer, transaction_id uuid)
language plpgsql
security definer
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

  select cost into v_cost from public.clf_credit_costs where action = p_action;
  if v_cost is null then
    raise exception 'unknown_action: %', p_action;
  end if;

  select balance into v_old_balance
    from public.clf_credit_balances
    where user_id = v_uid
    for update;

  if v_old_balance is null then
    v_old_balance := 0;
    insert into public.clf_credit_balances (user_id, balance) values (v_uid, 0)
      on conflict do nothing;
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

-- ─── Schema reload so PostgREST sees the new RPC ──────────────────────
notify pgrst, 'reload schema';

-- 014_usage_limits.sql
-- Free-tier time limit, and the pricing the tiers charge.
--
-- Policy (set 2026-08-09):
--   unpaid / guest  — a few minutes of learning per day, superadmin-tunable
--   paid            — no time limit
--
-- The free allowance is ONE number for the whole platform, not per tier: it is
-- what someone gets before they have any tier at all. It lives in a settings
-- table so the superadmin can change it without a deploy.

-- ── 1. Platform settings ──────────────────────────────────────────────────
create table if not exists clf_app_settings (
  key         text primary key,
  value       jsonb       not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

comment on table clf_app_settings is
  'Superadmin-tunable platform values. Read by anonymous visitors, so never put a secret here.';

insert into clf_app_settings (key, value, description) values
  ('free_minutes_per_day',
   '4'::jsonb,
   'Minutes of learning an unpaid visitor gets per day. Metered per device, so clearing browser storage resets it — a nudge, not a wall.')
on conflict (key) do nothing;

-- ── 2. Tier pricing ───────────────────────────────────────────────────────
-- Prices are per month, in the smallest unit (cents / 分) so nothing is stored
-- as a float. €1.50 → 150. ¥10 → 1000.
alter table clf_tiers add column if not exists price_eur_cents  integer;
alter table clf_tiers add column if not exists price_cny_fen    integer;
alter table clf_tiers add column if not exists max_seats        integer;
alter table clf_tiers add column if not exists is_time_limited  boolean not null default false;

comment on column clf_tiers.max_seats is
  'Accounts one subscription covers. NULL = unlimited. Family = 2, class = 20; above that a class must be split into groups.';
comment on column clf_tiers.is_time_limited is
  'TRUE only for the free tier — the one metered against free_minutes_per_day.';

-- Free is the only metered tier; everything paid is unlimited.
update clf_tiers set is_time_limited = true  where slug = 'free';
update clf_tiers set is_time_limited = false where slug <> 'free';

-- Individual €1.50 / ¥10
update clf_tiers
   set price_eur_cents = 150, price_cny_fen = 1000, max_seats = 1
 where slug = 'premium';

-- Class €5 / ¥40, up to 20 students
update clf_tiers
   set price_eur_cents = 500, price_cny_fen = 4000, max_seats = 20
 where slug = 'school';

-- Family €2 / ¥15, 2 accounts, includes the parent progress view.
-- Added rather than updated: there was no family tier before.
insert into clf_tiers (slug, label_zh, label_en, label_it, description,
                       is_default, sort_order,
                       price_eur_cents, price_cny_fen, max_seats, is_time_limited)
select 'family', '家庭版', 'Family', 'Famiglia',
       'Two accounts plus a parent view of every child''s progress',
       false, 3, 200, 1500, 2, false
where not exists (select 1 from clf_tiers where slug = 'family');

-- ── 3. RLS ────────────────────────────────────────────────────────────────
-- Settings must be readable before login: the meter has to know the allowance
-- for a visitor who has no account. Writes are superadmin only.
alter table clf_app_settings enable row level security;

drop policy if exists "anyone reads settings" on clf_app_settings;
create policy "anyone reads settings" on clf_app_settings
  for select using (true);

drop policy if exists "superadmin writes settings" on clf_app_settings;
create policy "superadmin writes settings" on clf_app_settings
  for all using (
    exists (
      select 1 from clf_user_profiles p
       where p.user_id = auth.uid()
         and p.role = 'super_admin'
         and coalesce(p.is_active, true)
    )
  );

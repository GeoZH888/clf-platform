-- 015_learning_events.sql
-- One place where every module records what a learner did.
--
-- Today progress is spread across four localStorage stores and about ten
-- tables with three different notions of identity. Nothing can answer "how is
-- this child doing?" across modules, which is precisely what a parent view, a
-- teacher view and any adaptive scheduler all need.
--
-- This is an APPEND-ONLY event log, not a per-item aggregate row. Writing an
-- event needs no read-modify-write, so any module can call it from anywhere
-- without races, and a question we have not thought of yet can still be asked
-- of the history later. Aggregates are a view (below), not a second source of
-- truth to keep in sync.

create table if not exists clf_learning_events (
  id           bigserial primary key,

  -- Exactly one of these is normally set. A guest has device_id only; after
  -- they get an account, claim_device_events() backfills user_id.
  user_id      uuid references auth.users(id) on delete cascade,
  device_id    text,

  module       text        not null,          -- 'lianzi' | 'words' | 'pinyin' | …
  item_type    text,                          -- 'character' | 'word' | 'idiom' | …
  item_id      text,                          -- the character, the word, a uuid…
  event        text        not null default 'practice',  -- practice | quiz | complete

  correct      boolean,                       -- null when the activity is not scored
  score        numeric(5,2),                  -- 0-100 where a score exists
  duration_ms  integer,                       -- time on this item, for the usage picture
  meta         jsonb       not null default '{}'::jsonb,

  created_at   timestamptz not null default now(),

  -- An event nobody can attribute is not worth storing.
  constraint clf_learning_events_has_subject
    check (user_id is not null or device_id is not null)
);

comment on table clf_learning_events is
  'Append-only log of learner activity across every module. Aggregates live in clf_learning_daily.';

-- Read patterns: a learner''s own history, a dashboard by day, and the
-- scheduler asking "how has this person done on this item".
create index if not exists clf_learning_events_user_time_idx
  on clf_learning_events (user_id, created_at desc) where user_id is not null;
create index if not exists clf_learning_events_device_time_idx
  on clf_learning_events (device_id, created_at desc) where device_id is not null;
create index if not exists clf_learning_events_user_item_idx
  on clf_learning_events (user_id, module, item_id) where user_id is not null;
create index if not exists clf_learning_events_module_time_idx
  on clf_learning_events (module, created_at desc);

-- ── Carrying a trial into an account ──────────────────────────────────────
-- A visitor practises anonymously, then is invited and signs in. Without this
-- their history would be stranded on the device row and they would appear to
-- start from nothing — the worst possible first impression of a paid account.
--
-- security definer so it can update rows the caller cannot yet see. It only
-- ever attaches UNCLAIMED rows to the CALLER, so the worst a guessed device_id
-- can do is pull someone else''s orphaned guest history into your own account —
-- it can never read, move or destroy another user''s data. device_id is a
-- random uuid, so guessing is not a practical attack.
create or replace function claim_device_events(p_device_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'must be signed in to claim device history';
  end if;
  if p_device_id is null or length(p_device_id) < 8 then
    raise exception 'device id looks invalid';
  end if;

  update clf_learning_events
     set user_id = auth.uid()
   where device_id = p_device_id
     and user_id is null;

  get diagnostics n = row_count;
  return n;
end;
$$;

-- ── Dashboard rollup ──────────────────────────────────────────────────────
-- What a parent or teacher actually wants: per learner, per day, per module.
create or replace view clf_learning_daily as
select
  user_id,
  device_id,
  module,
  (created_at at time zone 'UTC')::date            as day,
  count(*)                                          as events,
  count(*) filter (where correct is true)           as correct_count,
  count(*) filter (where correct is false)          as wrong_count,
  count(distinct item_id)                           as items_touched,
  round(avg(score) filter (where score is not null), 1) as avg_score,
  coalesce(sum(duration_ms), 0)                     as total_ms
from clf_learning_events
group by user_id, device_id, module, day;

comment on view clf_learning_daily is
  'Per learner, per day, per module. Feeds the parent and teacher dashboards.';

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table clf_learning_events enable row level security;

-- Anyone may write, including anonymous visitors — the free trial has to be
-- measurable before anyone has an account. A signed-in caller may only write
-- rows attributed to themselves, so nobody can forge another user's history.
drop policy if exists "write own events" on clf_learning_events;
create policy "write own events" on clf_learning_events
  for insert with check (
    user_id is null or user_id = auth.uid()
  );

-- Learners read their own; staff read everyone's.
drop policy if exists "read own events" on clf_learning_events;
create policy "read own events" on clf_learning_events
  for select using (
    (user_id is not null and user_id = auth.uid())
    or exists (
      select 1 from clf_user_profiles p
       where p.user_id = auth.uid()
         and p.role in ('super_admin', 'school_master', 'teacher')
         and coalesce(p.is_active, true)
    )
  );

-- Deliberately no update or delete policy. The log is append-only: correcting
-- history would undermine every number a parent or an invoice is based on.

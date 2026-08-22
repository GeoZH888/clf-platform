-- ═══════════════════════════════════════════════════════════════════════════
-- jgw_registrations + jgw_registration_invites: schema hardening
-- ═══════════════════════════════════════════════════════════════════════════
-- Two fixes:
--   1. Add UNIQUE constraint on jgw_registrations.username so DB enforces
--      uniqueness even if app-layer TOCTOU race slips through.
--   2. Add a Postgres function for atomic invite counter increment, replacing
--      the current "read-then-update" pattern that can bypass max_uses limit.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Username UNIQUE constraint
-- ───────────────────────────────────────────────────────────────────────────
-- Pre-flight: are there any duplicate usernames RIGHT NOW that would block
-- the constraint? If yes, this query lists them. Fix manually before running
-- the ALTER TABLE below.
select username, count(*) as duplicate_count
  from jgw_registrations
  group by username
  having count(*) > 1;
-- Expected: 0 rows. If you see any, decide which row to keep and delete the
-- others, OR rename the duplicates (e.g. append _dup1, _dup2) before adding
-- the constraint.

-- Add the constraint. Idempotent — `if not exists` catches re-runs.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'jgw_registrations_username_unique'
  ) then
    alter table jgw_registrations
      add constraint jgw_registrations_username_unique unique (username);
  end if;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Atomic invite counter increment (concurrency-safe)
-- ───────────────────────────────────────────────────────────────────────────
-- The current code does:
--   used_count = (read used_count) + 1
-- which has a TOCTOU race: 2 concurrent requests both read 0, both write 1.
--
-- This RPC does the increment server-side in a single statement, AND
-- returns whether the limit was actually respected (so caller can detect
-- "I lost the race, this invite is now exhausted").

create or replace function increment_invite_usage(invite_code text)
returns table (
  ok boolean,
  used_count int,
  max_uses int,
  reason text
)
language plpgsql
security definer
as $$
declare
  v_row jgw_registration_invites%rowtype;
begin
  -- Lock the row for the duration of this transaction
  select * into v_row
    from jgw_registration_invites
    where code = invite_code
    for update;

  if not found then
    return query select false, 0, 0, 'not_found'::text;
    return;
  end if;

  if v_row.expires_at is not null and v_row.expires_at < now() then
    return query select false, v_row.used_count, v_row.max_uses, 'expired'::text;
    return;
  end if;

  if v_row.used_count >= v_row.max_uses then
    return query select false, v_row.used_count, v_row.max_uses, 'exhausted'::text;
    return;
  end if;

  -- Increment atomically
  update jgw_registration_invites
    set used_count = used_count + 1
    where code = invite_code;

  return query select true, v_row.used_count + 1, v_row.max_uses, 'ok'::text;
end $$;

-- Quick test (replace 'YOUR_CODE' with a real invite code, comment out for
-- production):
-- select * from increment_invite_usage('YOUR_CODE');

-- ───────────────────────────────────────────────────────────────────────────
-- Verify
-- ───────────────────────────────────────────────────────────────────────────
select conname, contype
  from pg_constraint
  where conrelid = 'jgw_registrations'::regclass
    and conname = 'jgw_registrations_username_unique';

select proname, pronargs
  from pg_proc
  where proname = 'increment_invite_usage';

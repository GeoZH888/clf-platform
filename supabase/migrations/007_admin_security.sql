-- ═══════════════════════════════════════════════════════════════════════
--  007_admin_security.sql
--  Phase 3.2 of docs/build-plan.md — admin-side security hardening.
--
--  Today the frontend AccountsManagement.jsx UPDATEs clf_user_profiles.role
--  directly from the browser. There is NO RLS on clf_user_profiles, so any
--  authenticated user could in principle escalate their own role to
--  super_admin via direct REST. This migration closes that.
--
--  Also: introduces clf_admin_audit_log so every privileged admin action
--  (role change, user delete, module permission change) gets a permanent
--  record of who-did-what-when.
--
--  Safe to re-run — every CREATE / DROP-IF-EXISTS / IF NOT EXISTS guard
--  is in place.
--
--  After applying:
--      notify pgrst, 'reload schema';
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Helper: is_super_admin (security definer to avoid RLS recursion) ─
-- Used inside policies so we don't query a table that is itself protected
-- by those same policies.
create or replace function public.is_super_admin(p_uid uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.clf_user_profiles
    where user_id = p_uid and role = 'super_admin'
  );
$$;

grant execute on function public.is_super_admin(uuid) to authenticated, anon;

-- ─── Trigger: block non-admin from editing privileged columns ─────────
-- RLS gates the entire row update; this trigger then prevents a user from
-- self-promoting via columns they shouldn't touch (role, tier_id, is_active,
-- school_id). Self-edits of name, display_name, module_order, etc. still work.
create or replace function public.tg_clf_user_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    if NEW.role is distinct from OLD.role then
      raise exception 'role can only be changed by super_admin'
        using errcode = '42501';   -- insufficient_privilege
    end if;
    if NEW.tier_id is distinct from OLD.tier_id then
      raise exception 'tier_id can only be changed by super_admin'
        using errcode = '42501';
    end if;
    if NEW.is_active is distinct from OLD.is_active then
      raise exception 'is_active can only be changed by super_admin'
        using errcode = '42501';
    end if;
    if NEW.school_id is distinct from OLD.school_id then
      raise exception 'school_id can only be changed by super_admin'
        using errcode = '42501';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists tg_clf_user_profiles_guard on public.clf_user_profiles;
create trigger tg_clf_user_profiles_guard
  before update on public.clf_user_profiles
  for each row execute function public.tg_clf_user_profiles_guard();

-- ─── RLS on clf_user_profiles ─────────────────────────────────────────
alter table public.clf_user_profiles enable row level security;

-- Read: own profile + super_admin sees all
drop policy if exists "user_profiles_read" on public.clf_user_profiles;
create policy "user_profiles_read"
  on public.clf_user_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

-- Update: own profile (trigger blocks privileged columns) OR super_admin (any row)
drop policy if exists "user_profiles_update_self" on public.clf_user_profiles;
create policy "user_profiles_update_self"
  on public.clf_user_profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user_profiles_update_admin" on public.clf_user_profiles;
create policy "user_profiles_update_admin"
  on public.clf_user_profiles for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Insert and Delete: super_admin only via REST.
-- (Server-side admin-create-user.js uses service-role key, which bypasses RLS,
-- so signup flows continue to work.)
drop policy if exists "user_profiles_insert_admin" on public.clf_user_profiles;
create policy "user_profiles_insert_admin"
  on public.clf_user_profiles for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "user_profiles_delete_admin" on public.clf_user_profiles;
create policy "user_profiles_delete_admin"
  on public.clf_user_profiles for delete to authenticated
  using (public.is_super_admin());

-- ─── RLS on clf_user_modules ──────────────────────────────────────────
-- Read own, edit own (for self-selection), admin can do anything.
alter table public.clf_user_modules enable row level security;

drop policy if exists "user_modules_read" on public.clf_user_modules;
create policy "user_modules_read"
  on public.clf_user_modules for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists "user_modules_self_update" on public.clf_user_modules;
create policy "user_modules_self_update"
  on public.clf_user_modules for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user_modules_admin_all" on public.clf_user_modules;
create policy "user_modules_admin_all"
  on public.clf_user_modules for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ─── Admin audit log ──────────────────────────────────────────────────
create table if not exists public.clf_admin_audit_log (
  id              uuid primary key default gen_random_uuid(),
  actor_user_id   uuid not null references auth.users(id) on delete set null,
  target_user_id  uuid references auth.users(id) on delete set null,
  action          text not null,            -- 'role_change' | 'user_delete' | 'module_change' | 'password_reset' | ...
  before_value    jsonb,
  after_value     jsonb,
  context         jsonb,                    -- free-form, e.g. {"ip": "...", "ua": "..."}
  created_at      timestamptz not null default now()
);

create index if not exists idx_audit_log_recent
  on public.clf_admin_audit_log (created_at desc);

create index if not exists idx_audit_log_target
  on public.clf_admin_audit_log (target_user_id, created_at desc);

alter table public.clf_admin_audit_log enable row level security;

drop policy if exists "audit_log_read_admin" on public.clf_admin_audit_log;
create policy "audit_log_read_admin"
  on public.clf_admin_audit_log for select to authenticated
  using (public.is_super_admin());

-- The frontend writes rows from admin actions. Insert is admin-only;
-- actor_user_id must match auth.uid() so an admin can't pretend to be
-- someone else.
drop policy if exists "audit_log_insert_admin" on public.clf_admin_audit_log;
create policy "audit_log_insert_admin"
  on public.clf_admin_audit_log for insert to authenticated
  with check (actor_user_id = auth.uid() and public.is_super_admin());

-- No UPDATE or DELETE policies — audit log is append-only by design.

-- ─── Reload PostgREST schema ──────────────────────────────────────────
notify pgrst, 'reload schema';

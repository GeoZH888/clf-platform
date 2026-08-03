-- 019_corpus_write_policies.sql
-- Let the corpus admin UI actually write.
--
-- corpus_collections, corpus_documents and corpus_subjects have RLS enabled
-- with read access but no write policy, so /admin → 语料库 RAG could list
-- everything and save nothing:
--
--   42501: new row violates row-level security policy for table
--          "corpus_collections"
--
-- Reproduced with a real staff token: SELECT 200, INSERT 403.
--
-- Scope: super_admin and school_master — the two roles AdminApp accepts
-- (adminRoles in useAdminAuth). Teachers are deliberately excluded: the
-- corpus is platform-wide reference material feeding RAG for every module,
-- not per-class content, and it matches keeping AI/RAG admin-side.
--
-- The document-processing pipeline runs in netlify functions on the service
-- role, which bypasses RLS — these policies are only for browser writes.
--
-- Safe to re-run.

create or replace function public.clf_is_platform_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clf_user_profiles p
     where p.user_id = auth.uid()
       and p.is_active is distinct from false
       and p.role::text in ('super_admin', 'school_master')
  );
$$;

grant execute on function public.clf_is_platform_admin() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['corpus_collections', 'corpus_documents', 'corpus_subjects']
  loop
    if to_regclass('public.' || t) is null then
      raise notice 'skipping %, table not present', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    -- Read stays open to any signed-in user: the learning modules and the
    -- 题库 RAG picker both need to see what is in the corpus.
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_read', t);

    -- Write is admin-only, and one FOR ALL policy covers insert/update/delete.
    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (public.clf_is_platform_admin()) '
      'with check (public.clf_is_platform_admin())',
      t || '_admin_write', t);
  end loop;
end $$;

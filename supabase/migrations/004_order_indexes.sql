-- ═══════════════════════════════════════════════════════════════════════
--  004_order_indexes.sql
--  Composite indexes for the multi-column .order() queries that have hit
--  (or are at risk of) statement_timeout 57014 via the PostgREST API.
--
--  See docs/postgrest-cache-and-order.md for the audit + per-query rationale.
--
--  Safe to re-run — every CREATE INDEX uses IF NOT EXISTS.
--
--  After applying:
--      notify pgrst, 'reload schema';
--  so PostgREST picks the new indexes into its query plans.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── clf_poems ────────────────────────────────────────────────────────
-- Hit by src/poetry/PoetryApp.jsx:553 — .order('difficulty').order('sort_order')
-- with .eq('active', true). User has reported 500s on this.
create index if not exists idx_clf_poems_active_difficulty_sort
  on public.clf_poems (active, difficulty, sort_order);

-- ─── clf_chengyu ──────────────────────────────────────────────────────
-- Hit by src/chengyu/ChengyuApp.jsx:80 — .order('hsk_level') with
-- .eq('active', true). Single-column order, but no index means in-memory sort.
create index if not exists idx_clf_chengyu_active_hsk
  on public.clf_chengyu (active, hsk_level);

-- ─── clf_notices ──────────────────────────────────────────────────────
-- Hit by 4 files (parent/student/school-master/teacher NoticesPage). All do
-- .order('pinned', desc).order('created_at', desc) with class scoping.
create index if not exists idx_clf_notices_class_pinned_created
  on public.clf_notices (class_id, pinned desc, created_at desc);

-- ─── clf_user_profiles ────────────────────────────────────────────────
-- Hit by src/admin/AdminAppV2.jsx:391 — admin user list, .order('role').order('name')
create index if not exists idx_clf_user_profiles_role_name
  on public.clf_user_profiles (role, name);

-- ─── clf_characters ───────────────────────────────────────────────────
-- Hit by src/clf/modules/CharactersModule.jsx:336 — .order('hsk_level').order('sort_order')
-- (Adjust table name if your characters table is jgw_characters instead — both
--  are referenced in src/. If the index is on a non-existent table, the CREATE
--  IF NOT EXISTS will error; remove the offending block.)
-- create index if not exists idx_clf_characters_hsk_sort
--   on public.clf_characters (hsk_level, sort_order);
-- Uncomment after confirming the actual table name in your DB.

-- ─── Trigger PostgREST schema reload ──────────────────────────────────
notify pgrst, 'reload schema';

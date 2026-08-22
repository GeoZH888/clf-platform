-- ═══════════════════════════════════════════════════════════════════════════
-- HOTFIX: clf_poems.notes_it column (missing from initial schema)
-- ═══════════════════════════════════════════════════════════════════════════
-- All other text fields have _zh/_en/_it triplets (title, translation,
-- background). notes is missing _it. Add it.
--
-- This unblocks PoetryAdminTab batch text generation, which had
-- poem_text_generate prompt return notes_it but the column didn't exist
-- → upsert failed with "Could not find the 'notes_it' column".

alter table clf_poems
  add column if not exists notes_it text;

-- Verify
select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'clf_poems'
    and column_name like 'notes_%'
  order by column_name;
-- Expected: 3 rows — notes_en, notes_it, notes_zh

-- IMPORTANT: After adding the column, you may need to nudge Supabase's
-- PostgREST schema cache. Either:
--   a) wait ~30 seconds, OR
--   b) Supabase Dashboard → Database → API → Reload schema cache
-- Otherwise the next insert/upsert may still fail with the same error.
notify pgrst, 'reload schema';

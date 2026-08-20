-- ═══════════════════════════════════════════════════════════════════════════
-- clf_poems: TTS audio metadata fields
-- ═══════════════════════════════════════════════════════════════════════════
-- audio_url already exists (from clf_schema.sql).
-- Add metadata so we know WHICH voice + provider was used to generate the
-- current audio_url. This enables:
--   1. Cache-skip: if audio exists for the same voice, don't regenerate
--   2. Voice switching: admin can replace audio with a different voice
--   3. Future polyglot: if we add english voice, store separately

alter table clf_poems
  add column if not exists audio_voice    text,  -- e.g. 'xiaoxiao', 'yunxi'
  add column if not exists audio_provider text,  -- 'azure' | 'openai'
  add column if not exists audio_duration int;   -- seconds (rough)

-- Verify
select column_name, data_type from information_schema.columns
  where table_schema = 'public' and table_name = 'clf_poems'
    and column_name like 'audio_%'
  order by column_name;
-- Expected: audio_duration, audio_provider, audio_url, audio_voice

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- Storage bucket
-- ═══════════════════════════════════════════════════════════════════════════
-- Cannot create bucket via SQL — must do in Supabase Dashboard:
--
--   1. Storage → New bucket
--   2. Name: poem-audio
--   3. Public: ☑ ON
--   4. File size limit: 10 MB
--   5. Allowed MIME types: audio/mpeg, audio/mp3, audio/ogg
--   6. Save
--
-- Verify bucket exists with this query:
select id, name, public, file_size_limit, allowed_mime_types
  from storage.buckets where id = 'poem-audio';
-- Expected: 1 row, public=true

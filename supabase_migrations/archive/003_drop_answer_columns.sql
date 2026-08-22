-- ============================================================
-- Drop answer image columns — only illustration is needed.
-- The answer text is already shown clearly in the reveal screen.
-- ============================================================

ALTER TABLE clf_riddles
  DROP COLUMN IF EXISTS answer_image_url,
  DROP COLUMN IF EXISTS answer_prompt,
  DROP COLUMN IF EXISTS answer_provider;

NOTIFY pgrst, 'reload schema';

-- Optional cleanup: storage objects in riddle-illustrations bucket with
-- "_answer.png" suffix are now orphaned. They take a few KB each and
-- aren't referenced anywhere. To remove them, go to Supabase dashboard:
--   Storage → riddle-illustrations → search for "_answer" → delete
--
-- Or leave them — they're harmless and small.

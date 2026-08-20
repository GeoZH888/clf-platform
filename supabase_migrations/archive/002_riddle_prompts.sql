-- ============================================================
-- Riddle prompt persistence — save prompts that successfully
-- generated images, so admin can iterate on them.
-- ============================================================

ALTER TABLE clf_riddles
  ADD COLUMN IF NOT EXISTS illustration_prompt   text,
  ADD COLUMN IF NOT EXISTS answer_prompt         text,
  ADD COLUMN IF NOT EXISTS illustration_provider text,
  ADD COLUMN IF NOT EXISTS answer_provider       text;

-- These are populated by generate-riddle-images.js ONLY when an
-- image is successfully generated and uploaded. Failed prompts
-- never persist.

NOTIFY pgrst, 'reload schema';

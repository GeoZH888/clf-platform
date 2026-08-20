-- ============================================================
-- 成语 image prompt persistence — saves the Chinese prompt and
-- provider that successfully generated each image, so admin can
-- iterate.
-- ============================================================

ALTER TABLE clf_chengyu
  ADD COLUMN IF NOT EXISTS image_prompt   text,
  ADD COLUMN IF NOT EXISTS image_provider text;

-- Existing columns left intact:
--   image_url, image_style, image_scene
-- The new columns store the full edited prompt (Chinese) and the
-- AI provider that produced the current image_url.

-- Storage bucket for chengyu illustrations (reuse existing or create new)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chengyu-illustrations', 'chengyu-illustrations', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read chengyu-illustrations" ON storage.objects;
CREATE POLICY "Public read chengyu-illustrations"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chengyu-illustrations');

DROP POLICY IF EXISTS "Authenticated upload chengyu-illustrations" ON storage.objects;
CREATE POLICY "Authenticated upload chengyu-illustrations"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chengyu-illustrations' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated update chengyu-illustrations" ON storage.objects;
CREATE POLICY "Authenticated update chengyu-illustrations"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'chengyu-illustrations' AND auth.role() = 'authenticated');

NOTIFY pgrst, 'reload schema';

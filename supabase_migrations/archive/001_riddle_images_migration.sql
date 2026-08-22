-- ============================================================
-- 灯谜 image columns + storage bucket
-- ============================================================

-- 1. Add image URL columns to existing riddle table
ALTER TABLE clf_riddles
  ADD COLUMN IF NOT EXISTS illustration_url    text,  -- 谜面 visualization (during play)
  ADD COLUMN IF NOT EXISTS answer_image_url    text,  -- 谜底 visualization (on reveal)
  ADD COLUMN IF NOT EXISTS images_generated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_clf_riddles_no_images
  ON clf_riddles (id)
  WHERE illustration_url IS NULL OR answer_image_url IS NULL;

-- 2. Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('riddle-illustrations', 'riddle-illustrations', true)
ON CONFLICT (id) DO NOTHING;

-- Public read policies (admin writes via service_role which bypasses RLS)
DROP POLICY IF EXISTS "Public read riddle-illustrations" ON storage.objects;
CREATE POLICY "Public read riddle-illustrations"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'riddle-illustrations');

DROP POLICY IF EXISTS "Authenticated upload riddle-illustrations" ON storage.objects;
CREATE POLICY "Authenticated upload riddle-illustrations"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'riddle-illustrations' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated update riddle-illustrations" ON storage.objects;
CREATE POLICY "Authenticated update riddle-illustrations"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'riddle-illustrations' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated delete riddle-illustrations" ON storage.objects;
CREATE POLICY "Authenticated delete riddle-illustrations"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'riddle-illustrations' AND auth.role() = 'authenticated');

NOTIFY pgrst, 'reload schema';

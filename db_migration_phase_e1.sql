-- Phase E.1 migration
-- Adds homework attachment columns + student response media columns + RLS for homework-files bucket

-- 1. Homework attachments (teacher prompts)
ALTER TABLE clf_homework ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE clf_homework ADD COLUMN IF NOT EXISTS attachment_type TEXT;
ALTER TABLE clf_homework ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE clf_homework ADD COLUMN IF NOT EXISTS attachment_path TEXT;
ALTER TABLE clf_homework ADD COLUMN IF NOT EXISTS words_list JSONB;

COMMENT ON COLUMN clf_homework.attachment_type IS 'pdf | audio | null';
COMMENT ON COLUMN clf_homework.attachment_path IS 'storage path: prompts/{homework_id}/{filename}';

-- 2. Student response media
ALTER TABLE clf_homework_submissions ADD COLUMN IF NOT EXISTS response_audio_url TEXT;
ALTER TABLE clf_homework_submissions ADD COLUMN IF NOT EXISTS response_audio_path TEXT;
ALTER TABLE clf_homework_submissions ADD COLUMN IF NOT EXISTS response_pdf_url TEXT;
ALTER TABLE clf_homework_submissions ADD COLUMN IF NOT EXISTS response_pdf_path TEXT;
ALTER TABLE clf_homework_submissions ADD COLUMN IF NOT EXISTS response_pdf_name TEXT;

-- 3. Storage RLS policies for homework-files bucket
-- (run AFTER creating the bucket via dashboard)

-- Teachers can upload to prompts/{homework_id}/ if they own the homework
DROP POLICY IF EXISTS "teacher_upload_prompts" ON storage.objects;
CREATE POLICY "teacher_upload_prompts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'prompts'
    AND EXISTS (
      SELECT 1 FROM clf_homework h
      WHERE h.id::text = (storage.foldername(name))[2]
      AND h.created_by = auth.uid()
    )
  );

-- Teachers can read prompts they own
DROP POLICY IF EXISTS "teacher_read_prompts" ON storage.objects;
CREATE POLICY "teacher_read_prompts" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'prompts'
    AND EXISTS (
      SELECT 1 FROM clf_homework h
      WHERE h.id::text = (storage.foldername(name))[2]
      AND h.created_by = auth.uid()
    )
  );

-- Students can read prompts for their classes
DROP POLICY IF EXISTS "student_read_prompts" ON storage.objects;
CREATE POLICY "student_read_prompts" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'prompts'
    AND EXISTS (
      SELECT 1
      FROM clf_homework h
      JOIN clf_class_members m ON m.class_id = h.class_id
      WHERE h.id::text = (storage.foldername(name))[2]
      AND m.user_id = auth.uid()
    )
  );

-- Students can upload to responses/{submission_id}/ if it's their own submission
DROP POLICY IF EXISTS "student_upload_responses" ON storage.objects;
CREATE POLICY "student_upload_responses" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'responses'
    AND EXISTS (
      SELECT 1 FROM clf_homework_submissions s
      WHERE s.id::text = (storage.foldername(name))[2]
      AND s.student_id = auth.uid()
    )
  );

-- Students can read their own responses
DROP POLICY IF EXISTS "student_read_own_responses" ON storage.objects;
CREATE POLICY "student_read_own_responses" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'responses'
    AND EXISTS (
      SELECT 1 FROM clf_homework_submissions s
      WHERE s.id::text = (storage.foldername(name))[2]
      AND s.student_id = auth.uid()
    )
  );

-- Teachers can read responses to homework they own
DROP POLICY IF EXISTS "teacher_read_student_responses" ON storage.objects;
CREATE POLICY "teacher_read_student_responses" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'responses'
    AND EXISTS (
      SELECT 1
      FROM clf_homework_submissions s
      JOIN clf_homework h ON h.id = s.homework_id
      WHERE s.id::text = (storage.foldername(name))[2]
      AND h.created_by = auth.uid()
    )
  );

-- Update / delete: same logic as INSERT
DROP POLICY IF EXISTS "teacher_update_prompts" ON storage.objects;
CREATE POLICY "teacher_update_prompts" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'prompts'
    AND EXISTS (
      SELECT 1 FROM clf_homework h
      WHERE h.id::text = (storage.foldername(name))[2]
      AND h.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "teacher_delete_prompts" ON storage.objects;
CREATE POLICY "teacher_delete_prompts" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'prompts'
    AND EXISTS (
      SELECT 1 FROM clf_homework h
      WHERE h.id::text = (storage.foldername(name))[2]
      AND h.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "student_update_responses" ON storage.objects;
CREATE POLICY "student_update_responses" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'responses'
    AND EXISTS (
      SELECT 1 FROM clf_homework_submissions s
      WHERE s.id::text = (storage.foldername(name))[2]
      AND s.student_id = auth.uid()
    )
  );

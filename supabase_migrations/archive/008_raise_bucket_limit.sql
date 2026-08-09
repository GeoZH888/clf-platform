-- ═══════════════════════════════════════════════════════════════════════
--  Raise corpus-files bucket file size limit from 100MB to 500MB
--
--  Why: single big PDFs (300+ pages, scanned) can easily exceed 100MB.
--  The new batch upload handles thousands of small files, but we still
--  need to allow large individual files.
-- ═══════════════════════════════════════════════════════════════════════

UPDATE storage.buckets
SET file_size_limit = 524288000  -- 500 MB = 500 * 1024 * 1024
WHERE id = 'corpus-files';

-- Verify
SELECT
  id,
  name,
  ROUND(file_size_limit::numeric / 1024 / 1024, 0) AS limit_mb,
  public
FROM storage.buckets
WHERE id = 'corpus-files';
-- Expected: limit_mb = 500

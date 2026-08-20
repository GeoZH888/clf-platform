-- Ensure jgw_characters has the image_url column (needed for the enhanced edit modal)
-- Safe to run multiple times — no-op if already present.

ALTER TABLE jgw_characters ADD COLUMN IF NOT EXISTS image_url text;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'jgw_characters' AND table_schema = 'public' AND column_name = 'image_url';
-- Expected: one row with data_type 'text'

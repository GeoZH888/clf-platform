-- Phase E.3: Institution branding columns

ALTER TABLE clf_user_profiles
  ADD COLUMN IF NOT EXISTS institution_name TEXT,
  ADD COLUMN IF NOT EXISTS institution_logo_url TEXT;

-- Optional index for filtering by institution
CREATE INDEX IF NOT EXISTS idx_user_profiles_institution
  ON clf_user_profiles(institution_name)
  WHERE institution_name IS NOT NULL;

-- Manual step required in Supabase Dashboard:
--   Storage > New bucket > "institution-logos"
--   Public: ON
--   File size limit: 2 MB
--   Allowed MIME types: image/png, image/jpeg, image/svg+xml, image/webp

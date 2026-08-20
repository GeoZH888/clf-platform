-- ═══════════════════════════════════════════════════════════════════
--  Migration: pinyin audio + IPA overrides
--  Run in Supabase SQL editor
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- 1. Storage bucket for recorded audio files
-- ───────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('pinyin-audio', 'pinyin-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Public read so <audio> tags work without auth tokens
CREATE POLICY "Public read pinyin-audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pinyin-audio');

-- Anyone logged in can upload/replace — you can tighten this later
-- e.g. to a specific role once you have a proper admin role table.
CREATE POLICY "Authenticated upload pinyin-audio"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pinyin-audio' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated update pinyin-audio"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'pinyin-audio' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated delete pinyin-audio"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'pinyin-audio' AND auth.role() = 'authenticated');

-- ───────────────────────────────────────────────────────────────────
-- 2. Audio metadata — one row per recorded sound
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pinyin_audio (
  sound        text PRIMARY KEY,              -- 'b', 'zh', 'ang', etc.
  audio_url    text NOT NULL,                  -- Supabase Storage public URL
  duration_ms  int,                            -- for UI display, optional
  file_size    int,                            -- bytes, optional
  format       text DEFAULT 'audio/webm',      -- browsers default to webm
  uploaded_at  timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- Public read — frontend fetches without auth
ALTER TABLE pinyin_audio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read pinyin_audio"
  ON pinyin_audio FOR SELECT USING (true);
CREATE POLICY "Authenticated write pinyin_audio"
  ON pinyin_audio FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ───────────────────────────────────────────────────────────────────
-- 3. IPA overrides — optional per-sound overrides on top of pinyinIPA.js
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pinyin_sound_overrides (
  sound            text PRIMARY KEY,
  ipa              text,        -- null = use default
  desc_zh          text,
  desc_en          text,
  desc_it          text,
  example_char     text,
  example_meaning  text,
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE pinyin_sound_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read pinyin_sound_overrides"
  ON pinyin_sound_overrides FOR SELECT USING (true);
CREATE POLICY "Authenticated write pinyin_sound_overrides"
  ON pinyin_sound_overrides FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ───────────────────────────────────────────────────────────────────
-- 4. Auto-update updated_at trigger (reusable pattern)
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_pinyin_audio_updated_at ON pinyin_audio;
CREATE TRIGGER t_pinyin_audio_updated_at
  BEFORE UPDATE ON pinyin_audio
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS t_pinyin_sound_overrides_updated_at ON pinyin_sound_overrides;
CREATE TRIGGER t_pinyin_sound_overrides_updated_at
  BEFORE UPDATE ON pinyin_sound_overrides
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

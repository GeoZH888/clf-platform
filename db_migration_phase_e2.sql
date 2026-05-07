-- Phase E.2: AI provider config + per-user override

-- 1. AI provider config (admin-managed)
CREATE TABLE IF NOT EXISTS clf_ai_provider_config (
  id SERIAL PRIMARY KEY,
  feature TEXT NOT NULL,        -- 'text' | 'image' | 'audio' | 'embedding'
  provider TEXT NOT NULL,       -- 'anthropic' | 'openai' | 'gemini' | 'deepseek' | 'qwen' | 'grok' | 'mistral' | 'ideogram' | 'stability' | 'azure_tts' | 'youdao_tts'
  model TEXT,                   -- e.g. 'claude-opus-4-7', 'gpt-4o', 'gemini-pro'
  enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (feature, provider)
);

-- Seed with available providers
INSERT INTO clf_ai_provider_config (feature, provider, model, enabled, is_default) VALUES
  ('text',     'anthropic', 'claude-opus-4-7',           true, true),
  ('text',     'openai',    'gpt-4o',                    true, false),
  ('text',     'gemini',    'gemini-2.5-pro',            true, false),
  ('text',     'deepseek',  'deepseek-chat',             true, false),
  ('text',     'qwen',      'qwen-max',                  false, false),
  ('text',     'mistral',   'mistral-large-latest',      false, false),
  ('image',    'ideogram',  'ideogram-3.0',              true, true),
  ('image',    'stability', 'sd3-large',                 true, false),
  ('audio',    'azure_tts', 'azure-zh-cn',               true, true),
  ('audio',    'youdao_tts','youdao-zh-cn',              true, false)
ON CONFLICT (feature, provider) DO NOTHING;

-- 2. Per-user provider override (optional)
ALTER TABLE clf_user_profiles ADD COLUMN IF NOT EXISTS ai_text_provider TEXT;
ALTER TABLE clf_user_profiles ADD COLUMN IF NOT EXISTS ai_image_provider TEXT;
ALTER TABLE clf_user_profiles ADD COLUMN IF NOT EXISTS ai_audio_provider TEXT;

-- 3. RLS for clf_ai_provider_config
ALTER TABLE clf_ai_provider_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_config_admin_all ON clf_ai_provider_config;
CREATE POLICY ai_config_admin_all ON clf_ai_provider_config
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM clf_user_profiles
            WHERE user_id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM clf_user_profiles
            WHERE user_id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS ai_config_authenticated_read ON clf_ai_provider_config;
CREATE POLICY ai_config_authenticated_read ON clf_ai_provider_config
  FOR SELECT TO authenticated USING (enabled = true);

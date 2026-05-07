-- ===================================================================
-- Phase A v2: tier system + module gating + public heritage module
-- Run in Supabase SQL editor for project yqcojudvvjntaajnrilr.
-- Idempotent. Safe to re-run.
-- ===================================================================

-- 1. Tier table
CREATE TABLE IF NOT EXISTS clf_tiers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 text NOT NULL UNIQUE,
  label_zh             text NOT NULL,
  label_en             text NOT NULL,
  label_it             text,
  description          text,
  expires_after_days   int,
  is_default           boolean NOT NULL DEFAULT false,
  sort_order           int NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- 2. Module catalog
CREATE TABLE IF NOT EXISTS clf_modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  label_zh    text NOT NULL,
  label_en    text NOT NULL,
  label_it    text,
  description text,
  route       text NOT NULL,
  icon        text,
  color       text,
  is_public   boolean NOT NULL DEFAULT false,  -- TRUE = visible without login or tier
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- v2 migration: add is_public column if existing install
DO $$ BEGIN
  ALTER TABLE clf_modules ADD COLUMN is_public boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 3. Tier <-> module allowlist
CREATE TABLE IF NOT EXISTS clf_tier_modules (
  tier_id    uuid REFERENCES clf_tiers(id)   ON DELETE CASCADE,
  module_id  uuid REFERENCES clf_modules(id) ON DELETE CASCADE,
  PRIMARY KEY (tier_id, module_id)
);

-- 4. Add tier_id to user profiles
DO $$ BEGIN
  ALTER TABLE clf_user_profiles ADD COLUMN tier_id uuid REFERENCES clf_tiers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS clf_user_profiles_tier_idx ON clf_user_profiles(tier_id);

-- 5. Seed 4 tiers
INSERT INTO clf_tiers (slug, label_zh, label_en, label_it, description, expires_after_days, is_default, sort_order)
VALUES
  ('free',    '免费版', 'Free',              'Gratuito',         'Limited free modules',     NULL, true,  1),
  ('premium', '高级版', 'Premium',           'Premium',          'All community modules',    NULL, false, 2),
  ('school',  '校园版', 'School-affiliated', 'Affiliato Scuola', 'Tied to a school',         NULL, false, 3),
  ('trial',   '试用版', 'Trial',             'Prova',            'Premium for 14 days',      14,   false, 4)
ON CONFLICT (slug) DO UPDATE
  SET label_zh = EXCLUDED.label_zh, label_en = EXCLUDED.label_en,
      label_it = EXCLUDED.label_it, description = EXCLUDED.description,
      expires_after_days = EXCLUDED.expires_after_days,
      sort_order = EXCLUDED.sort_order;

-- 6. Seed CLF community modules + heritage (public)
INSERT INTO clf_modules (slug, label_zh, label_en, label_it, description, route, icon, color, is_public, sort_order)
VALUES
  ('characters', '汉字',         'Characters',         'Caratteri',  '认识汉字', '/community/characters', '字', '#E53935', false, 1),
  ('pinyin',     '拼音',         'Pinyin',             'Pinyin',     '拼音发音', '/community/pinyin',     '音', '#1565C0', false, 2),
  ('words',      '词语',         'Vocabulary',         'Vocabolario','按主题学词汇', '/community/words',      '词', '#1565C0', false, 3),
  ('grammar',    '语法',         'Grammar',            'Grammatica', '语法与练习', '/community/grammar',    '法', '#6A1B9A', false, 4),
  ('idioms',     '成语',         'Idioms',             'Proverbi',   '成语故事', '/community/idioms',     '成', '#8B4513', false, 5),
  ('poems',      '诗歌',         'Poetry',             'Poesia',     '诗歌阅读', '/community/poems',      '诗', '#C8972A', false, 6),
  ('stories',    '故事',         'Stories',            'Storie',     '故事阅读', '/community/stories',    '故', '#2E7D32', false, 7),
  ('dialogue',   '场景对话', 'Scene dialogue',  'Dialoghi',   '与AI对话',     '/community/dialogue',   '话', '#1D9E75', false, 8),
  ('storyhub',   '故事汇',   'Story hub',          'Storie',     'AI 生成故事', '/community/storyhub',   '汇', '#534AB7', false, 9),
  ('heritage',   '非遗',         'Intangible heritage','Patrimonio', '中华非物质文化遗产', '/feiyi', '遗', '#a0522d', true, 10)
ON CONFLICT (slug) DO UPDATE
  SET label_zh = EXCLUDED.label_zh, label_en = EXCLUDED.label_en,
      label_it = EXCLUDED.label_it, description = EXCLUDED.description,
      route = EXCLUDED.route, icon = EXCLUDED.icon, color = EXCLUDED.color,
      is_public = EXCLUDED.is_public,
      sort_order = EXCLUDED.sort_order;

-- 7. Tier defaults (free = characters+pinyin only; premium/school/trial = all NON-public modules)
WITH free_tier AS (SELECT id FROM clf_tiers WHERE slug = 'free'),
     basic AS (SELECT id FROM clf_modules WHERE slug IN ('characters', 'pinyin'))
INSERT INTO clf_tier_modules (tier_id, module_id)
SELECT free_tier.id, basic.id FROM free_tier, basic
ON CONFLICT DO NOTHING;

WITH full_tiers AS (SELECT id FROM clf_tiers WHERE slug IN ('premium','school','trial')),
     all_mods AS (SELECT id FROM clf_modules WHERE is_active = true AND is_public = false)
INSERT INTO clf_tier_modules (tier_id, module_id)
SELECT full_tiers.id, all_mods.id FROM full_tiers, all_mods
ON CONFLICT DO NOTHING;

-- 8. RLS
ALTER TABLE clf_tiers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_modules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_tier_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone read tiers"   ON clf_tiers;
CREATE POLICY "anyone read tiers"   ON clf_tiers        FOR SELECT USING (true);
DROP POLICY IF EXISTS "anyone read modules" ON clf_modules;
CREATE POLICY "anyone read modules" ON clf_modules      FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "anyone read links"   ON clf_tier_modules;
CREATE POLICY "anyone read links"   ON clf_tier_modules FOR SELECT USING (true);

DROP POLICY IF EXISTS "super_admin write tiers" ON clf_tiers;
CREATE POLICY "super_admin write tiers" ON clf_tiers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clf_user_profiles WHERE user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM clf_user_profiles WHERE user_id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS "super_admin write modules" ON clf_modules;
CREATE POLICY "super_admin write modules" ON clf_modules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clf_user_profiles WHERE user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM clf_user_profiles WHERE user_id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS "super_admin write links" ON clf_tier_modules;
CREATE POLICY "super_admin write links" ON clf_tier_modules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clf_user_profiles WHERE user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM clf_user_profiles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- Sanity
SELECT 'tiers'         AS what, count(*) FROM clf_tiers
UNION ALL SELECT 'modules',     count(*) FROM clf_modules
UNION ALL SELECT 'public_mods', count(*) FROM clf_modules WHERE is_public = true
UNION ALL SELECT 'free_links',  count(*) FROM clf_tier_modules WHERE tier_id = (SELECT id FROM clf_tiers WHERE slug='free');

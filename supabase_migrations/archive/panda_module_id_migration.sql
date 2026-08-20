-- ═══════════════════════════════════════════════════════════════════
--  Task 5 — Panda module assignment
--
--  Adds `module_id` column to jgw_panda_assets so admins can pin a
--  specific panda to a specific module in PandaStudio.
--
--  Also adds UNIQUE constraint on emotion (was implicit via upsert).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Add UNIQUE on emotion if missing ──
-- (silently skipped if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'jgw_panda_assets'::regclass
      AND contype = 'u'
      AND conname = 'jgw_panda_assets_emotion_key'
  ) THEN
    ALTER TABLE jgw_panda_assets
      ADD CONSTRAINT jgw_panda_assets_emotion_key UNIQUE (emotion);
  END IF;
END $$;

-- ── 2. Add module_id column ──
ALTER TABLE jgw_panda_assets
  ADD COLUMN IF NOT EXISTS module_id text;

-- Comment for clarity
COMMENT ON COLUMN jgw_panda_assets.module_id IS
  'Optional pin: when set, this panda is shown for the named module on PlatformHome (lianzi/pinyin/words/grammar/chengyu). Multiple rows can have NULL; only one row per module_id is meaningful.';

-- ── 3. Index for fast PlatformHome lookup ──
CREATE INDEX IF NOT EXISTS idx_panda_module_id
  ON jgw_panda_assets(module_id)
  WHERE module_id IS NOT NULL;

-- ── 4. Pre-populate sensible defaults based on existing emotions ──
-- This is a best-effort initial mapping; admin can change in PandaStudio.
UPDATE jgw_panda_assets SET module_id = 'lianzi'  WHERE emotion = 'writing'  AND module_id IS NULL;
UPDATE jgw_panda_assets SET module_id = 'pinyin'  WHERE emotion = 'pinyin'   AND module_id IS NULL;
UPDATE jgw_panda_assets SET module_id = 'words'   WHERE emotion = 'words'    AND module_id IS NULL;
-- grammar / chengyu have no obvious emotion match — admins can pick in UI

-- ── 5. Verify ──
SELECT emotion, label, module_id,
       CASE
         WHEN module_id IS NULL THEN '— unassigned —'
         ELSE '🎯 module: ' || module_id
       END AS assignment
FROM jgw_panda_assets
ORDER BY module_id NULLS LAST, emotion;

NOTIFY pgrst, 'reload schema';

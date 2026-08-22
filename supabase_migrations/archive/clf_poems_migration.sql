-- ═══════════════════════════════════════════════════════════════════════════
-- jgw_poems → clf_poems migration
-- ═══════════════════════════════════════════════════════════════════════════
-- Goal: unify all poetry data on clf_poems (the schema-defined target),
-- decommission jgw_poems (which has 4 missing columns including image_url —
-- explains why illustrations "succeeded" but never showed up).
--
-- Run sections in order. STOP after each verification block to confirm
-- nothing is wrong before continuing. The DROP statement at the end is
-- COMMENTED OUT — uncomment only after manual verification.

-- ───────────────────────────────────────────────────────────────────────────
-- Section 1: Pre-flight — confirm starting state
-- ───────────────────────────────────────────────────────────────────────────

select 'jgw_poems' as src, count(*) as rows from jgw_poems
union all
select 'clf_poems', count(*) from clf_poems;
-- Expected: jgw_poems = N rows (you said 1), clf_poems = 0 rows.
-- If clf_poems already has rows from a partial earlier migration, decide
-- whether to wipe (delete from clf_poems) or merge (more complex) before
-- proceeding.

-- ───────────────────────────────────────────────────────────────────────────
-- Section 2: Migrate data
-- ───────────────────────────────────────────────────────────────────────────

-- jgw_poems schema (per Inspect query):
--   id, title, title_en, author, dynasty, type, difficulty,
--   lines, translation_zh, translation_en, translation_it,
--   notes_zh, notes_en, background_zh, background_en, background_it,
--   active, sort_order, created_at, pinyin_map, image_prompt
--
-- clf_poems has all these PLUS:
--   title_it, dynasty_en, notes_it, image_url, audio_url, tags, level, age_min
-- (these get NULL or default values; nothing to migrate)

insert into clf_poems (
  id, title, title_en, author, dynasty, type, difficulty,
  lines, pinyin_map,
  translation_zh, translation_en, translation_it,
  background_zh, background_en, background_it,
  notes_zh, notes_en,
  image_prompt,
  active, sort_order, created_at
)
select
  id, title, title_en, author, dynasty, type, difficulty,
  lines, pinyin_map,
  translation_zh, translation_en, translation_it,
  background_zh, background_en, background_it,
  notes_zh, notes_en,
  image_prompt,
  active, sort_order, created_at
from jgw_poems
on conflict (title, author) do nothing;
-- on conflict do nothing makes this safe to re-run.

-- ───────────────────────────────────────────────────────────────────────────
-- Section 3: Verify migration
-- ───────────────────────────────────────────────────────────────────────────

select 'jgw_poems' as src, count(*) as rows, count(image_prompt) as with_prompt
  from jgw_poems
union all
select 'clf_poems', count(*), count(image_prompt)
  from clf_poems;
-- Expected: clf_poems row count == jgw_poems row count.
-- If you had image_prompt populated on jgw rows, it should now be on clf rows too.

-- Sanity check: see the migrated row(s)
select id, title, author, dynasty, type, active, image_prompt is not null as has_prompt
  from clf_poems
  order by created_at desc;

-- ───────────────────────────────────────────────────────────────────────────
-- Section 4: After PoetryAdminTab.jsx is deployed and verified to read/write
--            clf_poems correctly, drop the old table.
--            DO NOT UNCOMMENT THIS UNTIL THE NEW CODE IS LIVE AND TESTED.
-- ───────────────────────────────────────────────────────────────────────────

-- drop table if exists jgw_poems cascade;

-- After uncommenting and running, verify with:
--   select count(*) from information_schema.tables
--     where table_schema = 'public' and table_name = 'jgw_poems';
-- Expected: 0

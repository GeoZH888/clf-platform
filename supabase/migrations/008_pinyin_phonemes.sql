-- supabase/migrations/008_pinyin_phonemes.sql
-- 声母韵母表 — single table for initials + finals.
--
-- One row per phoneme (e.g. 'b', 'zh', 'ai', 'üe') keyed on (kind, py).
-- 'kind' partitions the table into the two reference grids that PinyinTable
-- shows side-by-side. category_label + category_color reproduce the colored
-- category groupings (双唇音 / 唇齿音 / 舌尖音 / …).
--
-- Run once in the Supabase SQL editor. Idempotent — uses IF NOT EXISTS.
-- Seed data lands via scripts/seed-pinyin-phonemes.mjs after this runs.

CREATE TABLE IF NOT EXISTS public.clf_pinyin_phonemes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind              text NOT NULL CHECK (kind IN ('initial', 'final')),
  py                text NOT NULL,
  category_label    text,
  category_color    text,
  example_char      text,
  example_meaning   text,
  display_order     int  NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, py)
);

CREATE INDEX IF NOT EXISTS clf_pinyin_phonemes_kind_order_idx
  ON public.clf_pinyin_phonemes (kind, display_order);

ALTER TABLE public.clf_pinyin_phonemes ENABLE ROW LEVEL SECURITY;

-- Public read so anonymous learners on /learn?module=pinyin can fetch the
-- table. Writes are service-role only (admin tooling / seed script).
DROP POLICY IF EXISTS "phonemes_read_all"  ON public.clf_pinyin_phonemes;
DROP POLICY IF EXISTS "phonemes_write_svc" ON public.clf_pinyin_phonemes;

CREATE POLICY "phonemes_read_all" ON public.clf_pinyin_phonemes
  FOR SELECT USING (true);

CREATE POLICY "phonemes_write_svc" ON public.clf_pinyin_phonemes
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════
--  006_feiyi_content.sql
--  Phase 2.A — public feiyi content tables.
--
--  Two tables:
--    clf_feiyi_categories  — the 4 thematic categories (folklore, opera,
--                            crafts, festivals). Seeded with the current
--                            CommunityHome FEIYI constant.
--    clf_feiyi_articles    — per-category content. Empty at migration
--                            time; admin adds rows later. UI shows
--                            "coming soon" until first article published.
--
--  RLS posture:
--    - Anonymous + authenticated SELECT on rows where the visibility
--      flag is on (categories.is_active / articles.is_published).
--    - super_admin only for INSERT / UPDATE / DELETE.
--    - Feiyi is intentionally PUBLIC — no login required.
--
--  Safe to re-run — every CREATE / INSERT uses IF NOT EXISTS / ON CONFLICT.
--
--  After applying:
--      notify pgrst, 'reload schema';
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Categories ───────────────────────────────────────────────────────
create table if not exists public.clf_feiyi_categories (
  slug             text primary key,
  name_zh          text not null,
  name_en          text not null,
  name_it          text not null,
  description_zh   text,
  description_en   text,
  description_it   text,
  icon             text,                 -- one character / glyph
  color            text,                 -- hex like '#a0522d'
  sort_order       int not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ─── Articles ─────────────────────────────────────────────────────────
create table if not exists public.clf_feiyi_articles (
  id               uuid primary key default gen_random_uuid(),
  category_slug    text not null references public.clf_feiyi_categories(slug) on delete restrict,
  title_zh         text not null,
  title_en         text,
  title_it         text,
  body_zh          text,                 -- markdown
  body_en          text,
  body_it          text,
  cover_image_url  text,
  is_published     boolean not null default false,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_feiyi_articles_cat_pub
  on public.clf_feiyi_articles (category_slug, is_published, published_at desc);

-- ─── RLS — public read, super_admin write ─────────────────────────────
alter table public.clf_feiyi_categories enable row level security;
alter table public.clf_feiyi_articles   enable row level security;

drop policy if exists "feiyi_categories_anon_read" on public.clf_feiyi_categories;
create policy "feiyi_categories_anon_read"
  on public.clf_feiyi_categories for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "feiyi_articles_anon_read" on public.clf_feiyi_articles;
create policy "feiyi_articles_anon_read"
  on public.clf_feiyi_articles for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists "feiyi_categories_admin_write" on public.clf_feiyi_categories;
create policy "feiyi_categories_admin_write"
  on public.clf_feiyi_categories for all to authenticated
  using (exists (select 1 from public.clf_user_profiles
                  where user_id = auth.uid() and role = 'super_admin'))
  with check (exists (select 1 from public.clf_user_profiles
                       where user_id = auth.uid() and role = 'super_admin'));

drop policy if exists "feiyi_articles_admin_write" on public.clf_feiyi_articles;
create policy "feiyi_articles_admin_write"
  on public.clf_feiyi_articles for all to authenticated
  using (exists (select 1 from public.clf_user_profiles
                  where user_id = auth.uid() and role = 'super_admin'))
  with check (exists (select 1 from public.clf_user_profiles
                       where user_id = auth.uid() and role = 'super_admin'));

-- ─── Seed: 4 canonical categories (matches CommunityHome's FEIYI const) ─
insert into public.clf_feiyi_categories
  (slug, name_zh, name_en, name_it, description_zh, description_en, description_it, icon, color, sort_order) values
  ('folklore',  '民俗故事', 'Folklore',  'Folclore',
   '传统民间传说与口头文学', 'Traditional folk tales and oral literature', 'Racconti popolari e letteratura orale',
   '俗', '#a0522d', 1),
  ('opera',     '传统戏曲', 'Opera',     'Opera',
   '昆曲、京剧、各地戏种', 'Kunqu, Beijing opera, and regional styles', 'Kunqu, opera di Pechino e stili regionali',
   '戏', '#c41e3a', 2),
  ('crafts',    '民间工艺', 'Crafts',    'Artigianato',
   '剪纸、刺绣、陶瓷与传统手工', 'Paper-cutting, embroidery, ceramics, traditional crafts', 'Carta tagliata, ricamo, ceramica e artigianato tradizionale',
   '工', '#8b4513', 3),
  ('festivals', '节庆文化', 'Festivals', 'Feste',
   '传统节日与仪式', 'Traditional festivals and rituals', 'Feste e rituali tradizionali',
   '庆', '#d4a017', 4)
on conflict (slug) do nothing;

-- ─── PostgREST schema reload ──────────────────────────────────────────
notify pgrst, 'reload schema';

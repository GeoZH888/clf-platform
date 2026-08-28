-- 016_classics.sql
-- 四书五经 — the Four Books and Five Classics, as a reading module.
--
-- Two tables, for the same reason 故事会 has two: the nine books are a fixed,
-- known set that should exist the moment the module ships, while the passages
-- inside them are content that gets written over time. Seeding the books means
-- the module is never an empty screen.
--
-- The books are seeded here rather than hardcoded in the app because titles,
-- descriptions and ordering are content — an editor should be able to reword a
-- description without a deploy.

create table if not exists clf_classics (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  collection   text not null check (collection in ('sishu', 'wujing')),  -- 四书 | 五经

  -- 原文 titles are conventionally written in traditional characters; the
  -- platform teaches simplified, so both are kept and the reader shows the one
  -- that matches what it is displaying.
  title_zh     text not null,          -- 大学
  title_zh_t   text,                   -- 大學
  title_en     text,
  title_it     text,
  title_pinyin text,

  summary_zh   text,
  summary_en   text,
  summary_it   text,

  era          text,                   -- 春秋 / 战国 …
  order_idx    integer not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now()
);

comment on table clf_classics is
  'The nine books of 四书五经. Fixed set — passages live in clf_classic_passages.';

create table if not exists clf_classic_passages (
  id            uuid primary key default gen_random_uuid(),
  classic_id    uuid not null references clf_classics(id) on delete cascade,
  passage_order integer not null default 1,

  chapter_zh    text,                  -- 学而第一
  original      text not null,         -- 原文, as transmitted
  -- 白话: the point of the module. A classical passage without a modern
  -- rendering is decoration; with one it can actually be read.
  vernacular_zh text,
  text_en       text,
  text_it       text,
  pinyin        text,
  notes_zh      text,                  -- 注解 for difficult characters/allusions

  -- Same shape as clf_story_pages, so the existing Azure narration path works
  -- here unchanged.
  audio_url      text,
  audio_voice    text,
  audio_provider text,
  audio_duration integer,

  created_at    timestamptz not null default now()
);

create index if not exists clf_classic_passages_book_idx
  on clf_classic_passages (classic_id, passage_order);

-- ── The nine books ────────────────────────────────────────────────────────
-- Order is the conventional teaching order, not alphabetical: 大学 first
-- because it is traditionally where a student begins.
insert into clf_classics
  (slug, collection, title_zh, title_zh_t, title_en, title_it, title_pinyin,
   summary_zh, summary_en, summary_it, era, order_idx)
values
  ('daxue','sishu','大学','大學','The Great Learning','Il Grande Studio','Dà Xué',
   '儒家入门之作,讲修身、齐家、治国、平天下的次第。',
   'The traditional starting point of Confucian study: how self-cultivation extends outward to family, state and world.',
   'Il punto di partenza dello studio confuciano: come la cura di sé si estende a famiglia, stato e mondo.',
   '战国', 1),

  ('lunyu','sishu','论语','論語','The Analects','I Dialoghi','Lún Yǔ',
   '孔子及其弟子的言行录,儒家最核心的经典。',
   'Sayings and conversations of Confucius and his disciples — the central Confucian text.',
   'Detti e conversazioni di Confucio e dei suoi discepoli, il testo confuciano centrale.',
   '春秋', 2),

  ('mengzi','sishu','孟子','孟子','Mencius','Mencio','Mèng Zǐ',
   '孟子与诸侯、弟子的辩论,主张性善与仁政。',
   'Mencius in debate with rulers and students, arguing that human nature is good and government should be humane.',
   'Mencio in dibattito con sovrani e allievi: la natura umana è buona e il governo dev''essere umano.',
   '战国', 3),

  ('zhongyong','sishu','中庸','中庸','The Doctrine of the Mean','La Via di Mezzo','Zhōng Yōng',
   '讲不偏不倚、持中守正的修养之道。',
   'On balance and constancy — holding to the centre without leaning.',
   'Sull''equilibrio e la costanza: mantenere il centro senza sbilanciarsi.',
   '战国', 4),

  ('shijing','wujing','诗经','詩經','The Book of Songs','Il Libro delle Odi','Shī Jīng',
   '中国最早的诗歌总集,三百零五篇,多为民歌。',
   'China''s oldest poetry collection — 305 pieces, many of them folk songs.',
   'La più antica raccolta poetica cinese: 305 componimenti, molti canti popolari.',
   '西周至春秋', 5),

  ('shangshu','wujing','尚书','尚書','The Book of Documents','Il Libro dei Documenti','Shàng Shū',
   '上古的政令、誓辞与训诰,中国最早的史书之一。',
   'Speeches, edicts and counsels from high antiquity — among the earliest Chinese histories.',
   'Discorsi, editti e consigli dell''antichità: fra le più antiche storie cinesi.',
   '上古', 6),

  ('liji','wujing','礼记','禮記','The Book of Rites','Il Libro dei Riti','Lǐ Jì',
   '记载礼制与礼义,《大学》《中庸》原为其中两篇。',
   'On ritual and its meaning. The Great Learning and Doctrine of the Mean were originally chapters of it.',
   'Sui riti e sul loro significato: Il Grande Studio e La Via di Mezzo ne erano capitoli.',
   '战国至汉', 7),

  ('zhouyi','wujing','周易','周易','The Book of Changes','Il Libro dei Mutamenti','Zhōu Yì',
   '以六十四卦讲变化之理,兼为卜筮与哲学之书。',
   'Sixty-four hexagrams on the nature of change — at once a divination manual and a work of philosophy.',
   'Sessantaquattro esagrammi sulla natura del mutamento: manuale divinatorio e opera filosofica.',
   '西周', 8),

  ('chunqiu','wujing','春秋','春秋','The Spring and Autumn Annals','Annali delle Primavere e Autunni','Chūn Qiū',
   '鲁国编年史,记事极简,而寓褒贬于一字之间。',
   'The chronicle of Lu — terse to the point of austerity, with judgement carried in single words.',
   'La cronaca di Lu: estremamente concisa, con il giudizio affidato a singole parole.',
   '春秋', 9)
on conflict (slug) do nothing;

-- ── RLS ───────────────────────────────────────────────────────────────────
-- Readable by anyone, including signed-out visitors: this is public cultural
-- material and the module is part of the free tier.
alter table clf_classics         enable row level security;
alter table clf_classic_passages enable row level security;

drop policy if exists "anyone reads classics" on clf_classics;
create policy "anyone reads classics" on clf_classics
  for select using (is_published);

drop policy if exists "anyone reads passages" on clf_classic_passages;
create policy "anyone reads passages" on clf_classic_passages
  for select using (true);

drop policy if exists "staff write classics" on clf_classics;
create policy "staff write classics" on clf_classics
  for all using (
    exists (select 1 from clf_user_profiles p
             where p.user_id = auth.uid()
               and p.role in ('super_admin','school_master','teacher')
               and coalesce(p.is_active, true))
  );

drop policy if exists "staff write passages" on clf_classic_passages;
create policy "staff write passages" on clf_classic_passages
  for all using (
    exists (select 1 from clf_user_profiles p
             where p.user_id = auth.uid()
               and p.role in ('super_admin','school_master','teacher')
               and coalesce(p.is_active, true))
  );

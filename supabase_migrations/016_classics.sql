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

-- ── Passages ─────────────────────────────────────────────────────────────
-- Ported from the 問骨 reader, which already had these twelve written and
-- checked, with per-character pinyin. Re-keying them by hand would have
-- risked introducing errors into text that is already correct.
--
-- on conflict does nothing via the unique index below, so re-running this
-- file cannot duplicate a passage.
create unique index if not exists clf_classic_passages_unique_idx
  on clf_classic_passages (classic_id, passage_order);

insert into clf_classic_passages
  (classic_id, passage_order, chapter_zh, original, pinyin, vernacular_zh, text_en, text_it, notes_zh)
select c.id, 1, '經一章', '大學之道，在明明德，在親民，在止於至善。', 'dà xué zhī dào zài míng míng dé zài qīn mín zài zhǐ yú zhì shàn',
       '大學的宗旨，在於彰明光明的德性，在於親近愛護民眾，在於達到並停留在最高的善。', 'The way of great learning lies in making bright one''s luminous virtue, in drawing close to the people, and in coming to rest in the highest good.', 'La via del grande studio sta nel far risplendere la virtù luminosa, nell’essere vicini al popolo, e nel fermarsi nel bene supremo.', '此三綱領統攝全篇。'
  from clf_classics c where c.slug = 'daxue'
on conflict (classic_id, passage_order) do nothing;

insert into clf_classic_passages
  (classic_id, passage_order, chapter_zh, original, pinyin, vernacular_zh, text_en, text_it, notes_zh)
select c.id, 2, '經一章', '物格而后知至，知至而后意誠，意誠而后心正，心正而后身修，身修而后家齊，家齊而后國治，國治而后天下平。', 'wù gé ér hòu zhī zhì zhī zhì ér hòu yì chéng yì chéng ér hòu xīn zhèng xīn zhèng ér hòu shēn xiū shēn xiū ér hòu jiā qí jiā qí ér hòu guó zhì guó zhì ér hòu tiān xià píng',
       '推究事物之理然後知識到達極致，知識到達然後意念真誠，意念真誠然後心思端正，心思端正然後自身修好，自身修好然後家庭整治，家庭整治然後國家安治，國家安治然後天下太平。', 'Things investigated, knowledge is complete; knowledge complete, the intention becomes sincere; the intention sincere, the mind is set right; the mind right, the self is cultivated; the self cultivated, the family is ordered; the family ordered, the state is governed; the state governed, the world is at peace.', 'Indagate le cose, il sapere giunge a compimento; compiuto il sapere, l’intenzione si fa sincera; sincera l’intenzione, la mente si raddrizza; retta la mente, la persona si coltiva; coltivata la persona, la famiglia si ordina; ordinata la famiglia, lo stato si governa; governato lo stato, il mondo è in pace.', '由修身而至平天下，儒家最著名的因果鏈。'
  from clf_classics c where c.slug = 'daxue'
on conflict (classic_id, passage_order) do nothing;

insert into clf_classic_passages
  (classic_id, passage_order, chapter_zh, original, pinyin, vernacular_zh, text_en, text_it, notes_zh)
select c.id, 1, '學而第一', '子曰：「學而時習之，不亦說乎？有朋自遠方來，不亦樂乎？人不知而不慍，不亦君子乎？」', 'zǐ yuē xué ér shí xí zhī bù yì yuè hū yǒu péng zì yuǎn fāng lái bù yì lè hū rén bù zhī ér bù yùn bù yì jūn zǐ hū',
       '孔子說：「學了又按時溫習實踐，不也喜悅嗎？有朋友從遠方來，不也快樂嗎？別人不了解我而我不惱怒，不也是君子嗎？」', 'The Master said: "To learn and in due time practice what one has learned — is that not a pleasure? To have friends come from afar — is that not a joy? To go unrecognized and feel no resentment — is that not the mark of a noble person?"', 'Il Maestro disse: «Studiare e mettere in pratica a suo tempo ciò che si è appreso — non è forse un piacere? Avere amici che giungono da lontano — non è forse una gioia? Non essere riconosciuti e non provarne rancore — non è forse il segno della persona nobile?»', '全書開篇——為學、交友、不慍，三種最初的喜悅。'
  from clf_classics c where c.slug = 'lunyu'
on conflict (classic_id, passage_order) do nothing;

insert into clf_classic_passages
  (classic_id, passage_order, chapter_zh, original, pinyin, vernacular_zh, text_en, text_it, notes_zh)
select c.id, 2, '述而第七', '子曰：「三人行，必有我師焉。擇其善者而從之，其不善者而改之。」', 'zǐ yuē sān rén xíng bì yǒu wǒ shī yān zé qí shàn zhě ér cóng zhī qí bù shàn zhě ér gǎi zhī',
       '孔子說：「三個人同行，其中必定有可以做我老師的人。選取他們的優點來學習，看到他們的缺點就對照改正自己。」', 'The Master said: "Walking with two others, I am sure to find a teacher among them. I pick out what is good in them and follow it; what is not good, I use to correct myself."', 'Il Maestro disse: «Camminando con altre due persone, vi troverò di certo un maestro. Scelgo ciò che in loro è buono e lo seguo; ciò che non lo è, mi serve per correggermi.»', '人人可為師——或為榜樣，或為鏡鑒。'
  from clf_classics c where c.slug = 'lunyu'
on conflict (classic_id, passage_order) do nothing;

insert into clf_classic_passages
  (classic_id, passage_order, chapter_zh, original, pinyin, vernacular_zh, text_en, text_it, notes_zh)
select c.id, 1, '公孫丑上', '惻隱之心，仁之端也；羞惡之心，義之端也；辭讓之心，禮之端也；是非之心，智之端也。', 'cè yǐn zhī xīn rén zhī duān yě xiū wù zhī xīn yì zhī duān yě cí ràng zhī xīn lǐ zhī duān yě shì fēi zhī xīn zhì zhī duān yě',
       '同情憐憫之心，是仁的發端；羞恥憎惡之心，是義的發端；謙辭禮讓之心，是禮的發端；分辨是非之心，是智的發端。', 'The heart of compassion is the sprout of humaneness; the heart of shame, the sprout of rightness; the heart of deference, the sprout of ritual propriety; the heart that distinguishes right from wrong, the sprout of wisdom.', 'Il cuore della compassione è il germoglio dell’umanità; il cuore della vergogna, il germoglio della rettitudine; il cuore della deferenza, il germoglio del rito; il cuore che distingue il giusto dall’ingiusto, il germoglio della saggezza.', '四端之說——德如萌芽，人皆有之，貴在擴充。'
  from clf_classics c where c.slug = 'mengzi'
on conflict (classic_id, passage_order) do nothing;

insert into clf_classic_passages
  (classic_id, passage_order, chapter_zh, original, pinyin, vernacular_zh, text_en, text_it, notes_zh)
select c.id, 1, '第一章', '天命之謂性，率性之謂道，修道之謂教。', 'tiān mìng zhī wèi xìng shuài xìng zhī wèi dào xiū dào zhī wèi jiào',
       '上天所賦予的叫做性，遵循本性而行叫做道，修明這條道叫做教。', 'What heaven confers is called nature; following that nature is called the way; cultivating the way is called teaching.', 'Ciò che il cielo conferisce si chiama natura; seguire quella natura si chiama via; coltivare la via si chiama insegnamento.', '十二字三定義——儒家經典中最凝練的開篇。'
  from clf_classics c where c.slug = 'zhongyong'
on conflict (classic_id, passage_order) do nothing;

insert into clf_classic_passages
  (classic_id, passage_order, chapter_zh, original, pinyin, vernacular_zh, text_en, text_it, notes_zh)
select c.id, 1, '周南·關雎', '關關雎鳩，在河之洲。窈窕淑女，君子好逑。', 'guān guān jū jiū zài hé zhī zhōu yǎo tiǎo shū nǚ jūn zǐ hǎo qiú',
       '雎鳩鳥關關和鳴，棲在河中的沙洲。文靜美好的女子，是君子理想的配偶。', 'Guan, guan cry the ospreys on the islet in the river. The graceful, virtuous maiden — a fine match for the noble man.', 'Guan, guan gridano i falchi pescatori sull’isolotto del fiume. La fanciulla graziosa e virtuosa — degna compagna dell’uomo nobile.', '三百篇之首——一首情歌，被有意置於全經之先。'
  from clf_classics c where c.slug = 'shijing'
on conflict (classic_id, passage_order) do nothing;

insert into clf_classic_passages
  (classic_id, passage_order, chapter_zh, original, pinyin, vernacular_zh, text_en, text_it, notes_zh)
select c.id, 1, '堯典', '克明俊德，以親九族。九族既睦，平章百姓。', 'kè míng jùn dé yǐ qīn jiǔ zú jiǔ zú jì mù píng zhāng bǎi xìng',
       '堯能夠彰明大德，使九族親愛和睦；九族和睦之後，又辨明彰顯百官族姓，使之各得其所。', 'He was able to make bright his great virtue, and so drew his nine degrees of kindred close; the kindred in harmony, he set in order the many clans of officials.', 'Seppe far risplendere la sua grande virtù, e così unì i nove gradi della sua parentela; armoniosa la parentela, mise ordine tra i molti clan dei funzionari.', '由己德而及天下——《大學》後來系統化的正是這一模式。'
  from clf_classics c where c.slug = 'shangshu'
on conflict (classic_id, passage_order) do nothing;

insert into clf_classic_passages
  (classic_id, passage_order, chapter_zh, original, pinyin, vernacular_zh, text_en, text_it, notes_zh)
select c.id, 1, '禮運', '大道之行也，天下為公。選賢與能，講信修睦。', 'dà dào zhī xíng yě tiān xià wéi gōng xuǎn xián jǔ néng jiǎng xìn xiū mù',
       '大道施行的時代，天下是天下人所共有的。選拔賢德與有才能的人，講求信用，培修和睦。', 'When the Great Way prevailed, the world was held in common. The worthy and the able were chosen for office; good faith was practiced and concord cultivated.', 'Quando prevaleva la Grande Via, il mondo apparteneva a tutti. Si sceglievano i degni e i capaci; si praticava la buona fede e si coltivava la concordia.', '大同章——兩千年來歷代改革者反覆援引，直至孫中山。'
  from clf_classics c where c.slug = 'liji'
on conflict (classic_id, passage_order) do nothing;

insert into clf_classic_passages
  (classic_id, passage_order, chapter_zh, original, pinyin, vernacular_zh, text_en, text_it, notes_zh)
select c.id, 1, '乾·象傳', '天行健，君子以自強不息。', 'tiān xíng jiàn jūn zǐ yǐ zì qiáng bù xī',
       '天道運行剛健不已，君子因此自我奮發，永不止息。', 'Heaven moves with unwearied vigor; the noble person, after its pattern, strengthens the self without rest.', 'Il cielo si muove con vigore instancabile; la persona nobile, a sua immagine, fortifica se stessa senza sosta.', '與「地勢坤，君子以厚德載物」相對，二語合為清華大學校訓。'
  from clf_classics c where c.slug = 'zhouyi'
on conflict (classic_id, passage_order) do nothing;

insert into clf_classic_passages
  (classic_id, passage_order, chapter_zh, original, pinyin, vernacular_zh, text_en, text_it, notes_zh)
select c.id, 2, '繫辭上', '一陰一陽之謂道。', 'yī yīn yī yáng zhī wèi dào',
       '一陰一陽的交替變化，就叫做道。', 'One yin, one yang — that is called the Way.', 'Uno yin, uno yang — questo si chiama la Via.', '六字盡括全經陰陽迭運的宇宙觀。'
  from clf_classics c where c.slug = 'zhouyi'
on conflict (classic_id, passage_order) do nothing;

insert into clf_classic_passages
  (classic_id, passage_order, chapter_zh, original, pinyin, vernacular_zh, text_en, text_it, notes_zh)
select c.id, 1, '隱公元年', '元年，春，王正月。', 'yuán nián chūn wáng zhēng yuè',
       '魯隱公元年，春季，周王曆的正月。', 'The first year, spring, the royal first month.', 'Il primo anno, primavera, il primo mese regale.', '全書首條。六字無事——「王正月」三字何以微言大義，注家聚訟千年。'
  from clf_classics c where c.slug = 'chunqiu'
on conflict (classic_id, passage_order) do nothing;

// src/data/wordsData.js
// Starter words — more added via admin AI auto-generate

export const THEMES = [
  { id:'greetings', emoji:'👋', zh:'问候',    en:'Greetings',  it:'Saluti' },
  { id:'family',    emoji:'👨‍👩‍👧', zh:'家庭',  en:'Family',     it:'Famiglia' },
  { id:'food',      emoji:'🍜', zh:'食物',    en:'Food',       it:'Cibo' },
  { id:'numbers',   emoji:'🔢', zh:'数字',    en:'Numbers',    it:'Numeri' },
  { id:'colors',    emoji:'🎨', zh:'颜色',    en:'Colors',     it:'Colori' },
  { id:'body',      emoji:'👤', zh:'身体',    en:'Body',       it:'Corpo' },
  { id:'time',      emoji:'⏰', zh:'时间',    en:'Time',       it:'Tempo' },
  { id:'travel',    emoji:'✈️', zh:'出行',   en:'Travel',     it:'Viaggio' },
  { id:'general',   emoji:'📚', zh:'通用',    en:'General',    it:'Generale' },
];

// Starter words (admin can add more via AI)
export const STARTER_WORDS = [
  { word_zh:'你好',   pinyin:'nǐ hǎo',    meaning_en:'Hello',           meaning_it:'Ciao',              theme:'greetings', hsk_level:1 },
  { word_zh:'谢谢',   pinyin:'xiè xie',   meaning_en:'Thank you',       meaning_it:'Grazie',            theme:'greetings', hsk_level:1 },
  { word_zh:'再见',   pinyin:'zài jiàn',  meaning_en:'Goodbye',         meaning_it:'Arrivederci',       theme:'greetings', hsk_level:1 },
  { word_zh:'对不起', pinyin:'duì bu qǐ', meaning_en:'Sorry',           meaning_it:'Mi dispiace',       theme:'greetings', hsk_level:1 },
  { word_zh:'没关系', pinyin:'méi guān xi',meaning_en:"It\'s OK",        meaning_it:'Non importa',       theme:'greetings', hsk_level:1 },
  { word_zh:'爸爸',   pinyin:'bà ba',     meaning_en:'Father',          meaning_it:'Papà',              theme:'family',    hsk_level:1 },
  { word_zh:'妈妈',   pinyin:'mā ma',     meaning_en:'Mother',          meaning_it:'Mamma',             theme:'family',    hsk_level:1 },
  { word_zh:'哥哥',   pinyin:'gē ge',     meaning_en:'Older brother',   meaning_it:'Fratello maggiore', theme:'family',    hsk_level:1 },
  { word_zh:'姐姐',   pinyin:'jiě jie',   meaning_en:'Older sister',    meaning_it:'Sorella maggiore',  theme:'family',    hsk_level:1 },
  { word_zh:'米饭',   pinyin:'mǐ fàn',    meaning_en:'Rice',            meaning_it:'Riso',              theme:'food',      hsk_level:1 },
  { word_zh:'面条',   pinyin:'miàn tiáo', meaning_en:'Noodles',         meaning_it:'Spaghetti cinesi',  theme:'food',      hsk_level:1 },
  { word_zh:'水',     pinyin:'shuǐ',      meaning_en:'Water',           meaning_it:'Acqua',             theme:'food',      hsk_level:1 },
  { word_zh:'茶',     pinyin:'chá',       meaning_en:'Tea',             meaning_it:'Tè',                theme:'food',      hsk_level:1 },
  { word_zh:'一',     pinyin:'yī',        meaning_en:'One',             meaning_it:'Uno',               theme:'numbers',   hsk_level:1 },
  { word_zh:'二',     pinyin:'èr',        meaning_en:'Two',             meaning_it:'Due',               theme:'numbers',   hsk_level:1 },
  { word_zh:'三',     pinyin:'sān',       meaning_en:'Three',           meaning_it:'Tre',               theme:'numbers',   hsk_level:1 },
  { word_zh:'红色',   pinyin:'hóng sè',   meaning_en:'Red',             meaning_it:'Rosso',             theme:'colors',    hsk_level:1 },
  { word_zh:'蓝色',   pinyin:'lán sè',    meaning_en:'Blue',            meaning_it:'Blu',               theme:'colors',    hsk_level:1 },
  { word_zh:'今天',   pinyin:'jīn tiān',  meaning_en:'Today',           meaning_it:'Oggi',              theme:'time',      hsk_level:1 },
  { word_zh:'明天',   pinyin:'míng tiān', meaning_en:'Tomorrow',        meaning_it:'Domani',            theme:'time',      hsk_level:1 },
];

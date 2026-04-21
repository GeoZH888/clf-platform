/**
 * src/data/characters.js
 * Progressive learning path — ordered from simplest to most complex.
 * Pedagogical principle: stroke count → visual clarity → compounds.
 *
 * Used as offline fallback while Supabase loads.
 * The DB is the source of truth for full character data.
 */

// Five traditional Chinese calligraphy script styles
// System fonts used where available; Google Fonts as fallback
export const FONTS = [
  {
    name: '楷书', en: 'Kǎishū',
    css: "'STKaiti','KaiTi','KaiTi_GB2312','Ma Shan Zheng',serif",
    desc: '初学首选 · Best for beginners',
    period: '魏晋 Wei-Jin c.200 CE',
    color: '#1976D2',
    note: 'Most systematic — learn this first',
  },
  {
    name: '隶书', en: 'Lìshū',
    css: "'ZCOOL XiaoWei','STLiti','LiSu',serif",
    desc: '汉代官书 · Han Dynasty official',
    period: '汉 Han 206 BCE',
    color: '#2E7D32',
    note: 'Evolved from seal script — flat, wide strokes',
  },
  {
    name: '行书', en: 'Xíngshū',
    css: "'STXingkai','Liu Jian Mao Cao','Long Cang','KaiTi',serif",
    desc: '日常书写 · Everyday writing',
    period: '魏晋 Wei-Jin c.200 CE',
    color: '#E65100',
    note: 'Between regular and cursive — most practical',
  },
  {
    name: '草书', en: 'Cǎoshū',
    css: "'Long Cang','Liu Jian Mao Cao','STKaiti',serif",
    desc: '艺术书法 · Artistic cursive',
    period: '汉 Han onward',
    color: '#6A1B9A',
    note: 'Most expressive — study regular script first',
  },
];

// Each character has:
//   c  — the character
//   p  — pinyin (tone-marked)
//   m  — meaning (English)
//   mz — meaning (中文)
//   mi — meaning (Italiano)
//   strokes — modern stroke count (for ordering)
//   difficulty — 1 easy → 4 hard

export const SETS = [

  // ── 第一关: Pure geometry (1–3 strokes) ─────────────────────
  // These look nothing like pictures — they're pure symbolic.
  // But they're the simplest to write, so they come first.
  {
    id: 'numbers',
    level: 1,
    name: '数字',
    nameEn: 'Numbers',
    nameIt: 'Numeri',
    emoji: '🔢',
    color: '#E3F2FD',
    borderColor: '#1976D2',
    description: '最简单的符号 · Simplest strokes',
    descriptionIt: 'I simboli più semplici',
    chars: [
      { c:'一', p:'yī',   m:'one',   mz:'一，数字1',     mi:'uno',    strokes:1, difficulty:1 },
      { c:'二', p:'èr',   m:'two',   mz:'二，数字2',     mi:'due',    strokes:2, difficulty:1 },
      { c:'三', p:'sān',  m:'three', mz:'三，数字3',     mi:'tre',    strokes:3, difficulty:1 },
      { c:'十', p:'shí',  m:'ten',   mz:'十，数字10',    mi:'dieci',  strokes:2, difficulty:1 },
    ],
  },

  // ── 第二关: Simple pictograms (2–4 strokes, clearly visual) ──
  {
    id: 'simple_pictograms',
    level: 2,
    name: '基础象形',
    nameEn: 'Basic Pictograms',
    nameIt: 'Pittogrammi Base',
    emoji: '🖼',
    color: '#E8F5E9',
    borderColor: '#2E7D32',
    description: '看图识字 · See the shape, know the meaning',
    descriptionIt: 'Vedi la forma, conosci il significato',
    chars: [
      { c:'人', p:'rén',  m:'person',   mz:'人，人类',  mi:'persona',  strokes:2, difficulty:1 },
      { c:'山', p:'shān', m:'mountain', mz:'山，山脉',  mi:'montagna', strokes:3, difficulty:1 },
      { c:'口', p:'kǒu',  m:'mouth',    mz:'口，嘴巴',  mi:'bocca',    strokes:3, difficulty:1 },
      { c:'日', p:'rì',   m:'sun / day',mz:'日，太阳',  mi:'sole',     strokes:4, difficulty:1 },
      { c:'月', p:'yuè',  m:'moon',     mz:'月，月亮',  mi:'luna',     strokes:4, difficulty:1 },
    ],
  },

  // ── 第三关: Nature elements (4+ strokes) ─────────────────────
  {
    id: 'nature',
    level: 3,
    name: '自然',
    nameEn: 'Nature',
    nameIt: 'Natura',
    emoji: '🌿',
    color: '#FFF8E1',
    borderColor: '#F57F17',
    description: '天地万物 · The elements of the world',
    descriptionIt: 'Gli elementi del mondo',
    chars: [
      { c:'木', p:'mù',   m:'tree / wood', mz:'木，树木',   mi:'albero',  strokes:4, difficulty:2 },
      { c:'水', p:'shuǐ', m:'water',       mz:'水，流水',   mi:'acqua',   strokes:4, difficulty:2 },
      { c:'火', p:'huǒ',  m:'fire',        mz:'火，火焰',   mi:'fuoco',   strokes:4, difficulty:2 },
      { c:'土', p:'tǔ',   m:'earth / soil',mz:'土，土地',   mi:'terra',   strokes:3, difficulty:2 },
      { c:'金', p:'jīn',  m:'metal / gold',mz:'金，金属',   mi:'metallo', strokes:8, difficulty:3 },
    ],
  },

  // ── 第四关: Compound ideographs ───────────────────────────────
  // Each one is made from characters already learned!
  {
    id: 'compounds',
    level: 4,
    name: '会意字',
    nameEn: 'Compound Meanings',
    nameIt: 'Ideogrammi Composti',
    emoji: '🔀',
    color: '#FCE4EC',
    borderColor: '#C62828',
    description: '两字合一义 · Two parts, one meaning',
    descriptionIt: 'Due parti, un significato',
    chars: [
      { c:'明', p:'míng', m:'bright',        mz:'明，明亮（日+月）', mi:'luminoso', strokes:8, difficulty:2, compound:'日+月' },
      { c:'休', p:'xiū',  m:'rest',          mz:'休，休息（人+木）', mi:'riposare', strokes:6, difficulty:2, compound:'人+木' },
      { c:'林', p:'lín',  m:'grove',         mz:'林，树林（木+木）', mi:'boschetto',strokes:8, difficulty:2, compound:'木+木' },
      { c:'森', p:'sēn',  m:'forest',        mz:'森，森林（木+木+木）',mi:'foresta',strokes:12, difficulty:3, compound:'木+木+木' },
      { c:'好', p:'hǎo',  m:'good',          mz:'好，好的（女+子）', mi:'buono',    strokes:6, difficulty:2, compound:'女+子' },
    ],
  },

  // ── 第五关: Complex pictograms ────────────────────────────────
  // Animal portraits — highly detailed oracle bone forms
  {
    id: 'animals',
    level: 5,
    name: '动物',
    nameEn: 'Animals',
    nameIt: 'Animali',
    emoji: '🐾',
    color: '#EDE7F6',
    borderColor: '#4527A0',
    description: '甲骨动物图谱 · The oracle bone bestiary',
    descriptionIt: 'Il bestiario delle ossa oracolari',
    chars: [
      { c:'马', p:'mǎ',  m:'horse',  mz:'马，骏马',      mi:'cavallo',    strokes:3,  difficulty:3 },
      { c:'鱼', p:'yú',  m:'fish',   mz:'鱼，鱼类',      mi:'pesce',      strokes:8,  difficulty:3 },
      { c:'龟', p:'guī', m:'turtle', mz:'龟，神圣的龟甲', mi:'tartaruga', strokes:11, difficulty:4 },
      { c:'鸟', p:'niǎo',m:'bird',   mz:'鸟，飞鸟',      mi:'uccello',    strokes:5,  difficulty:3 },
    ],
  },

  // ── 第六关: Ritual & divination ───────────────────────────────
  // The world of the oracle bones themselves
  {
    id: 'ritual',
    level: 6,
    name: '甲骨神道',
    nameEn: 'Oracle & Ritual',
    nameIt: 'Oracoli e Rituali',
    emoji: '🐢',
    color: '#FBE9E7',
    borderColor: '#8B4513',
    description: '商朝占卜文化 · The divination world of the Shang',
    descriptionIt: 'Il mondo della divinazione Shang',
    chars: [
      { c:'王', p:'wáng', m:'king',     mz:'王，国王',   mi:'re',        strokes:4, difficulty:2 },
      { c:'天', p:'tiān', m:'heaven',   mz:'天，天空',   mi:'cielo',     strokes:4, difficulty:2 },
      { c:'帝', p:'dì',   m:'emperor',  mz:'帝，上帝',   mi:'imperatore',strokes:9, difficulty:3 },
      { c:'贞', p:'zhēn', m:'divine',   mz:'贞，占卜',   mi:'divinare',  strokes:9, difficulty:3 },
      { c:'吉', p:'jí',   m:'auspicious',mz:'吉，吉祥',  mi:'propizio',  strokes:6, difficulty:2 },
    ],
  },
];

// Also export as CHARACTER_SETS for backwards compatibility
export const CHARACTER_SETS = SETS;

// Level metadata
export const LEVEL_META = {
  1: { name:'基础', nameEn:'Foundation', nameIt:'Base',         icon:'🌱', desc:'Start here · Comincia qui' },
  2: { name:'入门', nameEn:'Elementary', nameIt:'Elementare',   icon:'📖', desc:'Visual characters · Caratteri visivi' },
  3: { name:'进阶', nameEn:'Intermediate',nameIt:'Intermedio',  icon:'🖌',  desc:'More complex · Più complesso' },
  4: { name:'高阶', nameEn:'Advanced',   nameIt:'Avanzato',     icon:'🏆', desc:'Compound meanings · Composti' },
  5: { name:'大师', nameEn:'Master',     nameIt:'Maestro',      icon:'👑', desc:'Complex forms · Forme complesse' },
};

export const PICTOGRAPH_TYPES = {
  pictogram:         { label:'象形', en:'Pictogram',         it:'Pittogramma',  color:'#B22222' },
  ideogram:          { label:'指事', en:'Ideogram',          it:'Ideogramma',   color:'#2D5FA6' },
  compound_ideogram: { label:'会意', en:'Compound ideogram', it:'Composto',     color:'#2D7A2D' },
  phono_semantic:    { label:'形声', en:'Phono-semantic',    it:'Fono-semantico',color:'#7A4A2D' },
};

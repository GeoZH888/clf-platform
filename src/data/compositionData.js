// src/data/compositionData.js
// 组字 dataset — how characters are built from 义符 (meaning part) + 声符 (sound part).
//
// Every entry here is a 形声字: one component says what family the character belongs to,
// the other says roughly how it sounds. 清 qīng = 氵 (it's about water) + 青 qīng (it sounds
// like qīng). That single principle covers most modern characters, and it is the thing the
// 组字工坊 game teaches — not just "these two shapes stack together".
//
//   c   the character
//   py  its pinyin
//   s   the 义符 / semantic component (glyph — cross-references radicalsData where possible)
//   ph  the 声符 / phonetic component (glyph — see PHONETIC below)
//   l   layout: 'lr' 左右 | 'tb' 上下 | 'encl' 包围
//   o   visual order: 'sp' = semantic first (left/top/outside), 'ps' = phonetic first
//
// Characters are grouped by phonetic component so each 声符 has several children — that is
// what makes 自由组合 mode rewarding: swapping the 义符 on a familiar sound yields discoveries.

import { RADICAL_BY_GLYPH } from './radicalsData.js';

// 声符 — the sound-carrying components. Their own reading is what gets "inherited"
// (sometimes exactly: 青 qīng → 清 qīng; sometimes only loosely: 可 kě → 河 hé).
export const PHONETIC = [
  { p:'青', py:'qīng' }, { p:'寺', py:'sì'   }, { p:'包', py:'bāo' }, { p:'也', py:'yě'  },
  { p:'皮', py:'pí'   }, { p:'白', py:'bái'  }, { p:'工', py:'gōng'}, { p:'者', py:'zhě' },
  { p:'由', py:'yóu'  }, { p:'元', py:'yuán' }, { p:'交', py:'jiāo'}, { p:'兆', py:'zhào'},
  { p:'各', py:'gè'   }, { p:'中', py:'zhōng'}, { p:'良', py:'liáng'},{ p:'马', py:'mǎ'  },
  { p:'可', py:'kě'   }, { p:'生', py:'shēng'},{ p:'反', py:'fǎn' }, { p:'主', py:'zhǔ' },
  { p:'同', py:'tóng' }, { p:'半', py:'bàn'  }, { p:'分', py:'fēn' }, { p:'令', py:'lìng'},
  { p:'昔', py:'xī'   }, { p:'及', py:'jí'   }, { p:'果', py:'guǒ' }, { p:'尚', py:'shàng'},
  { p:'每', py:'měi'  }, { p:'相', py:'xiāng'},
];

// 义符 that are not in radicalsData (手 appears as a full component under 掌, not as 扌).
const EXTRA_SEMANTIC = {
  '手': { py:'shǒu', zh:'手', en:'hand', it:'mano' },
};

export const CHARS = [
  // ── 青 qīng ────────────────────────────────────────────────────────────────
  { c:'清', py:'qīng', s:'氵', ph:'青', l:'lr', o:'sp', zh:'清楚', en:'clear',        it:'chiaro' },
  { c:'情', py:'qíng', s:'忄', ph:'青', l:'lr', o:'sp', zh:'感情', en:'feeling',      it:'sentimento' },
  { c:'请', py:'qǐng', s:'讠', ph:'青', l:'lr', o:'sp', zh:'请',   en:'to invite',    it:'invitare' },
  { c:'晴', py:'qíng', s:'日', ph:'青', l:'lr', o:'sp', zh:'晴天', en:'sunny',        it:'sereno' },
  { c:'睛', py:'jīng', s:'目', ph:'青', l:'lr', o:'sp', zh:'眼睛', en:'eyeball',      it:'globo oculare' },
  { c:'精', py:'jīng', s:'米', ph:'青', l:'lr', o:'sp', zh:'精细', en:'refined',      it:'raffinato' },

  // ── 寺 sì ──────────────────────────────────────────────────────────────────
  { c:'持', py:'chí',  s:'扌', ph:'寺', l:'lr', o:'sp', zh:'坚持', en:'to hold',      it:'tenere' },
  { c:'时', py:'shí',  s:'日', ph:'寺', l:'lr', o:'sp', zh:'时间', en:'time',         it:'tempo' },
  { c:'诗', py:'shī',  s:'讠', ph:'寺', l:'lr', o:'sp', zh:'诗歌', en:'poem',         it:'poesia' },
  { c:'待', py:'dài',  s:'彳', ph:'寺', l:'lr', o:'sp', zh:'等待', en:'to await',     it:'attendere' },
  { c:'等', py:'děng', s:'竹', ph:'寺', l:'tb', o:'sp', zh:'等',   en:'to wait',      it:'aspettare' },

  // ── 包 bāo ─────────────────────────────────────────────────────────────────
  { c:'抱', py:'bào',  s:'扌', ph:'包', l:'lr', o:'sp', zh:'拥抱', en:'to hug',       it:'abbracciare' },
  { c:'跑', py:'pǎo',  s:'足', ph:'包', l:'lr', o:'sp', zh:'跑步', en:'to run',       it:'correre' },
  { c:'泡', py:'pào',  s:'氵', ph:'包', l:'lr', o:'sp', zh:'泡沫', en:'bubble',       it:'bolla' },
  { c:'饱', py:'bǎo',  s:'饣', ph:'包', l:'lr', o:'sp', zh:'吃饱', en:'full (fed)',   it:'sazio' },
  { c:'炮', py:'pào',  s:'火', ph:'包', l:'lr', o:'sp', zh:'大炮', en:'cannon',       it:'cannone' },
  { c:'袍', py:'páo',  s:'衤', ph:'包', l:'lr', o:'sp', zh:'长袍', en:'robe',         it:'toga' },

  // ── 也 yě ──────────────────────────────────────────────────────────────────
  { c:'他', py:'tā',   s:'亻', ph:'也', l:'lr', o:'sp', zh:'他',   en:'he',           it:'lui' },
  { c:'她', py:'tā',   s:'女', ph:'也', l:'lr', o:'sp', zh:'她',   en:'she',          it:'lei' },
  { c:'地', py:'dì',   s:'土', ph:'也', l:'lr', o:'sp', zh:'地方', en:'ground',       it:'terra' },
  { c:'池', py:'chí',  s:'氵', ph:'也', l:'lr', o:'sp', zh:'池塘', en:'pond',         it:'stagno' },
  { c:'驰', py:'chí',  s:'马', ph:'也', l:'lr', o:'sp', zh:'奔驰', en:'to gallop',    it:'galoppare' },

  // ── 皮 pí ──────────────────────────────────────────────────────────────────
  { c:'波', py:'bō',   s:'氵', ph:'皮', l:'lr', o:'sp', zh:'波浪', en:'wave',         it:'onda' },
  { c:'破', py:'pò',   s:'石', ph:'皮', l:'lr', o:'sp', zh:'破',   en:'broken',       it:'rotto' },
  { c:'被', py:'bèi',  s:'衤', ph:'皮', l:'lr', o:'sp', zh:'被子', en:'quilt; by',    it:'coperta' },
  { c:'披', py:'pī',   s:'扌', ph:'皮', l:'lr', o:'sp', zh:'披上', en:'to drape on',  it:'drappeggiare' },
  { c:'疲', py:'pí',   s:'疒', ph:'皮', l:'encl',o:'sp', zh:'疲劳', en:'tired',        it:'stanco' },

  // ── 白 bái ─────────────────────────────────────────────────────────────────
  { c:'拍', py:'pāi',  s:'扌', ph:'白', l:'lr', o:'sp', zh:'拍手', en:'to clap',      it:'battere le mani' },
  { c:'怕', py:'pà',   s:'忄', ph:'白', l:'lr', o:'sp', zh:'害怕', en:'to fear',      it:'temere' },
  { c:'泊', py:'bó',   s:'氵', ph:'白', l:'lr', o:'sp', zh:'停泊', en:'to moor',      it:'ormeggiare' },
  { c:'柏', py:'bǎi',  s:'木', ph:'白', l:'lr', o:'sp', zh:'柏树', en:'cypress',      it:'cipresso' },
  { c:'伯', py:'bó',   s:'亻', ph:'白', l:'lr', o:'sp', zh:'伯伯', en:'uncle',        it:'zio' },

  // ── 工 gōng ────────────────────────────────────────────────────────────────
  { c:'江', py:'jiāng',s:'氵', ph:'工', l:'lr', o:'sp', zh:'长江', en:'river',        it:'fiume' },
  { c:'红', py:'hóng', s:'纟', ph:'工', l:'lr', o:'sp', zh:'红色', en:'red',          it:'rosso' },
  { c:'空', py:'kōng', s:'穴', ph:'工', l:'tb', o:'sp', zh:'空气', en:'empty, sky',   it:'vuoto, cielo' },
  { c:'功', py:'gōng', s:'力', ph:'工', l:'lr', o:'ps', zh:'成功', en:'merit',        it:'merito' },
  { c:'攻', py:'gōng', s:'攵', ph:'工', l:'lr', o:'ps', zh:'进攻', en:'to attack',    it:'attaccare' },

  // ── 者 zhě ─────────────────────────────────────────────────────────────────
  { c:'都', py:'dōu',  s:'阝', ph:'者', l:'lr', o:'ps', zh:'都',   en:'all; capital', it:'tutti' },
  { c:'猪', py:'zhū',  s:'犭', ph:'者', l:'lr', o:'sp', zh:'猪',   en:'pig',          it:'maiale' },
  { c:'煮', py:'zhǔ',  s:'灬', ph:'者', l:'tb', o:'ps', zh:'煮',   en:'to boil',      it:'bollire' },
  { c:'著', py:'zhù',  s:'艹', ph:'者', l:'tb', o:'sp', zh:'著作', en:'to author',    it:'comporre' },
  { c:'诸', py:'zhū',  s:'讠', ph:'者', l:'lr', o:'sp', zh:'诸位', en:'various',      it:'vari' },

  // ── 由 yóu ─────────────────────────────────────────────────────────────────
  { c:'油', py:'yóu',  s:'氵', ph:'由', l:'lr', o:'sp', zh:'油',   en:'oil',          it:'olio' },
  { c:'抽', py:'chōu', s:'扌', ph:'由', l:'lr', o:'sp', zh:'抽出', en:'to pull out',  it:'estrarre' },
  { c:'袖', py:'xiù',  s:'衤', ph:'由', l:'lr', o:'sp', zh:'袖子', en:'sleeve',       it:'manica' },
  { c:'邮', py:'yóu',  s:'阝', ph:'由', l:'lr', o:'ps', zh:'邮件', en:'mail',         it:'posta' },
  { c:'笛', py:'dí',   s:'竹', ph:'由', l:'tb', o:'sp', zh:'笛子', en:'flute',        it:'flauto' },

  // ── 元 yuán ────────────────────────────────────────────────────────────────
  { c:'园', py:'yuán', s:'囗', ph:'元', l:'encl',o:'sp', zh:'公园', en:'garden',       it:'giardino' },
  { c:'远', py:'yuǎn', s:'辶', ph:'元', l:'encl',o:'sp', zh:'远',   en:'far',          it:'lontano' },
  { c:'玩', py:'wán',  s:'王', ph:'元', l:'lr', o:'sp', zh:'玩',   en:'to play',      it:'giocare' },
  { c:'完', py:'wán',  s:'宀', ph:'元', l:'tb', o:'sp', zh:'完成', en:'to finish',    it:'finire' },

  // ── 交 jiāo ────────────────────────────────────────────────────────────────
  { c:'校', py:'xiào', s:'木', ph:'交', l:'lr', o:'sp', zh:'学校', en:'school',       it:'scuola' },
  { c:'较', py:'jiào', s:'车', ph:'交', l:'lr', o:'sp', zh:'比较', en:'to compare',   it:'confrontare' },
  { c:'郊', py:'jiāo', s:'阝', ph:'交', l:'lr', o:'ps', zh:'郊区', en:'suburb',       it:'periferia' },
  { c:'饺', py:'jiǎo', s:'饣', ph:'交', l:'lr', o:'sp', zh:'饺子', en:'dumpling',     it:'raviolo' },

  // ── 兆 zhào ────────────────────────────────────────────────────────────────
  { c:'跳', py:'tiào', s:'足', ph:'兆', l:'lr', o:'sp', zh:'跳',   en:'to jump',      it:'saltare' },
  { c:'挑', py:'tiāo', s:'扌', ph:'兆', l:'lr', o:'sp', zh:'挑选', en:'to pick',      it:'scegliere' },
  { c:'桃', py:'táo',  s:'木', ph:'兆', l:'lr', o:'sp', zh:'桃子', en:'peach',        it:'pesca' },
  { c:'逃', py:'táo',  s:'辶', ph:'兆', l:'encl',o:'sp', zh:'逃跑', en:'to flee',      it:'fuggire' },

  // ── 各 gè ──────────────────────────────────────────────────────────────────
  { c:'客', py:'kè',   s:'宀', ph:'各', l:'tb', o:'sp', zh:'客人', en:'guest',        it:'ospite' },
  { c:'路', py:'lù',   s:'足', ph:'各', l:'lr', o:'sp', zh:'路',   en:'road',         it:'strada' },
  { c:'格', py:'gé',   s:'木', ph:'各', l:'lr', o:'sp', zh:'格子', en:'grid',         it:'griglia' },
  { c:'落', py:'luò',  s:'艹', ph:'各', l:'tb', o:'sp', zh:'落下', en:'to fall',      it:'cadere' },

  // ── 中 zhōng ───────────────────────────────────────────────────────────────
  { c:'冲', py:'chōng',s:'氵', ph:'中', l:'lr', o:'sp', zh:'冲',   en:'to rush',      it:'precipitarsi' },
  { c:'忠', py:'zhōng',s:'心', ph:'中', l:'tb', o:'ps', zh:'忠心', en:'loyal',        it:'leale' },
  { c:'种', py:'zhǒng',s:'禾', ph:'中', l:'lr', o:'sp', zh:'种子', en:'seed, kind',   it:'seme, tipo' },
  { c:'钟', py:'zhōng',s:'钅', ph:'中', l:'lr', o:'sp', zh:'钟',   en:'clock, bell',  it:'orologio' },

  // ── 良 liáng ───────────────────────────────────────────────────────────────
  { c:'娘', py:'niáng',s:'女', ph:'良', l:'lr', o:'sp', zh:'姑娘', en:'young woman',  it:'ragazza' },
  { c:'浪', py:'làng', s:'氵', ph:'良', l:'lr', o:'sp', zh:'海浪', en:'wave',         it:'onda' },
  { c:'狼', py:'láng', s:'犭', ph:'良', l:'lr', o:'sp', zh:'狼',   en:'wolf',         it:'lupo' },
  { c:'粮', py:'liáng',s:'米', ph:'良', l:'lr', o:'sp', zh:'粮食', en:'grain, food',  it:'cereali' },

  // ── 马 mǎ ──────────────────────────────────────────────────────────────────
  { c:'妈', py:'mā',   s:'女', ph:'马', l:'lr', o:'sp', zh:'妈妈', en:'mother',       it:'mamma' },
  { c:'吗', py:'ma',   s:'口', ph:'马', l:'lr', o:'sp', zh:'吗',   en:'question word',it:'particella' },
  { c:'码', py:'mǎ',   s:'石', ph:'马', l:'lr', o:'sp', zh:'号码', en:'code, number', it:'codice' },
  { c:'蚂', py:'mǎ',   s:'虫', ph:'马', l:'lr', o:'sp', zh:'蚂蚁', en:'ant',          it:'formica' },

  // ── 可 kě ──────────────────────────────────────────────────────────────────
  { c:'河', py:'hé',   s:'氵', ph:'可', l:'lr', o:'sp', zh:'河流', en:'river',        it:'fiume' },
  { c:'何', py:'hé',   s:'亻', ph:'可', l:'lr', o:'sp', zh:'如何', en:'what, how',    it:'come' },
  { c:'呵', py:'hē',   s:'口', ph:'可', l:'lr', o:'sp', zh:'呵护', en:'to breathe on',it:'soffiare' },

  // ── 生 shēng ───────────────────────────────────────────────────────────────
  { c:'姓', py:'xìng', s:'女', ph:'生', l:'lr', o:'sp', zh:'姓名', en:'surname',      it:'cognome' },
  { c:'性', py:'xìng', s:'忄', ph:'生', l:'lr', o:'sp', zh:'性格', en:'nature',       it:'indole' },
  { c:'星', py:'xīng', s:'日', ph:'生', l:'tb', o:'sp', zh:'星星', en:'star',         it:'stella' },

  // ── 反 fǎn ─────────────────────────────────────────────────────────────────
  { c:'饭', py:'fàn',  s:'饣', ph:'反', l:'lr', o:'sp', zh:'米饭', en:'meal, rice',   it:'pasto' },
  { c:'板', py:'bǎn',  s:'木', ph:'反', l:'lr', o:'sp', zh:'木板', en:'board',        it:'asse' },
  { c:'返', py:'fǎn',  s:'辶', ph:'反', l:'encl',o:'sp', zh:'返回', en:'to return',    it:'tornare' },

  // ── 主 zhǔ ─────────────────────────────────────────────────────────────────
  { c:'住', py:'zhù',  s:'亻', ph:'主', l:'lr', o:'sp', zh:'住',   en:'to live',      it:'abitare' },
  { c:'注', py:'zhù',  s:'氵', ph:'主', l:'lr', o:'sp', zh:'注意', en:'to pour, note',it:'versare' },
  { c:'柱', py:'zhù',  s:'木', ph:'主', l:'lr', o:'sp', zh:'柱子', en:'pillar',       it:'colonna' },

  // ── 同 tóng ────────────────────────────────────────────────────────────────
  { c:'洞', py:'dòng', s:'氵', ph:'同', l:'lr', o:'sp', zh:'山洞', en:'cave',         it:'grotta' },
  { c:'铜', py:'tóng', s:'钅', ph:'同', l:'lr', o:'sp', zh:'铜',   en:'copper',       it:'rame' },
  { c:'桐', py:'tóng', s:'木', ph:'同', l:'lr', o:'sp', zh:'梧桐', en:'paulownia',    it:'paulonia' },

  // ── 半 bàn ─────────────────────────────────────────────────────────────────
  { c:'伴', py:'bàn',  s:'亻', ph:'半', l:'lr', o:'sp', zh:'同伴', en:'companion',    it:'compagno' },
  { c:'拌', py:'bàn',  s:'扌', ph:'半', l:'lr', o:'sp', zh:'搅拌', en:'to mix',       it:'mescolare' },
  { c:'判', py:'pàn',  s:'刂', ph:'半', l:'lr', o:'ps', zh:'判断', en:'to judge',     it:'giudicare' },

  // ── 分 fēn ─────────────────────────────────────────────────────────────────
  { c:'份', py:'fèn',  s:'亻', ph:'分', l:'lr', o:'sp', zh:'一份', en:'portion',      it:'porzione' },
  { c:'粉', py:'fěn',  s:'米', ph:'分', l:'lr', o:'sp', zh:'面粉', en:'powder',       it:'polvere' },
  { c:'纷', py:'fēn',  s:'纟', ph:'分', l:'lr', o:'sp', zh:'纷乱', en:'numerous',     it:'numeroso' },

  // ── 令 lìng ────────────────────────────────────────────────────────────────
  { c:'冷', py:'lěng', s:'冫', ph:'令', l:'lr', o:'sp', zh:'冷',   en:'cold',         it:'freddo' },
  { c:'领', py:'lǐng', s:'页', ph:'令', l:'lr', o:'ps', zh:'领导', en:'collar, lead', it:'colletto, guidare' },
  { c:'铃', py:'líng', s:'钅', ph:'令', l:'lr', o:'sp', zh:'铃铛', en:'bell',         it:'campanello' },

  // ── 昔 xī ──────────────────────────────────────────────────────────────────
  { c:'借', py:'jiè',  s:'亻', ph:'昔', l:'lr', o:'sp', zh:'借',   en:'to borrow',    it:'prendere in prestito' },
  { c:'错', py:'cuò',  s:'钅', ph:'昔', l:'lr', o:'sp', zh:'错误', en:'wrong',        it:'sbagliato' },
  { c:'惜', py:'xī',   s:'忄', ph:'昔', l:'lr', o:'sp', zh:'珍惜', en:'to cherish',   it:'aver caro' },

  // ── 及 jí ──────────────────────────────────────────────────────────────────
  { c:'极', py:'jí',   s:'木', ph:'及', l:'lr', o:'sp', zh:'极了', en:'extreme',      it:'estremo' },
  { c:'级', py:'jí',   s:'纟', ph:'及', l:'lr', o:'sp', zh:'年级', en:'level, grade', it:'livello' },
  { c:'吸', py:'xī',   s:'口', ph:'及', l:'lr', o:'sp', zh:'呼吸', en:'to inhale',    it:'inalare' },

  // ── 果 guǒ ─────────────────────────────────────────────────────────────────
  { c:'课', py:'kè',   s:'讠', ph:'果', l:'lr', o:'sp', zh:'上课', en:'lesson',       it:'lezione' },
  { c:'棵', py:'kē',   s:'木', ph:'果', l:'lr', o:'sp', zh:'一棵树',en:'(for plants)', it:'(per piante)' },
  { c:'颗', py:'kē',   s:'页', ph:'果', l:'lr', o:'ps', zh:'一颗星',en:'(for beads)',  it:'(per grani)' },

  // ── 尚 shàng ───────────────────────────────────────────────────────────────
  { c:'常', py:'cháng',s:'巾', ph:'尚', l:'tb', o:'ps', zh:'常常', en:'often',        it:'spesso' },
  { c:'堂', py:'táng', s:'土', ph:'尚', l:'tb', o:'ps', zh:'课堂', en:'hall',         it:'sala' },
  { c:'掌', py:'zhǎng',s:'手', ph:'尚', l:'tb', o:'ps', zh:'手掌', en:'palm',         it:'palmo' },

  // ── 每 měi / 相 xiāng ──────────────────────────────────────────────────────
  { c:'海', py:'hǎi',  s:'氵', ph:'每', l:'lr', o:'sp', zh:'大海', en:'sea',          it:'mare' },
  { c:'梅', py:'méi',  s:'木', ph:'每', l:'lr', o:'sp', zh:'梅花', en:'plum',         it:'susino' },
  { c:'想', py:'xiǎng',s:'心', ph:'相', l:'tb', o:'ps', zh:'想',   en:'to think',     it:'pensare' },
  { c:'箱', py:'xiāng',s:'竹', ph:'相', l:'tb', o:'sp', zh:'箱子', en:'box',          it:'scatola' },
];

// ── Derived lookups ────────────────────────────────────────────────────────────

// '氵+可' → the 河 entry. 自由组合 mode checks every tap against this.
export const BY_PAIR = Object.fromEntries(CHARS.map(x => [`${x.s}+${x.ph}`, x]));

export const PHONETIC_BY_GLYPH = Object.fromEntries(PHONETIC.map(p => [p.p, p]));

// Every 义符 actually used, with its reading and gloss pulled from radicalsData so the
// two datasets can't drift apart.
export const SEMANTIC = [...new Set(CHARS.map(x => x.s))].map(g => {
  const r = RADICAL_BY_GLYPH[g];
  if (r) return { p:g, py:r.py, zh:r.mean_zh, en:r.mean_en, it:r.mean_it };
  const e = EXTRA_SEMANTIC[g];
  return { p:g, py:e.py, zh:e.zh, en:e.en, it:e.it };
});

export const SEMANTIC_BY_GLYPH = Object.fromEntries(SEMANTIC.map(s => [s.p, s]));

export function charGloss(x, lang) {
  return lang === 'zh' ? x.zh : lang === 'it' ? (x.it || x.en) : x.en;
}
export function partGloss(p, lang) {
  return lang === 'zh' ? p.zh : lang === 'it' ? (p.it || p.en) : p.en;
}

// Parts in the order they are actually written, so slots match the real character shape.
export function orderedParts(x) {
  const sem = { glyph:x.s,  role:'s'  };
  const pho = { glyph:x.ph, role:'ph' };
  return x.o === 'ps' ? [pho, sem] : [sem, pho];
}

// src/games/LianLianKan.jsx
//
// 连连看 — tap two cards that belong together and they clear.
//
// One engine, two decks. The mechanic is identical for radicals and for pinyin;
// only what counts as a pair differs, so the game logic lives here once and the
// decks are data.
//
//   radical  亻 ↔ 单人旁      a radical and its name
//   pinyin   b  ↔ 爸 bā       a sound and a syllable that uses it
//
// Pairs are drawn from the same datasets the other drills use (radicalsData,
// pinyinData), so anything added there appears here without further work.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLang } from '../context/LanguageContext.jsx';
import { usePhone } from '../hooks/useMediaQuery';
import { RADICALS } from '../data/radicalsData.js';
import { INITIALS, FINALS } from '../data/pinyinData.js';
import { recordLearning } from '../lib/learningLog.js';

const PAIRS_PER_ROUND = 6;   // 12 cards — fits a phone without scrolling

const P = {
  bg:     'linear-gradient(160deg, #fdf6e3 0%, #f5e6c8 50%, #f0d9b5 100%)',
  ink:'#1a0a05', ink2:'#6b4c2a', ink3:'#a07850',
};

const VARIANTS = {
  radical: {
    accent:'#7c3aed', soft:'#c4b5fd', tint:'#ede9fe',
    title: { zh:'部首连连看', en:'Radical match', it:'Abbina i radicali' },
    hint:  { zh:'把偏旁和它的名字配成一对',
             en:'Pair each radical with its name',
             it:'Abbina ogni radicale al suo nome' },
    build: (lang) => shuffle(RADICALS)
      .slice(0, PAIRS_PER_ROUND)
      .map(r => ({
        key:   r.r,
        left:  r.r,
        right: lang === 'zh' ? r.name_zh : lang === 'it' ? (r.name_it || r.name_en) : r.name_en,
        // Shown after a correct match — the reason the pair belongs together.
        note:  lang === 'zh' ? r.mean_zh : lang === 'it' ? (r.mean_it || r.mean_en) : r.mean_en,
      })),
  },
  pinyin: {
    accent:'#0369a1', soft:'#7dd3fc', tint:'#e0f2fe',
    title: { zh:'拼音连连看', en:'Pinyin match', it:'Abbina il pinyin' },
    hint:  { zh:'把声母韵母和例字配成一对',
             en:'Pair each sound with a syllable that uses it',
             it:'Abbina ogni suono a una sillaba' },
    // Initials and finals together: a round mixing 声母 and 韵母 is what makes
    // the distinction stick, rather than drilling each in isolation.
    build: () => shuffle([...INITIALS, ...FINALS].filter(s => s.eg))
      .slice(0, PAIRS_PER_ROUND)
      .map(s => ({
        key:   s.py,
        left:  s.py,
        right: s.eg,          // e.g. '爸 bā'
        note:  s.ipa ? `/${s.ipa}/` : '',
      })),
  },
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Two cards per pair, shuffled together so left and right are intermixed. */
function dealCards(pairs) {
  return shuffle(pairs.flatMap(p => ([
    { id: `${p.key}::L`, key: p.key, text: p.left,  side: 'L', note: p.note },
    { id: `${p.key}::R`, key: p.key, text: p.right, side: 'R', note: p.note },
  ])));
}

export default function LianLianKan({ variant = 'radical', onBack }) {
  const { lang } = useLang();
  const L = lang === 'en' || lang === 'it' ? lang : 'zh';
  const isPhone = usePhone();
  const V = VARIANTS[variant] || VARIANTS.radical;

  const [round,   setRound]   = useState(0);
  const [cards,   setCards]   = useState([]);
  const [picked,  setPicked]  = useState([]);   // ids currently selected
  const [cleared, setCleared] = useState([]);   // ids already matched
  const [wrong,   setWrong]   = useState([]);   // ids flashing red
  const [moves,   setMoves]   = useState(0);
  const [lastNote, setLastNote] = useState('');

  const pairs = useMemo(() => V.build(L), [V, L, round]);

  useEffect(() => {
    setCards(dealCards(pairs));
    setPicked([]); setCleared([]); setWrong([]); setMoves(0); setLastNote('');
  }, [pairs]);

  const done = cards.length > 0 && cleared.length === cards.length;

  // Perfect play is one move per pair; every extra move is a mistake.
  useEffect(() => {
    if (!done) return;
    const perfect = pairs.length;
    const score = Math.max(0, Math.round(100 * perfect / Math.max(moves, perfect)));
    recordLearning({
      module: variant === 'pinyin' ? 'pinyin' : 'radicals',
      itemType: 'match_round',
      itemId: pairs.map(p => p.key).join(','),
      event: 'quiz',
      correct: moves === perfect,
      score,
      meta: { moves, pairs: perfect, game: 'lianliankan' },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const tap = useCallback((card) => {
    if (cleared.includes(card.id) || picked.includes(card.id) || picked.length === 2) return;

    const next = [...picked, card.id];
    setPicked(next);
    if (next.length < 2) return;

    setMoves(m => m + 1);
    const [aId, bId] = next;
    const a = cards.find(c => c.id === aId);
    const b = cards.find(c => c.id === bId);

    // A pair is the same key from opposite sides — tapping both halves of the
    // same side is not a match even though the keys agree.
    if (a && b && a.key === b.key && a.side !== b.side) {
      setCleared(c => [...c, aId, bId]);
      setLastNote(a.note || '');
      setPicked([]);
    } else {
      setWrong(next);
      setTimeout(() => { setWrong([]); setPicked([]); }, 600);
    }
  }, [cards, cleared, picked]);

  const t = (o) => o?.[L] ?? o?.zh ?? '';

  return (
    <div style={{ minHeight:'100dvh', background:P.bg, color:P.ink }}>
      <header style={{
        padding: isPhone ? '12px 16px' : '18px 24px',
        paddingTop: `calc(${isPhone ? 12 : 18}px + var(--safe-top))`,
        background:`linear-gradient(90deg, ${V.accent} 0%, ${V.accent}cc 100%)`,
        color:'#fff', display:'flex', alignItems:'center', gap:10,
      }}>
        <button onClick={onBack} aria-label="Back" style={{
          background:'rgba(255,255,255,0.15)', color:'#fff',
          border:'1px solid rgba(255,255,255,0.3)', width:32, height:32,
          borderRadius:16, padding:0, cursor:'pointer', fontSize:16,
        }}>‹</button>
        <div style={{ fontSize: isPhone ? 18 : 22, fontWeight:700,
          fontFamily:"'STKaiti','KaiTi',serif", letterSpacing: isPhone ? 2 : 3 }}>
          {t(V.title)}
        </div>
        <div style={{ flex:1 }}/>
        <div style={{ fontSize:12, opacity:0.9 }}>
          {cleared.length / 2} / {pairs.length}
        </div>
      </header>

      <main style={{ padding: isPhone ? '16px 14px 40px' : '24px 28px 48px',
        maxWidth:620, margin:'0 auto' }}>

        <div style={{ fontSize:13, color:P.ink2, textAlign:'center', marginBottom:14 }}>
          {t(V.hint)}
        </div>

        <div style={{
          display:'grid',
          gridTemplateColumns:`repeat(${isPhone ? 3 : 4}, 1fr)`,
          gap: isPhone ? 8 : 12,
        }}>
          {cards.map(card => {
            const isCleared = cleared.includes(card.id);
            const isPicked  = picked.includes(card.id);
            const isWrong   = wrong.includes(card.id);
            // Cleared cards stay in place rather than reflowing the grid —
            // tiles jumping under a child's finger mid-round is disorienting.
            return (
              <button key={card.id} onClick={() => tap(card)} disabled={isCleared}
                style={{
                  aspectRatio:'1 / 1',
                  borderRadius:14,
                  border:`2px solid ${isWrong ? '#ef9a9a' : isPicked ? V.accent : V.soft}`,
                  background: isCleared ? 'transparent'
                            : isWrong   ? '#ffebee'
                            : isPicked  ? V.tint : '#fff',
                  opacity: isCleared ? 0.18 : 1,
                  cursor: isCleared ? 'default' : 'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  padding:4,
                  fontFamily:"'STKaiti','KaiTi',serif",
                  fontSize: card.text.length > 3 ? (isPhone ? 14 : 17) : (isPhone ? 24 : 30),
                  fontWeight:600,
                  color: isWrong ? '#b71c1c' : V.accent,
                  lineHeight:1.25,
                  transition:'opacity .25s, background .15s, border-color .15s',
                  WebkitTapHighlightColor:'transparent',
                  touchAction:'manipulation',
                }}>
                {isCleared ? '' : card.text}
              </button>
            );
          })}
        </div>

        {lastNote && !done && (
          <div style={{ marginTop:14, textAlign:'center', fontSize:13, color:P.ink2 }}>
            ✓ {lastNote}
          </div>
        )}

        {done && (
          <div style={{ marginTop:18, background:'#fff', border:`1.5px solid ${V.soft}`,
            borderRadius:16, padding:'18px 16px', textAlign:'center' }}>
            <div style={{ fontSize:30, marginBottom:6 }}>
              {moves === pairs.length ? '🏆' : '🎉'}
            </div>
            <div style={{ fontSize:16, fontWeight:700, color:V.accent }}>
              {moves === pairs.length
                ? (L === 'zh' ? '全对，一次都没错！' : L === 'it' ? 'Perfetto!' : 'Perfect — no mistakes!')
                : (L === 'zh' ? `完成！用了 ${moves} 次` : L === 'it' ? `Fatto in ${moves} mosse` : `Done in ${moves} moves`)}
            </div>
            <button onClick={() => setRound(r => r + 1)} style={{
              marginTop:14, width:'100%', padding:'13px', borderRadius:12,
              border:'none', background:V.accent, color:'#fff',
              fontSize:15, fontWeight:700, fontFamily:'inherit', cursor:'pointer',
            }}>
              {L === 'zh' ? '再来一局' : L === 'it' ? 'Ancora' : 'Play again'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

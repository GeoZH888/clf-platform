// src/classics/ClassicsApp.jsx
//
// 四书五经 — read the original, open a modern rendering, hear it read aloud.
//
// The nine books are a fixed set and come seeded, so the module is never an
// empty screen: even before a single passage is written, a learner can see what
// 四书五经 *is* and what each book covers, in their own language. Passages fill
// in over time.
//
// Classical text is the one place on this platform where traditional characters
// belong — that is how these works are transmitted — so a book carries both
// forms and the reader shows whichever matches what it is displaying.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useLang } from '../context/LanguageContext.jsx';
import { usePhone } from '../hooks/useMediaQuery';
import { recordLearning } from '../lib/learningLog.js';

const P = {
  bg:     'linear-gradient(160deg, #1c1917 0%, #292524 55%, #1c1917 100%)',
  card:   '#292524',
  edge:   '#44403c',
  ink:    '#f5f0e6',
  ink2:   '#c8bfae',
  ink3:   '#8a8177',
  accent: '#c9a227',   // aged gold — these are the oldest things in the app
  sishu:  '#7dd3fc',
  wujing: '#fca5a5',
};

const STR = {
  title:    { zh:'四书五经', en:'Four Books & Five Classics', it:'Quattro Libri e Cinque Classici' },
  blurb:    { zh:'曾经人人成诵的经典。阅读原文,展开白话理解,并可聆听诵读。',
              en:'Texts once known by heart. Read the original, open a modern rendering, and listen.',
              it:'Testi un tempo saputi a memoria. Leggi l\'originale, apri una resa moderna, ascolta.' },
  sishu:    { zh:'四书', en:'The Four Books', it:'I Quattro Libri' },
  wujing:   { zh:'五经', en:'The Five Classics', it:'I Cinque Classici' },
  original: { zh:'原文', en:'Original', it:'Originale' },
  plain:    { zh:'白话', en:'In plain Chinese', it:'In cinese moderno' },
  meaning:  { zh:'释义', en:'Meaning', it:'Significato' },
  notes:    { zh:'注解', en:'Notes', it:'Note' },
  listen:   { zh:'诵读', en:'Listen', it:'Ascolta' },
  stop:     { zh:'停止', en:'Stop', it:'Ferma' },
  empty:    { zh:'这一部还没有录入选段。', en:'No passages entered for this book yet.',
              it:'Nessun brano inserito per questo libro.' },
  loading:  { zh:'加载中…', en:'Loading…', it:'Caricamento…' },
  trad:     { zh:'繁体', en:'Traditional', it:'Tradizionale' },
};
const tr = (L, k) => STR[k]?.[L] ?? STR[k]?.zh ?? k;

export default function ClassicsApp({ onBack }) {
  const { lang } = useLang();
  const L = lang === 'en' || lang === 'it' ? lang : 'zh';
  const isPhone = usePhone();

  const [books, setBooks] = useState(null);
  const [open,  setOpen]  = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('clf_classics')
        .select('*')
        .eq('is_published', true)
        .order('order_idx', { ascending: true });
      setBooks(data || []);
    })();
  }, []);

  const titleOf = b => (L === 'en' && b.title_en) || (L === 'it' && b.title_it) || b.title_zh;
  const summaryOf = b => (L === 'en' && b.summary_en) || (L === 'it' && b.summary_it) || b.summary_zh || '';

  return (
    <div style={{ minHeight:'100dvh', background:P.bg, color:P.ink }}>
      <header style={{
        padding: isPhone ? '14px 18px' : '22px 28px',
        paddingTop: `calc(${isPhone ? 14 : 22}px + var(--safe-top))`,
        display:'flex', alignItems:'center', gap:12,
        borderBottom:`1px solid ${P.edge}`,
      }}>
        <button onClick={() => (open ? setOpen(null) : onBack?.())} aria-label="Back"
          style={{ background:'transparent', color:P.ink2, border:`1px solid ${P.edge}`,
            width:32, height:32, borderRadius:16, padding:0, cursor:'pointer', fontSize:16 }}>‹</button>
        <div style={{ fontSize: isPhone ? 22 : 30, fontWeight:400,
          fontFamily:"'STKaiti','KaiTi',serif", letterSpacing: isPhone ? 3 : 6, color:P.ink }}>
          {open ? titleOf(open) : tr(L, 'title')}
        </div>
      </header>

      <main style={{ padding: isPhone ? '20px 18px 48px' : '30px 28px 60px',
        maxWidth:780, margin:'0 auto' }}>
        {books === null && <div style={{ color:P.ink3 }}>{tr(L,'loading')}</div>}

        {books && !open && (
          <>
            <p style={{ color:P.ink2, fontSize: isPhone ? 13 : 14, lineHeight:1.9, marginTop:0 }}>
              {tr(L, 'blurb')}
            </p>
            {['sishu', 'wujing'].map(group => {
              const list = books.filter(b => b.collection === group);
              if (!list.length) return null;
              return (
                <section key={group} style={{ marginTop: isPhone ? 28 : 38 }}>
                  <div style={{ fontSize:12, letterSpacing:4, color:P[group],
                    fontFamily:"'STKaiti','KaiTi',serif", marginBottom:10 }}>
                    {tr(L, group)}
                  </div>
                  {list.map(b => (
                    <button key={b.id} onClick={() => setOpen(b)} style={{
                      display:'block', width:'100%', textAlign:'left',
                      background:'transparent', border:'none',
                      borderBottom:`1px solid ${P.edge}`,
                      padding: isPhone ? '16px 2px' : '20px 4px',
                      cursor:'pointer', color:P.ink, fontFamily:'inherit',
                      WebkitTapHighlightColor:'transparent',
                    }}>
                      <div style={{ display:'flex', alignItems:'baseline', gap:10, flexWrap:'wrap' }}>
                        <span style={{ fontSize: isPhone ? 24 : 30, fontWeight:400,
                          fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:2 }}>
                          {b.title_zh}
                        </span>
                        {b.title_pinyin && (
                          <span style={{ fontSize:12, color:P.ink3, fontStyle:'italic' }}>
                            {b.title_pinyin}
                          </span>
                        )}
                        {L !== 'zh' && (
                          <span style={{ fontSize:13, color:P.accent }}>{titleOf(b)}</span>
                        )}
                        {b.era && (
                          <span style={{ fontSize:11, color:P.ink3, marginLeft:'auto' }}>{b.era}</span>
                        )}
                      </div>
                      {summaryOf(b) && (
                        <div style={{ fontSize: isPhone ? 12 : 13, color:P.ink2,
                          marginTop:6, lineHeight:1.8 }}>{summaryOf(b)}</div>
                      )}
                    </button>
                  ))}
                </section>
              );
            })}
          </>
        )}

        {open && <BookReader book={open} L={L} isPhone={isPhone}/>}
      </main>
    </div>
  );
}

function BookReader({ book, L, isPhone }) {
  const [passages, setPassages] = useState(null);
  const [openId, setOpenId] = useState(null);      // which passage has its rendering expanded
  const [playing, setPlaying] = useState(null);    // passage id currently sounding

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('clf_classic_passages')
        .select('*')
        .eq('classic_id', book.id)
        .order('passage_order', { ascending: true });
      setPassages(data || []);
      setOpenId(null);
      setPlaying(null);
    })();
  }, [book.id]);

  if (passages === null) return <div style={{ color:P.ink3 }}>{tr(L,'loading')}</div>;

  if (!passages.length) {
    return (
      <div style={{ color:P.ink3, fontSize:13, lineHeight:1.9,
        border:`1px dashed ${P.edge}`, borderRadius:12, padding:'22px 18px', textAlign:'center' }}>
        {tr(L,'empty')}
      </div>
    );
  }

  const renderingOf = p =>
    L === 'en' ? (p.text_en || p.vernacular_zh)
    : L === 'it' ? (p.text_it || p.vernacular_zh)
    : p.vernacular_zh;

  return (
    <div>
      {passages.map(p => {
        const expanded = openId === p.id;
        const rendering = renderingOf(p);
        return (
          <article key={p.id} style={{
            borderBottom:`1px solid ${P.edge}`, padding: isPhone ? '20px 0' : '26px 0',
          }}>
            {p.chapter_zh && (
              <div style={{ fontSize:11, letterSpacing:3, color:P.accent, marginBottom:10 }}>
                {p.chapter_zh}
              </div>
            )}

            {/* 原文 — set larger and looser than anything else in the app.
                These lines were written to be recited, not skimmed.
                Pinyin sits under its OWN line rather than in one block below
                the passage: with four or eight lines of classical Chinese, a
                single run of romanisation underneath cannot be matched back to
                the characters it belongs to, which is exactly when a learner
                needs it most. */}
            <Original text={p.original} pinyin={p.pinyin} isPhone={isPhone}/>

            <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
              {rendering && (
                <button onClick={() => {
                    const next = expanded ? null : p.id;
                    setOpenId(next);
                    if (next) {
                      recordLearning({
                        module:'classics', itemType:'passage', itemId:p.id,
                        event:'practice',
                        meta:{ book: book.slug, chapter: p.chapter_zh || null },
                      });
                    }
                  }}
                  style={btn(expanded)}>
                  {expanded ? '−' : '+'} {L === 'zh' ? tr(L,'plain') : tr(L,'meaning')}
                </button>
              )}

              {p.audio_url && (
                <>
                  <button onClick={() => setPlaying(playing === p.id ? null : p.id)}
                    style={btn(playing === p.id)}>
                    {playing === p.id ? `⏸ ${tr(L,'stop')}` : `🔊 ${tr(L,'listen')}`}
                  </button>
                  {playing === p.id && (
                    <audio src={p.audio_url} autoPlay onEnded={() => setPlaying(null)}
                      style={{ display:'none' }}/>
                  )}
                </>
              )}
            </div>

            {expanded && rendering && (
              <div style={{ marginTop:14, background:P.card, border:`1px solid ${P.edge}`,
                borderRadius:12, padding: isPhone ? '14px 14px' : '18px 18px' }}>
                <div style={{ fontSize: isPhone ? 14 : 15, color:P.ink2, lineHeight:2 }}>
                  {rendering}
                </div>
                {p.notes_zh && L === 'zh' && (
                  <div style={{ marginTop:12, paddingTop:12, borderTop:`1px dashed ${P.edge}`,
                    fontSize:12, color:P.ink3, lineHeight:1.9 }}>
                    {tr(L,'notes')}：{p.notes_zh}
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

// Whitespace + Chinese and ASCII punctuation. Deliberately no /u flag: under
// it, ASCII punctuation cannot be backslash-escaped inside a character class
// and the build fails. Same expression the poetry grid uses.
const PUNCT = /[\s，。！？、；：""''「」『』《》（）().,!?;:]/;

// Pinyin sits ABOVE ITS OWN CHARACTER, not under the line.
//
// A learner meeting 學而時習之 needs to know which sound belongs to which
// character. Romanisation under the line makes them count positions to work it
// out — and classical Chinese is exactly where they cannot, because they do not
// yet know where the word boundaries fall.
//
// <ruby> is the element built for this: the pairing survives line wrapping,
// screen readers announce it correctly, and selecting the text copies the
// characters rather than an interleaved mess.
//
// Alignment follows the convention already used by the poetry grid: ONE pinyin
// per non-punctuation character, whitespace separated. Punctuation takes none.
function Original({ text, pinyin, isPhone }) {
  const chars  = Array.from(String(text || ''));
  const tokens = String(pinyin || '').trim().split(/\s+/).filter(Boolean);

  // Annotate only when the counts agree. A list that is off by one would shift
  // every reading after the error onto the wrong character, and a learner has
  // no way to notice — so a mismatch falls back to plain text with the
  // romanisation below, clearly not claiming per-character alignment.
  const needed  = chars.filter(c => !PUNCT.test(c)).length;
  const aligned = tokens.length > 0 && tokens.length === needed;
  const size    = isPhone ? 19 : 23;

  if (!aligned) {
    return (
      <div>
        <div style={{
          fontSize: size, fontFamily:"'STKaiti','KaiTi',serif",
          lineHeight: 2.2, letterSpacing: 2, color: P.ink, whiteSpace:'pre-wrap',
        }}>{text}</div>
        {pinyin && (
          <div style={{ fontSize:12, color:P.ink3, marginTop:8, fontStyle:'italic',
            lineHeight:1.8, whiteSpace:'pre-wrap' }}>{pinyin}</div>
        )}
      </div>
    );
  }

  let t = 0;
  return (
    <div style={{
      fontSize: size,
      fontFamily:"'STKaiti','KaiTi',serif",
      color: P.ink,
      // Ruby needs vertical room; without it the readings collide with the
      // line above.
      lineHeight: 2.9,
    }}>
      {chars.map((ch, i) => {
        if (ch === '\n') return <br key={i}/>;
        if (PUNCT.test(ch)) return <span key={i} style={{ letterSpacing: 2 }}>{ch}</span>;
        const py = tokens[t++];
        return (
          <ruby key={i} style={{ rubyAlign:'center', margin:'0 1px' }}>
            {ch}
            <rt style={{
              fontSize: isPhone ? 9 : 11,
              fontFamily:'system-ui, -apple-system, sans-serif',
              fontWeight: 400, color: P.ink3, letterSpacing: 0,
              lineHeight: 1.1,
            }}>{py}</rt>
          </ruby>
        );
      })}
    </div>
  );
}

const btn = (on) => ({
  padding:'6px 14px', borderRadius:20, cursor:'pointer',
  border:`1px solid ${on ? P.accent : P.edge}`,
  background: on ? 'rgba(201,162,39,0.12)' : 'transparent',
  color: on ? P.accent : P.ink2,
  fontSize:12, fontFamily:'inherit',
  WebkitTapHighlightColor:'transparent',
});

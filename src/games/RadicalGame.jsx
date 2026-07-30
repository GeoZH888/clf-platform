// src/games/RadicalGame.jsx
// GAME 5: 🧩 部首听音 — 偏旁部首 + 读音 drill
//
// Four question kinds are mixed into one run, so a radical is attacked from every side:
//   listen  🔊 → glyph   hear the reading, pick the radical      (读音, ear → eye)
//   name    glyph → 读音  see the radical, pick its pronunciation (读音, eye → ear)
//   meaning glyph → 义    see the radical, pick what it means     (识义)
//   find    radical → 字  pick the character that uses it         (偏旁部首 in context)
//
// Every answer is followed by a reveal card that plays the radical and lets the learner
// tap each example word — that is where most of the pronunciation exposure happens.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLang } from '../context/LanguageContext.jsx';
import { RADICALS, radicalName, radicalMeaning, exampleGloss, alsoContains } from '../data/radicalsData.js';
import { playTTS, playPhonemeTTS } from '../utils/ttsHelper.js';
import { shuffle, awardPoints, ScoreBadge, Lives, ResultScreen } from './gameUi.jsx';

const TOTAL  = 12;
const LIVES  = 3;
const COLOR  = '#00897B';
const BG     = '#00140f';
const CARD   = '#0a241d';
const BORDER = '#0f3d33';

const KINDS = ['listen', 'name', 'meaning', 'find'];

// ── Audio ──────────────────────────────────────────────────────────────────────
// The bare radical form (氵, 忄, 辶 …) has no reliable TTS voice, so we hand the
// tone-marked pinyin to playPhonemeTTS first and fall back to a standalone character
// with the same reading (氵 → 水). See ttsHelper for the full cascade.
function playRadical(r) {
  playPhonemeTTS(r.py, r.read || r.eg[0]?.c);
}

// ── Question builder ───────────────────────────────────────────────────────────
function buildQuestions(lang) {
  const pool  = shuffle(RADICALS).slice(0, TOTAL);
  // Spread the four kinds evenly instead of drawing at random, so a short run still
  // covers ear-training and radical-spotting rather than landing on one kind.
  const kinds = shuffle(Array.from({ length: TOTAL }, (_, i) => KINDS[i % KINDS.length]));

  return pool.map((r, i) => {
    const kind = kinds[i];

    if (kind === 'listen') {
      // Distractors must sound different — 火 and 灬 are both huǒ, so filter by reading.
      const others = shuffle(RADICALS.filter(o => o.py !== r.py)).slice(0, 3);
      return { kind, r, answer: r.r, options: shuffle([r, ...others]).map(o => o.r) };
    }

    if (kind === 'name') {
      const others = shuffle(RADICALS.filter(o => o.py !== r.py)).slice(0, 3);
      return { kind, r, answer: r.py, options: shuffle([r, ...others]).map(o => o.py) };
    }

    if (kind === 'meaning') {
      // Same-reading pairs are variants of one radical (火/灬, 心/忄) and gloss almost
      // identically — offering both would make two options defensible.
      const mine   = radicalMeaning(r, lang);
      const others = shuffle(RADICALS.filter(o => o.py !== r.py && radicalMeaning(o, lang) !== mine)).slice(0, 3);
      return { kind, r, answer: mine, options: shuffle([r, ...others]).map(o => radicalMeaning(o, lang)) };
    }

    // find — one character that uses this radical, three that do not.
    const correct = shuffle(r.eg)[0];
    const decoys  = shuffle(
      RADICALS
        // 煮 carries 灬, which a learner reasonably reads as 火 — not a fair decoy for 火.
        .filter(o => o.r !== r.r && o.py !== r.py)
        .flatMap(o => o.eg)
        // 明 carries both 日 and 月; such a decoy would be a second correct answer.
        .filter(e => !alsoContains(e, r.r) && e.c !== correct.c)
    ).slice(0, 3);
    return {
      kind, r, answer: correct.c,
      options: shuffle([correct, ...decoys]).map(e => e.c),
      chars: Object.fromEntries([correct, ...decoys].map(e => [e.c, e])),
    };
  });
}

// ── Reveal card shown after every answer ───────────────────────────────────────
function RevealCard({ q, lang, t }) {
  const r = q.r;
  return (
    <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:18,
      padding:'16px 18px', width:'100%', maxWidth:360 }}>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:12 }}>
        <div style={{ fontSize:44, color:COLOR, fontFamily:"'STKaiti','KaiTi',serif", lineHeight:1 }}>
          {r.r}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:19, fontWeight:800, color:'#fdf6e3' }}>{r.py}</span>
            <button onClick={() => playRadical(r)}
              style={{ border:'none', background:`${COLOR}22`, color:COLOR, borderRadius:9,
                padding:'3px 9px', fontSize:14, cursor:'pointer',
                WebkitTapHighlightColor:'transparent' }}>🔊</button>
          </div>
          <div style={{ fontSize:12, color:'#7fb3aa', marginTop:2 }}>
            {radicalName(r, lang)}
            {lang !== 'zh' && <span style={{ color:'#4d7f77' }}> · {r.name_zh}</span>}
          </div>
          <div style={{ fontSize:12, color:'#a07850', marginTop:2 }}>{radicalMeaning(r, lang)}</div>
        </div>
      </div>

      <div style={{ fontSize:10, color:'#4d7f77', marginBottom:6, letterSpacing:1 }}>
        {t('例字 · 点击听读音', 'EXAMPLES · TAP TO HEAR', 'ESEMPI · TOCCA PER ASCOLTARE')}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {r.eg.map(e => (
          <button key={e.c} onClick={() => playTTS(e.c)}
            style={{ display:'flex', alignItems:'center', gap:10, textAlign:'left',
              background:'#06100d', border:`1px solid ${BORDER}`, borderRadius:12,
              padding:'8px 10px', cursor:'pointer', WebkitTapHighlightColor:'transparent' }}>
            <span style={{ fontSize:26, color:'#fdf6e3', fontFamily:"'STKaiti','KaiTi',serif",
              lineHeight:1, minWidth:30 }}>{e.c}</span>
            <span style={{ flex:1 }}>
              <span style={{ fontSize:13, color:COLOR, fontWeight:600 }}>{e.p}</span>
              <span style={{ fontSize:11, color:'#a07850', marginLeft:8 }}>{exampleGloss(e, lang)}</span>
            </span>
            <span style={{ fontSize:13, opacity:0.6 }}>🔊</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Game ───────────────────────────────────────────────────────────────────────
// `lang` is passed explicitly by GamesApp; mounted straight from /learn?module=radicals
// there is no prop, so fall back to the LanguageProvider UserApp wraps us in.
export default function RadicalGame({ onBack, lang: langProp }) {
  const { lang: ctxLang } = useLang();
  const lang = langProp || ctxLang || 'zh';
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it || en) : en;

  const [phase,  setPhase]  = useState('intro');   // intro | playing | result
  const [qs,     setQs]     = useState([]);
  const [idx,    setIdx]    = useState(0);
  const [score,  setScore]  = useState(0);
  const [combo,  setCombo]  = useState(0);
  const [lives,  setLives]  = useState(LIVES);
  const [chosen, setChosen] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const endedRef = useRef(false);

  const q = qs[idx];

  const start = useCallback(() => {
    const built = buildQuestions(lang);
    setQs(built); setIdx(0); setScore(0); setCombo(0); setLives(LIVES);
    setChosen(null); setCorrectCount(0); setPhase('playing');
    endedRef.current = false;
    // Fires inside the tap handler, which unlocks audio playback on mobile.
    if (built[0].kind === 'listen') playRadical(built[0].r);
  }, [lang]);

  // Auto-play the prompt on every 听音 question after the first.
  useEffect(() => {
    if (phase === 'playing' && q?.kind === 'listen' && chosen === null && idx > 0) {
      playRadical(q.r);
    }
  }, [phase, idx, q, chosen]);

  function choose(opt) {
    if (chosen !== null) return;
    const correct = opt === q.answer;
    setChosen(opt);
    if (correct) {
      const newCombo = combo + 1;
      setCombo(newCombo);
      setScore(s => s + 10 + newCombo * 5);
      setCorrectCount(c => c + 1);
    } else {
      setCombo(0);
      setLives(l => l - 1);
    }
    // Hearing it right after answering is the point of the drill — always voice it.
    if (q.kind !== 'listen') playRadical(q.r);
  }

  function next() {
    if (lives <= 0 || idx + 1 >= qs.length) {
      if (!endedRef.current) {
        endedRef.current = true;
        awardPoints('radical_quiz', score);
      }
      setPhase('result');
      return;
    }
    setIdx(i => i + 1);
    setChosen(null);
  }

  // ── Intro ──────────────────────────────────────────────────────────────────
  if (phase === 'intro') return (
    <div style={{ minHeight:'100dvh', background:BG, display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'12px 16px' }}>
        <button onClick={onBack} style={{ border:'none', background:'none', fontSize:22,
          color:'#fff', cursor:'pointer' }}>‹</button>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'0 24px 40px', gap:16 }}>
        <div style={{ fontSize:64 }}>🧩</div>
        <div style={{ fontSize:22, fontWeight:800, color:'#fdf6e3' }}>
          {t('部首听音','Radical & Sound','Radicali e Suoni')}
        </div>
        <div style={{ fontSize:13, color:'#7fb3aa', textAlign:'center', lineHeight:1.7, maxWidth:320 }}>
          {t('听读音选部首 · 看部首说读音 · 认部首含义 · 找同旁的字',
             'Hear it and pick the radical · read it aloud · match its meaning · spot the character that uses it',
             'Ascolta e scegli il radicale · leggilo · abbina il significato · trova il carattere che lo usa')}
        </div>
        <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16,
          padding:'12px 20px', display:'flex', gap:20 }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:20, fontWeight:800, color:COLOR }}>{TOTAL}</div>
            <div style={{ fontSize:10, color:'#a07850' }}>{t('题','questions','domande')}</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:20, fontWeight:800, color:COLOR }}>{RADICALS.length}</div>
            <div style={{ fontSize:10, color:'#a07850' }}>{t('部首','radicals','radicali')}</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:20, fontWeight:800, color:COLOR }}>{LIVES}</div>
            <div style={{ fontSize:10, color:'#a07850' }}>{t('生命','lives','vite')}</div>
          </div>
        </div>
        <button onClick={start}
          style={{ marginTop:8, padding:'14px 40px', borderRadius:16, border:'none',
            background:COLOR, color:'#fff', fontSize:16, fontWeight:700, cursor:'pointer',
            boxShadow:`0 6px 24px ${COLOR}44`, WebkitTapHighlightColor:'transparent' }}>
          {t('开始','Start','Inizia')}
        </button>
        <div style={{ fontSize:11, color:'#4d7f77' }}>
          🔊 {t('请打开声音','Turn your sound on','Attiva l\'audio')}
        </div>
      </div>
    </div>
  );

  // ── Result ─────────────────────────────────────────────────────────────────
  if (phase === 'result') return (
    <ResultScreen score={score} total={qs.length} max={TOTAL * 10 + TOTAL * 5 * 2}
      icon="🧩" title={t('部首听音','Radical & Sound')}
      onBack={onBack} onReplay={start} lang={lang}
      extra={t(`答对 ${correctCount}/${qs.length} 个部首`,
               `${correctCount}/${qs.length} radicals correct`,
               `${correctCount}/${qs.length} radicali corretti`)} />
  );

  if (!q) return null;

  const answered = chosen !== null;
  const wasRight = answered && chosen === q.answer;

  const KIND_LABEL = {
    listen:  t('听音选部首','Hear it → pick the radical','Ascolta → scegli il radicale'),
    name:    t('这个部首怎么读？','How is this radical read?','Come si legge questo radicale?'),
    meaning: t('这个部首是什么意思？','What does this radical mean?','Cosa significa questo radicale?'),
    find:    t('哪个字用了这个部首？','Which character uses this radical?','Quale carattere usa questo radicale?'),
  };

  // Options render differently per kind: glyphs and characters want the Kai face at a
  // large size, pinyin and meanings are plain text that may wrap.
  const glyphOptions = q.kind === 'listen' || q.kind === 'find';

  return (
    <div style={{ minHeight:'100dvh', background:BG, display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none', fontSize:22,
          color:'#fff', cursor:'pointer' }}>‹</button>
        <div style={{ flex:1, height:6, background:'#0a2a23', borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${((idx + 1) / qs.length) * 100}%`,
            background:COLOR, borderRadius:3, transition:'width 0.3s' }}/>
        </div>
        <Lives count={lives} max={LIVES}/>
      </div>

      {/* Score */}
      <div style={{ display:'flex', justifyContent:'center', gap:16, padding:'0 16px 12px' }}>
        <ScoreBadge score={score}          label={t('分数','Score')}  color={COLOR}/>
        <ScoreBadge score={`×${combo}`}    label={t('连击','Combo')}  color="#6A1B9A"/>
        <ScoreBadge score={`${idx+1}/${qs.length}`} label={t('题目','Q')} color="#1565C0"/>
      </div>

      {/* Prompt + options */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
        padding:'4px 16px 24px', gap:16, overflowY:'auto' }}>

        <div style={{ background:CARD, borderRadius:20, padding:'18px 24px', width:'100%',
          maxWidth:360, textAlign:'center', border:`1px solid ${BORDER}` }}>
          <div style={{ fontSize:11, color:'#7fb3aa', marginBottom:10 }}>{KIND_LABEL[q.kind]}</div>

          {q.kind === 'listen' ? (
            <button onClick={() => playRadical(q.r)}
              style={{ width:84, height:84, borderRadius:42, border:`2px solid ${COLOR}`,
                background:`${COLOR}22`, color:COLOR, fontSize:34, cursor:'pointer',
                WebkitTapHighlightColor:'transparent' }}>🔊</button>
          ) : (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12 }}>
              <div style={{ fontSize:56, color:'#fdf6e3', lineHeight:1.1,
                fontFamily:"'STKaiti','KaiTi',serif" }}>{q.r.r}</div>
              {q.kind === 'find' && (
                <div style={{ textAlign:'left' }}>
                  <div style={{ fontSize:14, color:COLOR, fontWeight:700 }}>{q.r.py}</div>
                  <div style={{ fontSize:11, color:'#7fb3aa' }}>{radicalName(q.r, lang)}</div>
                </div>
              )}
            </div>
          )}

          {q.kind === 'listen' && (
            <div style={{ fontSize:11, color:'#4d7f77', marginTop:10 }}>
              {t('点击重听','Tap to replay','Tocca per riascoltare')}
            </div>
          )}
        </div>

        <div style={{ display:'grid',
          gridTemplateColumns: glyphOptions ? '1fr 1fr' : '1fr',
          gap:10, width:'100%', maxWidth:360 }}>
          {q.options.map(opt => {
            const isCorrect = opt === q.answer;
            const isChosen  = opt === chosen;
            const bg = !answered ? CARD
              : isCorrect ? '#0f5132'
              : isChosen  ? '#5f1a1a'
              : '#06100d';
            const border = !answered ? BORDER
              : isCorrect ? '#4CAF50'
              : isChosen  ? '#F44336' : '#123';
            return (
              <button key={opt} onClick={() => choose(opt)}
                style={{ padding: glyphOptions ? '16px 8px' : '14px 14px',
                  borderRadius:14, cursor: answered ? 'default' : 'pointer',
                  border:`2px solid ${border}`, background:bg, color:'#fdf6e3',
                  fontSize: glyphOptions ? 36 : 15,
                  fontFamily: glyphOptions ? "'STKaiti','KaiTi',serif" : 'inherit',
                  fontWeight: glyphOptions ? 400 : 500,
                  lineHeight:1.3, textAlign:'center', transition:'all 0.15s',
                  WebkitTapHighlightColor:'transparent' }}>
                {opt}
                {/* On 找字 questions the pinyin of each option is useful feedback once answered. */}
                {answered && q.kind === 'find' && q.chars?.[opt] && (
                  <div style={{ fontSize:11, color:'#7fb3aa', fontFamily:'inherit', marginTop:4 }}>
                    {q.chars[opt].p}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {answered && (
          <>
            <div style={{ fontSize:14, fontWeight:700, color: wasRight ? '#4CAF50' : '#F44336' }}>
              {wasRight ? `✓ ${t('答对了','Correct','Corretto')}`
                        : `✗ ${t('再记一遍','Take another look','Guarda ancora')}`}
            </div>
            <RevealCard q={q} lang={lang} t={t}/>
            <button onClick={next}
              style={{ padding:'13px 36px', borderRadius:14, border:'none', background:COLOR,
                color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer',
                WebkitTapHighlightColor:'transparent' }}>
              {lives <= 0
                ? t('查看成绩','See results','Vedi risultati')
                : idx + 1 >= qs.length
                  ? t('完成','Finish','Fine')
                  : t('继续','Continue','Continua')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

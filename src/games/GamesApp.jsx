// src/games/GamesApp.jsx
// 游戏中心 — 4 mini-games drawing content from all learning modules
// Games: Speed Quiz | Memory Match | Falling Sky | Word Chain

import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { supabase } from '../lib/supabase.js';
import { useLang } from '../context/LanguageContext.jsx';

// Unity frame — only loaded when a Unity game is actually launched
const UnityGameFrame = lazy(() => import('./UnityGameFrame.jsx'));

const TOKEN_KEY = 'jgw_device_token';

// ── Shared helpers ─────────────────────────────────────────────────────────────
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
function getToken()   { return localStorage.getItem(TOKEN_KEY); }
async function awardPoints(action, pts) {
  const token = getToken();
  if (!token) return;
  await supabase.from('jgw_points').insert({ device_token:token, module:'games', action, points:pts });
}

// ── Score Badge ────────────────────────────────────────────────────────────────
function ScoreBadge({ score, label, color='#8B4513' }) {
  return (
    <div style={{ background:'#fff', borderRadius:12, padding:'8px 16px',
      border:`1.5px solid ${color}33`, textAlign:'center', minWidth:80 }}>
      <div style={{ fontSize:22, fontWeight:800, color }}>{score}</div>
      <div style={{ fontSize:10, color:'#a07850' }}>{label}</div>
    </div>
  );
}

// ── Lives display ──────────────────────────────────────────────────────────────
function Lives({ count, max=3 }) {
  return (
    <div style={{ display:'flex', gap:4 }}>
      {Array.from({length:max}, (_,i) => (
        <span key={i} style={{ fontSize:18, opacity: i < count ? 1 : 0.2 }}>❤️</span>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GAME 1: ⚡ 闪电问答 — Speed Quiz with lives + combo multiplier
// ══════════════════════════════════════════════════════════════════════════════
function SpeedQuiz({ items, onBack, lang }) {
  const t = (zh, en) => lang === 'zh' ? zh : en;
  const TOTAL = 15;
  const TIME  = 8; // seconds per question

  const [qs,      setQs]      = useState(() => shuffle(items).slice(0, TOTAL));
  const [idx,     setIdx]     = useState(0);
  const [score,   setScore]   = useState(0);
  const [combo,   setCombo]   = useState(0);
  const [lives,   setLives]   = useState(3);
  const [timeLeft,setTimeLeft]= useState(TIME);
  const [chosen,  setChosen]  = useState(null);
  const [phase,   setPhase]   = useState('playing'); // playing | result
  const [flash,   setFlash]   = useState(null); // 'correct' | 'wrong'
  const timerRef = useRef(null);

  const q = qs[idx];

  const advance = useCallback((correct) => {
    clearInterval(timerRef.current);
    const newCombo  = correct ? combo + 1 : 0;
    const pts       = correct ? (10 + newCombo * 5) : 0;
    const newScore  = score + pts;
    const newLives  = correct ? lives : lives - 1;
    setCombo(newCombo);
    setScore(newScore);
    setLives(newLives);
    setFlash(correct ? 'correct' : 'wrong');

    setTimeout(() => {
      setFlash(null);
      if (newLives <= 0 || idx + 1 >= TOTAL) {
        setPhase('result');
        awardPoints('speed_quiz', newScore);
      } else {
        setIdx(i => i + 1);
        setChosen(null);
        setTimeLeft(TIME);
      }
    }, 700);
  }, [combo, score, lives, idx]);

  useEffect(() => {
    if (phase !== 'playing' || chosen !== null) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { advance(false); return TIME; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [idx, phase, chosen, advance]);

  function choose(opt) {
    if (chosen) return;
    setChosen(opt);
    advance(opt === q.answer);
  }

  if (phase === 'result') return (
    <ResultScreen score={score} total={TOTAL} max={TOTAL*10+TOTAL*5*2}
      icon="⚡" title={t('闪电问答','Speed Quiz')}
      onBack={onBack} onReplay={() => {
        setQs(shuffle(items).slice(0,TOTAL)); setIdx(0); setScore(0);
        setCombo(0); setLives(3); setTimeLeft(TIME); setChosen(null); setPhase('playing');
      }} lang={lang}/>
  );

  const timerPct = (timeLeft / TIME) * 100;
  const timerColor = timeLeft <= 3 ? '#C62828' : timeLeft <= 5 ? '#F57F17' : '#2E7D32';

  return (
    <div style={{ minHeight:'100dvh', background:'#1a0a05', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none', fontSize:22, color:'#fff', cursor:'pointer' }}>‹</button>
        <div style={{ flex:1 }}>
          <div style={{ height:6, background:'#333', borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${timerPct}%`, background:timerColor,
              borderRadius:3, transition:'width 1s linear, background 0.3s' }}/>
          </div>
        </div>
        <div style={{ fontSize:20, fontWeight:700, color:timerColor, minWidth:28, textAlign:'right' }}>{timeLeft}</div>
        <Lives count={lives}/>
      </div>

      {/* Score + combo */}
      <div style={{ display:'flex', justifyContent:'center', gap:16, padding:'0 16px 12px' }}>
        <ScoreBadge score={score}  label={t('分数','Score')} color="#F57F17"/>
        <ScoreBadge score={`×${combo}`} label={t('连击','Combo')} color="#6A1B9A"/>
        <ScoreBadge score={`${idx+1}/${TOTAL}`} label={t('题目','Q')} color="#1565C0"/>
      </div>

      {/* Flash overlay */}
      {flash && (
        <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:10,
          background: flash==='correct' ? 'rgba(46,125,50,0.25)' : 'rgba(198,40,40,0.25)',
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontSize:64 }}>{flash==='correct' ? '✓' : '✗'}</div>
        </div>
      )}

      {/* Question */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'16px' }}>
        <div style={{ background:'#2a1a0a', borderRadius:20, padding:'24px 28px',
          marginBottom:20, width:'100%', maxWidth:360, textAlign:'center',
          border:'1px solid #5D2E0C' }}>
          <div style={{ fontSize:11, color:'#a07850', marginBottom:8 }}>{q.type}</div>
          <div style={{ fontSize: q.questionText.length > 6 ? 18 : 28,
            color:'#fdf6e3', fontWeight:700, lineHeight:1.4,
            fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:2 }}>
            {q.questionText}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, width:'100%', maxWidth:360 }}>
          {q.options.map(opt => {
            const isCorrect = opt === q.answer;
            const isChosen  = opt === chosen;
            const bg = !chosen ? '#2a1a0a'
              : isChosen && isCorrect ? '#1B5E20'
              : isChosen ? '#B71C1C'
              : isCorrect && chosen ? '#1B5E20'
              : '#1a0a05';
            const border = !chosen ? '#5D2E0C'
              : isCorrect && chosen ? '#4CAF50'
              : isChosen ? '#F44336' : '#333';
            return (
              <button key={opt} onClick={() => choose(opt)}
                style={{ padding:'14px 10px', borderRadius:14, cursor:chosen?'default':'pointer',
                  border:`2px solid ${border}`, background:bg,
                  color:'#fdf6e3', fontSize:15,
                  fontFamily:"'STKaiti','KaiTi',serif",
                  transition:'all 0.15s', fontWeight:500,
                  textAlign:'center', lineHeight:1.3 }}>
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GAME 2: 🃏 翻牌记忆 — Memory card matching
// ══════════════════════════════════════════════════════════════════════════════
function MemoryMatch({ items, onBack, lang }) {
  const t = (zh, en) => lang === 'zh' ? zh : en;
  const PAIRS = 8;

  function buildDeck() {
    const pool = shuffle(items).slice(0, PAIRS);
    const cards = pool.flatMap((item, i) => [
      { id:`q${i}`, pairId:i, text:item.front, type:'question' },
      { id:`a${i}`, pairId:i, text:item.back,  type:'answer'   },
    ]);
    return shuffle(cards).map((c, i) => ({ ...c, idx:i, flipped:false, matched:false }));
  }

  const [deck,    setDeck]    = useState(buildDeck);
  const [flipped, setFlipped] = useState([]); // indices of face-up unmatched
  const [moves,   setMoves]   = useState(0);
  const [matched, setMatched] = useState(0);
  const [phase,   setPhase]   = useState('playing');
  const [score,   setScore]   = useState(0);
  const lockRef = useRef(false);

  function flip(idx) {
    if (lockRef.current) return;
    if (deck[idx].matched || deck[idx].flipped) return;
    if (flipped.length === 1 && flipped[0] === idx) return;

    const newDeck = [...deck];
    newDeck[idx] = { ...newDeck[idx], flipped:true };
    setDeck(newDeck);

    if (flipped.length === 0) {
      setFlipped([idx]);
      return;
    }

    const first = flipped[0];
    setFlipped([]);
    setMoves(m => m + 1);
    lockRef.current = true;

    if (deck[first].pairId === deck[idx].pairId) {
      // Match!
      setTimeout(() => {
        setDeck(d => d.map((c,i) =>
          i === first || i === idx ? { ...c, matched:true } : c));
        const newMatched = matched + 1;
        setMatched(newMatched);
        const pts = Math.max(10, 50 - moves * 2);
        setScore(s => s + pts);
        if (newMatched >= PAIRS) {
          setTimeout(() => { setPhase('result'); awardPoints('memory_match', score+pts); }, 400);
        }
        lockRef.current = false;
      }, 400);
    } else {
      setTimeout(() => {
        setDeck(d => d.map((c,i) =>
          i === first || i === idx ? { ...c, flipped:false } : c));
        lockRef.current = false;
      }, 900);
    }
  }

  if (phase === 'result') return (
    <ResultScreen score={score} total={PAIRS} max={PAIRS*50}
      icon="🃏" title={t('翻牌记忆','Memory Match')}
      onBack={onBack} onReplay={() => {
        setDeck(buildDeck()); setFlipped([]); setMoves(0);
        setMatched(0); setPhase('playing'); setScore(0);
      }} lang={lang} extra={`${moves} ${t('步完成','moves')}`}/>
  );

  return (
    <div style={{ minHeight:'100dvh', background:'#0D1B2A', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none', fontSize:22, color:'#fff', cursor:'pointer' }}>‹</button>
        <div style={{ fontSize:14, fontWeight:600, color:'#fff', flex:1 }}>🃏 {t('翻牌记忆','Memory Match')}</div>
        <ScoreBadge score={matched} label={`/${PAIRS}`} color="#69F0AE"/>
        <ScoreBadge score={moves}   label={t('步','moves')} color="#FFD740"/>
      </div>

      <div style={{ flex:1, padding:'12px 16px', display:'grid',
        gridTemplateColumns:'repeat(4, 1fr)', gap:8, alignContent:'center' }}>
        {deck.map((card, idx) => (
          <div key={card.id} onClick={() => flip(idx)}
            style={{ aspectRatio:'1', borderRadius:12, cursor:'pointer',
              perspective:600, transition:'transform 0.1s' }}>
            <div style={{
              width:'100%', height:'100%', borderRadius:12,
              background: card.matched ? '#1B5E20'
                : card.flipped ? '#1565C0' : '#1a3a5c',
              border: card.matched ? '2px solid #4CAF50'
                : card.flipped ? '2px solid #42A5F5' : '2px solid #2a4a6c',
              display:'flex', alignItems:'center', justifyContent:'center',
              transition:'all 0.25s',
              boxShadow: card.matched ? '0 0 12px #4CAF5066' : 'none',
            }}>
              {(card.flipped || card.matched)
                ? <div style={{ fontSize:card.text.length > 4 ? 11 : 16,
                    color:'#fff', textAlign:'center', padding:'4px',
                    fontFamily:"'STKaiti','KaiTi',serif", fontWeight:600,
                    lineHeight:1.3 }}>{card.text}</div>
                : <div style={{ fontSize:24, color:'#2a4a6c' }}>?</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GAME 3: 🌧 字雨 — Falling characters, tap the matching pinyin
// ══════════════════════════════════════════════════════════════════════════════
function FallingChars({ items, onBack, lang }) {
  const t = (zh, en) => lang === 'zh' ? zh : en;
  const [score,   setScore]   = useState(0);
  const [lives,   setLives]   = useState(3);
  const [phase,   setPhase]   = useState('playing');
  const [current, setCurrent] = useState(() => shuffle(items)[0]);
  const [cols,    setCols]    = useState([]);
  const [falling, setFalling] = useState(null); // {text, correct, x, progress}
  const [feedback,setFeedback]= useState(null);
  const poolRef = useRef([...items]);
  const tickRef = useRef(null);

  // Build 4 columns: one correct + 3 distractors
  useEffect(() => {
    const item    = current;
    const others  = shuffle(items.filter(i => i.answer !== item.answer)).slice(0, 3);
    const options = shuffle([item, ...others]);
    setCols(options);
    // Start a new falling item
    const colIdx = options.findIndex(o => o.answer === item.answer);
    setFalling({ text:item.front, correct:item.answer, x:colIdx, progress:0 });
  }, [current]);

  useEffect(() => {
    if (phase !== 'playing' || !falling) return;
    tickRef.current = setInterval(() => {
      setFalling(f => {
        if (!f) return f;
        if (f.progress >= 100) {
          // Missed
          clearInterval(tickRef.current);
          handleMiss();
          return null;
        }
        return { ...f, progress: f.progress + 1.2 };
      });
    }, 50);
    return () => clearInterval(tickRef.current);
  }, [falling?.text, phase]);

  function handleMiss() {
    setFeedback('miss');
    setTimeout(() => {
      setFeedback(null);
      const newLives = lives - 1;
      if (newLives <= 0) { setPhase('result'); awardPoints('falling_chars', score); return; }
      setLives(newLives);
      nextItem();
    }, 600);
  }

  function tapCol(col) {
    if (!falling || feedback) return;
    clearInterval(tickRef.current);
    const correct = col.answer === falling.correct;
    setFeedback(correct ? 'correct' : 'wrong');
    if (correct) setScore(s => s + 15);
    else { const nl = lives-1; setLives(nl); if(nl<=0){setTimeout(()=>{setPhase('result');awardPoints('falling_chars',score+15);},600);return;} }
    setTimeout(() => { setFeedback(null); nextItem(); }, 500);
  }

  function nextItem() {
    poolRef.current = poolRef.current.length > 1
      ? poolRef.current.filter(i => i.front !== current.front)
      : [...items];
    setCurrent(shuffle(poolRef.current)[0]);
  }

  if (phase === 'result') return (
    <ResultScreen score={score} total={20} max={300}
      icon="🌧" title={t('字雨','Falling Sky')}
      onBack={onBack} onReplay={() => { setScore(0);setLives(3);setPhase('playing');poolRef.current=[...items];setCurrent(shuffle(items)[0]); }}
      lang={lang}/>
  );

  return (
    <div style={{ minHeight:'100dvh', background:'#0A0A1A', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none', fontSize:22, color:'#fff', cursor:'pointer' }}>‹</button>
        <div style={{ fontSize:14, fontWeight:600, color:'#fff', flex:1 }}>🌧 {t('字雨','Falling Sky')}</div>
        <ScoreBadge score={score} label={t('分','pts')} color="#FFD740"/>
        <Lives count={lives}/>
      </div>

      {/* Falling character */}
      <div style={{ position:'relative', flex:1, display:'flex', flexDirection:'column' }}>
        {falling && (
          <div style={{ position:'absolute', left:`${(falling.x * 25) + 12.5}%`, transform:'translateX(-50%)',
            top:`${falling.progress}%`, transition:'top 0.05s linear',
            display:'flex', flexDirection:'column', alignItems:'center', gap:4,
            zIndex:2 }}>
            <div style={{ background: feedback==='correct'?'#1B5E20':feedback==='wrong'?'#B71C1C':'#1565C0',
              borderRadius:16, padding:'10px 16px', boxShadow:'0 4px 20px rgba(0,100,255,0.4)',
              border:'2px solid #42A5F5', transition:'background 0.2s' }}>
              <div style={{ fontSize:32, color:'#fff', fontFamily:"'STKaiti','KaiTi',serif",
                fontWeight:700, textShadow:'0 0 20px rgba(100,200,255,0.8)' }}>
                {falling.text}
              </div>
            </div>
            {/* Progress trail */}
            <div style={{ width:2, height: Math.min(falling.progress*1.5, 40),
              background:'linear-gradient(180deg,#42A5F5,transparent)', borderRadius:1 }}/>
          </div>
        )}

        {/* Feedback flash */}
        {feedback && (
          <div style={{ position:'absolute', inset:0, pointerEvents:'none',
            background: feedback==='correct'?'rgba(76,175,80,0.15)':feedback==='miss'?'rgba(100,100,100,0.3)':'rgba(244,67,54,0.15)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:3 }}>
            <div style={{ fontSize:60 }}>
              {feedback==='correct'?'✓':feedback==='miss'?'💨':'✗'}
            </div>
          </div>
        )}

        {/* Column tap targets */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0,
          display:'flex', height:100 }}>
          {cols.map((col, i) => (
            <button key={i} onClick={() => tapCol(col)}
              style={{ flex:1, margin:4, borderRadius:16,
                border:'2px solid #2a3a5c',
                background:'#0d1b2a',
                color:'#fdf6e3', fontSize:14,
                fontFamily:"'STKaiti','KaiTi',serif",
                cursor:'pointer', fontWeight:600,
                WebkitTapHighlightColor:'transparent' }}>
              {col.answer}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GAME 4: 🔤 词语拼写 — Drag-tap to spell a word from shuffled syllables
// ══════════════════════════════════════════════════════════════════════════════
function WordSpell({ items, onBack, lang }) {
  const t = (zh, en) => lang === 'zh' ? zh : en;
  const [pool]    = useState(() => shuffle(items.filter(i => i.chars?.length >= 2)).slice(0, 12));
  const [idx,     setIdx]     = useState(0);
  const [chosen,  setChosen]  = useState([]);
  const [bank,    setBank]    = useState([]);
  const [score,   setScore]   = useState(0);
  const [result,  setResult]  = useState(null); // 'correct'|'wrong'
  const [phase,   setPhase]   = useState('playing');

  useEffect(() => {
    if (pool[idx]) {
      setBank(shuffle(pool[idx].chars.map((c,i) => ({ c, idx:i }))));
      setChosen([]);
      setResult(null);
    }
  }, [idx]);

  function pick(item) {
    if (result) return;
    setChosen(prev => [...prev, item]);
    setBank(prev => prev.filter(b => b !== item));
  }
  function unpick(item) {
    if (result) return;
    setChosen(prev => prev.filter(c => c !== item));
    setBank(prev => [...prev, item]);
  }

  function check() {
    const attempt = chosen.map(c => c.c).join('');
    const correct = pool[idx].chars.join('');
    const ok = attempt === correct;
    setResult(ok ? 'correct' : 'wrong');
    if (ok) { setScore(s => s + 20); }
    setTimeout(() => {
      if (idx + 1 >= pool.length) { setPhase('result'); awardPoints('word_spell', score + (ok?20:0)); }
      else setIdx(i => i + 1);
    }, 800);
  }

  const item = pool[idx];

  if (phase === 'result') return (
    <ResultScreen score={score} total={pool.length} max={pool.length*20}
      icon="🔤" title={t('词语拼写','Word Spell')}
      onBack={onBack} onReplay={() => { setIdx(0); setScore(0); setPhase('playing'); }}
      lang={lang}/>
  );

  return (
    <div style={{ minHeight:'100dvh', background:'#1B0033', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none', fontSize:22, color:'#fff', cursor:'pointer' }}>‹</button>
        <div style={{ fontSize:14, fontWeight:600, color:'#fff', flex:1 }}>🔤 {t('词语拼写','Word Spell')}</div>
        <ScoreBadge score={score} label={t('分','pts')} color="#CE93D8"/>
        <div style={{ fontSize:12, color:'#CE93D8' }}>{idx+1}/{pool.length}</div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', padding:'20px 16px', gap:20 }}>

        {/* Hint */}
        <div style={{ background:'#2d0050', borderRadius:16, padding:'16px 24px',
          width:'100%', maxWidth:340, textAlign:'center',
          border:'1.5px solid #7B1FA2' }}>
          <div style={{ fontSize:11, color:'#CE93D8', marginBottom:8 }}>
            {t('看意思，拼出词语','Spell the word from the meaning')}
          </div>
          <div style={{ fontSize:18, color:'#fdf6e3', lineHeight:1.5 }}>
            {lang==='zh' ? item?.meaning_zh : lang==='it' ? (item?.meaning_it||item?.meaning_en) : item?.meaning_en}
          </div>
          {item?.pinyin && (
            <div style={{ fontSize:13, color:'#CE93D8', marginTop:6 }}>{item.pinyin}</div>
          )}
        </div>

        {/* Answer slots */}
        <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
          {Array.from({length: item?.chars.length || 0}, (_, i) => (
            <div key={i} onClick={() => chosen[i] && unpick(chosen[i])}
              style={{ width:52, height:52, borderRadius:12, cursor:'pointer',
                border:`2px solid ${result==='correct'?'#4CAF50':result==='wrong'?'#F44336':'#7B1FA2'}`,
                background: chosen[i] ? '#4a0080' : 'transparent',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:24, color:'#fdf6e3', fontFamily:"'STKaiti','KaiTi',serif",
                fontWeight:700, transition:'all 0.15s' }}>
              {chosen[i]?.c || ''}
            </div>
          ))}
        </div>

        {result && (
          <div style={{ fontSize:28 }}>{result==='correct'?'🎉':'💔'}</div>
        )}

        {/* Character bank */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center', maxWidth:300 }}>
          {bank.map((b, i) => (
            <button key={i} onClick={() => pick(b)}
              style={{ width:52, height:52, borderRadius:12, border:'2px solid #7B1FA2',
                background:'#2d0050', color:'#fdf6e3', fontSize:24, cursor:'pointer',
                fontFamily:"'STKaiti','KaiTi',serif", fontWeight:700,
                WebkitTapHighlightColor:'transparent' }}>
              {b.c}
            </button>
          ))}
        </div>

        {!result && chosen.length === (item?.chars.length || 0) && (
          <button onClick={check}
            style={{ padding:'13px 40px', borderRadius:16, border:'none',
              background:'#7B1FA2', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
            {t('确认','Confirm')} ✓
          </button>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Result Screen
// ══════════════════════════════════════════════════════════════════════════════
function ResultScreen({ score, total, max, icon, title, onBack, onReplay, lang, extra }) {
  const t = (zh, en) => lang==='zh' ? zh : en;
  const pct  = Math.round((score / max) * 100);
  const star = pct >= 80 ? 3 : pct >= 50 ? 2 : 1;
  const msg  = pct >= 80 ? ['🏆', t('太棒了！','Excellent!')]
             : pct >= 50 ? ['👍', t('很好！','Good job!')]
             : ['💪', t('继续练习！','Keep practicing!')];
  return (
    <div style={{ minHeight:'100dvh', background:'#1a0a05', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', padding:24, gap:20 }}>
      <div style={{ fontSize:60 }}>{msg[0]}</div>
      <div style={{ fontSize:20, fontWeight:700, color:'#fdf6e3' }}>{msg[1]}</div>
      <div style={{ display:'flex', gap:4 }}>
        {[1,2,3].map(s => <span key={s} style={{ fontSize:32, opacity:s<=star?1:0.2 }}>⭐</span>)}
      </div>
      <div style={{ background:'#2a1a0a', borderRadius:20, padding:'20px 32px', textAlign:'center',
        border:'1px solid #5D2E0C', minWidth:200 }}>
        <div style={{ fontSize:40, fontWeight:800, color:'#F57F17' }}>{score}</div>
        <div style={{ fontSize:13, color:'#a07850' }}>{t('总分','Total Score')}</div>
        {extra && <div style={{ fontSize:11, color:'#a07850', marginTop:4 }}>{extra}</div>}
      </div>
      <div style={{ display:'flex', gap:12 }}>
        <button onClick={onReplay}
          style={{ padding:'12px 28px', borderRadius:14, border:'none',
            background:'#8B4513', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
          🔄 {t('再玩一次','Play Again')}
        </button>
        <button onClick={onBack}
          style={{ padding:'12px 24px', borderRadius:14,
            border:'1px solid #5D2E0C', background:'transparent',
            color:'#fdf6e3', fontSize:14, cursor:'pointer' }}>
          {t('返回','Back')}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main GamesApp — hub + data loading
// ══════════════════════════════════════════════════════════════════════════════
export default function GamesApp({ onBack }) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang==='zh' ? zh : lang==='it' ? it||en : en;
  const [game,    setGame]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [allItems,setAllItems]= useState([]);

  useEffect(() => {
    async function load() {
      // Load from all modules and normalize to {front, back, answer, type, chars?}
      const [chars, words, chengyu] = await Promise.all([
        supabase.from('jgw_characters').select('glyph_modern,pinyin,meaning_en,meaning_zh,meaning_it').limit(80),
        supabase.from('jgw_words').select('word_zh,pinyin,meaning_en,meaning_zh,meaning_it').limit(80),
        supabase.from('jgw_chengyu').select('idiom,pinyin,meaning_zh,meaning_en,meaning_it').eq('active',true).limit(60),
      ]);

      const items = [];

      // Characters: show glyph → pick pinyin
      (chars.data||[]).filter(c=>c.pinyin).forEach(c => {
        items.push({
          front:      c.glyph_modern,
          back:       lang==='zh' ? c.meaning_zh : lang==='it' ? (c.meaning_it||c.meaning_en) : c.meaning_en,
          answer:     c.pinyin,
          type:       t('汉字→拼音','Character→Pinyin','Carattere→Pinyin'),
          meaning_zh: c.meaning_zh, meaning_en: c.meaning_en, meaning_it: c.meaning_it,
          pinyin:     c.pinyin,
          chars:      c.glyph_modern.split(''),
        });
      });

      // Words: show meaning → pick word
      (words.data||[]).filter(w=>w.word_zh&&w.meaning_zh).forEach(w => {
        items.push({
          front:      lang==='zh' ? w.meaning_zh : lang==='it' ? (w.meaning_it||w.meaning_en) : w.meaning_en,
          back:       w.word_zh,
          answer:     w.word_zh,
          type:       t('看义选词','Meaning→Word','Significato→Parola'),
          meaning_zh: w.meaning_zh, meaning_en: w.meaning_en, meaning_it: w.meaning_it,
          pinyin:     w.pinyin,
          chars:      w.word_zh.split(''),
        });
      });

      // Chengyu: show meaning → pick idiom
      (chengyu.data||[]).filter(c=>c.idiom&&c.meaning_zh).forEach(c => {
        items.push({
          front:      lang==='zh' ? c.meaning_zh : lang==='it' ? (c.meaning_it||c.meaning_en) : c.meaning_en,
          back:       c.idiom,
          answer:     c.idiom,
          type:       t('成语','Idiom','Proverbio'),
          meaning_zh: c.meaning_zh, meaning_en: c.meaning_en, meaning_it: c.meaning_it,
          pinyin:     c.pinyin,
          chars:      c.idiom.split(''),
        });
      });

      // Build quiz questions with options
      const withOptions = items.map(item => {
        const others = shuffle(items.filter(i => i.answer !== item.answer)).slice(0, 3);
        return { ...item, options: shuffle([item, ...others]).map(o => o.answer), questionText: item.front };
      });

      setAllItems(shuffle(withOptions));
      setLoading(false);
    }
    load();
  }, [lang]);

  // ── Unity WebGL games registry ──────────────────────────────────────────────
  // Add entries here as you build and deploy Unity games.
  // Host builds at: /public/unity-games/{id}/index.html
  // Or use external URL (e.g. Netlify Large Media, itch.io, etc.)
  const UNITY_GAMES = [
    // Example entries — uncomment and fill in your game URLs:
    // {
    //   id:  'stroke-order',
    //   url: '/unity-games/stroke-order/index.html',
    //   icon:'🖌️', color:'#8B4513',
    //   zh: '笔顺大冒险', en: 'Stroke Adventure', it: 'Avventura dei Tratti',
    //   desc_zh: '在3D世界中练习汉字笔顺', desc_en: 'Practice stroke order in a 3D world',
    // },
    // {
    //   id:  'pinyin-run',
    //   url: '/unity-games/pinyin-run/index.html',
    //   icon:'🏃', color:'#1565C0',
    //   zh: '拼音跑酷', en: 'Pinyin Runner', it: 'Corridore Pinyin',
    //   desc_zh: '跑步躲避障碍，收集正确拼音', desc_en: 'Run and collect correct pinyin answers',
    // },
  ].filter(g => g.id); // Remove empty entries

  const GAMES = [
    { id:'speed',   icon:'⚡', color:'#FF6F00', bg:'#1a0a00',
      title:   t('闪电问答','Speed Quiz','Quiz Veloce'),
      desc:    t('8秒内选对答案，连击加分！','Answer in 8s, combos multiply your score!','Rispondi in 8s, combo moltiplicano il punteggio!'),
      tag:     t('趣味','Fun','Divertente'),
    },
    { id:'memory',  icon:'🃏', color:'#0288D1', bg:'#000d1a',
      title:   t('翻牌记忆','Memory Match','Memoria'),
      desc:    t('翻牌配对，测试你的记忆力','Flip and match cards, test your memory','Abbina le carte'),
      tag:     t('记忆','Memory','Memoria'),
    },
    { id:'falling', icon:'🌧', color:'#1565C0', bg:'#00000f',
      title:   t('字雨','Falling Sky','Pioggia di Caratteri'),
      desc:    t('字符从天而降，快速点击正确拼音！','Characters fall from the sky — tap the right answer!','Tocca la risposta giusta!'),
      tag:     t('快速','Fast','Veloce'),
    },
    { id:'spell',   icon:'🔤', color:'#7B1FA2', bg:'#100020',
      title:   t('拼词游戏','Word Spell','Componi'),
      desc:    t('看意思，拼出正确词语','See the meaning, tap characters to spell the word','Componi la parola'),
      tag:     t('拼写','Spell','Componi'),
    },
  ];

  if (game === 'speed')   return <SpeedQuiz   items={allItems}  onBack={()=>setGame(null)} lang={lang}/>;
  if (game === 'memory')  return <MemoryMatch  items={allItems}  onBack={()=>setGame(null)} lang={lang}/>;
  if (game === 'falling') return <FallingChars items={allItems}  onBack={()=>setGame(null)} lang={lang}/>;
  if (game === 'spell')   return <WordSpell    items={allItems.filter(i=>i.chars?.length>=2&&i.chars?.length<=4)} onBack={()=>setGame(null)} lang={lang}/>;

  // Unity WebGL games
  if (game?.startsWith('unity_')) {
    const unityId = game.replace('unity_','');
    const unityGame = UNITY_GAMES.find(g => g.id === unityId);
    return (
      <Suspense fallback={
        <div style={{minHeight:'100dvh',background:'#1a0a05',display:'flex',alignItems:'center',
          justifyContent:'center',color:'#a07850',fontSize:14}}>Loading Unity game…</div>
      }>
        <UnityGameFrame
          gameId={unityId}
          gameUrl={unityGame?.url}
          title={unityGame ? (lang==='zh' ? unityGame.zh : lang==='it' ? unityGame.it : unityGame.en) : unityId}
          lang={lang}
          initContent={{ words: allItems.slice(0,50), characters: allItems.filter(i=>i.type?.includes('Character')).slice(0,30) }}
          onScore={(score) => console.log('Unity score:', score)}
          onBack={()=>setGame(null)}
        />
      </Suspense>
    );
  }

  return (
    <div style={{ background:'#1a0a05', minHeight:'100dvh', paddingBottom:40 }}>
      {/* Header */}
      <div style={{ padding:'16px 16px 8px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none',
          fontSize:24, color:'#fdf6e3', cursor:'pointer' }}>‹</button>
        <div>
          <div style={{ fontSize:18, fontWeight:700, color:'#fdf6e3' }}>
            🎮 {t('游戏中心','Games','Giochi')}
          </div>
          <div style={{ fontSize:11, color:'#a07850' }}>
            {t('用游戏学中文','Learn Chinese through games','Impara il cinese giocando')}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', height:300, gap:12 }}>
          <div style={{ fontSize:40 }}>🎮</div>
          <div style={{ color:'#a07850', fontSize:13 }}>
            {t('加载游戏内容…','Loading game content…','Caricamento…')}
          </div>
        </div>
      ) : (
        <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:14 }}>
          {GAMES.map(g => (
            <button key={g.id} onClick={() => setGame(g.id)}
              onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}
              style={{ background:`linear-gradient(135deg, ${g.bg} 0%, ${g.color}22 100%)`,
                border:`1.5px solid ${g.color}44`, borderRadius:20, padding:'0',
                cursor:'pointer', textAlign:'left', overflow:'hidden',
                transition:'transform 0.2s, box-shadow 0.2s',
                boxShadow:`0 4px 20px ${g.color}22`,
                WebkitTapHighlightColor:'transparent' }}>
              <div style={{ padding:'20px 20px 16px', display:'flex', gap:16, alignItems:'center' }}>
                <div style={{ fontSize:52, lineHeight:1, flexShrink:0,
                  filter:'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }}>
                  {g.icon}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:17, fontWeight:700, color:'#fdf6e3' }}>{g.title}</span>
                    <span style={{ fontSize:10, background:g.color+'33', color:g.color,
                      padding:'2px 8px', borderRadius:8, fontWeight:600 }}>{g.tag}</span>
                  </div>
                  <div style={{ fontSize:12, color:'#a07850', lineHeight:1.5 }}>{g.desc}</div>
                </div>
                <div style={{ fontSize:22, color:g.color, opacity:0.7 }}>›</div>
              </div>
              <div style={{ height:3, background:`linear-gradient(90deg, ${g.color}, transparent)` }}/>
            </button>
          ))}

          {/* ── Unity WebGL games ── */}
          {UNITY_GAMES.length > 0 && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:6 }}>
                <div style={{ flex:1, height:1, background:'#333' }}/>
                <div style={{ fontSize:11, color:'#a07850', fontWeight:600 }}>
                  🎮 {t('Unity 3D 游戏','Unity 3D Games','Giochi Unity 3D')}
                </div>
                <div style={{ flex:1, height:1, background:'#333' }}/>
              </div>
              {UNITY_GAMES.map(g => (
                <button key={g.id} onClick={() => setGame(`unity_${g.id}`)}
                  style={{ background:`linear-gradient(135deg, #111 0%, ${g.color}22 100%)`,
                    border:`1.5px solid ${g.color}66`, borderRadius:20, padding:'16px 20px',
                    cursor:'pointer', textAlign:'left', display:'flex', gap:14, alignItems:'center',
                    WebkitTapHighlightColor:'transparent' }}>
                  <div style={{ fontSize:44, lineHeight:1 }}>{g.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <span style={{ fontSize:16, fontWeight:700, color:'#fdf6e3' }}>
                        {lang==='zh' ? g.zh : lang==='it' ? g.it : g.en}
                      </span>
                      <span style={{ fontSize:9, background:'#F57F1722', color:'#F57F17',
                        padding:'1px 6px', borderRadius:6, fontWeight:600 }}>UNITY</span>
                    </div>
                    <div style={{ fontSize:11, color:'#a07850' }}>
                      {lang==='zh' ? g.desc_zh : g.desc_en}
                    </div>
                  </div>
                  <div style={{ fontSize:20, color:g.color, opacity:0.8 }}>›</div>
                </button>
              ))}
            </>
          )}

          <div style={{ textAlign:'center', fontSize:11, color:'#5D2E0C', marginTop:4 }}>
            {t(`共 ${allItems.length} 条题目 · 内容来自所有学习模块`,
               `${allItems.length} questions from all learning modules`,
               `${allItems.length} domande da tutti i moduli`)}
          </div>
        </div>
      )}
    </div>
  );
}

// src/games/CompositionGame.jsx
// GAME 6: 🧱 组字工坊 — build characters from 偏旁部首
//
// Three modes over one dataset (compositionData.js):
//   拼一拼  assemble   sound + meaning → tap the two parts that build the character
//   拆一拆  decompose  character shown → split it back into 义符 + 声符
//   自由组合 sandbox    free-combine any two parts, discover real characters, collect them
//
// All three teach the same thing: a 形声字 is a meaning part plus a sound part.
// 清 = 氵 (about water) + 青 (sounds like qīng). Every reveal labels which is which,
// because that is the transferable skill — guessing at characters you've never seen.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLang } from '../context/LanguageContext.jsx';
import { useScreenHistory } from '../hooks/useScreenHistory.js';
import {
  CHARS, SEMANTIC, PHONETIC, BY_PAIR,
  SEMANTIC_BY_GLYPH, PHONETIC_BY_GLYPH,
  charGloss, partGloss, orderedParts,
} from '../data/compositionData.js';
import { playTTS } from '../utils/ttsHelper.js';
import { shuffle, awardPoints, ScoreBadge, Lives, ResultScreen } from './gameUi.jsx';

const TOTAL  = 10;
const LIVES  = 3;
const COLOR  = '#5C6BC0';
const SEM_C  = '#26A69A';   // 义符 — teal, matches the radical game
const PHO_C  = '#EF6C00';   // 声符 — orange
const BG     = '#0b0e1f';
const CARD   = '#151a33';
const BORDER = '#252c4d';

const FOUND_KEY = 'clf_compose_found';

const KAI = "'STKaiti','KaiTi',serif";

function loadFound() {
  try { return JSON.parse(localStorage.getItem(FOUND_KEY) || '[]'); } catch { return []; }
}
function saveFound(list) {
  try { localStorage.setItem(FOUND_KEY, JSON.stringify(list)); } catch { /* private mode */ }
}

const LAYOUT_LABEL = {
  lr:   ['左右结构', 'left–right',  'sinistra–destra'],
  tb:   ['上下结构', 'top–bottom',  'sopra–sotto'],
  encl: ['包围结构', 'enclosing',   'avvolgente'],
};

// ── A tappable component chip ──────────────────────────────────────────────────
function PartTile({ glyph, role, used, onTap, size = 56 }) {
  const accent = role === 's' ? SEM_C : role === 'ph' ? PHO_C : COLOR;
  return (
    <button onClick={onTap} disabled={used}
      style={{ width:size, height:size, borderRadius:14,
        border:`2px solid ${used ? '#1b2038' : accent + '77'}`,
        background: used ? '#0d1226' : CARD,
        color: used ? '#2b3358' : '#fdf6e3',
        fontSize: size * 0.55, fontFamily:KAI, lineHeight:1,
        cursor: used ? 'default' : 'pointer', transition:'all 0.15s',
        WebkitTapHighlightColor:'transparent' }}>
      {glyph}
    </button>
  );
}

// ── The two slots, arranged to match the character's real structure ────────────
function SlotBoard({ layout, filled, onClear, shake }) {
  const vertical = layout === 'tb';
  const slot = (i) => {
    const f = filled[i];
    const accent = f ? (f.role === 's' ? SEM_C : PHO_C) : BORDER;
    return (
      <button key={i} onClick={() => f && onClear(i)}
        style={{ width:76, height:76, borderRadius:14,
          border:`2px ${f ? 'solid' : 'dashed'} ${accent}`,
          background: f ? CARD : 'transparent',
          color:'#fdf6e3', fontSize:40, fontFamily:KAI, lineHeight:1,
          cursor: f ? 'pointer' : 'default', transition:'all 0.15s',
          WebkitTapHighlightColor:'transparent' }}>
        {f ? f.glyph : ''}
      </button>
    );
  };
  return (
    <div style={{ display:'flex', flexDirection: vertical ? 'column' : 'row', gap:10,
      justifyContent:'center', alignItems:'center',
      /* `shake` keyframes live in index.css:362 */
      animation: shake ? 'shake 0.3s ease' : 'none' }}>
      {slot(0)}
      <span style={{ color:'#3d4675', fontSize:20 }}>{vertical ? '' : '+'}</span>
      {slot(1)}
    </div>
  );
}

// ── Reveal: the finished character with each part's job spelled out ────────────
function RoleReveal({ x, lang, t }) {
  const sem = SEMANTIC_BY_GLYPH[x.s];
  const pho = PHONETIC_BY_GLYPH[x.ph];
  return (
    <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:18,
      padding:'16px 18px', width:'100%', maxWidth:360 }}>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
        <div style={{ fontSize:52, color:'#fdf6e3', fontFamily:KAI, lineHeight:1 }}>{x.c}</div>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:18, fontWeight:800, color:COLOR }}>{x.py}</span>
            <button onClick={() => playTTS(x.c)}
              style={{ border:'none', background:`${COLOR}22`, color:COLOR, borderRadius:9,
                padding:'3px 9px', fontSize:14, cursor:'pointer',
                WebkitTapHighlightColor:'transparent' }}>🔊</button>
          </div>
          <div style={{ fontSize:12, color:'#8f97c4', marginTop:2 }}>{charGloss(x, lang)}</div>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, background:'#0d1226',
          border:`1px solid ${SEM_C}44`, borderRadius:12, padding:'8px 10px' }}>
          <span style={{ fontSize:28, color:SEM_C, fontFamily:KAI, minWidth:34, textAlign:'center' }}>{x.s}</span>
          <span style={{ flex:1 }}>
            <span style={{ fontSize:11, color:SEM_C, fontWeight:700 }}>
              {t('义符 · 表意','MEANING PART','PARTE DI SIGNIFICATO')}
            </span>
            <div style={{ fontSize:12, color:'#8f97c4', marginTop:1 }}>
              {sem.py} · {partGloss(sem, lang)}
            </div>
          </span>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10, background:'#0d1226',
          border:`1px solid ${PHO_C}44`, borderRadius:12, padding:'8px 10px' }}>
          <span style={{ fontSize:28, color:PHO_C, fontFamily:KAI, minWidth:34, textAlign:'center' }}>{x.ph}</span>
          <span style={{ flex:1 }}>
            <span style={{ fontSize:11, color:PHO_C, fontWeight:700 }}>
              {t('声符 · 表音','SOUND PART','PARTE FONETICA')}
            </span>
            <div style={{ fontSize:12, color:'#8f97c4', marginTop:1 }}>
              {pho.py} → {x.py}
            </div>
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Shared header ──────────────────────────────────────────────────────────────
function GameHeader({ onBack, progress, lives }) {
  return (
    <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
      <button onClick={onBack} style={{ border:'none', background:'none', fontSize:22,
        color:'#fff', cursor:'pointer' }}>‹</button>
      <div style={{ flex:1, height:6, background:'#1b2038', borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${progress * 100}%`, background:COLOR,
          borderRadius:3, transition:'width 0.3s' }}/>
      </div>
      <Lives count={lives} max={LIVES}/>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODE 1 & 2 — 拼一拼 / 拆一拆 (same board, opposite direction)
// ══════════════════════════════════════════════════════════════════════════════
function BuildMode({ mode, onBack, lang, t }) {
  const reveal = mode === 'decompose';   // decompose shows the target glyph up front

  const [qs,     setQs]     = useState(() => shuffle(CHARS).slice(0, TOTAL));
  const [idx,    setIdx]    = useState(0);
  const [score,  setScore]  = useState(0);
  const [combo,  setCombo]  = useState(0);
  const [lives,  setLives]  = useState(LIVES);
  const [filled, setFilled] = useState([null, null]);
  const [result, setResult] = useState(null);   // null | 'right' | 'wrong'
  const [shake,  setShake]  = useState(false);
  const [phase,  setPhase]  = useState('playing');
  const [right,  setRight]  = useState(0);
  const endedRef = useRef(false);

  const x = qs[idx];

  // Tray: the two real parts plus four decoys, so the choice is never by elimination.
  const [tray, setTray] = useState([]);
  useEffect(() => {
    if (!x) return;
    const real = orderedParts(x);
    const semDecoys = shuffle(SEMANTIC.filter(s => s.p !== x.s)).slice(0, 2)
      .map(s => ({ glyph:s.p, role:'s' }));
    const phoDecoys = shuffle(PHONETIC.filter(p => p.p !== x.ph)).slice(0, 2)
      .map(p => ({ glyph:p.p, role:'ph' }));
    setTray(shuffle([...real, ...semDecoys, ...phoDecoys]));
    setFilled([null, null]);
    setResult(null);
  }, [x]);

  const check = useCallback((next) => {
    const want = orderedParts(x);
    // Position matters: 功 is 工+力, not 力+工 — order is part of knowing the character.
    const ok = next[0]?.glyph === want[0].glyph && next[1]?.glyph === want[1].glyph;
    if (ok) {
      const c = combo + 1;
      setCombo(c); setScore(s => s + 10 + c * 5); setRight(r => r + 1);
      setResult('right');
    } else {
      setCombo(0); setLives(l => l - 1); setResult('wrong');
      setShake(true); setTimeout(() => setShake(false), 400);
    }
    playTTS(x.c);
  }, [x, combo]);

  function tap(part, i) {
    if (result) return;
    const slot = filled[0] === null ? 0 : filled[1] === null ? 1 : -1;
    if (slot < 0) return;
    const next = [...filled];
    next[slot] = { ...part, trayIdx:i };
    setFilled(next);
    if (next[0] && next[1]) check(next);
  }

  function clearSlot(i) {
    if (result) return;
    const next = [...filled];
    next[i] = null;
    setFilled(next);
  }

  function nextQ() {
    if (lives <= 0 || idx + 1 >= qs.length) {
      if (!endedRef.current) {
        endedRef.current = true;
        awardPoints(mode === 'assemble' ? 'compose_assemble' : 'compose_decompose', score);
      }
      setPhase('result');
      return;
    }
    setIdx(i => i + 1);
  }

  function replay() {
    setQs(shuffle(CHARS).slice(0, TOTAL));
    setIdx(0); setScore(0); setCombo(0); setLives(LIVES); setRight(0);
    setFilled([null, null]); setResult(null); setPhase('playing');
    endedRef.current = false;
  }

  if (phase === 'result') return (
    <ResultScreen score={score} total={qs.length} max={TOTAL * 10 + TOTAL * 5 * 2}
      icon="🧱" title={t('组字工坊','Character Workshop')}
      onBack={onBack} onReplay={replay} lang={lang}
      extra={t(`拼对 ${right}/${qs.length} 个字`,
               `${right}/${qs.length} characters built`,
               `${right}/${qs.length} caratteri costruiti`)}/>
  );

  if (!x) return null;
  const layoutLabel = LAYOUT_LABEL[x.l][lang === 'zh' ? 0 : lang === 'it' ? 2 : 1];

  return (
    <div style={{ minHeight:'100dvh', background:BG, display:'flex', flexDirection:'column' }}>
      <GameHeader onBack={onBack} progress={(idx + 1) / qs.length} lives={lives}/>

      <div style={{ display:'flex', justifyContent:'center', gap:16, padding:'0 16px 12px' }}>
        <ScoreBadge score={score}       label={t('分数','Score')} color={COLOR}/>
        <ScoreBadge score={`×${combo}`} label={t('连击','Combo')} color="#6A1B9A"/>
        <ScoreBadge score={`${idx+1}/${qs.length}`} label={t('题目','Q')} color="#1565C0"/>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
        padding:'4px 16px 24px', gap:16, overflowY:'auto' }}>

        {/* Prompt */}
        <div style={{ background:CARD, borderRadius:20, padding:'16px 24px', width:'100%',
          maxWidth:360, textAlign:'center', border:`1px solid ${BORDER}` }}>
          <div style={{ fontSize:11, color:'#8f97c4', marginBottom:8 }}>
            {reveal ? t('把这个字拆成两部分','Split this character into its two parts','Dividi questo carattere in due parti')
                    : t('用两个部件拼出这个字','Build this character from two parts','Costruisci il carattere con due parti')}
          </div>
          {reveal ? (
            <div style={{ fontSize:64, color:'#fdf6e3', fontFamily:KAI, lineHeight:1.1 }}>{x.c}</div>
          ) : null}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10,
            marginTop: reveal ? 8 : 0 }}>
            <span style={{ fontSize:22, fontWeight:800, color:COLOR }}>{x.py}</span>
            <button onClick={() => playTTS(x.c)}
              style={{ border:'none', background:`${COLOR}22`, color:COLOR, borderRadius:10,
                padding:'4px 10px', fontSize:15, cursor:'pointer',
                WebkitTapHighlightColor:'transparent' }}>🔊</button>
          </div>
          <div style={{ fontSize:13, color:'#8f97c4', marginTop:4 }}>{charGloss(x, lang)}</div>
          <div style={{ fontSize:10, color:'#4d5688', marginTop:8 }}>{layoutLabel}</div>
        </div>

        {/* Slots */}
        <SlotBoard layout={x.l} filled={filled} onClear={clearSlot} shake={shake}/>

        {/* Tray */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:10, justifyContent:'center',
          maxWidth:360 }}>
          {tray.map((p, i) => (
            <PartTile key={`${p.glyph}-${i}`} glyph={p.glyph} role={result ? p.role : null}
              used={filled.some(f => f?.trayIdx === i)}
              onTap={() => tap(p, i)}/>
          ))}
        </div>

        {result && (
          <>
            <div style={{ fontSize:14, fontWeight:700,
              color: result === 'right' ? '#4CAF50' : '#F44336' }}>
              {result === 'right' ? `✓ ${t('拼对了','Correct','Corretto')}`
                                  : `✗ ${t('看看正确的组合','Here is the right build','Ecco la combinazione giusta')}`}
            </div>
            <RoleReveal x={x} lang={lang} t={t}/>
            <button onClick={nextQ}
              style={{ padding:'13px 36px', borderRadius:14, border:'none', background:COLOR,
                color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer',
                WebkitTapHighlightColor:'transparent' }}>
              {lives <= 0 ? t('查看成绩','See results','Vedi risultati')
                : idx + 1 >= qs.length ? t('完成','Finish','Fine')
                : t('继续','Continue','Continua')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODE 3 — 自由组合 sandbox
// ══════════════════════════════════════════════════════════════════════════════
function SandboxMode({ onBack, lang, t }) {
  const [sem,   setSem]   = useState(null);
  const [pho,   setPho]   = useState(null);
  const [found, setFound] = useState(loadFound);
  const [hit,   setHit]   = useState(null);    // the char just discovered//rediscovered
  const [miss,  setMiss]  = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Combine as soon as both sides are chosen.
  useEffect(() => {
    if (!sem || !pho) return;
    const x = BY_PAIR[`${sem}+${pho}`];
    if (x) {
      setHit(x); setMiss(false);
      playTTS(x.c);
      if (!found.includes(x.c)) {
        const next = [...found, x.c];
        setFound(next); saveFound(next);
        awardPoints('compose_discover', 5);
      }
    } else {
      setHit(null); setMiss(true);
    }
  }, [sem, pho]);   // eslint-disable-line react-hooks/exhaustive-deps

  function reset() { setSem(null); setPho(null); setHit(null); setMiss(false); }

  const pct = Math.round((found.length / CHARS.length) * 100);

  return (
    <div style={{ minHeight:'100dvh', background:BG, display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none', fontSize:22,
          color:'#fff', cursor:'pointer' }}>‹</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#fdf6e3' }}>
            🔮 {t('自由组合','Free Combine','Combinazione Libera')}
          </div>
          <div style={{ fontSize:11, color:'#8f97c4' }}>
            {t(`已发现 ${found.length}/${CHARS.length} 个字`,
               `${found.length}/${CHARS.length} characters discovered`,
               `${found.length}/${CHARS.length} caratteri scoperti`)}
          </div>
        </div>
        <button onClick={() => setShowAll(v => !v)}
          style={{ border:`1px solid ${BORDER}`, background:CARD, color:'#8f97c4',
            borderRadius:10, padding:'6px 10px', fontSize:12, cursor:'pointer' }}>
          {showAll ? t('返回','Back','Indietro') : `📖 ${t('图鉴','Collection','Raccolta')}`}
        </button>
      </div>

      <div style={{ padding:'0 16px 8px' }}>
        <div style={{ height:5, background:'#1b2038', borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, background:COLOR, borderRadius:3,
            transition:'width 0.4s' }}/>
        </div>
      </div>

      {showAll ? (
        <div style={{ flex:1, overflowY:'auto', padding:'12px 16px 32px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(64px, 1fr))',
            gap:8 }}>
            {CHARS.map(x => {
              const got = found.includes(x.c);
              return (
                <button key={x.c} onClick={() => got && playTTS(x.c)}
                  style={{ aspectRatio:'1', borderRadius:12, cursor: got ? 'pointer' : 'default',
                    border:`1px solid ${got ? COLOR + '66' : '#1b2038'}`,
                    background: got ? CARD : '#0d1226',
                    display:'flex', flexDirection:'column', alignItems:'center',
                    justifyContent:'center', gap:2, WebkitTapHighlightColor:'transparent' }}>
                  <span style={{ fontSize:26, fontFamily:KAI,
                    color: got ? '#fdf6e3' : '#232a4a' }}>{got ? x.c : '?'}</span>
                  {got && <span style={{ fontSize:9, color:'#8f97c4' }}>{x.py}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'4px 16px 24px',
          gap:14, overflowY:'auto' }}>

          {/* Result window */}
          <div style={{ background:CARD, border:`1px solid ${hit ? COLOR : BORDER}`,
            borderRadius:18, padding:'16px', minHeight:120, display:'flex',
            flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6 }}>
            {hit ? (
              <>
                <div style={{ fontSize:52, color:'#fdf6e3', fontFamily:KAI, lineHeight:1 }}>{hit.c}</div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:17, fontWeight:800, color:COLOR }}>{hit.py}</span>
                  <button onClick={() => playTTS(hit.c)}
                    style={{ border:'none', background:`${COLOR}22`, color:COLOR, borderRadius:8,
                      padding:'2px 8px', fontSize:13, cursor:'pointer' }}>🔊</button>
                </div>
                <div style={{ fontSize:12, color:'#8f97c4' }}>{charGloss(hit, lang)}</div>
                <div style={{ fontSize:11, color:'#8f97c4', marginTop:4 }}>
                  <span style={{ color:SEM_C }}>{hit.s} {t('表意','meaning','significato')}</span>
                  <span style={{ color:'#3d4675' }}> + </span>
                  <span style={{ color:PHO_C }}>{hit.ph} {t('表音','sound','suono')}</span>
                </div>
              </>
            ) : miss ? (
              <>
                <div style={{ fontSize:34, opacity:0.5 }}>🤔</div>
                <div style={{ fontSize:13, color:'#8f97c4' }}>
                  {sem}{' + '}{pho} — {t('不是一个字','not a character','non è un carattere')}
                </div>
                <div style={{ fontSize:11, color:'#4d5688' }}>
                  {t('换一个部件试试','Try swapping one part','Prova a cambiare una parte')}
                </div>
              </>
            ) : (
              <div style={{ fontSize:12, color:'#4d5688', textAlign:'center', lineHeight:1.7 }}>
                {t('选一个义符 + 一个声符，看看能不能组成字',
                   'Pick one meaning part and one sound part — see if they make a character',
                   'Scegli una parte di significato e una fonetica')}
              </div>
            )}
            {(hit || miss) && (
              <button onClick={reset}
                style={{ marginTop:8, border:`1px solid ${BORDER}`, background:'transparent',
                  color:'#8f97c4', borderRadius:10, padding:'5px 14px', fontSize:12,
                  cursor:'pointer' }}>
                {t('重选','Clear','Azzera')}
              </button>
            )}
          </div>

          {/* 义符 palette */}
          <div>
            <div style={{ fontSize:11, color:SEM_C, fontWeight:700, marginBottom:6 }}>
              {t('义符 · 表示意思','MEANING PARTS','PARTI DI SIGNIFICATO')}
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
              {SEMANTIC.map(s => (
                <button key={s.p} onClick={() => setSem(s.p === sem ? null : s.p)}
                  style={{ width:46, height:46, borderRadius:12, fontSize:24, fontFamily:KAI,
                    border:`2px solid ${s.p === sem ? SEM_C : '#1b2038'}`,
                    background: s.p === sem ? `${SEM_C}22` : CARD,
                    color:'#fdf6e3', cursor:'pointer', lineHeight:1,
                    WebkitTapHighlightColor:'transparent' }}>{s.p}</button>
              ))}
            </div>
          </div>

          {/* 声符 palette */}
          <div>
            <div style={{ fontSize:11, color:PHO_C, fontWeight:700, marginBottom:6 }}>
              {t('声符 · 表示读音','SOUND PARTS','PARTI FONETICHE')}
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
              {PHONETIC.map(p => (
                <button key={p.p} onClick={() => setPho(p.p === pho ? null : p.p)}
                  style={{ width:46, height:46, borderRadius:12, fontSize:24, fontFamily:KAI,
                    border:`2px solid ${p.p === pho ? PHO_C : '#1b2038'}`,
                    background: p.p === pho ? `${PHO_C}22` : CARD,
                    color:'#fdf6e3', cursor:'pointer', lineHeight:1,
                    WebkitTapHighlightColor:'transparent' }}>{p.p}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Hub
// ══════════════════════════════════════════════════════════════════════════════
export default function CompositionGame({ onBack, lang: langProp }) {
  const { lang: ctxLang } = useLang();
  const lang = langProp || ctxLang || 'zh';
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it || en) : en;

  const [mode, setMode] = useScreenHistory(null, 'compose');
  const found = loadFound();

  if (mode === 'assemble')  return <BuildMode mode="assemble"  onBack={() => setMode(null)} lang={lang} t={t}/>;
  if (mode === 'decompose') return <BuildMode mode="decompose" onBack={() => setMode(null)} lang={lang} t={t}/>;
  if (mode === 'sandbox')   return <SandboxMode onBack={() => setMode(null)} lang={lang} t={t}/>;

  const MODES = [
    { id:'assemble',  icon:'🧱', color:COLOR,
      title: t('拼一拼','Assemble','Assembla'),
      desc:  t('听读音看意思，用两个部件拼出汉字',
               'Hear the sound, see the meaning, tap two parts to build the character',
               'Ascolta e costruisci il carattere con due parti') },
    { id:'decompose', icon:'✂️', color:'#26A69A',
      title: t('拆一拆','Take Apart','Scomponi'),
      desc:  t('给你一个字，把它拆成义符和声符',
               'Split a character back into its meaning part and sound part',
               'Dividi il carattere in parte semantica e fonetica') },
    { id:'sandbox',   icon:'🔮', color:'#EF6C00',
      title: t('自由组合','Free Combine','Combinazione Libera'),
      desc:  t(`任意组合部件，发现真正的汉字 · 已收集 ${found.length}/${CHARS.length}`,
               `Combine parts freely and discover real characters · ${found.length}/${CHARS.length} collected`,
               `Combina liberamente · ${found.length}/${CHARS.length} raccolti`) },
  ];

  return (
    <div style={{ background:BG, minHeight:'100dvh', paddingBottom:40 }}>
      <div style={{ padding:'16px 16px 8px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none',
          fontSize:24, color:'#fdf6e3', cursor:'pointer' }}>‹</button>
        <div>
          <div style={{ fontSize:18, fontWeight:700, color:'#fdf6e3' }}>
            🧱 {t('组字工坊','Character Workshop','Officina dei Caratteri')}
          </div>
          <div style={{ fontSize:11, color:'#8f97c4' }}>
            {t('偏旁部首怎么组成汉字','How radicals combine into characters','Come i radicali formano i caratteri')}
          </div>
        </div>
      </div>

      {/* The one idea the whole game rests on */}
      <div style={{ margin:'8px 16px 4px', background:CARD, border:`1px solid ${BORDER}`,
        borderRadius:16, padding:'14px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          fontFamily:KAI, fontSize:30, color:'#fdf6e3' }}>
          <span style={{ color:SEM_C }}>氵</span>
          <span style={{ fontSize:18, color:'#3d4675' }}>+</span>
          <span style={{ color:PHO_C }}>青</span>
          <span style={{ fontSize:18, color:'#3d4675' }}>=</span>
          <span>清</span>
          <span style={{ fontSize:15, color:COLOR, fontFamily:'inherit', fontWeight:700 }}>qīng</span>
        </div>
        <div style={{ fontSize:11, color:'#8f97c4', textAlign:'center', marginTop:8, lineHeight:1.6 }}>
          <span style={{ color:SEM_C }}>{t('义符给意思','the meaning part tells you what it is about',
                                            'la parte semantica dà il senso')}</span>
          {' · '}
          <span style={{ color:PHO_C }}>{t('声符给读音','the sound part tells you how to say it',
                                            'la parte fonetica dà il suono')}</span>
        </div>
      </div>

      <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:14 }}>
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            style={{ background:`linear-gradient(135deg, ${CARD} 0%, ${m.color}22 100%)`,
              border:`1.5px solid ${m.color}44`, borderRadius:20, padding:'18px 20px',
              cursor:'pointer', textAlign:'left', display:'flex', gap:16, alignItems:'center',
              boxShadow:`0 4px 20px ${m.color}18`,
              WebkitTapHighlightColor:'transparent' }}>
            <div style={{ fontSize:44, lineHeight:1, flexShrink:0 }}>{m.icon}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:17, fontWeight:700, color:'#fdf6e3', marginBottom:4 }}>{m.title}</div>
              <div style={{ fontSize:12, color:'#8f97c4', lineHeight:1.5 }}>{m.desc}</div>
            </div>
            <div style={{ fontSize:22, color:m.color, opacity:0.7 }}>›</div>
          </button>
        ))}
      </div>

      <div style={{ textAlign:'center', fontSize:11, color:'#3d4675', marginTop:4 }}>
        {t(`${CHARS.length} 个形声字 · ${SEMANTIC.length} 个义符 · ${PHONETIC.length} 个声符`,
           `${CHARS.length} characters · ${SEMANTIC.length} meaning parts · ${PHONETIC.length} sound parts`,
           `${CHARS.length} caratteri · ${SEMANTIC.length} semantiche · ${PHONETIC.length} fonetiche`)}
      </div>
    </div>
  );
}

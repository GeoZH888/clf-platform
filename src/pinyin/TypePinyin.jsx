// src/pinyin/TypePinyin.jsx
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { playTTS } from '../utils/ttsHelper';
import { usePinyinProgress } from '../hooks/usePinyinProgress.js';

const TOKEN_KEY = 'jgw_device_token';

// Default exercises if no DB data
const DEFAULT = [
  { char:'你', py:'nǐ',  hint_zh:'你好', hint_en:'you' },
  { char:'我', py:'wǒ',  hint_zh:'我是', hint_en:'I/me' },
  { char:'好', py:'hǎo', hint_zh:'你好', hint_en:'good' },
  { char:'是', py:'shì', hint_zh:'我是', hint_en:'to be' },
  { char:'不', py:'bù',  hint_zh:'不是', hint_en:'no/not' },
  { char:'他', py:'tā',  hint_zh:'他是', hint_en:'he/him' },
  { char:'她', py:'tā',  hint_zh:'她是', hint_en:'she/her' },
  { char:'们', py:'men', hint_zh:'我们', hint_en:'plural suffix' },
];

// Tone map for keyboard
const TONE_MAP = {
  a: ['ā','á','ǎ','à','a'],
  e: ['ē','é','ě','è','e'],
  i: ['ī','í','ǐ','ì','i'],
  o: ['ō','ó','ǒ','ò','o'],
  u: ['ū','ú','ǔ','ù','u'],
  ü: ['ǖ','ǘ','ǚ','ǜ','ü'],
};

const TONE_COLORS = ['#1565C0','#2E7D32','#E65100','#B71C1C','#888'];
const TONE_BG     = ['#E3F2FD','#E8F5E9','#FFF3E0','#FFEBEE','#f5f5f5'];
const TONE_NAMES  = ['一声','二声','三声','四声','轻声'];

export default function TypePinyin({ onBack, lang='zh' }) {
  const { recordPractice, sortAdaptively, getEntry } = usePinyinProgress();

  // DEFAULT exercises, sorted adaptively at session start (weak-first).
  const [exercises, setExercises] = useState(() =>
    sortAdaptively('type', DEFAULT, ex => ex.char)
  );
  const [idx,       setIdx]       = useState(0);
  const [input,     setInput]     = useState('');
  const [base,      setBase]      = useState('a');
  const [result,    setResult]    = useState(null); // null | 'correct' | 'wrong'
  const [showHint,  setShowHint]  = useState(false);
  const [score,     setScore]     = useState({ correct:0, total:0 });
  const [done,      setDone]      = useState(false);
  const inputRef = useRef(null);

  const t = (zh, en, it) => lang==='zh' ? zh : lang==='it' ? it : en;

  useEffect(() => {
    // Load exercises from DB, re-sort adaptively when they arrive
    supabase.from('jgw_pinyin_exercises').select('type_exercises').maybeSingle()
      .then(({ data }) => {
        if (data?.type_exercises?.length > 0)
          setExercises(sortAdaptively('type', data.type_exercises, ex => ex.char));
      });
    // Only sort once at mount — don't re-sort on every progress tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ex = exercises[idx];

  function insertTone(char) {
    const start = inputRef.current?.selectionStart ?? input.length;
    const end   = inputRef.current?.selectionEnd   ?? input.length;
    const next  = input.slice(0, start) + char + input.slice(end);
    setInput(next);
    setTimeout(() => inputRef.current?.setSelectionRange(start+1, start+1), 0);
    inputRef.current?.focus();
  }

  function checkAnswer() {
    const correct = input.trim().toLowerCase() === ex.py.toLowerCase();
    setResult(correct ? 'correct' : 'wrong');
    setScore(s => ({ correct: s.correct+(correct?1:0), total: s.total+1 }));

    // ── Adaptive progress: binary 100/0 for this item's history ──
    if (ex?.char) recordPractice('type', ex.char, correct ? 100 : 0);

    // Log
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      supabase.from('pinyin_practice_log').insert({
        device_token: token, module: 'type',
        score: correct ? 100 : 0, correct: correct, total: 1, attempts: 1,
      });
    }

    setTimeout(() => {
      if (idx + 1 >= exercises.length) { setDone(true); return; }
      setIdx(i => i+1);
      setInput(''); setResult(null); setShowHint(false);
    }, 1200);
  }

  function restart() {
    setIdx(0); setInput(''); setResult(null);
    setShowHint(false); setScore({correct:0,total:0}); setDone(false);
  }

  if (done) {
    const pct = Math.round(score.correct / score.total * 100);
    return (
      <div style={{ minHeight:'100dvh', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        background:'var(--bg)', padding:'2rem', gap:'1.5rem' }}>
        <div style={{ fontSize:64 }}>{pct>=80?'🎉':pct>=60?'👍':'💪'}</div>
        <div style={{ fontSize:48, fontWeight:600,
          color:pct>=80?'#2E7D32':pct>=60?'#E65100':'#1565C0' }}>{pct}%</div>
        <div style={{ fontSize:14, color:'var(--text-2)' }}>
          {score.correct}/{score.total} {t('正确','correct','corrette')}
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <div onClick={restart}
            style={{ padding:'12px 24px', borderRadius:12, background:'#4CAF50',
              color:'#fff', fontSize:14, cursor:'pointer', fontWeight:500,
              WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
            {t('再来一遍','Again','Ancora')}
          </div>
          <div onClick={onBack}
            style={{ padding:'12px 24px', borderRadius:12, fontSize:14, cursor:'pointer',
              border:'1px solid var(--border)', background:'var(--card)',
              WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
            {t('返回','Back','Indietro')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background:'var(--bg)', minHeight:'100dvh', paddingBottom:40 }}>

      {/* Header */}
      <div style={{ background:'#1565C0', padding:'12px 16px',
        display:'flex', alignItems:'center', gap:12 }}>
        <div onTouchStart={onBack} onClick={onBack}
          style={{ fontSize:22, color:'#fff', cursor:'pointer', padding:'4px 8px',
            WebkitTapHighlightColor:'transparent' }}>‹</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:500, color:'#fff' }}>
            {t('拼音输入','Type Pinyin','Scrivi Pinyin')}
          </div>
          <div style={{ fontSize:10, color:'#90CAF9' }}>大卫学中文</div>
        </div>
        <div style={{ fontSize:13, color:'#90CAF9' }}>{idx+1}/{exercises.length}</div>
      </div>

      {/* Progress */}
      <div style={{ height:4, background:'#BBDEFB' }}>
        <div style={{ height:4, background:'#1565C0',
          width:`${(idx/exercises.length)*100}%`, transition:'width 0.3s' }}/>
      </div>

      <div style={{ padding:'16px' }}>

        {/* Score */}
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
          <span style={{ fontSize:12, color:'#2E7D32', background:'#E8F5E9',
            padding:'3px 10px', borderRadius:12 }}>
            ✓ {score.correct}/{score.total}
          </span>
        </div>

        {/* Character card */}
        <div style={{ background:'var(--card)', borderRadius:20,
          border:'1px solid var(--border)', padding:'28px 20px',
          textAlign:'center', marginBottom:16,
          boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize:72, fontFamily:"'STKaiti','KaiTi',Georgia,serif",
            color:'var(--text)', lineHeight:1, marginBottom:12 }}>
            {ex?.char}
          </div>

          {/* ── Adaptive status: user's past performance on THIS char ── */}
          {(() => {
            const past = ex?.char ? getEntry('type', ex.char) : null;
            return (
              <div style={{ fontSize:10, color:'#a07850', marginBottom:8,
                display:'flex', gap:6, justifyContent:'center', alignItems:'center' }}>
                <span>✨</span>
                <span>
                  {past
                    ? (lang === 'zh' ? `已练 ${past.practiced} 次 · 最高 ${past.maxScore}分`
                     : lang === 'it' ? `Praticato ${past.practiced}× · max ${past.maxScore}`
                     :                 `Practiced ${past.practiced}× · max ${past.maxScore}`)
                    : (lang === 'zh' ? '初次练习 · 薄弱字优先'
                     : lang === 'it' ? 'Prima volta · deboli per primi'
                     :                 'First time · weak-first order')}
                </span>
              </div>
            );
          })()}

          {showHint && (
            <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.8 }}>
              <div>{ex?.hint_zh}</div>
              <div style={{ fontSize:11, color:'var(--text-3)' }}>
                {lang==='it' ? ex?.hint_it : ex?.hint_en}
              </div>
            </div>
          )}
          <div style={{ marginTop:10, display:'flex', gap:8, justifyContent:'center' }}>
            <div onTouchStart={() => playTTS(ex?.char)} onClick={() => playTTS(ex?.char)}
              style={{ padding:'6px 14px', borderRadius:20, background:'#E3F2FD',
                color:'#1565C0', fontSize:12, cursor:'pointer',
                WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
              🔊 {t('听','Hear','Ascolta')}
            </div>
            <div onTouchStart={() => setShowHint(h=>!h)} onClick={() => setShowHint(h=>!h)}
              style={{ padding:'6px 14px', borderRadius:20, background:'#FFF8E1',
                color:'#E65100', fontSize:12, cursor:'pointer',
                WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
              💡 {t('提示','Hint','Aiuto')}
            </div>
          </div>
        </div>

        {/* Result feedback */}
        {result && (
          <div style={{ textAlign:'center', marginBottom:10, padding:'10px',
            borderRadius:12, fontSize:16, fontWeight:500,
            background: result==='correct' ? '#E8F5E9' : '#FFEBEE',
            color: result==='correct' ? '#2E7D32' : '#c0392b' }}>
            {result==='correct'
              ? `✅ ${t('正确！','Correct!','Corretto!')} ${ex?.py}`
              : `❌ ${t('答案是','Answer:','Risposta:')} ${ex?.py}`}
          </div>
        )}

        {/* Input field */}
        <div style={{ background:'var(--card)', borderRadius:16,
          border:'1px solid var(--border)', padding:'14px', marginBottom:12 }}>
          <label style={{ fontSize:11, color:'var(--text-3)', display:'block', marginBottom:6 }}>
            {t('输入拼音（含声调）','Type pinyin with tone marks','Scrivi pinyin con toni')}
          </label>
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') checkAnswer(); }}
              placeholder={t('如 rén、nǐ hǎo','e.g. rén, nǐ hǎo','es. rén')}
              disabled={!!result}
              style={{ flex:1, padding:'10px 14px', fontSize:20,
                borderRadius:10, border:`2px solid ${
                  result==='correct' ? '#4CAF50' :
                  result==='wrong'   ? '#f44336' : '#7B1FA2'}`,
                outline:'none', fontFamily:'monospace',
                background: result ? '#fafafa' : '#fff' }}/>
          </div>
        </div>

        {/* Tone keyboard — ABOVE confirm button */}
        <div style={{ background:'var(--card)', borderRadius:16,
          border:'1px solid var(--border)', padding:'12px', marginBottom:12 }}>
          <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:8 }}>
            🎵 {t('声调键盘 · 点击插入','Tap to insert tone','Tocca per inserire')}
          </div>

          {/* Vowel selector */}
          <div style={{ display:'flex', gap:5, marginBottom:10, flexWrap:'wrap' }}>
            {Object.keys(TONE_MAP).map(v => (
              <div key={v}
                onTouchStart={() => setBase(v)} onClick={() => setBase(v)}
                style={{ padding:'7px 16px', borderRadius:20, cursor:'pointer',
                  fontSize:16, fontWeight:600,
                  border:`2px solid ${base===v ? '#7B1FA2' : 'var(--border)'}`,
                  background: base===v ? '#7B1FA2' : 'var(--card)',
                  color: base===v ? '#fff' : 'var(--text-2)',
                  WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
                {v}
              </div>
            ))}
          </div>

          {/* Tone buttons */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6, marginBottom:10 }}>
            {TONE_MAP[base].map((char, i) => (
              <div key={i}
                onTouchStart={() => insertTone(char)}
                onClick={() => insertTone(char)}
                style={{ padding:'12px 4px', borderRadius:10, cursor:'pointer',
                  textAlign:'center', border:`1px solid ${TONE_COLORS[i]}33`,
                  background: TONE_BG[i],
                  WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
                <div style={{ fontSize:24, fontWeight:600, color:TONE_COLORS[i] }}>{char}</div>
                <div style={{ fontSize:9, color:TONE_COLORS[i], marginTop:2, opacity:0.8 }}>{TONE_NAMES[i]}</div>
              </div>
            ))}
          </div>

          {/* Consonants + backspace */}
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w'].map(c => (
              <div key={c}
                onTouchStart={() => insertTone(c)} onClick={() => insertTone(c)}
                style={{ padding:'7px 9px', borderRadius:6, cursor:'pointer',
                  fontSize:13, background:'#f5f5f5', color:'#333',
                  border:'1px solid #ddd', minWidth:32, textAlign:'center',
                  WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
                {c}
              </div>
            ))}
            <div
              onTouchStart={() => setInput(v => v.slice(0,-1))}
              onClick={() => setInput(v => v.slice(0,-1))}
              style={{ padding:'7px 12px', borderRadius:6, cursor:'pointer',
                fontSize:14, background:'#ffebee', color:'#c0392b',
                border:'1px solid #ffcccc',
                WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
              ⌫
            </div>
            {/* Space key */}
            <div
              onTouchStart={() => insertTone(' ')} onClick={() => insertTone(' ')}
              style={{ padding:'7px 20px', borderRadius:6, cursor:'pointer',
                fontSize:13, background:'#f5f5f5', color:'#666',
                border:'1px solid #ddd',
                WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
              空格
            </div>
          </div>
        </div>

        {/* Confirm button */}
        <div onTouchStart={checkAnswer} onClick={checkAnswer}
          style={{ width:'100%', padding:'14px', borderRadius:14,
            background: result || !input.trim() ? '#ddd' : '#7B1FA2',
            color:'#fff', fontSize:16, cursor:'pointer', fontWeight:600,
            textAlign:'center', marginBottom:8,
            WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
          {t('确认','Confirm','Conferma')}
        </div>
      </div>
    </div>
  );
}

// src/words/WordsFill.jsx
// See meaning, type the Chinese word

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import TtsButton from '../components/TtsButton';

const TOKEN_KEY = 'jgw_device_token';
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

export default function WordsFill({ theme, onBack, lang='zh' }) {
  const [words,    setWords]    = useState([]);
  const [idx,      setIdx]      = useState(0);
  const [input,    setInput]    = useState('');
  const [result,   setResult]   = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [score,    setScore]    = useState(0);
  const [done,     setDone]     = useState(false);
  const [hint,     setHint]     = useState(false);
  const inputRef = useRef(null);

  const t = (zh, en, it) => lang==='zh' ? zh : lang==='it' ? it : en;

  useEffect(() => {
    const q = supabase.from('jgw_words').select('*');
    if (theme && theme !== 'all') q.eq('theme', theme);
    q.then(({ data }) => setWords(shuffle(data || [])));
  }, [theme]);

  if (!words.length) return (
    <div style={{ padding:'3rem', textAlign:'center', color:'var(--text-3)' }}>
      {t('加载中…','Loading…','Caricamento…')}
    </div>
  );

  const word = words[idx];

  function check() {
    if (!input.trim()) return;
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    const correct = input.trim() === word.word_zh;

    if (!correct) {
      setResult('wrong');
      setTimeout(() => { setResult(null); setInput(''); inputRef.current?.focus(); }, 800);
      return;
    }

    const pts = newAttempts===1?100:newAttempts===2?70:newAttempts===3?40:10;
    setScore(s => s + pts);
    setResult('correct');

    const token = localStorage.getItem(TOKEN_KEY);
    if (token) supabase.from('jgw_words_log').insert({
      device_token:token, word_zh:word.word_zh, mode:'fill',
      correct:true, score:pts, attempts:newAttempts,
    });

    setTimeout(() => {
      if (idx+1 >= words.length) { setDone(true); }
      else { setIdx(i=>i+1); setInput(''); setResult(null); setAttempts(0); setHint(false); }
    }, 900);
  }

  function skip() {
    setResult('correct');
    setInput(word.word_zh);
    setTimeout(() => {
      if (idx+1 >= words.length) { setDone(true); }
      else { setIdx(i=>i+1); setInput(''); setResult(null); setAttempts(0); setHint(false); }
    }, 1200);
  }

  if (done) {
    const max = words.length * 100;
    const pct = Math.round((score/max)*100);
    return (
      <div style={{ background:'var(--bg)', minHeight:'100dvh',
        display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'2rem', gap:'1.5rem' }}>
        <div style={{ fontSize:64 }}>{pct>=80?'🎉':pct>=50?'👍':'💪'}</div>
        <div style={{ fontSize:48, fontWeight:600,
          color:pct>=80?'#2E7D32':pct>=50?'#E65100':'#7B1FA2' }}>{score}分</div>
        <div style={{ fontSize:13, color:'var(--text-2)' }}>
          {t(`满分${max}分`,`Max ${max}pts`,`Max ${max}pt`)}
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <div onTouchStart={() => {setIdx(0);setInput('');setResult(null);setScore(0);setDone(false);setAttempts(0);setHint(false);}}
            onClick={() => {setIdx(0);setInput('');setResult(null);setScore(0);setDone(false);setAttempts(0);setHint(false);}}
            style={{ padding:'12px 24px', borderRadius:12, background:'#7B1FA2',
              color:'#fff', fontSize:14, cursor:'pointer',
              WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
            {t('再练','Again','Ancora')}
          </div>
          <div onTouchStart={onBack} onClick={onBack}
            style={{ padding:'12px 24px', borderRadius:12,
              border:'1px solid var(--border)', background:'var(--card)',
              fontSize:14, cursor:'pointer',
              WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
            {t('返回','Back','Indietro')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background:'var(--bg)', minHeight:'100dvh', paddingBottom:80 }}>
      <div style={{ background:'#7B1FA2', padding:'12px 16px',
        display:'flex', alignItems:'center', gap:12 }}>
        <div onTouchStart={onBack} onClick={onBack}
          style={{ fontSize:22, color:'#fff', cursor:'pointer',
            padding:'4px 8px', WebkitTapHighlightColor:'transparent' }}>‹</div>
        <div style={{ flex:1, fontSize:15, fontWeight:500, color:'#fff' }}>
          {t('看义填词','Fill in Blank','Completa')}
        </div>
        <div style={{ fontSize:13, color:'#CE93D8' }}>{idx+1}/{words.length}</div>
      </div>

      <div style={{ height:4, background:'#E1BEE7' }}>
        <div style={{ height:4, background:'#7B1FA2',
          width:`${(idx/words.length)*100}%`, transition:'width 0.3s' }}/>
      </div>

      <div style={{ padding:'24px 16px', textAlign:'center' }}>
        {/* Meaning */}
        <div style={{ background:'var(--card)', borderRadius:16,
          border:'1px solid var(--border)', padding:'20px', marginBottom:20 }}>
          <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:8 }}>
            {t('意思','Meaning','Significato')}
          </div>
          <div style={{ fontSize:26, fontWeight:600, color:'var(--text)', marginBottom:6 }}>
            {lang==='it' ? (word.meaning_it || word.meaning_en) : word.meaning_en}
          </div>
          {word.example_en && (
            <div style={{ fontSize:12, color:'var(--text-3)', marginTop:8, lineHeight:1.6 }}>
              {lang==='it' ? (word.example_it || word.example_en) : word.example_en}
            </div>
          )}
        </div>

        {/* Hint */}
        {hint && (
          <div style={{ marginBottom:12, padding:'8px 14px',
            background:'#F3E5F5', borderRadius:10,
            fontSize:16, color:'#7B1FA2', letterSpacing:4 }}>
            {word.pinyin}
          </div>
        )}

        {/* Input */}
        <input ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key==='Enter' && (result ? null : check())}
          placeholder={t('输入汉字','Type Chinese characters','Scrivi in cinese')}
          disabled={!!result}
          style={{ width:'100%', padding:'14px 16px', fontSize:22,
            borderRadius:14, textAlign:'center', boxSizing:'border-box',
            border:`2px solid ${result==='correct'?'#2E7D32':result==='wrong'?'#c0392b':'var(--border)'}`,
            background:result==='correct'?'#E8F5E9':result==='wrong'?'#FFEBEE':'var(--card)',
            color:'var(--text)', outline:'none',
            fontFamily:"'STKaiti','KaiTi',Georgia,serif" }}/>

        {/* Feedback */}
        {result==='correct' && (
          <div style={{ fontSize:16, color:'#2E7D32', marginTop:10, fontWeight:500 }}>
            ✓ {t('正确！','Correct!','Corretto!')}
            <TtsButton text={word.word_zh} size="sm" style={{ marginLeft:8, background:'#2E7D32' }}/>
          </div>
        )}

        {/* Action buttons */}
        {!result && (
          <div style={{ display:'flex', gap:10, marginTop:14, justifyContent:'center' }}>
            <div onTouchStart={() => setHint(h => !h)} onClick={() => setHint(h => !h)}
              style={{ padding:'11px 20px', borderRadius:12, cursor:'pointer',
                border:'1px solid var(--border)', background:'var(--card)',
                fontSize:13, color:'var(--text-2)',
                WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
              {hint ? t('隐藏拼音','Hide hint','Nascondi') : t('提示拼音','Show pinyin','Mostra pinyin')}
            </div>
            <div onTouchStart={check} onClick={check}
              style={{ padding:'11px 24px', borderRadius:12, cursor:'pointer',
                background: input.trim() ? '#7B1FA2' : '#ddd',
                border:'none', color:'#fff', fontSize:14, fontWeight:500,
                WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
              {t('确认','Check','Controlla')}
            </div>
          </div>
        )}

        {/* Skip */}
        {!result && attempts >= 2 && (
          <div onTouchStart={skip} onClick={skip}
            style={{ marginTop:10, fontSize:12, color:'var(--text-3)',
              cursor:'pointer', textDecoration:'underline',
              WebkitTapHighlightColor:'transparent' }}>
            {t('跳过显示答案','Skip & show answer','Salta e mostra')}
          </div>
        )}
      </div>
    </div>
  );
}

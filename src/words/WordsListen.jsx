// src/words/WordsListen.jsx
// Hear a word, choose its meaning from 4 options

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import TtsButton from '../components/TtsButton';

const TOKEN_KEY = 'jgw_device_token';
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

export default function WordsListen({ theme, onBack, lang='zh' }) {
  const [words,    setWords]    = useState([]);
  const [idx,      setIdx]      = useState(0);
  const [chosen,   setChosen]   = useState(null);
  const [played,   setPlayed]   = useState(false);
  const [score,    setScore]    = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [done,     setDone]     = useState(false);

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

  // Build 4 options: correct + 3 random wrong
  const options = (() => {
    const others = words.filter((_, i) => i !== idx);
    const wrong  = shuffle(others).slice(0, 3);
    return shuffle([word, ...wrong]);
  })();

  function getMeaning(w) {
    return lang==='it' ? (w.meaning_it || w.meaning_en) : w.meaning_en;
  }

  function choose(opt) {
    if (chosen || !played) return;
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    const correct = opt.word_zh === word.word_zh;

    if (!correct) {
      setChosen(opt.word_zh);
      setTimeout(() => setChosen(null), 700);
      return;
    }

    const pts = newAttempts === 1 ? 100 : newAttempts === 2 ? 70 : 40;
    setScore(s => s + pts);
    setChosen(opt.word_zh);

    const token = localStorage.getItem(TOKEN_KEY);
    if (token) supabase.from('jgw_words_log').insert({
      device_token:token, word_zh:word.word_zh, mode:'listen',
      correct:true, score:pts, attempts:newAttempts,
    });

    setTimeout(() => {
      if (idx + 1 >= words.length) { setDone(true); }
      else { setIdx(i=>i+1); setChosen(null); setPlayed(false); setAttempts(0); }
    }, 900);
  }

  if (done) {
    const max = words.length * 100;
    const pct = Math.round((score / max) * 100);
    return (
      <div style={{ background:'var(--bg)', minHeight:'100dvh',
        display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'2rem', gap:'1.5rem' }}>
        <div style={{ fontSize:64 }}>{pct>=80?'🎉':pct>=50?'👍':'💪'}</div>
        <div style={{ fontSize:48, fontWeight:600,
          color:pct>=80?'#2E7D32':pct>=50?'#E65100':'#1565C0' }}>{score}分</div>
        <div style={{ fontSize:13, color:'var(--text-2)' }}>
          {t(`满分${max}分`,`Max ${max}pts`,`Max ${max}pt`)}
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <div onTouchStart={() => {setIdx(0);setChosen(null);setScore(0);setDone(false);setPlayed(false);setAttempts(0);}}
            onClick={() => {setIdx(0);setChosen(null);setScore(0);setDone(false);setPlayed(false);setAttempts(0);}}
            style={{ padding:'12px 24px', borderRadius:12, background:'#F57F17',
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
      <div style={{ background:'#F57F17', padding:'12px 16px',
        display:'flex', alignItems:'center', gap:12 }}>
        <div onTouchStart={onBack} onClick={onBack}
          style={{ fontSize:22, color:'#fff', cursor:'pointer',
            padding:'4px 8px', WebkitTapHighlightColor:'transparent' }}>‹</div>
        <div style={{ flex:1, fontSize:15, fontWeight:500, color:'#fff' }}>
          {t('听词选义','Listen & Choose','Ascolta e Scegli')}
        </div>
        <div style={{ fontSize:13, color:'#FFE0B2' }}>{idx+1}/{words.length}</div>
      </div>

      <div style={{ height:4, background:'#FFE0B2' }}>
        <div style={{ height:4, background:'#F57F17',
          width:`${(idx/words.length)*100}%`, transition:'width 0.3s' }}/>
      </div>

      {/* Play button */}
      <div style={{ textAlign:'center', padding:'32px 16px 24px' }}>
        <TtsButton text={word.word_zh} size="lg"
          style={{ background: played ? '#888' : '#F57F17' }}
          onAfterPlay={() => setPlayed(true)}/>
        <div style={{ fontSize:12, color:'var(--text-3)', marginTop:12 }}>
          {!played
            ? t('👆 点击听发音','👆 Tap to listen','👆 Tocca per ascoltare')
            : attempts > 0
            ? t(`第${attempts+1}次尝试`,`Attempt ${attempts+1}`,`Tentativo ${attempts+1}`)
            : t('选择正确的意思','Choose the correct meaning','Scegli il significato')}
        </div>
      </div>

      {/* Options */}
      <div style={{ padding:'0 16px', display:'grid',
        gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {options.map(opt => {
          const isCorrect = opt.word_zh === word.word_zh;
          const isChosen  = opt.word_zh === chosen;
          let bg='var(--card)', border='var(--border)', color='var(--text)';
          if (!played) { bg='var(--bg)'; color='var(--text-3)'; }
          if (chosen) {
            if (isCorrect)     { bg='#E8F5E9'; border='#2E7D32'; color='#2E7D32'; }
            else if (isChosen) { bg='#FFEBEE'; border='#c0392b'; color='#c0392b'; }
          }
          return (
            <div key={opt.word_zh}
              onTouchStart={(e) => { e.preventDefault(); choose(opt); }}
              onClick={() => choose(opt)}
              style={{ padding:'14px 10px', borderRadius:14, cursor:'pointer',
                border:`2px solid ${border}`, background:bg, color,
                textAlign:'center', minHeight:60,
                display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', gap:4,
                WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
              <div style={{ fontSize:14, fontWeight:500, pointerEvents:'none' }}>
                {getMeaning(opt)}
              </div>
              {chosen && isCorrect && (
                <div style={{ fontSize:11, pointerEvents:'none' }}>✓ {opt.word_zh}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// src/words/WordsListen.jsx
// Hear a word via TTS, choose correct meaning from 4 options.

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLang } from '../context/LanguageContext';
import { sortAdaptively, recordWordsProgress } from '../hooks/useWordsProgress';
import TtsButton from '../components/TtsButton';

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

export default function WordsListen({ theme, onBack }) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it||en) : en;

  const [words,    setWords]    = useState([]);
  const [idx,      setIdx]      = useState(0);
  const [chosen,   setChosen]   = useState(null);
  const [played,   setPlayed]   = useState(false);
  const [score,    setScore]    = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [done,     setDone]     = useState(false);
  const [userId,   setUserId]   = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null));

    async function load() {
      let q = supabase.from('clf_words').select('*');
      if (theme && theme !== 'all') q = q.eq('theme', theme);
      const { data, error } = await q;
      if (error) { console.warn('[WordsListen] load failed:', error.message); return; }
      setWords(sortAdaptively('listen', data || []));
    }
    load();
  }, [theme]);

  if (!words.length) return (
    <div style={{ padding:'3rem', textAlign:'center', color:'#a07850' }}>
      {t('加载中…','Loading…','Caricamento…')}
    </div>
  );

  const word = words[idx];

  // Build 4 options (cached per word index via useMemo would be cleaner,
  // but this reruns only on render and the pool is small)
  const options = (() => {
    const others = words.filter((_, i) => i !== idx);
    const wrong  = shuffle(others).slice(0, 3);
    return shuffle([word, ...wrong]);
  })();

  function getMeaning(w) {
    return lang === 'it' ? (w.meaning_it || w.meaning_en) : w.meaning_en;
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

    recordWordsProgress('listen', word.word_zh, pts);

    if (userId) {
      supabase.from('clf_words_log').insert({
        user_id: userId, word_zh: word.word_zh, mode: 'listen',
        correct: true, score: pts, attempts: newAttempts,
      }).then(() => {}, () => {});
    }

    setTimeout(() => {
      if (idx + 1 >= words.length) { setDone(true); }
      else { setIdx(i=>i+1); setChosen(null); setPlayed(false); setAttempts(0); }
    }, 900);
  }

  if (done) {
    const max = words.length * 100;
    const pct = Math.round((score / max) * 100);
    return (
      <div style={{ background:'var(--bg,#fdf6e3)', minHeight:'100dvh',
        display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'2rem', gap:'1.5rem' }}>
        <div style={{ fontSize:64 }}>{pct>=80?'🎉':pct>=50?'👍':'💪'}</div>
        <div style={{ fontSize:48, fontWeight:600,
          color:pct>=80?'#2E7D32':pct>=50?'#E65100':'#1565C0' }}>{score}{t('分','pts','pt')}</div>
        <div style={{ fontSize:13, color:'#6b4c2a' }}>
          {t(`满分${max}分`,`Max ${max}pts`,`Max ${max}pt`)}
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <button onClick={() => { setIdx(0); setChosen(null); setScore(0); setDone(false); setPlayed(false); setAttempts(0); }}
            style={{ padding:'12px 24px', borderRadius:12, background:'#F57F17',
              color:'#fff', fontSize:14, cursor:'pointer', border:'none' }}>
            {t('再练','Again','Ancora')}
          </button>
          <button onClick={onBack}
            style={{ padding:'12px 24px', borderRadius:12,
              border:'1px solid #e8d5b0', background:'#fff', fontSize:14, cursor:'pointer' }}>
            {t('返回','Back','Indietro')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background:'var(--bg,#fdf6e3)', minHeight:'100dvh', paddingBottom:80 }}>
      <div style={{ background:'#F57F17', padding:'12px 16px',
        display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ background:'none', border:'none',
          fontSize:22, color:'#fff', cursor:'pointer', padding:'4px 8px' }}>‹</button>
        <div style={{ flex:1, fontSize:15, fontWeight:500, color:'#fff' }}>
          👂 {t('听词选义','Listen & Choose','Ascolta e Scegli')}
        </div>
        <div style={{ fontSize:13, color:'#FFE0B2' }}>{idx+1}/{words.length}</div>
      </div>

      <div style={{ height:4, background:'#FFE0B2' }}>
        <div style={{ height:4, background:'#F57F17',
          width:`${(idx/words.length)*100}%`, transition:'width 0.3s' }}/>
      </div>

      <div style={{ textAlign:'center', padding:'32px 16px 24px' }}>
        <TtsButton text={word.word_zh} size="lg"
          style={{ background: played ? '#888' : '#F57F17' }}
          onAfterPlay={() => setPlayed(true)}/>
        <div style={{ fontSize:12, color:'#a07850', marginTop:12 }}>
          {!played
            ? t('👆 点击听发音','👆 Tap to listen','👆 Tocca per ascoltare')
            : attempts > 0
              ? t(`第${attempts+1}次尝试`,`Attempt ${attempts+1}`,`Tentativo ${attempts+1}`)
              : t('选择正确的意思','Choose the correct meaning','Scegli il significato')}
        </div>
      </div>

      <div style={{ padding:'0 16px', display:'grid',
        gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {options.map(opt => {
          const isCorrect = opt.word_zh === word.word_zh;
          const isChosen  = opt.word_zh === chosen;
          let bg = '#fff', border = '#e8d5b0', color = '#5D2E0C';
          if (!played) { bg = '#fdf6e3'; color = '#a07850'; }
          if (chosen) {
            if (isCorrect)     { bg = '#E8F5E9'; border = '#2E7D32'; color = '#2E7D32'; }
            else if (isChosen) { bg = '#FFEBEE'; border = '#c0392b'; color = '#c0392b'; }
          }
          return (
            <button key={opt.word_zh}
              onClick={() => choose(opt)} disabled={!played || chosen}
              style={{ padding:'14px 10px', borderRadius:14,
                cursor: (played && !chosen) ? 'pointer' : 'default',
                border:`2px solid ${border}`, background: bg, color,
                textAlign:'center', minHeight:60,
                display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', gap:4,
                fontFamily:'inherit' }}>
              <div style={{ fontSize:14, fontWeight:500 }}>
                {getMeaning(opt)}
              </div>
              {chosen && isCorrect && (
                <div style={{ fontSize:11 }}>✓ {opt.word_zh}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

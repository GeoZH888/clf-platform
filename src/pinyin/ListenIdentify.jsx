// src/pinyin/ListenIdentify.jsx
import { useState, useEffect } from 'react';
import { LISTEN_EXERCISES, TONES } from '../data/pinyinData';
import TtsButton from '../components/TtsButton';
import { supabase } from '../lib/supabase';

const TOKEN_KEY = 'jgw_device_token';

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

export default function ListenIdentify({ onBack, lang='zh' }) {
  const [exercises, setExercises] = useState(() => shuffle(LISTEN_EXERCISES));
  const [idx,      setIdx]      = useState(0);
  const [chosen,   setChosen]   = useState(null);

  // Load exercises from DB (admin can edit them)
  useEffect(() => {
    supabase.from('jgw_pinyin_exercises').select('listen_exercises').maybeSingle()
      .then(({ data }) => {
        if (data?.listen_exercises?.length > 0)
          setExercises(shuffle(data.listen_exercises));
      });
  }, []);
  const [score,    setScore]    = useState(0);
  const [total,    setTotal]    = useState(0);
  const [finished, setFinished] = useState(false);
  const [streak,   setStreak]   = useState(0);
  const [played,   setPlayed]   = useState(false);
  const [attempts, setAttempts] = useState(0); // attempts per question

  // Score per attempt: 1st=100, 2nd=70, 3rd=40, 4th+=10
  function attemptScore(n) {
    return n <= 1 ? 100 : n === 2 ? 70 : n === 3 ? 40 : 10;
  }

  const ex = exercises[idx];
  const t = (zh, en, it) => lang==='zh' ? zh : lang==='it' ? it : en;

  function choose(option) {
    if (chosen || !played) return;
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    const correct = option === ex.py;

    if (!correct) {
      // Wrong — show briefly then let them try again
      setChosen(option);
      setTimeout(() => setChosen(null), 800);
      return;
    }

    // Correct
    const pts = attemptScore(newAttempts);
    const newScore = score + pts;
    setChosen(option);
    setScore(newScore);
    setTotal(t => t + 1);
    setStreak(s => s + 1);

    setTimeout(() => {
      if (idx + 1 >= exercises.length) {
        setFinished(true);
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) supabase.from('pinyin_practice_log').insert({
          device_token: token, module: 'listen',
          score: Math.round(newScore / exercises.length),
          correct: total + 1, total: exercises.length,
          attempts: newAttempts,
        });
      } else {
        setIdx(i => i + 1);
        setChosen(null);
        setPlayed(false);
        setAttempts(0);
      }
    }, 1000);
  }

  if (finished) {
    const pct = Math.round((score/exercises.length)*100);
    return (
      <div style={{ background:'var(--bg)', minHeight:'100dvh',
        display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'2rem', gap:'1.5rem' }}>
        <div style={{ fontSize:64 }}>{pct>=80?'🎉':pct>=60?'👍':'💪'}</div>
        <div style={{ fontSize:48, fontWeight:600,
          color:score>=exercises.length*80?'#2E7D32':score>=exercises.length*50?'#E65100':'#c0392b' }}>
          {score}分
        </div>
        <div style={{ fontSize:13, color:'#666' }}>
          {t(`满分 ${exercises.length*100}分`,
             `Max ${exercises.length*100}pts`,
             `Max ${exercises.length*100}pt`)}
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <div onTouchStart={() => {setIdx(0);setChosen(null);setScore(0);setTotal(0);setFinished(false);setStreak(0);setPlayed(false);}}
            onClick={() => {setIdx(0);setChosen(null);setScore(0);setTotal(0);setFinished(false);setStreak(0);setPlayed(false);}}
            style={{ padding:'12px 24px', borderRadius:12, background:'#E65100',
              color:'#fff', fontSize:14, cursor:'pointer', fontWeight:500,
              WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
            {t('再练一次','Try again','Riprova')}
          </div>
          <div onTouchStart={onBack} onClick={onBack}
            style={{ padding:'12px 24px', borderRadius:12,
              border:'1px solid #ddd', background:'#fff',
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
      <div style={{ background:'#E65100', padding:'12px 16px',
        display:'flex', alignItems:'center', gap:12 }}>
        <div onTouchStart={onBack} onClick={onBack}
          style={{ fontSize:22, color:'#fff', cursor:'pointer',
            padding:'4px 8px', WebkitTapHighlightColor:'transparent' }}>‹</div>
        <div style={{ flex:1, fontSize:15, fontWeight:500, color:'#fff' }}>
          {t('听音识调','Listen & Identify','Ascolta e Identifica')}
        </div>
        <div style={{ fontSize:13, color:'#FFCC80' }}>{idx+1}/{exercises.length}</div>
      </div>

      <div style={{ height:4, background:'#FFE0B2' }}>
        <div style={{ height:4, background:'#E65100',
          width:`${(idx/exercises.length)*100}%`, transition:'width 0.3s' }}/>
      </div>

      <div style={{ display:'flex', justifyContent:'space-between',
        padding:'8px 16px', fontSize:12, color:'#666' }}>
        <span>✓ {score}</span>
        {streak>=3 && <span style={{ color:'#E65100' }}>🔥 {streak}</span>}
        <span>✗ {total-score}</span>
      </div>

      <div style={{ textAlign:'center', padding:'24px 16px 16px' }}>
        <div style={{ fontSize:80, fontFamily:"'STKaiti','KaiTi',Georgia,serif",
          color:'#1a0a05', lineHeight:1, marginBottom:20 }}>
          {ex.char}
        </div>

        <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}>
          <TtsButton text={ex.char} size="lg"
            onAfterPlay={() => setPlayed(true)}
            style={{ background: played ? '#888' : '#E65100' }}/>
        </div>

        <div style={{ fontSize:12, color:'#999', marginBottom:4 }}>
          {!played
            ? t('👆 先点击听发音','👆 Tap to listen first','👆 Tocca prima per ascoltare')
            : attempts === 0
            ? t('✓ 现在选声调','✓ Choose the tone','✓ Scegli il tono')
            : t(`第${attempts+1}次尝试 · ${attemptScore(attempts+1)}分`,
                `Attempt ${attempts+1} · ${attemptScore(attempts+1)}pts`,
                `Tentativo ${attempts+1} · ${attemptScore(attempts+1)}pt`)}
        </div>
      </div>

      <div style={{ padding:'0 16px', display:'grid',
        gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {ex.options.map((opt, i) => {
          const isCorrect = opt === ex.py;
          const isChosen  = opt === chosen;
          let bg='#fff', border='#e0e0e0', color='#333';
          if (!played) { bg='#f5f5f5'; color='#ccc'; }
          if (chosen) {
            if (isCorrect)     { bg='#E8F5E9'; border='#2E7D32'; color='#2E7D32'; }
            else if (isChosen) { bg='#FFEBEE'; border='#c0392b'; color='#c0392b'; }
          }
          return (
            <div key={opt}
              onTouchStart={(e) => { e.preventDefault(); choose(opt); }}
              onClick={() => choose(opt)}
              style={{ padding:'16px 8px', borderRadius:14,
                cursor: played&&!chosen?'pointer':'default',
                border:`2px solid ${border}`, background:bg, color,
                fontSize:22, fontWeight:600, textAlign:'center',
                minHeight:64, display:'flex', alignItems:'center',
                justifyContent:'center', gap:6,
                WebkitTapHighlightColor:'transparent',
                touchAction:'manipulation', userSelect:'none' }}>
              <span style={{ pointerEvents:'none' }}>{opt}</span>
              {chosen && isCorrect && <span style={{ pointerEvents:'none' }}>✓</span>}
              {chosen && isChosen && !isCorrect && <span style={{ pointerEvents:'none' }}>✗</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * src/components/game/GlyphQuiz.jsx
 * Show mnemonic illustration → choose the right character from 4 options
 * Timer: 10 seconds. Combo multiplier for consecutive correct answers.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLang } from '../../context/LanguageContext.jsx';

const TIMER_MAX = 10;

export default function GlyphQuiz({ characters, onBack, onXP }) {
  const { t, lang } = useLang();
  const [qIdx, setQIdx]       = useState(0);
  const [queue, setQueue]     = useState([]);
  const [score, setScore]     = useState(0);
  const [combo, setCombo]     = useState(0);
  const [timer, setTimer]     = useState(TIMER_MAX);
  const [answered, setAnswer] = useState(false);
  const [selected, setSelect] = useState(null);
  const [options, setOptions] = useState([]);
  const [done, setDone]       = useState(false);
  const timerRef = useRef(null);

  const initGame = useCallback(() => {
    const shuffled = [...characters].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    setQIdx(0);
    setScore(0);
    setCombo(0);
    setTimer(TIMER_MAX);
    setAnswer(false);
    setSelect(null);
    setDone(false);
  }, [characters]);

  useEffect(() => { initGame(); }, [initGame]);

  // Build options when question changes
  useEffect(() => {
    if (!queue.length || qIdx >= queue.length) return;
    const correct = queue[qIdx];
    const others  = characters.filter(c => c.glyph_modern !== correct.glyph_modern);
    const distractors = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
    const opts = [...distractors, correct].sort(() => Math.random() - 0.5);
    setOptions(opts);
    setAnswer(false);
    setSelect(null);
    setTimer(TIMER_MAX);
  }, [qIdx, queue, characters]);

  // Countdown
  useEffect(() => {
    if (answered || done || !queue.length) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAnswer(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [qIdx, answered, done, queue.length]);

  const handleAnswer = useCallback((char) => {
    if (answered) return;
    clearInterval(timerRef.current);
    setAnswer(true);
    setSelect(char);

    const correct = queue[qIdx]?.glyph_modern;
    if (char === correct) {
      const timeBonus = timer;
      const comboMultiplier = Math.min(combo + 1, 5);
      const gained = (10 + timeBonus) * comboMultiplier;
      setScore(s => s + gained);
      setCombo(c => c + 1);
      onXP?.('quiz_correct', comboMultiplier);
    } else {
      setCombo(0);
    }
    setTimeout(goNext, 1100);
  }, [answered, queue, qIdx, timer, combo, onXP]);

  const goNext = useCallback(() => {
    if (qIdx + 1 >= queue.length) {
      setDone(true);
    } else {
      setQIdx(i => i + 1);
    }
  }, [qIdx, queue.length]);

  if (done) {
    const stars = score > 300 ? 3 : score > 150 ? 2 : 1;
    return (
      <div style={{ padding:'1rem', textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:8 }}>{'⭐'.repeat(stars)}</div>
        <div style={{ fontSize:18, fontWeight:500, color:'var(--color-text-primary)', marginBottom:4 }}>{t('score')}: {score}</div>
        <div style={{ fontSize:13, color:'var(--color-text-secondary)', marginBottom:16 }}>
          {combo > 2 ? `${t('combo')} ×${combo}!` : `${queue.length} ${lang === 'zh' ? '题' : 'questions'}`}
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <button onClick={initGame} style={{ padding:'10px 20px', fontSize:14, cursor:'pointer', borderRadius:10, border:'none', background:'#8B4513', color:'#fdf6e3', fontFamily:'var(--font-sans)', fontWeight:500 }}>{t('restart')}</button>
          <button onClick={onBack}  style={{ padding:'10px 20px', fontSize:14, cursor:'pointer', borderRadius:10, border:'0.5px solid var(--color-border-secondary)', background:'var(--color-background-secondary)', color:'var(--color-text-secondary)', fontFamily:'var(--font-sans)' }}>{t('back')}</button>
        </div>
      </div>
    );
  }

  const q = queue[qIdx];
  if (!q) return null;
  const charMeaning = lang==='zh' ? q.meaning_zh : lang==='it' ? q.meaning_it : q.meaning_en;

  return (
    <div style={{ padding:'0 0.5rem' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <button onClick={onBack} style={{ padding:'6px 12px', fontSize:13, cursor:'pointer', borderRadius:8, border:'0.5px solid var(--color-border-secondary)', background:'var(--color-background-secondary)', color:'var(--color-text-secondary)', fontFamily:'var(--font-sans)' }}>
          ← {t('back')}
        </button>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ fontSize:12, color:'var(--color-text-secondary)' }}>{t('score')}: {score}</div>
          {combo > 1 && <div style={{ fontSize:12, color:'#8B4513', fontWeight:500 }}>×{combo} combo!</div>}
        </div>
        <div style={{ fontSize:22, fontWeight:500, color: timer <= 3 ? '#c0392b' : 'var(--color-text-primary)', transition:'color 0.2s', minWidth:36, textAlign:'center' }}>
          {answered ? '' : `${timer}s`}
        </div>
      </div>

      {/* Timer bar */}
      <div style={{ height:4, background:'var(--color-border-tertiary)', borderRadius:2, overflow:'hidden', marginBottom:14 }}>
        <div style={{ height:'100%', width:`${(timer/TIMER_MAX)*100}%`, background: timer <= 3 ? '#c0392b' : '#8B4513', borderRadius:2, transition:'width 1s linear' }}/>
      </div>

      {/* Question number */}
      <div style={{ textAlign:'center', marginBottom:10 }}>
        <span style={{ fontSize:11, color:'var(--color-text-tertiary)', letterSpacing:'0.05em' }}>{qIdx+1} / {queue.length}</span>
      </div>

      {/* Illustration or oracle bone SVG */}
      <div style={{ width:140, height:140, margin:'0 auto 16px', borderRadius:16, overflow:'hidden', border:'2px solid var(--color-border-secondary)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {q.mnemonic_svg
          ? <div style={{ width:'100%', height:'100%' }} dangerouslySetInnerHTML={{ __html: q.mnemonic_svg.replace('<svg ', '<svg width="140" height="140" ') }}/>
          : <div style={{ width:'100%', height:'100%', background:'#fdf6e3', display:'flex', alignItems:'center', justifyContent:'center' }}
              dangerouslySetInnerHTML={{ __html: (q.svg_jiaguwen||'').replace('<svg ', '<svg width="100" height="100" ') }}/>
        }
      </div>

      <div style={{ fontSize:13, color:'var(--color-text-tertiary)', textAlign:'center', marginBottom:14 }}>{t('choose')}</div>

      {/* Options */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {options.map(opt => {
          const isCorrect = opt.glyph_modern === q.glyph_modern;
          const isSelected = opt.glyph_modern === selected;
          let bg = 'var(--color-background-secondary)', border = 'var(--color-border-secondary)', color = 'var(--color-text-primary)';
          if (answered) {
            if (isCorrect)  { bg='#E8F5E9'; border='#2E7D32'; color='#2E7D32'; }
            else if (isSelected) { bg='#FFEBEE'; border='#c0392b'; color='#c0392b'; }
          }
          const optMeaning = lang==='zh' ? opt.meaning_zh : lang==='it' ? opt.meaning_it : opt.meaning_en;
          return (
            <button
              key={opt.glyph_modern}
              onClick={() => handleAnswer(opt.glyph_modern)}
              disabled={answered}
              style={{ padding:'14px 8px', borderRadius:12, border:`1.5px solid ${border}`, background:bg, display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor: answered ? 'default' : 'pointer', transition:'all 0.2s', fontFamily:'var(--font-sans)' }}
            >
              <span style={{ fontSize:30, fontFamily:"'STKaiti','KaiTi',serif", color }}>{opt.glyph_modern}</span>
              <span style={{ fontSize:11, color: answered ? color : 'var(--color-text-tertiary)', textAlign:'center', lineHeight:1.3 }}>{opt.pinyin}</span>
              {answered && <span style={{ fontSize:10, color, textAlign:'center', lineHeight:1.3 }}>{optMeaning?.slice(0,20)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

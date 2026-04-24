// src/words/Flashcards.jsx
// Classic flashcard practice: front shows word, flip to see meaning.
// User rates "know it" vs "not yet" → score recorded to progress store.
//
// Adapted from jgw_words legacy version:
//   - Reads from clf_words (not jgw_words)
//   - Logs to clf_words_log keyed by user_id (not device_token)
//   - Uses sortAdaptively from useWordsProgress for weak-first ordering

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLang } from '../context/LanguageContext';
import { sortAdaptively, recordWordsProgress } from '../hooks/useWordsProgress';
import TtsButton from '../components/TtsButton';

export default function Flashcards({ theme, onBack }) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it||en) : en;

  const [words,   setWords]   = useState([]);
  const [idx,     setIdx]     = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [result,  setResult]  = useState(null);
  const [done,    setDone]    = useState(false);
  const [scores,  setScores]  = useState({});
  const [userId,  setUserId]  = useState(null);

  useEffect(() => {
    // Grab user id for logging
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null));

    async function load() {
      let q = supabase.from('clf_words').select('*');
      if (theme && theme !== 'all') q = q.eq('theme', theme);
      const { data, error } = await q.order('hsk_level');
      if (error) { console.warn('[Flashcards] load failed:', error.message); return; }
      // Weak-first ordering — items user struggled with appear first
      const sorted = sortAdaptively('flashcard', data || []);
      setWords(sorted);
    }
    load();
  }, [theme]);

  if (!words.length) return (
    <div style={{ padding:'3rem', textAlign:'center', color:'#a07850' }}>
      {t('加载中…','Loading…','Caricamento…')}
    </div>
  );

  const word = words[idx];

  function goNext() {
    if (idx + 1 >= words.length) { setDone(true); return; }
    setIdx(i => i + 1); setFlipped(false); setResult(null);
  }
  function goPrev() {
    if (idx === 0) return;
    setIdx(i => i - 1); setFlipped(false); setResult(null);
  }

  function handleResult(res) {
    const sc = res === 'know' ? 100 : 50;
    setScores(s => ({ ...s, [word.word_zh]: sc }));
    setResult(res);

    // Record to local progress store (drives adaptive ordering + session pool)
    recordWordsProgress('flashcard', word.word_zh, sc);

    // Log to Supabase for cross-device analytics (only if logged in)
    if (userId) {
      supabase.from('clf_words_log').insert({
        user_id: userId, word_zh: word.word_zh, mode: 'flashcard',
        correct: res === 'know', score: sc,
      }).then(() => {}, () => {});    // non-blocking
    }

    setTimeout(goNext, 600);
  }

  if (done) {
    const known = Object.values(scores).filter(s => s === 100).length;
    const pct   = Math.round((known / words.length) * 100);
    return (
      <div style={{ background:'var(--bg,#fdf6e3)', minHeight:'100dvh',
        display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'2rem', gap:'1.5rem' }}>
        <div style={{ fontSize:64 }}>{pct>=80?'🎉':pct>=50?'👍':'💪'}</div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:48, fontWeight:600,
            color:pct>=80?'#2E7D32':pct>=50?'#E65100':'#1565C0' }}>{pct}%</div>
          <div style={{ fontSize:14, color:'#5D2E0C', marginTop:4 }}>
            {known}/{words.length} {t('词已掌握','words known','parole conosciute')}
          </div>
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <button onClick={() => { setIdx(0); setFlipped(false); setResult(null); setDone(false); setScores({}); }}
            style={{ padding:'12px 24px', borderRadius:12, background:'#1565C0',
              color:'#fff', fontSize:14, cursor:'pointer', border:'none', fontWeight:500 }}>
            {t('再来一遍','Again','Ancora')}
          </button>
          <button onClick={onBack}
            style={{ padding:'12px 24px', borderRadius:12,
              border:'1px solid #e8d5b0', background:'#fff',
              fontSize:14, cursor:'pointer' }}>
            {t('返回','Back','Indietro')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background:'var(--bg,#fdf6e3)', minHeight:'100dvh', paddingBottom:80 }}>

      {/* Header */}
      <div style={{ background:'#1565C0', padding:'12px 16px',
        display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ background:'none', border:'none',
          fontSize:22, color:'#fff', cursor:'pointer', padding:'4px 8px' }}>‹</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:500, color:'#fff' }}>
            🃏 {t('闪卡','Flashcards','Flashcard')}
          </div>
          <div style={{ fontSize:10, color:'#BBDEFB' }}>大卫学中文 · 词语</div>
        </div>
        <div style={{ fontSize:13, color:'#BBDEFB' }}>{idx+1}/{words.length}</div>
      </div>

      {/* Progress bar */}
      <div style={{ height:4, background:'#BBDEFB' }}>
        <div style={{ height:4, background:'#1565C0',
          width:`${((idx+1)/words.length)*100}%`, transition:'width 0.3s' }}/>
      </div>

      <div style={{ padding:'16px' }}>

        {/* Card */}
        <div onClick={() => setFlipped(f => !f)}
          style={{ background:'#fff', borderRadius:20,
            border:'1px solid #e8d5b0', minHeight:260,
            display:'flex', flexDirection:'column', alignItems:'center',
            justifyContent:'center', padding:'24px 20px', cursor:'pointer',
            textAlign:'center', gap:10,
            boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>

          {!flipped ? (
            /* Front */
            <>
              {word.image_url && (
                <img src={word.image_url} alt={word.word_zh}
                  style={{ width:140, height:140, objectFit:'cover',
                    borderRadius:14, marginBottom:4,
                    border:'1px solid #e8d5b0' }}/>
              )}
              <div style={{ fontSize:52, fontFamily:"'STKaiti','KaiTi',Georgia,serif",
                color:'#5D2E0C', lineHeight:1.2 }}>
                {word.word_zh}
              </div>
              <div style={{ fontSize:20, color:'#1565C0', fontWeight:500 }}>
                {word.pinyin}
              </div>
              <div style={{ marginTop:6 }}>
                <TtsButton text={word.word_zh} size="md"/>
              </div>
              <div style={{ fontSize:12, color:'#a07850', marginTop:4 }}>
                {t('点击翻转查看释义','Tap to see meaning','Tocca per il significato')}
              </div>
            </>
          ) : (
            /* Back — trilingual */
            <>
              <div style={{ fontSize:28, fontFamily:"'STKaiti','KaiTi',Georgia,serif",
                color:'#6b4c2a', marginBottom:4 }}>
                {word.word_zh} · {word.pinyin}
              </div>

              <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ padding:'10px 14px', background:'#E3F2FD',
                  borderRadius:10, textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#1565C0', marginBottom:2 }}>🇬🇧 English</div>
                  <div style={{ fontSize:18, fontWeight:600, color:'#0C3C7A' }}>
                    {word.meaning_en}
                  </div>
                </div>
                <div style={{ padding:'10px 14px', background:'#E8F5E9',
                  borderRadius:10, textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#2E7D32', marginBottom:2 }}>🇮🇹 Italiano</div>
                  <div style={{ fontSize:18, fontWeight:600, color:'#1B5E20' }}>
                    {word.meaning_it || word.meaning_en}
                  </div>
                </div>
                {word.meaning_zh && (
                  <div style={{ padding:'10px 14px', background:'#FFF8E1',
                    borderRadius:10, textAlign:'center' }}>
                    <div style={{ fontSize:10, color:'#E65100', marginBottom:2 }}>🇨🇳 中文</div>
                    <div style={{ fontSize:15, color:'#4E342E',
                      fontFamily:"'STKaiti','KaiTi',Georgia,serif" }}>
                      {word.meaning_zh}
                    </div>
                  </div>
                )}
              </div>

              {word.example_zh && (
                <div style={{ padding:'10px 14px', background:'#fdf6e3',
                  borderRadius:10, width:'100%', fontSize:13, color:'#6b4c2a',
                  lineHeight:1.7, textAlign:'left' }}>
                  <div style={{ fontFamily:"'STKaiti','KaiTi',Georgia,serif" }}>
                    {word.example_zh}
                  </div>
                  <div style={{ fontSize:11, color:'#a07850', marginTop:2 }}>
                    {lang==='it' ? (word.example_it||word.example_en) : word.example_en}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rating buttons — only after flip */}
        {flipped && !result && (
          <div style={{ display:'flex', gap:12, marginTop:14 }}>
            <button onClick={() => handleResult('unsure')}
              style={{ flex:1, padding:'14px', borderRadius:14, cursor:'pointer',
                background:'#FFEBEE', border:'2px solid #EF9A9A', textAlign:'center',
                fontFamily:'inherit' }}>
              <div style={{ fontSize:24 }}>😅</div>
              <div style={{ fontSize:13, color:'#c0392b', marginTop:4, fontWeight:500 }}>
                {t('还不熟','Not yet','Non ancora')}
              </div>
            </button>
            <button onClick={() => handleResult('know')}
              style={{ flex:1, padding:'14px', borderRadius:14, cursor:'pointer',
                background:'#E8F5E9', border:'2px solid #A5D6A7', textAlign:'center',
                fontFamily:'inherit' }}>
              <div style={{ fontSize:24 }}>😊</div>
              <div style={{ fontSize:13, color:'#2E7D32', marginTop:4, fontWeight:500 }}>
                {t('我知道','I know it','Lo so')}
              </div>
            </button>
          </div>
        )}

        {/* Nav */}
        <div style={{ display:'flex', gap:10, marginTop:12 }}>
          <button onClick={goPrev} disabled={idx === 0}
            style={{ flex:1, padding:'12px', borderRadius:12, cursor: idx===0?'default':'pointer',
              border:'1px solid #e8d5b0',
              background: idx===0 ? '#f5f5f5' : '#fff',
              color: idx===0 ? '#ccc' : '#6b4c2a',
              fontSize:13, fontWeight:500 }}>
            ‹ {t('上一个','Prev','Prec.')}
          </button>
          <button onClick={goNext}
            style={{ flex:1, padding:'12px', borderRadius:12, cursor:'pointer',
              border:'none', background:'#1565C0', color:'#fff',
              fontSize:13, fontWeight:500 }}>
            {idx+1 >= words.length
              ? t('完成 ✓','Finish ✓','Fine ✓')
              : t('下一个','Next','Succ.') + ' ›'}
          </button>
        </div>
      </div>
    </div>
  );
}

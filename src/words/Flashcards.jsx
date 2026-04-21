// src/words/Flashcards.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import TtsButton from '../components/TtsButton';

const TOKEN_KEY = 'jgw_device_token';
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

export default function Flashcards({ theme, onBack, lang='zh' }) {
  const [words,  setWords]  = useState([]);
  const [idx,    setIdx]    = useState(0);
  const [flipped,setFlipped]= useState(false);
  const [result, setResult] = useState(null);
  const [done,   setDone]   = useState(false);
  const [scores, setScores] = useState({});

  const t = (zh, en, it) => lang==='zh' ? zh : lang==='it' ? it : en;

  useEffect(() => {
    const q = supabase.from('jgw_words').select('*');
    if (theme && theme !== 'all') q.eq('theme', theme);
    q.order('hsk_level').then(({ data }) => setWords(shuffle(data || [])));
  }, [theme]);

  if (!words.length) return (
    <div style={{ padding:'3rem', textAlign:'center', color:'var(--text-3)' }}>
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
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) supabase.from('jgw_words_log').insert({
      device_token:token, word_zh:word.word_zh,
      mode:'flashcard', correct:res==='know', score:sc,
    });
    setTimeout(goNext, 600);
  }

  if (done) {
    const known = Object.values(scores).filter(s => s===100).length;
    const pct   = Math.round((known/words.length)*100);
    return (
      <div style={{ background:'var(--bg)', minHeight:'100dvh',
        display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'2rem', gap:'1.5rem' }}>
        <div style={{ fontSize:64 }}>{pct>=80?'🎉':pct>=50?'👍':'💪'}</div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:48, fontWeight:600,
            color:pct>=80?'#2E7D32':pct>=50?'#E65100':'#1565C0' }}>{pct}%</div>
          <div style={{ fontSize:14, color:'var(--text-2)', marginTop:4 }}>
            {known}/{words.length} {t('词已掌握','words known','parole conosciute')}
          </div>
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <div onTouchStart={()=>{setIdx(0);setFlipped(false);setResult(null);setDone(false);setScores({});}}
            onClick={()=>{setIdx(0);setFlipped(false);setResult(null);setDone(false);setScores({});}}
            style={{ padding:'12px 24px', borderRadius:12, background:'#4CAF50',
              color:'#fff', fontSize:14, cursor:'pointer', fontWeight:500,
              WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
            {t('再来一遍','Again','Ancora')}
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

      {/* Header */}
      <div style={{ background:'#1565C0', padding:'12px 16px',
        display:'flex', alignItems:'center', gap:12 }}>
        <div onTouchStart={onBack} onClick={onBack}
          style={{ fontSize:22, color:'#fff', cursor:'pointer',
            padding:'4px 8px', WebkitTapHighlightColor:'transparent' }}>‹</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:500, color:'#fff' }}>
            {t('闪卡','Flashcards','Flashcard')}
          </div>
          <div style={{ fontSize:10, color:'#90CAF9' }}>大卫学中文</div>
        </div>
        <div style={{ fontSize:13, color:'#90CAF9' }}>{idx+1}/{words.length}</div>
      </div>

      {/* Progress bar */}
      <div style={{ height:4, background:'#BBDEFB' }}>
        <div style={{ height:4, background:'#1565C0',
          width:`${((idx+1)/words.length)*100}%`, transition:'width 0.3s' }}/>
      </div>

      <div style={{ padding:'16px' }}>

        {/* Card */}
        <div onTouchStart={()=>setFlipped(f=>!f)} onClick={()=>setFlipped(f=>!f)}
          style={{ background:'var(--card)', borderRadius:20,
            border:'1px solid var(--border)', minHeight:260,
            display:'flex', flexDirection:'column', alignItems:'center',
            justifyContent:'center', padding:'24px 20px', cursor:'pointer',
            textAlign:'center', gap:10, touchAction:'manipulation',
            WebkitTapHighlightColor:'transparent',
            boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>

          {!flipped ? (
            /* Front */
            <>
              {word.image_url && (
                <img src={word.image_url} alt={word.word_zh}
                  style={{ width:140, height:140, objectFit:'cover',
                    borderRadius:14, marginBottom:4,
                    border:'1px solid var(--border)' }}/>
              )}
              <div style={{ fontSize:52, fontFamily:"'STKaiti','KaiTi',Georgia,serif",
                color:'var(--text)', lineHeight:1.2 }}>
                {word.word_zh}
              </div>
              <div style={{ fontSize:20, color:'#1565C0', fontWeight:500 }}>
                {word.pinyin}
              </div>
              <div style={{ marginTop:6 }}>
                <TtsButton text={word.word_zh} size="md"/>
              </div>
              <div style={{ fontSize:12, color:'var(--text-3)', marginTop:4 }}>
                {t('点击翻转查看释义','Tap to see meaning','Tocca per il significato')}
              </div>
            </>
          ) : (
            /* Back — trilingual */
            <>
              <div style={{ fontSize:28, fontFamily:"'STKaiti','KaiTi',Georgia,serif",
                color:'var(--text-2)', marginBottom:4 }}>
                {word.word_zh} · {word.pinyin}
              </div>

              <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:8 }}>
                {/* English */}
                <div style={{ padding:'10px 14px', background:'#E3F2FD',
                  borderRadius:10, textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#1565C0', marginBottom:2 }}>🇬🇧 English</div>
                  <div style={{ fontSize:18, fontWeight:600, color:'#0C3C7A' }}>
                    {word.meaning_en}
                  </div>
                </div>
                {/* Italian */}
                <div style={{ padding:'10px 14px', background:'#E8F5E9',
                  borderRadius:10, textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#2E7D32', marginBottom:2 }}>🇮🇹 Italiano</div>
                  <div style={{ fontSize:18, fontWeight:600, color:'#1B5E20' }}>
                    {word.meaning_it || word.meaning_en}
                  </div>
                </div>
                {/* Chinese explanation */}
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

              {/* Example sentence */}
              {word.example_zh && (
                <div style={{ padding:'10px 14px', background:'var(--bg)',
                  borderRadius:10, width:'100%',
                  fontSize:13, color:'var(--text-2)', lineHeight:1.7, textAlign:'left' }}>
                  <div style={{ fontFamily:"'STKaiti','KaiTi',Georgia,serif" }}>
                    {word.example_zh}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
                    {lang==='it' ? (word.example_it||word.example_en) : word.example_en}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Know / Don't know — only after flip */}
        {flipped && !result && (
          <div style={{ display:'flex', gap:12, marginTop:14 }}>
            <div onTouchStart={()=>handleResult('unsure')} onClick={()=>handleResult('unsure')}
              style={{ flex:1, padding:'14px', borderRadius:14, cursor:'pointer',
                background:'#FFEBEE', border:'2px solid #EF9A9A', textAlign:'center',
                touchAction:'manipulation', WebkitTapHighlightColor:'transparent' }}>
              <div style={{ fontSize:24 }}>😅</div>
              <div style={{ fontSize:13, color:'#c0392b', marginTop:4, fontWeight:500 }}>
                {t('还不熟','Not yet','Non ancora')}
              </div>
            </div>
            <div onTouchStart={()=>handleResult('know')} onClick={()=>handleResult('know')}
              style={{ flex:1, padding:'14px', borderRadius:14, cursor:'pointer',
                background:'#E8F5E9', border:'2px solid #A5D6A7', textAlign:'center',
                touchAction:'manipulation', WebkitTapHighlightColor:'transparent' }}>
              <div style={{ fontSize:24 }}>😊</div>
              <div style={{ fontSize:13, color:'#2E7D32', marginTop:4, fontWeight:500 }}>
                {t('我知道','I know it','Lo so')}
              </div>
            </div>
          </div>
        )}

        {/* Prev / Next navigation */}
        <div style={{ display:'flex', gap:10, marginTop:12 }}>
          <div onTouchStart={goPrev} onClick={goPrev}
            style={{ flex:1, padding:'12px', borderRadius:12, cursor:'pointer',
              border:'1px solid var(--border)',
              background: idx===0 ? '#f5f5f5' : 'var(--card)',
              color: idx===0 ? '#ccc' : 'var(--text-2)',
              textAlign:'center', fontSize:13, fontWeight:500,
              touchAction:'manipulation', WebkitTapHighlightColor:'transparent' }}>
            ‹ {t('上一个','Prev','Prec.')}
          </div>
          <div onTouchStart={goNext} onClick={goNext}
            style={{ flex:1, padding:'12px', borderRadius:12, cursor:'pointer',
              border:'none', background:'#1565C0', color:'#fff',
              textAlign:'center', fontSize:13, fontWeight:500,
              touchAction:'manipulation', WebkitTapHighlightColor:'transparent' }}>
            {idx+1 >= words.length
              ? t('完成 ✓','Finish ✓','Fine ✓')
              : t('下一个','Next','Succ.') + ' ›'}
          </div>
        </div>
      </div>
    </div>
  );
}

// src/words/WordsHome.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { THEMES } from '../data/wordsData';

const TOKEN_KEY = 'jgw_device_token';

export default function WordsHome({ onSelect, onBack, lang='zh' }) {
  const [words,   setWords]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats,   setStats]   = useState({});

  const t = (zh, en, it) => lang==='zh' ? zh : lang==='it' ? it : en;

  useEffect(() => {
    supabase.from('jgw_words').select('theme, word_zh, image_url').then(({ data }) => {
      setWords(data || []);
      setLoading(false);
    });
    // Load practice stats
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      supabase.from('jgw_words_log')
        .select('word_zh, correct')
        .eq('device_token', token)
        .then(({ data }) => {
          const s = {};
          (data || []).forEach(r => {
            if (!s[r.word_zh]) s[r.word_zh] = { total:0, correct:0 };
            s[r.word_zh].total++;
            if (r.correct) s[r.word_zh].correct++;
          });
          setStats(s);
        });
    }
  }, []);

  // Count words per theme
  const byTheme = {};
  words.forEach(w => {
    byTheme[w.theme] = (byTheme[w.theme] || 0) + 1;
  });
  const totalWords = words.length;
  const practicedWords = Object.keys(stats).length;

  const MODES = [
    { id:'flashcard', emoji:'🃏', zh:'闪卡',    en:'Flashcards',      it:'Flashcard',
      descZh:'看词认意思', descEn:'See word, recall meaning', descIt:'Vedi e ricorda',
      color:'#E3F2FD', border:'#1565C0', text:'#0C447C' },
    { id:'listen',    emoji:'👂', zh:'听词选义', en:'Listen & Choose',  it:'Ascolta e Scegli',
      descZh:'听发音选意思', descEn:'Hear word, choose meaning', descIt:'Ascolta e scegli',
      color:'#FFF8E1', border:'#F57F17', text:'#E65100' },
    { id:'fill',      emoji:'✍️', zh:'看义填词', en:'Fill in Blank',   it:'Completa',
      descZh:'看意思写词组', descEn:'See meaning, write word', descIt:'Vedi e scrivi',
      color:'#F3E5F5', border:'#7B1FA2', text:'#4A148C' },
  ].map(m => ({ ...m, desc: lang==='zh' ? m.descZh : lang==='it' ? m.descIt : m.descEn }));

  return (
    <div style={{ background:'var(--bg)', minHeight:'100dvh', paddingBottom:80 }}>

      {/* Header */}
      <div style={{ background:'#4CAF50', padding:'14px 16px',
        display:'flex', alignItems:'center', gap:12 }}>
        <div onTouchStart={onBack} onClick={onBack}
          style={{ fontSize:22, color:'#fff', cursor:'pointer',
            padding:'4px 8px', WebkitTapHighlightColor:'transparent' }}>‹</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18, fontWeight:500, color:'#fff',
            fontFamily:"'STKaiti','KaiTi',Georgia,serif" }}>
            📝 {t('词组练习','Word Practice','Pratica Parole')}
          </div>
          <div style={{ fontSize:11, color:'#C8E6C9', marginTop:2 }}>
            {loading ? '…' : `${totalWords} ${t('个词组','words','parole')} · ${practicedWords} ${t('已练','practiced','praticate')}`}
          </div>
        </div>
      </div>

      <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:14 }}>

        {/* Practice mode cards */}
        <div>
          <div style={{ fontSize:11, color:'var(--text-3)',
            letterSpacing:'0.06em', marginBottom:10 }}>
            {t('练习模式','Practice Modes','Modalità')}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {MODES.map(m => (
              <div key={m.id}
                onTouchStart={() => onSelect({ type:'mode', mode:m.id })}
                onClick={() => onSelect({ type:'mode', mode:m.id })}
                style={{ background:m.color, border:`2px solid ${m.border}`,
                  borderRadius:14, padding:'14px 16px', cursor:'pointer',
                  display:'flex', alignItems:'center', gap:12,
                  WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
                <div style={{ width:44, height:44, borderRadius:12,
                  background:m.border, display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:20, flexShrink:0 }}>
                  {m.emoji}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:500, color:m.text }}>
                    {lang==='zh' ? m.zh : lang==='it' ? m.it : m.en}
                  </div>
                  <div style={{ fontSize:11, color:m.text, opacity:0.7, marginTop:2 }}>
                    {m.desc}
                  </div>
                </div>
                <div style={{ fontSize:18, color:m.border, opacity:0.5 }}>›</div>
              </div>
            ))}
          </div>
        </div>

        {/* Browse by theme */}
        <div>
          <div style={{ fontSize:11, color:'var(--text-3)',
            letterSpacing:'0.06em', marginBottom:10 }}>
            {t('按主题浏览','Browse by Theme','Per Tema')}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {THEMES.filter(th => byTheme[th.id] > 0 || th.id === 'general').map(th => {
              // Find first word with image for this theme
              const sample = words.find(w => w.theme === th.id && w.image_url);
              return (
              <div key={th.id}
                onTouchStart={() => onSelect({ type:'theme', theme:th.id })}
                onClick={() => onSelect({ type:'theme', theme:th.id })}
                style={{ background:'var(--card)', border:'1px solid var(--border)',
                  borderRadius:12, overflow:'hidden', cursor:'pointer',
                  WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
                {/* Thumbnail */}
                <div style={{ height:64, background:'#f0f0f0',
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {sample?.image_url
                    ? <img src={sample.image_url} alt={th.zh}
                        style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    : <span style={{ fontSize:28 }}>{th.emoji}</span>}
                </div>
                <div style={{ padding:'8px' }}>
                  <div style={{ fontSize:12, fontWeight:500, color:'var(--text)', textAlign:'center' }}>
                    {lang==='zh' ? th.zh : lang==='it' ? th.it : th.en}
                  </div>
                  <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2, textAlign:'center' }}>
                    {byTheme[th.id] || 0} {t('词','words','parole')}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Quick stats */}
        {practicedWords > 0 && (
          <div style={{ background:'var(--card)', borderRadius:14,
            border:'1px solid var(--border)', padding:'14px 16px' }}>
            <div style={{ fontSize:13, fontWeight:500, color:'var(--text)', marginBottom:10 }}>
              {t('我的进度','My Progress','Il mio progresso')}
            </div>
            <div style={{ display:'flex', gap:12 }}>
              {[
                { label:t('已学','Learned','Imparate'), value:practicedWords },
                { label:t('总词数','Total','Totale'), value:totalWords },
                { label:t('完成率','Progress','Progresso'),
                  value:totalWords>0?Math.round((practicedWords/totalWords)*100)+'%':'0%' },
              ].map(({ label, value }) => (
                <div key={label} style={{ flex:1, textAlign:'center',
                  padding:'8px 6px', background:'#f5f5f5', borderRadius:10 }}>
                  <div style={{ fontSize:20, fontWeight:600, color:'#4CAF50' }}>{value}</div>
                  <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

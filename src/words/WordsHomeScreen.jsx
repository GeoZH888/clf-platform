// src/words/WordsHomeScreen.jsx
// Home screen for 词语 (Vocabulary) module.
// Reads platform-level learning path from localStorage (clf_current_path)
// and filters word list accordingly.

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLang } from '../context/LanguageContext';
import { getModeStats } from '../hooks/useWordsProgress';

const PATH_STORAGE_KEY = 'clf_current_path';

// Themes — consistent with legacy wordsData but could be loaded from DB later
const THEMES = [
  { id:'greetings', emoji:'👋', zh:'问候', en:'Greetings', it:'Saluti' },
  { id:'family',    emoji:'👨‍👩‍👧', zh:'家庭', en:'Family',  it:'Famiglia' },
  { id:'food',      emoji:'🍜', zh:'食物', en:'Food',     it:'Cibo' },
  { id:'numbers',   emoji:'🔢', zh:'数字', en:'Numbers',  it:'Numeri' },
  { id:'colors',    emoji:'🎨', zh:'颜色', en:'Colors',   it:'Colori' },
  { id:'body',      emoji:'👤', zh:'身体', en:'Body',     it:'Corpo' },
  { id:'time',      emoji:'⏰', zh:'时间', en:'Time',     it:'Tempo' },
  { id:'travel',    emoji:'✈️', zh:'出行', en:'Travel',   it:'Viaggio' },
];

export default function WordsHomeScreen({ onBack, onSelect }) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it||en) : en;

  const [words, setWords]     = useState([]);
  const [loading, setLoading] = useState(true);

  // Read current learning path (HSK / Jinan / All) from platform-level state
  const [currentPath] = useState(() => {
    try { return localStorage.getItem(PATH_STORAGE_KEY) || 'all'; }
    catch { return 'all'; }
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      let q = supabase.from('clf_words').select('*');
      // Apply platform path filter
      if (currentPath === 'hsk')        q = q.lte('hsk_level', 1);        // HSK 1 starter
      else if (currentPath === 'jinan') q = q.not('renjiao_grade', 'is', null);
      const { data, error } = await q.order('hsk_level', { ascending: true });
      if (error) console.warn('[WordsHomeScreen] load failed:', error.message);
      setWords(data || []);
      setLoading(false);
    }
    load();
  }, [currentPath]);

  // Count words per theme
  const byTheme = {};
  words.forEach(w => { byTheme[w.theme] = (byTheme[w.theme] || 0) + 1; });

  // Adaptive stats across all modes
  const flashStats  = getModeStats('flashcard', words);
  const listenStats = getModeStats('listen',    words);
  const fillStats   = getModeStats('fill',      words);
  const totalPracticed = Math.max(flashStats.practiced, listenStats.practiced, fillStats.practiced);

  const MODES = [
    {
      id: 'flashcard', emoji: '🃏',
      title: t('闪卡', 'Flashcards', 'Flashcard'),
      desc:  t('看词认意思', 'See word, recall meaning', 'Vedi e ricorda'),
      color: '#E3F2FD', accent: '#1565C0', text: '#0C447C',
      stats: flashStats,
    },
    {
      id: 'listen', emoji: '👂',
      title: t('听词选义', 'Listen & Choose', 'Ascolta e Scegli'),
      desc:  t('听发音选意思', 'Hear word, choose meaning', 'Ascolta e scegli'),
      color: '#FFF8E1', accent: '#F57F17', text: '#E65100',
      stats: listenStats,
    },
    {
      id: 'fill', emoji: '✍️',
      title: t('看义填词', 'Fill in Blank', 'Completa'),
      desc:  t('看意思写词组', 'See meaning, write word', 'Vedi e scrivi'),
      color: '#F3E5F5', accent: '#7B1FA2', text: '#4A148C',
      stats: fillStats,
    },
  ];

  return (
    <div style={{ background:'var(--bg,#fdf6e3)', minHeight:'100dvh', paddingBottom:80 }}>

      {/* Header */}
      <div style={{ background:'#2E7D32', padding:'14px 16px',
        display:'flex', alignItems:'center', gap:12,
        position:'sticky', top:0, zIndex:10 }}>
        {onBack && (
          <button onClick={onBack} style={{ border:'none', background:'none',
            color:'#fff', fontSize:26, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>‹</button>
        )}
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18, fontWeight:500, color:'#fff',
            fontFamily:"'STKaiti','KaiTi',Georgia,serif" }}>
            📝 {t('词语','Vocabulary','Vocabolario')}
          </div>
          <div style={{ fontSize:11, color:'#C8E6C9', marginTop:2 }}>
            {loading ? '…'
              : `${words.length} ${t('个词组','words','parole')} · ${totalPracticed} ${t('已练','practiced','praticate')}`}
          </div>
        </div>
      </div>

      <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:14 }}>

        {/* Path indicator */}
        {currentPath !== 'all' && (
          <div style={{ fontSize:11, color:'#2E7D32', background:'#E8F5E9',
            padding:'6px 12px', borderRadius:10, textAlign:'center',
            border:'1px solid #A5D6A7' }}>
            🎯 {t('当前路径','Current path','Percorso')}: {
              currentPath === 'hsk' ? 'HSK' :
              currentPath === 'jinan' ? '暨南中文' : currentPath
            }
          </div>
        )}

        {/* Practice mode cards */}
        <div>
          <div style={{ fontSize:11, color:'var(--text-3,#a07850)',
            letterSpacing:'0.06em', marginBottom:10 }}>
            {t('练习模式','Practice Modes','Modalità')}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {MODES.map(m => (
              <button key={m.id}
                onClick={() => onSelect?.({ type:'mode', mode:m.id })}
                style={{ background:m.color, border:`2px solid ${m.accent}`,
                  borderRadius:14, padding:'14px 16px', cursor:'pointer',
                  display:'flex', alignItems:'center', gap:12,
                  textAlign:'left', width:'100%', fontFamily:'inherit',
                  WebkitTapHighlightColor:'transparent' }}>
                <div style={{ width:44, height:44, borderRadius:12,
                  background:m.accent, color:'#fff',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:20, flexShrink:0 }}>
                  {m.emoji}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:600, color:m.text }}>
                    {m.title}
                  </div>
                  <div style={{ fontSize:11, color:m.text, opacity:0.75, marginTop:2 }}>
                    {m.desc}
                  </div>
                  {m.stats.practiced > 0 && (
                    <div style={{ fontSize:10, color:m.accent, marginTop:3 }}>
                      ✨ {m.stats.practiced} {t('已练','practiced','praticate')}
                      {m.stats.mastered > 0 && <> · {m.stats.mastered} {t('已掌握','mastered','padronanza')}</>}
                    </div>
                  )}
                </div>
                <div style={{ fontSize:18, color:m.accent }}>›</div>
              </button>
            ))}
          </div>
        </div>

        {/* Browse by theme */}
        {!loading && Object.keys(byTheme).length > 0 && (
          <div>
            <div style={{ fontSize:11, color:'var(--text-3,#a07850)',
              letterSpacing:'0.06em', marginBottom:10 }}>
              {t('按主题浏览','Browse by Theme','Per Tema')}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {THEMES.filter(th => byTheme[th.id] > 0).map(th => (
                <button key={th.id}
                  onClick={() => onSelect?.({ type:'theme', theme:th.id })}
                  style={{ background:'#fff', border:'1px solid #e8d5b0',
                    borderRadius:12, overflow:'hidden', cursor:'pointer',
                    padding:0, fontFamily:'inherit',
                    WebkitTapHighlightColor:'transparent' }}>
                  <div style={{ height:52, background:'#f5ede0',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:24 }}>
                    {th.emoji}
                  </div>
                  <div style={{ padding:'8px' }}>
                    <div style={{ fontSize:12, fontWeight:500,
                      color:'#5D2E0C', textAlign:'center' }}>
                      {th[lang] || th.en}
                    </div>
                    <div style={{ fontSize:10, color:'#a07850',
                      marginTop:2, textAlign:'center' }}>
                      {byTheme[th.id]} {t('词','words','parole')}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div style={{ padding:40, textAlign:'center', color:'#a07850' }}>
            {t('加载中…','Loading…','Caricamento…')}
          </div>
        )}

        {/* Hint */}
        <div style={{ background:'#fff', borderRadius:12, padding:'10px 14px',
          border:'1px solid #e8d5b0', fontSize:11, color:'#2E7D32',
          display:'flex', gap:8, alignItems:'flex-start' }}>
          <span style={{ fontSize:14 }}>💡</span>
          <span>{t(
            '建议顺序：先闪卡熟悉 → 再听词巩固 → 最后填词挑战',
            'Suggested: flashcards first → listening → fill-in',
            'Ordine: flashcard → ascolto → scrittura'
          )}</span>
        </div>
      </div>
    </div>
  );
}

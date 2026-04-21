// src/pinyin/PinyinHome.jsx
// Pinyin module home — 4 learning paths

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const TOKEN_KEY = 'jgw_device_token';

const MODULES = [
  { id:'table',   emoji:'📋', zh:'声母韵母表', en:'Initials & Finals', it:'Iniziali e Finali',
    desc:'认识所有拼音', descEn:'Learn all pinyin sounds', descIt:'Impara tutti i suoni',
    color:'#E3F2FD', border:'#1565C0', textColor:'#0C447C' },
  { id:'tones',   emoji:'🎵', zh:'四声练习',   en:'Tone Practice',     it:'Pratica dei Toni',
    desc:'掌握四个声调', descEn:'Master the 4 tones',   descIt:'Padroneggia i 4 toni',
    color:'#E8F5E9', border:'#2E7D32', textColor:'#1B5E20' },
  { id:'listen',  emoji:'👂', zh:'听音识调',   en:'Listen & Identify',  it:'Ascolta e Identifica',
    desc:'听声音选声调', descEn:'Hear and pick the tone', descIt:'Ascolta e scegli',
    color:'#FFF8E1', border:'#F57F17', textColor:'#E65100' },
  { id:'type',    emoji:'⌨️', zh:'拼音输入',   en:'Type Pinyin',        it:'Scrivi Pinyin',
    desc:'看字写拼音', descEn:'See character, type pinyin', descIt:'Vedi e scrivi',
    color:'#F3E5F5', border:'#7B1FA2', textColor:'#4A148C' },
];

export default function PinyinHome({ onSelect, lang='zh' }) {
  const [stats, setStats] = useState({});

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    supabase.from('pinyin_practice_log')
      .select('module, score')
      .eq('device_token', token)
      .then(({ data }) => {
        if (!data) return;
        const s = {};
        data.forEach(r => {
          if (!s[r.module]) s[r.module] = { count:0, best:0 };
          s[r.module].count++;
          s[r.module].best = Math.max(s[r.module].best, r.score);
        });
        setStats(s);
      });
  }, []);

  const t = (zh, en, it) => lang==='zh' ? zh : lang==='it' ? it : en;

  return (
    <div style={{ background:'var(--bg)', minHeight:'100dvh', paddingBottom:80 }}>

      {/* Header */}
      <div style={{ background:'#1565C0', padding:'20px 16px 16px', textAlign:'center' }}>
        <div style={{ fontSize:32, marginBottom:4 }}>🔤</div>
        <div style={{ fontSize:22, fontWeight:500, color:'#fff',
          fontFamily:"'STKaiti','KaiTi',Georgia,serif" }}>
          {t('拼音学习','Pinyin Learning','Impara il Pinyin')}
        </div>
        <div style={{ fontSize:12, color:'#90CAF9', marginTop:4 }}>
          {t('从零开始，掌握汉语拼音',
             'From zero to pinyin mastery',
             'Da zero alla padronanza del pinyin')}
        </div>
      </div>

      {/* Module cards */}
      <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:12 }}>
        {MODULES.map((m, i) => {
          const st = stats[m.id];
          return (
            <button key={m.id} onClick={() => onSelect(m.id)}
              style={{ background:m.color, border:`2px solid ${m.border}`,
                borderRadius:16, padding:'16px', textAlign:'left',
                cursor:'pointer', width:'100%', display:'flex',
                alignItems:'center', gap:14 }}>

              {/* Step number */}
              <div style={{ width:36, height:36, borderRadius:'50%',
                background:m.border, color:'#fff', display:'flex',
                alignItems:'center', justifyContent:'center',
                fontSize:16, fontWeight:600, flexShrink:0 }}>
                {i+1}
              </div>

              {/* Content */}
              <div style={{ flex:1 }}>
                <div style={{ fontSize:16, fontWeight:500, color:m.textColor }}>
                  {m.emoji} {t(m.zh, m.en, m.it)}
                </div>
                <div style={{ fontSize:12, color:m.textColor, opacity:0.8, marginTop:2 }}>
                  {t(m.desc, m.descEn, m.descIt)}
                </div>
                {st && (
                  <div style={{ fontSize:11, color:m.textColor, marginTop:4,
                    opacity:0.7 }}>
                    {t(`练习${st.count}次`,`${st.count} sessions`,`${st.count} sessioni`)}
                    {' · '}{t(`最高${st.best}分`,`Best: ${st.best}`,`Migliore: ${st.best}`)}
                  </div>
                )}
              </div>

              {/* Arrow */}
              <div style={{ fontSize:20, color:m.border, opacity:0.6 }}>›</div>
            </button>
          );
        })}
      </div>

      {/* Tip */}
      <div style={{ margin:'0 16px', padding:'12px 14px', background:'#fff',
        borderRadius:12, border:'1px solid #e0e0e0', fontSize:12,
        color:'#666', lineHeight:1.7 }}>
        💡 {t(
          '建议顺序：先学声母韵母表，再练四声，然后听音，最后输入练习',
          'Suggested order: table → tones → listening → typing',
          'Ordine consigliato: tabella → toni → ascolto → scrittura'
        )}
      </div>
    </div>
  );
}

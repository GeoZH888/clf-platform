// src/clf/CLFHome.jsx
// Heritage learner home — shows level, progress, available modules

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const MODULES = [
  { id:'characters', icon:'字', label:'汉字', label_en:'Characters', label_it:'Caratteri',
    desc:'认识汉字，学习笔顺', color:'#E53935', bg:'#FFEBEE', available:true },
  { id:'words',      icon:'词', label:'词语', label_en:'Vocabulary',  label_it:'Vocabolario',
    desc:'按主题学词汇',       color:'#1565C0', bg:'#E3F2FD', available:false },
  { id:'grammar',    icon:'法', label:'语法', label_en:'Grammar',     label_it:'Grammatica',
    desc:'语法规则与练习',     color:'#6A1B9A', bg:'#F3E5F5', available:false },
  { id:'idioms',     icon:'成', label:'成语', label_en:'Idioms',      label_it:'Proverbi',
    desc:'成语故事与练习',     color:'#8B4513', bg:'#FFF8E1', available:false },
  { id:'poems',      icon:'诗', label:'诗歌', label_en:'Poetry',      label_it:'Poesia',
    desc:'古典诗歌阅读',       color:'#C8972A', bg:'#FFF8E1', available:false },
  { id:'stories',    icon:'故', label:'故事', label_en:'Stories',     label_it:'Storie',
    desc:'分级阅读故事',       color:'#2E7D32', bg:'#E8F5E9', available:false },
];

const LEVEL_COLORS = {
  0:'#FF9800',1:'#F44336',2:'#E91E63',3:'#9C27B0',4:'#673AB7',
  5:'#3F51B5',6:'#2196F3',7:'#03A9F4',8:'#00BCD4',9:'#009688',
  10:'#4CAF50',11:'#8BC34A',
};

export default function CLFHome({ profile, onSelect, onEditProfile }) {
  const [stats,  setStats]  = useState({ characters:0, words:0, streak:0 });
  const [lang,   setLang]   = useState('zh');

  const level     = profile?.current_level || 1;
  const levelColor = LEVEL_COLORS[level] || '#8B4513';
  const t = (zh, en, it) => lang==='zh' ? zh : lang==='it' ? it||en : en;

  useEffect(() => {
    const token = localStorage.getItem('clf_learner_token');
    if (!token) return;
    // Load quick stats
    supabase.from('clf_progress')
      .select('item_table', { count:'exact' })
      .eq('device_token', token).eq('correct', true)
      .then(({ count }) => setStats(s => ({ ...s, characters: count||0 })));
  }, []);

  return (
    <div style={{ minHeight:'100dvh', background:'#fdf6e3' }}>

      {/* Header */}
      <div style={{ background:`linear-gradient(135deg, ${levelColor}, ${levelColor}cc)`,
        padding:'20px 16px 24px', position:'relative' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:'#fff',
              fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:2 }}>
              大卫学中文
            </div>
            <div style={{ fontSize:12, color:'#ffffff99', marginTop:2 }}>
              Heritage Chinese · {t('汉语学习平台','Heritage Platform','Piattaforma')}
            </div>
          </div>
          {/* Language toggle */}
          <div style={{ display:'flex', gap:4 }}>
            {['zh','en','it'].map(l => (
              <button key={l} onClick={() => setLang(l)}
                style={{ padding:'4px 8px', borderRadius:8, border:'none', cursor:'pointer',
                  background: lang===l ? '#fff' : 'rgba(255,255,255,0.2)',
                  color: lang===l ? levelColor : '#fff',
                  fontSize:11, fontWeight:600 }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Learner card */}
        <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:16, padding:'14px 16px',
          marginTop:16, backdropFilter:'blur(8px)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:'#fff' }}>
                {profile?.display_name || t('学习者','Learner','Studente')}
              </div>
              <div style={{ fontSize:11, color:'#ffffff99', marginTop:2 }}>
                {t(`第 ${level} 级`, `Level ${level}`, `Livello ${level}`)}
                {profile?.hsk_equivalent && ` · ${profile.hsk_equivalent}`}
              </div>
            </div>
            <div style={{ display:'flex', gap:12 }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:700, color:'#fff' }}>{stats.characters}</div>
                <div style={{ fontSize:10, color:'#ffffff88' }}>{t('已学','learned','imparate')}</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:700, color:'#fff' }}>
                  {profile?.streak_days || 0}🔥
                </div>
                <div style={{ fontSize:10, color:'#ffffff88' }}>{t('连续天','streak','giorni')}</div>
              </div>
            </div>
          </div>

          {/* Level progress bar */}
          <div style={{ marginTop:12 }}>
            <div style={{ height:4, background:'rgba(255,255,255,0.2)', borderRadius:2 }}>
              <div style={{ height:'100%', width:`${Math.min((stats.characters/50)*100, 100)}%`,
                background:'#fff', borderRadius:2, transition:'width 0.5s' }}/>
            </div>
            <div style={{ fontSize:10, color:'#ffffff88', marginTop:4 }}>
              {stats.characters} / 50 {t('字到下一级','chars to next level','caratteri al prossimo livello')}
            </div>
          </div>
        </div>
      </div>

      {/* Module grid */}
      <div style={{ padding:'16px' }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#8B4513', marginBottom:12 }}>
          {t('学习模块','Learning Modules','Moduli')}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {MODULES.map(m => {
            const name = lang==='zh' ? m.label : lang==='it' ? m.label_it : m.label_en;
            return (
              <button key={m.id}
                onClick={() => m.available && onSelect(m.id)}
                style={{ background: m.available ? '#fff' : '#f5f5f5',
                  border:`1.5px solid ${m.available ? m.color+'44' : '#e0e0e0'}`,
                  borderRadius:16, padding:'16px 14px', cursor: m.available ? 'pointer' : 'default',
                  textAlign:'left', position:'relative', overflow:'hidden',
                  opacity: m.available ? 1 : 0.6,
                  WebkitTapHighlightColor:'transparent' }}>
                {/* Coming soon badge */}
                {!m.available && (
                  <div style={{ position:'absolute', top:8, right:8, fontSize:9,
                    background:'#e0e0e0', color:'#888', padding:'2px 6px', borderRadius:6 }}>
                    {t('即将上线','Soon','Presto')}
                  </div>
                )}
                <div style={{ fontSize:28, fontWeight:700, color: m.available ? m.color : '#bbb',
                  fontFamily:"'STKaiti','KaiTi',serif", marginBottom:8,
                  background: m.available ? m.bg : '#f0f0f0',
                  width:44, height:44, borderRadius:12,
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {m.icon}
                </div>
                <div style={{ fontSize:15, fontWeight:700,
                  color: m.available ? '#1a0a05' : '#bbb' }}>{name}</div>
                <div style={{ fontSize:11, color:'#a07850', marginTop:3 }}>{m.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Edit profile */}
        <button onClick={onEditProfile}
          style={{ width:'100%', marginTop:16, padding:'12px',
            border:'1px dashed #e8d5b0', borderRadius:14,
            background:'transparent', color:'#a07850',
            fontSize:13, cursor:'pointer' }}>
          ⚙️ {t('编辑学习档案','Edit Learning Profile','Modifica Profilo')}
        </button>
      </div>
    </div>
  );
}

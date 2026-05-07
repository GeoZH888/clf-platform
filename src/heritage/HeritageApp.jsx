// src/heritage/HeritageApp.jsx
// 非遗 home: compact tile grid matching community module style.
// Public — no login required.
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';

const CATEGORIES = [
  { slug:'folklore',  label_zh:'民俗故事', label_en:'Folklore',  label_it:'Folclore',    icon:'俗', color:'#a0522d',
    desc_zh: '传统民间传说', desc_en: 'Traditional folk tales',  desc_it: 'Racconti popolari' },
  { slug:'opera',     label_zh:'传统戏曲', label_en:'Opera',     label_it:'Opera',       icon:'戏', color:'#c41e3a',
    desc_zh: '昆曲、京剧、各地戏种', desc_en: 'Kunqu, Beijing opera, regional styles', desc_it: 'Kunqu, opera di Pechino' },
  { slug:'crafts',    label_zh:'民间工艺', label_en:'Crafts',    label_it:'Artigianato', icon:'工', color:'#8b4513',
    desc_zh: '剪纸、刺绣、陶瓷', desc_en: 'Paper-cutting, embroidery, ceramics', desc_it: 'Carta tagliata, ricamo, ceramica' },
  { slug:'festivals', label_zh:'节庆文化', label_en:'Festivals', label_it:'Feste',       icon:'庆', color:'#d4a017',
    desc_zh: '传统节日与仪式', desc_en: 'Traditional festivals & rituals', desc_it: 'Feste e rituali' },
];

export default function HeritageApp() {
  return (
    <BrowserRouter basename="/feiyi">
      <Routes>
        <Route path="/" element={<HeritageHome />} />
        <Route path="*" element={<HeritageHome />} />
      </Routes>
    </BrowserRouter>
  );
}

function HeritageHome() {
  const [lang, setLang] = useState('zh');
  const navigate = useNavigate();
  const t = (cat, kind = 'label') => cat[`${kind}_${lang}`];

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #fdf6e3 0%, #f5e6c8 50%, #f0d9b5 100%)',
      color: '#1a0a05',
    }}>
      <header style={{
        padding: '20px 24px',
        background: 'linear-gradient(90deg, #a0522d 0%, #8b4513 100%)',
        color: '#fff5e6',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700,
            fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 6 }}>
            {lang === 'zh' ? '非遗' : lang === 'en' ? 'Heritage' : 'Patrimonio'}
          </div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
            {lang === 'zh' ? '中华非物质文化遗产'
              : lang === 'en' ? 'Chinese Intangible Cultural Heritage'
              : 'Patrimonio culturale immateriale cinese'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['zh', 'en', 'it'].map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding: '5px 11px', borderRadius: 14,
              background: lang === l ? '#fff5e6' : 'rgba(255,255,255,0.15)',
              color: lang === l ? '#a0522d' : '#fff5e6',
              border: '1px solid rgba(255,255,255,0.3)',
              cursor: 'pointer', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase',
            }}>{l}</button>
          ))}
          <button onClick={() => window.location.href = '/'} style={{
            padding: '5px 11px', borderRadius: 14,
            background: 'rgba(255,255,255,0.15)', color: '#fff5e6',
            border: '1px solid rgba(255,255,255,0.3)',
            cursor: 'pointer', fontSize: 11, fontWeight: 600, marginLeft: 4,
          }}>
            {lang === 'zh' ? '首页' : lang === 'en' ? 'Home' : 'Home'}
          </button>
        </div>
      </header>

      <main style={{ padding: '24px 20px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          background: '#fff',
          border: '1px solid #e8d5b0',
          borderRadius: 14, padding: 16, marginBottom: 20,
          fontSize: 13, color: '#5d4630', lineHeight: 1.7,
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
        }}>
          {lang === 'zh' && '非物质文化遗产是人类口口相传、代代相承的生活智慧与艺术形式。这里收集中华传统文化中的多个主题，供所有人自由浏览学习。'}
          {lang === 'en' && 'Intangible cultural heritage represents living traditions transmitted through generations. This collection introduces themes from Chinese tradition, freely available to all.'}
          {lang === 'it' && 'Il patrimonio culturale immateriale rappresenta tradizioni viventi tramandate per generazioni. Questa raccolta presenta temi della tradizione cinese, gratuita per tutti.'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 1,
            background: 'linear-gradient(to right, transparent, rgba(160,82,45,0.4))' }}/>
          <div style={{ fontSize: 12, color: '#a0522d', fontWeight: 700, letterSpacing: 4 }}>
            {lang === 'zh' ? '主题' : lang === 'en' ? 'Themes' : 'Temi'}
          </div>
          <div style={{ flex: 1, height: 1,
            background: 'linear-gradient(to left, transparent, rgba(160,82,45,0.4))' }}/>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
        }}>
          {CATEGORIES.map(c => <CategoryTile key={c.slug} cat={c} t={t} navigate={navigate}/>)}
        </div>

        <div style={{
          textAlign: 'center', marginTop: 40, fontSize: 11, color: '#a07850',
        }}>
          {lang === 'zh' && '公益资源 · 免费开放 · 无需注册'}
          {lang === 'en' && 'Public resource · Free · No registration'}
          {lang === 'it' && 'Risorsa pubblica · Gratuita · Nessuna registrazione'}
        </div>
      </main>
    </div>
  );
}

function CategoryTile({ cat, t, navigate }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => alert(t(cat) + ' · 内容建设中…')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        border: `1.5px solid ${hovered ? cat.color : '#e8d5b0'}`,
        borderRadius: 14, padding: '18px 12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered
          ? `0 10px 24px ${cat.color}30`
          : '0 2px 6px rgba(0,0,0,0.04)',
        textAlign: 'center',
        color: '#1a0a05',
      }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: `${cat.color}15`,
        border: `1.5px solid ${cat.color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 800, color: cat.color,
        fontFamily: "'STKaiti','KaiTi',serif",
        margin: '0 auto 10px',
      }}>
        {cat.icon}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4,
        fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 1 }}>
        {t(cat)}
      </div>
      <div style={{ fontSize: 10, color: '#8b6f47', lineHeight: 1.4 }}>
        {t(cat, 'desc')}
      </div>
    </button>
  );
}

// src/components/PlatformHome.jsx
// Platform hub. Two responsibilities:
//   1. Own the learning-path scope (HSK / Jinan / Theme / All) that applies
//      to ALL modules. Path is persisted to localStorage under
//      "clf_current_path". Each module reads this key on mount and filters
//      its content accordingly.
//   2. List modules via the MODULES array below. Adding a new module is
//      one object append here + one render case in App.jsx.
//
// Current modules: lianzi (character writing), pinyin.
// Easy to add: words, chengyu, poetry, grammar, hsk, games.

import { useState, useEffect } from 'react';
import { useLang } from '../context/LanguageContext.jsx';
import PathSelector from './PathSelector.jsx';
import LangSwitcher from './LangSwitcher.jsx';

const PATH_STORAGE_KEY = 'clf_current_path';

// ── Module registry ────────────────────────────────────────────────
// id → must match what App.jsx's onSelect expects (e.g. 'lianzi' → 'home').
// emoji, name, desc, features, tag → display content in three languages.
// color / border / text → card theme colors.
//
// To add a new module: append an entry here, then add a render case in
// App.jsx. No other changes to this file are required.
const MODULES = [
  {
    id:       'lianzi',
    emoji:    '🐢',
    name:     { zh:'练字', en:'Character Writing', it:'Scrittura' },
    desc:     { zh:'笔顺 · 软笔 · 声调练习',
                en:'Stroke order · brush · tones',
                it:'Tratti · pennello · toni' },
    features: [
      { zh:'字形临摹',     en:'Character tracing',  it:'Tracciamento' },
      { zh:'笔顺动画引导', en:'Stroke animations',  it:'Animazioni tratti' },
      { zh:'软笔/硬笔练习', en:'Brush & hard pen',   it:'Pennello e penna' },
      { zh:'声调朗读评分', en:'Tone scoring',       it:'Punteggio toni' },
    ],
    tag:      { zh:'书法', en:'Calligraphy', it:'Calligrafia' },
    color:    '#FBE9E7',
    border:   '#8B4513',
    text:     '#5D2E0C',
  },
  {
    id:       'pinyin',
    emoji:    '🔤',
    name:     { zh:'拼音', en:'Pinyin', it:'Pinyin' },
    desc:     { zh:'声母 · 韵母 · 四声 · 发音',
                en:'Initials · finals · tones · speech',
                it:'Iniziali · finali · toni · voce' },
    features: [
      { zh:'声母韵母表', en:'Initials & finals',     it:'Iniziali e finali' },
      { zh:'四声练习',   en:'Tone practice',         it:'Pratica toni' },
      { zh:'听音识调',   en:'Listen & identify',     it:'Ascolta e identifica' },
      { zh:'发音打分',   en:'Speech scoring',        it:'Punteggio voce' },
    ],
    tag:      { zh:'发音', en:'Pronunciation', it:'Pronuncia' },
    color:    '#E3F2FD',
    border:   '#1565C0',
    text:     '#0C3C7A',
  },

  // ── Future modules — uncomment and adjust as they come online ──
  // {
  //   id:    'words', emoji:'📚',
  //   name:  { zh:'词汇', en:'Vocabulary', it:'Vocabolario' },
  //   desc:  { zh:'生词 · HSK词表', en:'HSK vocab', it:'Vocabolario HSK' },
  //   features: [
  //     { zh:'词汇卡片', en:'Flashcards',    it:'Flashcard' },
  //     { zh:'例句',     en:'Example sentences', it:'Frasi di esempio' },
  //     { zh:'搭配练习', en:'Collocations',  it:'Collocazioni' },
  //     { zh:'间隔重复', en:'Spaced repetition', it:'Ripetizione spaziata' },
  //   ],
  //   tag: { zh:'词汇', en:'Vocab', it:'Vocab' },
  //   color:'#E8F5E9', border:'#2E7D32', text:'#1B5E20',
  // },
  // {
  //   id:    'poetry', emoji:'🎴',
  //   name:  { zh:'诗歌', en:'Poetry', it:'Poesia' },
  //   ...
  // },
  // {
  //   id:    'chengyu', emoji:'🎭',
  //   name:  { zh:'成语', en:'Idioms', it:'Idiomi' },
  //   ...
  // },
];

// ────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────
export default function PlatformHome({ onSelect, allowedModules, userLabel, onSettings, onLogout }) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it || en) : en;

  // Platform-level path scope. Read from localStorage on mount so navigating
  // away and back preserves the selection. Each module (HomeScreen, PinyinApp,
  // etc.) reads the same key when it mounts.
  const [currentPath, setCurrentPath] = useState(() => {
    try { return localStorage.getItem(PATH_STORAGE_KEY) || 'all'; }
    catch { return 'all'; }
  });
  useEffect(() => {
    try { localStorage.setItem(PATH_STORAGE_KEY, currentPath); } catch {}
  }, [currentPath]);

  // Respect allowedModules from App if provided (e.g. device auth limits)
  const visibleModules = allowedModules && allowedModules.length > 0
    ? MODULES.filter(m => allowedModules.includes(m.id))
    : MODULES;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingBottom: 40 }}>

      {/* ── Top bar: title + language + settings ── */}
      <div style={{ padding: '14px 16px 6px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)',
            fontFamily: "'STKaiti','KaiTi',Georgia,serif" }}>
            {t('大卫学中文', 'Hanzi Platform', 'Hanzi Platform')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
            {t('选择学习路径，再选模块', 'Pick a path, then a module', 'Scegli percorso e modulo')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <LangSwitcher/>
          {onSettings && (
            <button onClick={onSettings} style={{
              width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)',
              background: 'var(--card)', cursor: 'pointer', fontSize: 14,
            }}>⚙</button>
          )}
        </div>
      </div>

      {/* ── Learning path (applies to all modules) ── */}
      <div style={{ padding: '6px 16px 14px' }}>
        <PathSelector
          currentPath={currentPath}
          onSelectPath={setCurrentPath}
          lang={lang}
        />
      </div>

      {/* ── Module grid ── */}
      <div style={{ padding: '0 16px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 14 }}>
        {visibleModules.map(m => (
          <ModuleCard key={m.id} mod={m} lang={lang}
            onClick={() => onSelect?.(m.id)} />
        ))}
      </div>

      {/* ── Footer ── */}
      <div style={{ textAlign: 'center', padding: '24px 16px 0',
        fontSize: 11, color: 'var(--text-3)' }}>
        {userLabel && <div style={{ marginBottom: 6 }}>{userLabel}</div>}
        zhongwen-world.netlify.app · {t('汉字学习平台', 'Hanzi learning platform', 'Piattaforma Hanzi')}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// ModuleCard — large gateway card per module
// ────────────────────────────────────────────────────────────────────
function ModuleCard({ mod, lang, onClick }) {
  const name = mod.name?.[lang] || mod.name?.en || mod.id;
  const desc = mod.desc?.[lang] || mod.desc?.en || '';
  const tag  = mod.tag?.[lang]  || mod.tag?.en  || '';

  return (
    <button onClick={onClick}
      style={{
        background: mod.color,
        border: `2px solid ${mod.border}`,
        borderRadius: 20,
        padding: '20px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        position: 'relative',
        WebkitTapHighlightColor: 'transparent',
        fontFamily: 'inherit',
        transition: 'transform 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>

      {/* Tag badge */}
      {tag && (
        <div style={{ position: 'absolute', top: 12, right: 12,
          background: mod.border, color: '#fff',
          fontSize: 10, padding: '2px 9px', borderRadius: 10, fontWeight: 600 }}>
          {tag}
        </div>
      )}

      {/* Icon + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16,
          background: mod.border, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, flexShrink: 0 }}>
          {mod.emoji}
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: mod.text,
            fontFamily: "'STKaiti','KaiTi',Georgia,serif", lineHeight: 1.1 }}>
            {name}
          </div>
          <div style={{ fontSize: 11, color: mod.border, marginTop: 3, opacity: 0.85 }}>
            {desc}
          </div>
        </div>
      </div>

      {/* Features (numbered list) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
        {mod.features.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9,
            fontSize: 13, color: mod.text }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%',
              background: mod.border, color: '#fff',
              fontSize: 10, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0 }}>{i + 1}</div>
            <span>{f?.[lang] || f?.en || ''}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, color: mod.border, opacity: 0.85 }}>
          {lang === 'zh' ? '点击进入' : lang === 'it' ? 'Tocca per iniziare' : 'Tap to enter'}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: '50%',
          background: mod.border, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18 }}>›</div>
      </div>
    </button>
  );
}

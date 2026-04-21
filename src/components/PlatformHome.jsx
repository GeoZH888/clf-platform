// src/components/PlatformHome.jsx
import { useLang } from '../context/LanguageContext.jsx';
import LangSwitcher from './LangSwitcher.jsx';
import PathSelector from './PathSelector.jsx';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

function greet() {
  const h = new Date().getHours();
  if (h < 6)  return { zh:'夜深了，还在学习 🌙', en:'Burning midnight oil 🌙', it:'Stai ancora studiando 🌙' };
  if (h < 12) return { zh:'早上好，开始学习 ☀️', en:'Good morning ☀️', it:'Buongiorno ☀️' };
  if (h < 18) return { zh:'下午好，继续加油 ✨', en:'Good afternoon ✨', it:'Buon pomeriggio ✨' };
  return       { zh:'晚上好，每天进步 🔥', en:'Good evening 🔥', it:'Buona sera 🔥' };
}

// ── Fallback inline SVG pandas per module ─────────────────────────────────────
// Shown when Supabase panda assets aren't loaded yet
function PandaBrush({ size = 120 }) {
  // Panda holding a calligraphy brush — for 练字
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <ellipse cx="60" cy="75" rx="28" ry="30" fill="#fff" stroke="#333" strokeWidth="2"/>
      {/* Head */}
      <circle cx="60" cy="42" r="24" fill="#fff" stroke="#333" strokeWidth="2"/>
      {/* Ears */}
      <circle cx="40" cy="22" r="10" fill="#222"/>
      <circle cx="80" cy="22" r="10" fill="#222"/>
      <circle cx="40" cy="22" r="6" fill="#444"/>
      <circle cx="80" cy="22" r="6" fill="#444"/>
      {/* Eye patches */}
      <ellipse cx="50" cy="40" rx="9" ry="8" fill="#222" transform="rotate(-10 50 40)"/>
      <ellipse cx="70" cy="40" rx="9" ry="8" fill="#222" transform="rotate(10 70 40)"/>
      {/* Eyes */}
      <circle cx="50" cy="41" r="4" fill="#fff"/>
      <circle cx="70" cy="41" r="4" fill="#fff"/>
      <circle cx="51" cy="41" r="2" fill="#111"/>
      <circle cx="71" cy="41" r="2" fill="#111"/>
      {/* Nose */}
      <ellipse cx="60" cy="51" rx="5" ry="3" fill="#555"/>
      {/* Smile */}
      <path d="M54 56 Q60 62 66 56" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Arms */}
      <ellipse cx="34" cy="72" rx="10" ry="16" fill="#222" transform="rotate(20 34 72)"/>
      <ellipse cx="86" cy="72" rx="10" ry="16" fill="#222" transform="rotate(-20 86 72)"/>
      {/* Brush in right hand */}
      <line x1="92" y1="62" x2="108" y2="30" stroke="#8B4513" strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="108" cy="28" rx="4" ry="7" fill="#E53935" transform="rotate(-30 108 28)"/>
      {/* Brush tip ink */}
      <circle cx="112" cy="22" r="3" fill="#1a0a05"/>
      {/* Legs */}
      <ellipse cx="48" cy="100" rx="12" ry="10" fill="#222"/>
      <ellipse cx="72" cy="100" rx="12" ry="10" fill="#222"/>
    </svg>
  );
}

function PandaSpeaking({ size = 120 }) {
  // Panda with musical notes / speaking — for 拼音
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="78" rx="26" ry="28" fill="#fff" stroke="#333" strokeWidth="2"/>
      <circle cx="60" cy="44" r="24" fill="#fff" stroke="#333" strokeWidth="2"/>
      <circle cx="40" cy="24" r="10" fill="#222"/>
      <circle cx="80" cy="24" r="10" fill="#222"/>
      <circle cx="40" cy="24" r="6" fill="#444"/>
      <circle cx="80" cy="24" r="6" fill="#444"/>
      <ellipse cx="50" cy="42" rx="9" ry="8" fill="#222" transform="rotate(-10 50 42)"/>
      <ellipse cx="70" cy="42" rx="9" ry="8" fill="#222" transform="rotate(10 70 42)"/>
      <circle cx="50" cy="43" r="4" fill="#fff"/>
      <circle cx="70" cy="43" r="4" fill="#fff"/>
      <circle cx="51" cy="43" r="2" fill="#111"/>
      <circle cx="71" cy="43" r="2" fill="#111"/>
      <ellipse cx="60" cy="53" rx="5" ry="3" fill="#555"/>
      {/* Open mouth - speaking */}
      <path d="M53 59 Q60 68 67 59" fill="#E91E63" stroke="#333" strokeWidth="1"/>
      <ellipse cx="34" cy="76" rx="10" ry="15" fill="#222" transform="rotate(15 34 76)"/>
      <ellipse cx="86" cy="76" rx="10" ry="15" fill="#222" transform="rotate(-15 86 76)"/>
      <ellipse cx="48" cy="103" rx="11" ry="9" fill="#222"/>
      <ellipse cx="72" cy="103" rx="11" ry="9" fill="#222"/>
      {/* Musical notes */}
      <text x="88" y="38" fontSize="14" fill="#1565C0" fontWeight="bold">♪</text>
      <text x="96" y="22" fontSize="11" fill="#1E88E5">♫</text>
      <text x="82" y="52" fontSize="9" fill="#42A5F5">♩</text>
    </svg>
  );
}

function PandaReading({ size = 120 }) {
  // Panda reading a book — for 词语
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="76" rx="26" ry="28" fill="#fff" stroke="#333" strokeWidth="2"/>
      <circle cx="60" cy="44" r="24" fill="#fff" stroke="#333" strokeWidth="2"/>
      <circle cx="40" cy="24" r="10" fill="#222"/>
      <circle cx="80" cy="24" r="10" fill="#222"/>
      <circle cx="40" cy="24" r="6" fill="#444"/>
      <circle cx="80" cy="24" r="6" fill="#444"/>
      <ellipse cx="50" cy="42" rx="9" ry="8" fill="#222" transform="rotate(-10 50 42)"/>
      <ellipse cx="70" cy="42" rx="9" ry="8" fill="#222" transform="rotate(10 70 42)"/>
      <circle cx="50" cy="43" r="4" fill="#fff"/>
      <circle cx="70" cy="43" r="4" fill="#fff"/>
      <circle cx="51" cy="42" r="2" fill="#111"/>
      <circle cx="71" cy="42" r="2" fill="#111"/>
      <ellipse cx="60" cy="53" rx="5" ry="3" fill="#555"/>
      {/* Smile */}
      <path d="M54 58 Q60 64 66 58" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Arms holding book */}
      <ellipse cx="34" cy="78" rx="10" ry="15" fill="#222" transform="rotate(25 34 78)"/>
      <ellipse cx="86" cy="78" rx="10" ry="15" fill="#222" transform="rotate(-25 86 78)"/>
      {/* Book */}
      <rect x="30" y="88" width="60" height="22" rx="3" fill="#2E7D32" stroke="#1B5E20" strokeWidth="1.5"/>
      <line x1="60" y1="88" x2="60" y2="110" stroke="#1B5E20" strokeWidth="1.5"/>
      {/* Book text lines */}
      <line x1="36" y1="95" x2="57" y2="95" stroke="#fff" strokeWidth="1" opacity="0.6"/>
      <line x1="36" y1="100" x2="57" y2="100" stroke="#fff" strokeWidth="1" opacity="0.6"/>
      <line x1="63" y1="95" x2="84" y2="95" stroke="#fff" strokeWidth="1" opacity="0.6"/>
      <line x1="63" y1="100" x2="84" y2="100" stroke="#fff" strokeWidth="1" opacity="0.6"/>
      <ellipse cx="48" cy="108" rx="11" ry="9" fill="#222"/>
      <ellipse cx="72" cy="108" rx="11" ry="9" fill="#222"/>
    </svg>
  );
}

const PANDA_SVG = {
  lianzi:  PandaBrush,
  pinyin:  PandaSpeaking,
  words:   PandaReading,
  chengyu: PandaReading,
  grammar: PandaReading,
  hsk:     PandaReading,
  poetry:  PandaReading,
  games:   PandaReading,
};

// ── Module data ───────────────────────────────────────────────────────────────
const MODULES = [
  {
    id: 'lianzi',
    pandaEmotion: 'writing',
    zh: '练字', en: 'Character Tracing', it: 'Scrittura',
    desc: { zh:'笔顺 · 软笔 · 声调练习', en:'Stroke order · brush · tones', it:'Tratti · pennello · toni' },
    color: '#FBE9E7', border: '#8B4513', text: '#5D2E0C',
    tag: { zh:'书法', en:'Calligraphy', it:'Calligrafia' },
    features: [
      { zh:'字形临摹', en:'Character tracing', it:'Tracciamento' },
      { zh:'笔顺动画引导', en:'Animated stroke guide', it:'Guida animata' },
      { zh:'软笔 / 硬笔练习', en:'Brush & pen modes', it:'Pennello e penna' },
      { zh:'声调朗读评分', en:'Tone pronunciation scoring', it:'Valutazione tono' },
    ],
  },
  {
    id: 'pinyin',
    pandaEmotion: 'pinyin',
    zh: '拼音', en: 'Pinyin', it: 'Pinyin',
    desc: { zh:'声母 · 韵母 · 四声', en:'Initials · finals · tones', it:'Iniziali · finali · toni' },
    color: '#E3F2FD', border: '#1565C0', text: '#0C3C7A',
    tag: { zh:'发音', en:'Pronunciation', it:'Pronuncia' },
    features: [
      { zh:'声母韵母口型动画', en:'Mouth animation per sound', it:'Animazione bocca' },
      { zh:'四声练习 + 对比', en:'Tone practice & comparison', it:'Pratica dei toni' },
      { zh:'听音识调测验', en:'Listen & identify tone', it:'Ascolta e identifica' },
      { zh:'发音录音评分', en:'Speak & get scored', it:'Pronuncia e punteggio' },
    ],
  },
  {
    id: 'words',
    pandaEmotion: 'words',
    zh: '词语', en: 'Vocabulary', it: 'Vocabolario',
    desc: { zh:'词汇 · 闪卡 · 听写', en:'Vocabulary · flashcards · dictation', it:'Vocabolario · flashcard' },
    color: '#E8F5E9', border: '#2E7D32', text: '#1B5E20',
    tag: { zh:'词汇', en:'Vocabulary', it:'Vocabolario' },
    features: [
      { zh:'按主题分类词汇', en:'Vocabulary by theme', it:'Per tema' },
      { zh:'闪卡快速练习', en:'Flashcard practice', it:'Flashcard' },
      { zh:'听词选义', en:'Listen & choose meaning', it:'Ascolta e scegli' },
      { zh:'看义填词', en:'Fill in the blank', it:'Completa' },
    ],
  },
  {
    id: 'hsk',
    pandaEmotion: 'hsk',
    zh: 'HSK', en: 'HSK', it: 'HSK',
    desc: { zh:'HSK 1-6级 · 词汇 · AI解释', en:'HSK 1-6 · vocabulary · AI explanations', it:'HSK 1-6 · vocabolario · AI' },
    color: '#E8F5E9', border: '#2E7D32', text: '#1B5E20',
    tag: { zh:'词汇', en:'Vocabulary', it:'Vocabolario' },
    features: [
      { zh:'HSK 1-6 全级词汇', en:'All HSK 1-6 vocabulary', it:'Tutto il vocabolario HSK' },
      { zh:'📖 学习 · 闪卡翻面', en:'📖 Flashcard learning', it:'📖 Flashcard' },
      { zh:'✅ 测验 · 4选1', en:'✅ 4-choice quiz', it:'✅ Quiz a 4 scelte' },
      { zh:'🎯 练习 · 智能复习', en:'🎯 Spaced repetition', it:'🎯 Ripetizione spaziata' },
    ],
  },
  {
    id: 'poetry',
    pandaEmotion: 'poetry',
    zh: '诗歌', en: 'Poetry', it: 'Poesia',
    desc: { zh:'古典诗歌 · 阅读 · 默写 · 测验', en:'Classical poetry · read · memorize · quiz', it:'Poesia classica · lettura · memoria · quiz' },
    color: '#1a0f00', border: '#C8972A', text: '#C8972A',
    tag: { zh:'经典', en:'Classic', it:'Classica' },
    features: [
      { zh:'唐宋元明清 经典诗词', en:'Tang, Song, Ming, Qing classics', it:'Classici Tang, Song e oltre' },
      { zh:'📖 阅读 · 译文 · 背景', en:'📖 Read with translation & context', it:'📖 Leggi con traduzione' },
      { zh:'📝 默写 · 填空练习', en:'📝 Memorize · fill-in-blank', it:'📝 Memorizza e completa' },
      { zh:'✅ 诗句测验 · 接龙', en:'✅ Line-by-line quiz', it:'✅ Quiz verso per verso' },
    ],
  },
  {
    id: 'chengyu',
    pandaEmotion: 'chengyu',
    zh: '成语', en: 'Idioms', it: 'Proverbi',
    desc: { zh:'成语 · 典故 · 接龙', en:'Chinese idioms · stories · games', it:'Proverbi · storie · giochi' },
    color: '#FFF8E1', border: '#8B4513', text: '#4E2800',
    tag: { zh:'成语', en:'Idioms', it:'Proverbi' },
    features: [
      { zh:'成语闪卡 + 典故', en:'Flashcards with origin stories', it:'Flashcard con storie' },
      { zh:'选义测验', en:'Choose meaning quiz', it:'Quiz' },
      { zh:'填空练习', en:'Fill in the blank', it:'Completa' },
      { zh:'成语接龙挑战', en:'Idiom chain challenge', it:'Catena di proverbi' },
    ],
  },
  {
    id: 'grammar',
    pandaEmotion: 'grammar',
    zh: '语法', en: 'Grammar', it: 'Grammatica',
    desc: { zh:'语法点 · 填空 · 造句', en:'Patterns · fill-blank · sentence building', it:'Schemi · completa · costruisci' },
    color: '#F3E5F5', border: '#6A1B9A', text: '#3E0A5E',
    tag: { zh:'语法', en:'Grammar', it:'Grammatica' },
    features: [
      { zh:'把/被/是的/比较等语法点', en:'把/被/是的/比 and more patterns', it:'Schemi grammaticali' },
      { zh:'填空选词练习', en:'Fill-in-blank quiz', it:'Completa gli spazi' },
      { zh:'连词成句训练', en:'Sentence building game', it:'Costruisci frasi' },
      { zh:'语法速查表', en:'Grammar cheatsheet', it:'Riepilogo rapido' },
    ],
  },
  {
    id: 'games',
    pandaEmotion: 'games',
    zh: '游戏', en: 'Games', it: 'Giochi',
    desc: { zh:'⚡问答 · 🃏记忆 · 🌧字雨 · 🔤拼词', en:'⚡Quiz · 🃏Memory · 🌧Falling · 🔤Spell', it:'⚡Quiz · 🃏Memoria · 🌧Pioggia · 🔤Componi' },
    color: '#212121', border: '#F57F17', text: '#FFD740',
    tag: { zh:'趣味', en:'Fun', it:'Divertente' },
    features: [
      { zh:'⚡ 闪电问答 — 8秒连击加分', en:'⚡ Speed Quiz — 8s combos', it:'⚡ Quiz veloce — combo' },
      { zh:'🃏 翻牌记忆 — 配对挑战', en:'🃏 Memory Match — flip cards', it:'🃏 Abbina le carte' },
      { zh:'🌧 字雨 — 字符从天而降', en:'🌧 Falling Sky — react fast', it:'🌧 Pioggia di caratteri' },
      { zh:'🔤 拼词游戏 — 造词挑战', en:'🔤 Word Spell — build words', it:'🔤 Componi le parole' },
    ],
  },
];

// ── Module card ───────────────────────────────────────────────────────────────
function ModuleCard({ m, lang, pandaUrl, onSelect }) {
  const [pressed, setPressed] = useState(false);
  const name = lang==='zh' ? m.zh : lang==='it' ? m.it : m.en;
  const desc = lang==='zh' ? m.desc.zh : lang==='it' ? m.desc.it : m.desc.en;
  const tag  = lang==='zh' ? m.tag.zh  : lang==='it' ? m.tag.it  : m.tag.en;
  const PandaSVG = PANDA_SVG[m.id];

  return (
    <button
      onClick={() => onSelect(m.id)}
      onMouseEnter={e => e.currentTarget.style.transform='translateY(-3px)'}
      onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      style={{
        background: m.color,
        border: `2px solid ${m.border}`,
        borderRadius: 24,
        padding: 0,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        WebkitTapHighlightColor: 'transparent',
        transition: 'transform 0.2s, box-shadow 0.2s',
        boxShadow: pressed ? 'none' : `0 4px 16px ${m.border}22`,
        overflow: 'hidden',
      }}>

      {/* ── Panda illustration area ── */}
      <div style={{
        background: `linear-gradient(135deg, ${m.border}18 0%, ${m.border}08 100%)`,
        borderBottom: `1px solid ${m.border}22`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '20px 0 12px',
        position: 'relative',
        minHeight: 160,
      }}>
        {/* Tag badge */}
        <div style={{
          position: 'absolute', top: 12, right: 14,
          background: m.border, color: '#fff',
          fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
          padding: '3px 10px', borderRadius: 20,
        }}>{tag}</div>

        {/* Panda image */}
        {pandaUrl ? (
          <img src={pandaUrl} alt={m.zh}
            style={{ width: 110, height: 110, objectFit: 'contain',
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.12))' }}/>
        ) : PandaSVG ? (
          <div style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.12))' }}>
            <PandaSVG size={110}/>
          </div>
        ) : (
          <div style={{ fontSize: 64, lineHeight:1 }}>🐼</div>
        )}

        {/* Module name under panda */}
        <div style={{
          marginTop: 8,
          fontSize: 24, fontWeight: 600, color: m.text,
          fontFamily: "'STKaiti','KaiTi',Georgia,serif",
          letterSpacing: 2,
        }}>{name}</div>
        <div style={{ fontSize: 11, color: m.border, opacity: 0.8, marginTop: 2 }}>
          {desc}
        </div>
      </div>

      {/* ── Feature list ── */}
      <div style={{ padding: '14px 18px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
          {m.features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: m.text }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: m.border + '22', border: `1px solid ${m.border}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: m.border, fontWeight: 600, flexShrink: 0,
              }}>{i + 1}</div>
              {lang==='zh' ? f.zh : lang==='it' ? f.it : f.en}
            </div>
          ))}
        </div>

        {/* CTA row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: m.border, opacity: 0.7 }}>
            {lang==='zh' ? '点击进入' : lang==='it' ? 'Tocca per iniziare' : 'Tap to start'}
          </div>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: m.border,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 20,
            boxShadow: `0 2px 8px ${m.border}44`,
          }}>›</div>
        </div>
      </div>
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PlatformHome({ onSelect, allowedModules = ['lianzi','pinyin'], onSettings, onLogout, userLabel }) {
  const { lang } = useLang();
  const g = greet();
  const greeting = lang==='zh' ? g.zh : lang==='it' ? g.it : g.en;
  const [pandaIcons, setPandaIcons] = useState({});
  const [showLogout, setShowLogout] = useState(false);

  // ── Learning path state (persisted in localStorage) ──
  const [selectedPath, setSelectedPath] = useState(() => {
    try { return localStorage.getItem('learning_path') || 'all'; }
    catch { return 'all'; }
  });

  function handleSelectPath(pathId) {
    setSelectedPath(pathId);
    try { localStorage.setItem('learning_path', pathId); } catch {}
    // If you want clicking a path to auto-jump into character practice,
    // uncomment the next line:
    //   if (onSelect) onSelect('lianzi');
  }

  // Close dropdown on outside click
  useEffect(() => {
    if (!showLogout) return;
    const close = () => setShowLogout(false);
    setTimeout(() => document.addEventListener('click', close), 0);
    return () => document.removeEventListener('click', close);
  }, [showLogout]);

  useEffect(() => {
    supabase.from('jgw_panda_assets').select('emotion, image_url')
      .then(({ data }) => {
        if (data) {
          const map = {};
          data.forEach(r => { map[r.emotion] = r.image_url; });
          setPandaIcons(map);
        }
      }).catch(() => {});
  }, []);

  const visible = MODULES.filter(m => allowedModules.includes(m.id));

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ padding: '16px 16px 12px',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>{greeting}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
            {new Date().toLocaleDateString('zh-CN',
              { month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {onSettings && (
            <button onClick={onSettings}
              title={lang==='zh'?'个人设置':lang==='it'?'Impostazioni':'Settings'}
              style={{ border:'none', background:'none', cursor:'pointer',
                fontSize:20, color:'var(--text-3)', padding:'4px',
                WebkitTapHighlightColor:'transparent' }}>
              ⚙️
            </button>
          )}

          {/* User avatar / logout */}
          <div style={{ position:'relative' }}>
            <button onClick={() => setShowLogout(s => !s)}
              title={userLabel || 'Account'}
              style={{ border:'1.5px solid #e8d5b0', background:'#fff',
                borderRadius:20, padding:'4px 10px', cursor:'pointer',
                fontSize:12, color:'#8B4513', fontWeight:600,
                display:'flex', alignItems:'center', gap:5,
                WebkitTapHighlightColor:'transparent' }}>
              <span style={{ fontSize:16 }}>👤</span>
              <span style={{ maxWidth:70, overflow:'hidden', textOverflow:'ellipsis',
                whiteSpace:'nowrap' }}>
                {userLabel || (lang==='zh'?'我':'Me')}
              </span>
            </button>
            {showLogout && (
              <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)',
                background:'#fff', border:'1px solid #e8d5b0', borderRadius:12,
                boxShadow:'0 4px 16px rgba(0,0,0,0.12)', zIndex:200, minWidth:140,
                overflow:'hidden' }}>
                {onSettings && (
                  <button onClick={() => { setShowLogout(false); onSettings(); }}
                    style={{ width:'100%', padding:'10px 14px', border:'none',
                      background:'none', textAlign:'left', fontSize:13,
                      color:'#1a0a05', cursor:'pointer', display:'flex', gap:8 }}>
                    ⚙️ {lang==='zh'?'个人设置':lang==='it'?'Impostazioni':'Settings'}
                  </button>
                )}
                <div style={{ height:1, background:'#f0e8d8', margin:'0 10px' }}/>
                <button onClick={() => {
                  setShowLogout(false);
                  if (window.confirm(
                    lang==='zh' ? '确定要退出登录吗？' :
                    lang==='it' ? 'Confermi il logout?' :
                    'Are you sure you want to log out?'
                  )) { onLogout?.(); }
                }} style={{ width:'100%', padding:'10px 14px', border:'none',
                  background:'none', textAlign:'left', fontSize:13,
                  color:'#c0392b', cursor:'pointer', display:'flex', gap:8 }}>
                  🚪 {lang==='zh'?'退出登录':lang==='it'?'Esci':'Log out'}
                </button>
              </div>
            )}
          </div>

          <LangSwitcher/>
        </div>
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', padding: '4px 16px 22px' }}>
        <div style={{
          fontSize: 26, fontWeight: 500, color: 'var(--text)',
          fontFamily: "'STKaiti','KaiTi',Georgia,serif",
          letterSpacing: 3,
        }}>
          {lang==='zh' ? '大卫学中文' : lang==='it' ? 'David Studia Cinese' : 'David Learns Chinese'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
          {lang==='zh' ? '选择学习模块' : lang==='it' ? 'Scegli il modulo' : 'Choose a learning module'}
        </div>
      </div>

      {/* ── Learning Path Selector ── */}
      <div style={{ maxWidth: 600, margin: '0 auto 16px', padding: '0 16px' }}>
        <PathSelector
          currentPath={selectedPath}
          onSelectPath={handleSelectPath}
          lang={lang}
        />
      </div>

      {/* Cards */}
      <div style={{
        padding: '0 16px',
        display: 'grid',
        gridTemplateColumns: visible.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {visible.map(m => (
          <ModuleCard key={m.id} m={m} lang={lang}
            pandaUrl={pandaIcons[m.pandaEmotion] || null}
            onSelect={onSelect}/>
        ))}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '28px 16px 0',
        fontSize: 11, color: 'var(--text-3)' }}>
        大卫学中文 · wenzi-learn.net
      </div>
    </div>
  );
}

// src/components/PracticeModeScreen.jsx
// Two-layer practice picker reached via the bottom-nav 练习 tab.
//
// Layer 1 — module selector: 练字 vs 拼音 (extensible for future modules)
// Layer 2 — mode selector for the chosen module
//
// Navigation contract (App.jsx owns the state):
//   - props.module: null | 'lianzi' | 'pinyin'
//       null      → render Layer 1
//       'lianzi'  → render Layer 2 (character-writing modes)
//       'pinyin'  → render Layer 2 (pinyin modes)
//
//   - props.onSelectModule(moduleId):
//       called from Layer 1 card tap. App sets state, re-renders this screen
//       with a non-null module prop → Layer 2 appears.
//
//   - props.onSelectMode(moduleId, modeId):
//       called from Layer 2 card tap. App routes:
//         lianzi + {list|dictation|completion} → HomeScreen w/ practiceMode set
//         pinyin + {table|tones|listen|type|speak} → PinyinApp w/ initialScreen set
//
//   - props.onBack():
//       called from back button on Layer 1; Layer 2 back stays inside this
//       screen and returns to Layer 1 by flipping the module prop.

import { useLang } from '../context/LanguageContext.jsx';

// ── Module registry (Layer 1) ──────────────────────────────────────
const MODULES = [
  {
    id:     'lianzi',
    emoji:  '🐼',
    name:   { zh:'练字', en:'Character Writing', it:'Scrittura' },
    desc:   { zh:'字形 · 笔顺 · 默写 · 补笔',
              en:'Shapes · strokes · dictation',
              it:'Forme · tratti · dettato' },
    color:  '#FBE9E7',
    border: '#8B4513',
    text:   '#5D2E0C',
  },
  {
    id:     'pinyin',
    emoji:  '🐼',
    name:   { zh:'拼音', en:'Pinyin', it:'Pinyin' },
    desc:   { zh:'声母韵母 · 四声 · 听音 · 发音',
              en:'Initials · tones · listen · speak',
              it:'Iniziali · toni · ascolto · voce' },
    color:  '#E3F2FD',
    border: '#1565C0',
    text:   '#0C3C7A',
  },
  // Future modules: append here.
];

// ── Mode registry (Layer 2) ────────────────────────────────────────
const MODES = {
  lianzi: [
    { id:'list',       emoji:'📖',
      title:{ zh:'字集列表',  en:'Character Sets', it:'Set di caratteri' },
      desc: { zh:'浏览字集 · 描红与笔顺',
              en:'Browse sets · trace & stroke order',
              it:'Sfoglia · traccia e tratti' },
      bg:'#FFF8E1', accent:'#F57F17' },
    { id:'dictation',  emoji:'⏱',
      title:{ zh:'默写练习', en:'Dictation',  it:'Dettato' },
      desc: { zh:'看拼音或意思默写 · 计时',
              en:'Recall from pinyin or meaning · timed',
              it:'Ricorda da pinyin/significato · a tempo' },
      bg:'#FBE9E7', accent:'#8B4513' },
    { id:'completion', emoji:'◧',
      title:{ zh:'补笔练习', en:'Stroke Completion', it:'Completa i tratti' },
      desc: { zh:'补齐隐藏的笔画 · 自适应难度',
              en:'Fill in hidden strokes · adaptive',
              it:'Completa tratti nascosti · adattivo' },
      bg:'#F3E5F5', accent:'#6A1B9A' },
  ],
  pinyin: [
    { id:'table',  emoji:'📋',
      title:{ zh:'声母韵母表', en:'Initials & Finals', it:'Tabella Pinyin' },
      desc: { zh:'认识所有拼音 · 口型动画',
              en:'All sounds with mouth animation',
              it:'Tutti i suoni con animazione' },
      bg:'#E3F2FD', accent:'#1565C0' },
    { id:'tones',  emoji:'🎵',
      title:{ zh:'四声练习', en:'Tone Practice', it:'Pratica Toni' },
      desc: { zh:'掌握四个声调',
              en:'Master the four tones',
              it:'Padroneggia i toni' },
      bg:'#E8F5E9', accent:'#2E7D32' },
    { id:'listen', emoji:'👂',
      title:{ zh:'听音识调', en:'Listen & Identify', it:'Ascolta e Identifica' },
      desc: { zh:'听声音选声调',
              en:'Hear and choose the tone',
              it:'Scegli il tono' },
      bg:'#FFF8E1', accent:'#F57F17' },
    { id:'type',   emoji:'⌨️',
      title:{ zh:'拼音输入', en:'Type Pinyin', it:'Scrivi Pinyin' },
      desc: { zh:'看字写拼音',
              en:'See character, type pinyin',
              it:'Vedi e scrivi' },
      bg:'#F3E5F5', accent:'#6A1B9A' },
    { id:'speak',  emoji:'🎤',
      title:{ zh:'发音练习', en:'Speak & Score', it:'Pronuncia' },
      desc: { zh:'听发音→开口说→看评分',
              en:'Listen → Speak → Get scored',
              it:'Ascolta → Parla → Punteggio' },
      bg:'#FCE4EC', accent:'#C62828' },
  ],
};

// ────────────────────────────────────────────────────────────────────
export default function PracticeModeScreen({ module, onSelectModule, onSelectMode, onBack }) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it||en) : en;

  const inLayer2 = !!module;
  const modes = inLayer2 ? (MODES[module] || []) : [];
  const currentMod = inLayer2 ? MODULES.find(m => m.id === module) : null;

  const handleBack = () => {
    if (inLayer2) onSelectModule(null);    // back to Layer 1
    else          onBack?.();              // back to platform
  };

  return (
    <div style={{ padding:'16px', maxWidth:430, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <button onClick={handleBack} style={{
          padding:'6px 14px', fontSize:13, cursor:'pointer', borderRadius:20,
          border:'1px solid #e8d5b0', background:'#fff', color:'#8B4513',
          WebkitTapHighlightColor:'transparent' }}>
          ‹ {t('返回','Back','Indietro')}
        </button>
        <h2 style={{ margin:0, fontSize:18, color:'#8B4513', fontWeight:500,
          fontFamily:"'STKaiti','KaiTi',Georgia,serif" }}>
          {inLayer2
            ? `${currentMod?.name?.[lang] || currentMod?.name?.en} · ${t('选择模式','Choose mode','Scegli modalità')}`
            : t('选择练习模块','Choose module','Scegli il modulo')}
        </h2>
      </div>

      {/* Body */}
      {!inLayer2 ? (
        // ── Layer 1: module picker ─────────────────────────────────
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {MODULES.map(mod => (
            <ModuleCard key={mod.id} mod={mod} lang={lang}
              onClick={() => onSelectModule(mod.id)}/>
          ))}
        </div>
      ) : (
        // ── Layer 2: mode picker ───────────────────────────────────
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {modes.map(mode => (
            <ModeCard key={mode.id} mode={mode} lang={lang}
              onClick={() => onSelectMode(module, mode.id)}/>
          ))}
        </div>
      )}

      {/* Footer hint */}
      <div style={{ textAlign:'center', fontSize:11, color:'#a07850', marginTop:24 }}>
        {inLayer2
          ? t('选模式 → 选字集 → 选字 → 开练',
              'Pick mode → pick set → pick char → practice',
              'Modalità → set → carattere → pratica')
          : t('选模块 → 选模式 → 开始练习',
              'Pick module → pick mode → practice',
              'Modulo → modalità → pratica')}
      </div>
    </div>
  );
}

// ── Layer 1 card ────────────────────────────────────────────────────
function ModuleCard({ mod, lang, onClick }) {
  const name = mod.name?.[lang] || mod.name?.en || mod.id;
  const desc = mod.desc?.[lang] || mod.desc?.en || '';
  return (
    <button onClick={onClick} style={{
      background: mod.color,
      border: `2px solid ${mod.border}`,
      borderRadius: 20,
      padding: '18px 20px',
      cursor: 'pointer',
      textAlign: 'left',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      width: '100%',
      fontFamily: 'inherit',
      WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: mod.border, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, flexShrink: 0 }}>
        {mod.emoji}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 20, fontWeight: 500, color: mod.text,
          fontFamily: "'STKaiti','KaiTi',Georgia,serif", lineHeight: 1.1 }}>
          {name}
        </div>
        <div style={{ fontSize: 12, color: mod.border, marginTop: 4, opacity: 0.85 }}>
          {desc}
        </div>
      </div>
      <div style={{ fontSize: 20, color: mod.border, flexShrink: 0 }}>›</div>
    </button>
  );
}

// ── Layer 2 card ────────────────────────────────────────────────────
function ModeCard({ mode, lang, onClick }) {
  const title = mode.title?.[lang] || mode.title?.en || mode.id;
  const desc  = mode.desc?.[lang]  || mode.desc?.en  || '';
  return (
    <button onClick={onClick} style={{
      background: mode.bg,
      border: `1.5px solid ${mode.accent}33`,
      borderRadius: 16,
      padding: '14px 16px',
      cursor: 'pointer',
      textAlign: 'left',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      width: '100%',
      fontFamily: 'inherit',
      WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: '#fff', color: mode.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0,
        border: `1.5px solid ${mode.accent}44` }}>
        {mode.emoji}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: mode.accent,
          fontFamily: "'STKaiti','KaiTi',Georgia,serif", lineHeight: 1.15 }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: '#6b4c2a', marginTop: 2 }}>
          {desc}
        </div>
      </div>
      <div style={{ fontSize: 17, color: mode.accent, flexShrink: 0 }}>›</div>
    </button>
  );
}

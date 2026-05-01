// ═══════════════════════════════════════════════════════════════
// MainEntrance.jsx  —  Drop into clf-platform/src/components/
//
// Top-level gateway with two doors:
//   课堂  →  大卫学中文 teaching system (B2C student view)
//   社区  →  CLF community modules (characters, pinyin, words…)
//
// Usage in App.jsx:
//   import MainEntrance from './components/MainEntrance.jsx'
//   // make it the very first screen (before 'platform'):
//   const [screen, setScreen] = useState('entrance')
//   ...
//   {screen === 'entrance' && (
//     <MainEntrance
//       onKetang={() => setScreen('ketang')}   // or open URL
//       onShequ={() => setScreen('platform')}
//     />
//   )}
//
// If 大卫学中文 is a separate domain, replace onKetang with:
//   onKetang={() => window.open('https://admin.zhongwen-world.netlify.app', '_blank')}
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'

// ── Translation helper ───────────────────────────────────────
function t(zh, en, it, lang) {
  return lang === 'en' ? en : lang === 'it' ? it : zh
}

// ── Greeting by time of day ──────────────────────────────────
function getGreeting(lang) {
  const h = new Date().getHours()
  const greetings = [
    { range: [0,6],   zh:'深夜好，还在用功 🌙',      en:'Burning midnight oil 🌙',    it:'Stai ancora studiando 🌙' },
    { range: [6,12],  zh:'早上好，准备出发 ☀️',      en:'Good morning! Let\'s go ☀️', it:'Buongiorno! Iniziamo ☀️' },
    { range: [12,18], zh:'下午好，继续加油 ✨',       en:'Good afternoon ✨',           it:'Buon pomeriggio ✨' },
    { range: [18,24], zh:'晚上好，每天进步一点 🔥',   en:'Good evening 🔥',             it:'Buona sera 🔥' },
  ]
  const g = greetings.find(g => h >= g.range[0] && h < g.range[1]) || greetings[1]
  return lang === 'en' ? g.en : lang === 'it' ? g.it : g.zh
}

// ── Animated Chinese lantern SVG ─────────────────────────────
function Lantern({ color = '#c41e3a', swing = false, size = 52 }) {
  return (
    <svg width={size} height={size * 1.5} viewBox="0 0 52 78" fill="none"
      style={{ filter: `drop-shadow(0 0 8px ${color}66)`,
               animation: swing ? 'lanternSwing 3s ease-in-out infinite' : 'none' }}>
      {/* Top cap */}
      <rect x="18" y="2" width="16" height="6" rx="2" fill={color} opacity="0.9"/>
      {/* String */}
      <line x1="26" y1="0" x2="26" y2="6" stroke="#8B6914" strokeWidth="1.5"/>
      {/* Body */}
      <ellipse cx="26" cy="42" rx="20" ry="28" fill={color} opacity="0.88"/>
      {/* Highlight */}
      <ellipse cx="20" cy="32" rx="6" ry="10" fill="white" opacity="0.18"/>
      {/* Ribs */}
      {[-14,-7,0,7,14].map((x, i) => (
        <line key={i} x1={26+x} y1="14" x2={26+x*0.5} y2="70" stroke="white" strokeWidth="0.8" opacity="0.25"/>
      ))}
      {/* Bottom tassel */}
      <rect x="22" y="68" width="8" height="4" rx="1" fill={color} opacity="0.9"/>
      {[22,25,28].map((x, i) => (
        <line key={i} x1={x} y1="72" x2={x - 2 + i * 2} y2="78" stroke="#f0c040" strokeWidth="1.2"/>
      ))}
      {/* Glow center */}
      <ellipse cx="26" cy="42" rx="10" ry="14" fill="#fffbe6" opacity="0.22"/>
    </svg>
  )
}

// ── Door card ────────────────────────────────────────────────
function DoorCard({ emoji, title, subtitle, desc, features, color, bgGrad, textColor, accentColor, onClick, badge }) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => { setPressed(false); onClick() }}
      style={{
        background: bgGrad,
        border: `2.5px solid ${color}`,
        borderRadius: 24,
        padding: '28px 24px 24px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        transform: pressed ? 'scale(0.97)' : hovered ? 'translateY(-4px) scale(1.01)' : 'none',
        boxShadow: hovered
          ? `0 16px 40px ${color}30, 0 4px 12px ${color}20`
          : `0 4px 16px ${color}15`,
        position: 'relative',
        overflow: 'hidden',
      }}>

      {/* Background glyph decoration */}
      <div style={{ position:'absolute', top:-10, right:-10, fontSize:120, opacity:0.05,
        lineHeight:1, color, pointerEvents:'none', userSelect:'none', fontFamily:'serif' }}>
        {title}
      </div>

      {/* Badge */}
      {badge && (
        <div style={{ position:'absolute', top:14, right:14, background:color, color:'white',
          fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20 }}>
          {badge}
        </div>
      )}

      {/* Icon + title */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:12 }}>
        <div style={{ width:56, height:56, borderRadius:16, background:`${color}18`,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:30,
          border:`1.5px solid ${color}30`, flexShrink:0 }}>
          {emoji}
        </div>
        <div>
          <div style={{ fontSize:26, fontWeight:900, color:textColor, lineHeight:1.1,
            fontFamily:"'STKaiti','KaiTi','FangSong',serif" }}>
            {title}
          </div>
          <div style={{ fontSize:13, color:accentColor, marginTop:2, fontWeight:600 }}>
            {subtitle}
          </div>
        </div>
      </div>

      {/* Description */}
      <div style={{ fontSize:13, color:textColor, lineHeight:1.7, marginBottom:14,
        opacity:0.8, borderLeft:`3px solid ${color}40`, paddingLeft:10 }}>
        {desc}
      </div>

      {/* Feature pills */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
        {features.map((f, i) => (
          <span key={i} style={{ fontSize:11, padding:'3px 10px', borderRadius:20,
            background:`${color}12`, color:textColor, border:`1px solid ${color}25`,
            fontWeight:500 }}>
            {f}
          </span>
        ))}
      </div>

      {/* Enter arrow */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:12, color:accentColor, opacity:0.7 }}>点击进入 →</span>
        <div style={{ width:36, height:36, borderRadius:'50%', background:color,
          display:'flex', alignItems:'center', justifyContent:'center',
          color:'white', fontSize:18, fontWeight:700,
          transition:'transform 0.2s', transform: hovered ? 'scale(1.15)' : 'none',
          boxShadow:`0 4px 12px ${color}50` }}>
          ›
        </div>
      </div>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════
export default function MainEntrance({ onKetang, onShequ, lang = 'zh', userLabel = '' }) {
  const [animIn, setAnimIn] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setAnimIn(true))
  }, [])

  const greeting = getGreeting(lang)

  // ── 课堂 features ──────────────────────────────────────────
  const ketangFeatures = [
    t('AI智能课程','AI-powered Lessons','Lezioni con IA', lang),
    t('作业管理','Homework Mgmt','Gestione Compiti', lang),
    t('班级考勤','Class Attendance','Presenze Classe', lang),
    t('HSK备考','HSK Prep','Preparazione HSK', lang),
    t('教师反馈','Teacher Feedback','Feedback Insegnante', lang),
  ]

  // ── 社区 features ──────────────────────────────────────────
  const shequFeatures = [
    t('汉字练写','Character Tracing','Tracciamento', lang),
    t('拼音学习','Pinyin Learning','Apprendimento Pinyin', lang),
    t('词语闪卡','Vocab Flashcards','Flashcard Vocaboli', lang),
    t('成语故事','Chengyu Stories','Storie Chengyu', lang),
    t('AI对话','AI Conversation','Conversazione IA', lang),
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #1a0505 0%, #2d0808 35%, #1a0505 70%, #0f0202 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '0 16px 40px',
      opacity: animIn ? 1 : 0,
      transform: animIn ? 'none' : 'translateY(20px)',
      transition: 'all 0.5s cubic-bezier(0.34,1.56,0.64,1)',
    }}>

      <style>{`
        @keyframes lanternSwing {
          0%,100% { transform: rotate(-6deg) translateY(0); }
          50%      { transform: rotate( 6deg) translateY(-3px); }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:none; }
        }
        @keyframes pulse-glow {
          0%,100% { opacity:0.6; } 50% { opacity:1; }
        }
      `}</style>

      {/* ── Top lanterns ── */}
      <div style={{ display:'flex', justifyContent:'center', gap:48,
        paddingTop:28, paddingBottom:4 }}>
        {[['#c41e3a', true], ['#d4a017', false], ['#c41e3a', true]].map(([color, swing], i) => (
          <div key={i} style={{ animationDelay:`${i*0.3}s`, opacity: animIn ? 1 : 0,
            animation: animIn ? `fadeUp 0.6s ${i*0.15}s both` : 'none' }}>
            <Lantern color={color} swing={swing} size={i===1 ? 62 : 48} />
          </div>
        ))}
      </div>

      {/* ── Logo / Title ── */}
      <div style={{ textAlign:'center', marginBottom:6,
        animation: animIn ? 'fadeUp 0.6s 0.2s both' : 'none' }}>
        <div style={{ fontSize:36, fontWeight:900, color:'#ffffff',
          fontFamily:"'STKaiti','KaiTi','FangSong',serif",
          letterSpacing:6, textShadow:'0 0 30px rgba(196,30,58,0.6)' }}>
          大卫学中文
        </div>
        <div style={{ fontSize:13, color:'rgba(255,255,255,0.45)', letterSpacing:2, marginTop:2 }}>
          {t('中意双语教育平台', 'Chinese-Italian Bilingual Education', 'Piattaforma Bilingue Cinese-Italiano', lang)}
        </div>
      </div>

      {/* ── Greeting ── */}
      {greeting && (
        <div style={{ fontSize:13, color:'rgba(212,160,23,0.8)', marginBottom:24,
          animation: animIn ? 'fadeUp 0.6s 0.3s both' : 'none' }}>
          {greeting}{userLabel ? `，${userLabel}` : ''}
        </div>
      )}

      {/* ── Decorative divider ── */}
      <div style={{ display:'flex', alignItems:'center', gap:12,
        width:'100%', maxWidth:560, marginBottom:28,
        animation: animIn ? 'fadeUp 0.6s 0.35s both' : 'none' }}>
        <div style={{ flex:1, height:1, background:'linear-gradient(to right, transparent, rgba(196,30,58,0.5))' }}/>
        <span style={{ color:'rgba(196,30,58,0.7)', fontSize:18 }}>❖</span>
        <div style={{ flex:1, height:1, background:'linear-gradient(to left, transparent, rgba(196,30,58,0.5))' }}/>
      </div>

      {/* ── Two doors ── */}
      <div style={{ width:'100%', maxWidth:560, display:'flex', flexDirection:'column', gap:18 }}>

        {/* 课堂 door */}
        <div style={{ animation: animIn ? 'fadeUp 0.6s 0.4s both' : 'none' }}>
          <DoorCard
            emoji="🏫"
            title={t('课堂', 'Classroom', 'Aula', lang)}
            subtitle={t('大卫学中文 · 教学系统', 'David Chinese · Teaching System', 'Sistema di Insegnamento', lang)}
            desc={t(
              '由教师管理的正式学习空间。加入班级、完成作业、接受AI辅助的个性化教学，与老师和同学共同进步。',
              'A teacher-managed formal learning space. Join classes, complete homework, receive AI-assisted personalised teaching.',
              'Spazio di apprendimento formale gestito dall\'insegnante. Unisciti alle classi, completa i compiti.',
              lang
            )}
            features={ketangFeatures}
            color="#c41e3a"
            bgGrad="linear-gradient(135deg, #fff5f0 0%, #ffe8e0 50%, #fff0eb 100%)"
            textColor="#2c1008"
            accentColor="#c41e3a"
            badge={t('B2C 学生入口', 'Student Portal', 'Portale Studenti', lang)}
            onClick={onKetang}
          />
        </div>

        {/* 社区 door */}
        <div style={{ animation: animIn ? 'fadeUp 0.6s 0.52s both' : 'none' }}>
          <DoorCard
            emoji="🌏"
            title={t('社区', 'Community', 'Comunità', lang)}
            subtitle={t('自由练习 · 汉字 · 拼音 · 词语', 'Free Practice · Characters · Pinyin · Words', 'Pratica Libera · Caratteri · Pinyin', lang)}
            desc={t(
              '开放式中文学习社区。自由探索汉字描红、拼音发音、词语闪卡、成语故事……按自己的节奏，随时随地学习。',
              'Open Chinese learning community. Freely explore character tracing, pinyin pronunciation, vocabulary flashcards, chengyu stories… learn at your own pace.',
              'Comunità aperta di apprendimento del cinese. Esplora liberamente la scrittura dei caratteri, la pronuncia pinyin, le flashcard di vocabolario.',
              lang
            )}
            features={shequFeatures}
            color="#1565C0"
            bgGrad="linear-gradient(135deg, #f0f6ff 0%, #e3f0ff 50%, #f0f8ff 100%)"
            textColor="#0c2a5a"
            accentColor="#1565C0"
            onClick={onShequ}
          />
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ marginTop:32, textAlign:'center',
        animation: animIn ? 'fadeUp 0.6s 0.65s both' : 'none' }}>
        <div style={{ display:'flex', gap:16, justifyContent:'center', marginBottom:8 }}>
          {['🇨🇳','🇮🇹','🇬🇧'].map((flag, i) => (
            <span key={i} style={{ fontSize:20, cursor:'pointer', opacity:0.6,
              transition:'opacity 0.15s', filter:'grayscale(0.2)' }}
              onClick={() => {/* wire to your lang switcher */}}>
              {flag}
            </span>
          ))}
        </div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.25)', letterSpacing:1 }}>
          zhongwen-world.netlify.app · {t('大卫中文教育平台 v2', 'David Chinese Education Platform v2', 'Piattaforma Educativa David Cinese v2', lang)}
        </div>
      </div>
    </div>
  )
}

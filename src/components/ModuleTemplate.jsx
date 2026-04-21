// src/components/ModuleTemplate.jsx
// Unified template used by 练字, 拼音, 词语 — and all future modules.
// Provides: colored header, back button, stats chips, numbered sub-module cards.
//
// Usage:
//   <ModuleTemplate
//     color="#2E7D32"
//     icon="📝"
//     title="词语"
//     subtitle="词汇 · 闪卡 · 听写"
//     onBack={...}
//     stats={[{value:'35', label:'词组'}, {value:'0', label:'已练'}]}
//     modules={[
//       { id:'flash', icon:'🃏', title:'闪卡', desc:'看词认意思', color:'#E3F2FD', accent:'#1565C0', onClick },
//       ...
//     ]}
//     extra={<div>...extra content below cards...</div>}
//   />

export default function ModuleTemplate({
  color,        // header background e.g. '#2E7D32'
  icon,         // emoji or img src
  title,        // module title zh string
  titleEn,      // optional English
  subtitle,     // desc under title
  onBack,
  backLabel = '‹ 返回主页',
  stats = [],   // [{value, label}]
  modules = [], // [{id, icon, title, desc, color, accent, onClick, badge?}]
  extra,        // optional JSX below cards
  lang = 'zh',
}) {
  return (
    <div style={{ background: 'var(--bg, #F5F5F5)', minHeight: '100dvh', paddingBottom: 80 }}>

      {/* ── Back link ── */}
      <div style={{ padding: '10px 16px 0' }}>
        <button onClick={onBack} style={{
          border: 'none', background: 'none', cursor: 'pointer',
          fontSize: 13, color: 'var(--text-2, #666)',
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 0', WebkitTapHighlightColor: 'transparent',
        }}>
          {backLabel}
        </button>
      </div>

      {/* ── Colored header ── */}
      <div style={{
        background: color,
        margin: '8px 16px 0',
        borderRadius: 18,
        padding: '20px 20px 22px',
        textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{ fontSize: 38, marginBottom: 8, lineHeight: 1 }}>
          {typeof icon === 'string' && icon.startsWith('http')
            ? <img src={icon} style={{ width: 48, height: 48, objectFit: 'contain' }} alt=""/>
            : icon}
        </div>
        {/* Title */}
        <div style={{
          fontSize: 22, fontWeight: 600, color: '#fff',
          fontFamily: "'STKaiti','KaiTi',Georgia,serif",
          letterSpacing: 2,
        }}>
          {title}
          {titleEn && <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 8, opacity: 0.8 }}>{titleEn}</span>}
        </div>
        {/* Subtitle */}
        {subtitle && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 6 }}>
            {subtitle}
          </div>
        )}
        {/* Stats chips */}
        {stats.length > 0 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
            {stats.map((s, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.18)',
                borderRadius: 20, padding: '4px 14px',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{s.value}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Sub-module cards ── */}
      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {modules.map((m, i) => (
          <button key={m.id} onClick={m.onClick} style={{
            background: m.color || '#fff',
            border: `1.5px solid ${m.accent || color}44`,
            borderRadius: 16,
            padding: '14px 16px',
            cursor: 'pointer', textAlign: 'left', width: '100%',
            display: 'flex', alignItems: 'center', gap: 14,
            WebkitTapHighlightColor: 'transparent',
            transition: 'transform 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateX(3px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
          >
            {/* Number badge */}
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: m.accent || color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {m.badge ?? (i + 1)}
            </div>

            {/* Icon + text */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                {m.icon && <span style={{ fontSize: 16 }}>{m.icon}</span>}
                <span style={{ fontSize: 15, fontWeight: 600, color: m.accent || color }}>
                  {m.title}
                </span>
                {m.tag && (
                  <span style={{
                    fontSize: 10, padding: '1px 7px', borderRadius: 10,
                    background: (m.accent || color) + '20',
                    color: m.accent || color, fontWeight: 600,
                  }}>{m.tag}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3, #999)' }}>{m.desc}</div>
            </div>

            {/* Chevron */}
            <div style={{ fontSize: 18, color: (m.accent || color) + '88', flexShrink: 0 }}>›</div>
          </button>
        ))}
      </div>

      {/* ── Extra content ── */}
      {extra && (
        <div style={{ padding: '16px 16px 0' }}>{extra}</div>
      )}
    </div>
  );
}

// src/components/BottomNav.jsx
// Universal bottom nav — works across ALL modules
// 4 items: 主页 | 练习 | 进度 | 设置

import { useLang } from '../context/LanguageContext.jsx';

const V = { verm:'#8B4513', text3:'#a07850', bg:'#fff', border:'#e8d5b0' };

function NavBtn({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', gap:3, padding:'8px 4px',
      border:'none', background:'none', cursor:'pointer',
      WebkitTapHighlightColor:'transparent',
    }}>
      <div style={{ fontSize:22, lineHeight:1 }}>{icon}</div>
      <div style={{
        fontSize:10, fontWeight: active ? 700 : 400,
        color: active ? V.verm : V.text3,
        borderBottom: active ? `2px solid ${V.verm}` : '2px solid transparent',
        paddingBottom:1,
      }}>{label}</div>
    </button>
  );
}

export default function BottomNav({ active, onNav, screen }) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? it||en : en;

  const tabs = [
    { id:'home',     icon:'🏠', label:t('主页','Home','Home') },
    { id:'practice', icon:'📖', label:t('练习','Practice','Pratica') },
    { id:'progress', icon:'📊', label:t('进度','Progress','Progresso') },
    { id:'settings', icon:'⚙️', label:t('设置','Settings','Impost.') },
  ];

  return (
    <div style={{
      position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
      width:'100%', maxWidth:430,
      background:V.bg, borderTop:`1px solid ${V.border}`,
      display:'flex', paddingBottom:'env(safe-area-inset-bottom, 0px)',
      boxShadow:'0 -2px 12px rgba(0,0,0,0.07)', zIndex:100,
    }}>
      {tabs.map(tab => (
        <NavBtn key={tab.id}
          icon={tab.icon}
          label={tab.label}
          active={active === tab.id}
          onClick={() => onNav(tab.id)}/>
      ))}
    </div>
  );
}

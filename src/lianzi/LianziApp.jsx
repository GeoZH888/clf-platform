// src/lianzi/LianziApp.jsx
// Standalone 练字-only app for the mobile (Capacitor) bundle.
//
// Reuses the same screens/hooks as /learn?module=lianzi in the web app
// (HomeScreen → SetScreen → PracticeScreen → ProgressScreen + Settings),
// but strips out every other module, the admin/auth/community trees, and
// the PWA install nudges. Super_admin still edits content via the web
// /admin/lianzi page; this bundle is a read/practice consumer on the same
// shared Supabase DB.

import { useState } from 'react';
import { useScreenHistory, useExitConfirm } from '../hooks/useScreenHistory.js';
import HomeScreen     from '../components/HomeScreen.jsx';
import SetScreen      from '../components/SetScreen.jsx';
import PracticeScreen from '../components/PracticeScreen.jsx';
import ProgressScreen from '../components/ProgressScreen.jsx';
import MyStatsScreen  from '../components/MyStatsScreen.jsx';
import FloatingLangMenu from '../components/FloatingLangMenu.jsx';
import { LanguageProvider, useLang } from '../context/LanguageContext.jsx';
import { useProgress }   from '../hooks/useProgress.js';
import { useCharacters } from '../hooks/useCharacters.js';

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

function LianziBottomNav({ active, onNav }) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it||en) : en;
  const tabs = [
    { id:'home',     icon:'🏠', label:t('主页','Home','Home') },
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
          icon={tab.icon} label={tab.label}
          active={active === tab.id}
          onClick={() => onNav(tab.id)}/>
      ))}
    </div>
  );
}

function SettingsScreen({ onBack }) {
  const { lang, setLang } = useLang();
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it||en) : en;
  const LANGS = [
    { id:'zh', label:'中文' },
    { id:'en', label:'English' },
    { id:'it', label:'Italiano' },
  ];
  return (
    <div style={{ padding:'16px', maxWidth:430, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <button onClick={onBack} style={{
          padding:'6px 12px', fontSize:13, cursor:'pointer', borderRadius:8,
          border:'1px solid #e8d5b0', background:'#fff', color:'#8B4513',
        }}>← {t('返回','Back','Indietro')}</button>
        <h2 style={{ margin:0, fontSize:20, color:'#8B4513' }}>
          ⚙️ {t('设置','Settings','Impostazioni')}
        </h2>
      </div>

      <div style={{ background:'#fff', borderRadius:12, padding:'14px', marginBottom:14,
        border:'1px solid #e8d5b0' }}>
        <div style={{ fontSize:12, color:'#a07850', marginBottom:8 }}>
          🌐 {t('语言','Language','Lingua')}
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {LANGS.map(L => (
            <button key={L.id} onClick={()=>setLang(L.id)} style={{
              flex:1, padding:'8px', fontSize:13, cursor:'pointer', borderRadius:8,
              border:'none', fontFamily:'inherit',
              background: lang===L.id ? '#8B4513' : '#f5ede0',
              color:    lang===L.id ? '#fdf6e3' : '#8B4513',
            }}>{L.label}</button>
          ))}
        </div>
      </div>

      <div style={{ fontSize:10, color:'#a07850', textAlign:'center', marginTop:20 }}>
        练字 · 中文世界
      </div>
    </div>
  );
}

function LianziAppInner() {
  const [screen,    setScreen]  = useScreenHistory('home', 'lianzi-app');
  const [activeSet, setSet]     = useState(null);
  const [charIdx,   setCharIdx] = useState(0);
  const { progress, stats, recordPractice, recordQuiz, resetProgress } = useProgress();
  const { sets: SETS, loading: setsLoading } = useCharacters();

  useExitConfirm(screen === 'home', '再按一次退出 · Press again to exit');

  if (setsLoading && SETS.length === 0) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center',
      justifyContent:'center', background:'var(--bg)', color:'var(--text2)', fontSize:14 }}>
      Loading characters…
    </div>
  );

  const currentChar = activeSet?.chars?.[charIdx] ?? null;

  const navActive =
      screen === 'progress' || screen === 'mystats' ? 'progress'
    : screen === 'settings' ? 'settings'
    : 'home';

  function handleNav(id) {
    if (id === 'home')     setScreen('home');
    if (id === 'progress') setScreen('progress');
    if (id === 'settings') setScreen('settings');
  }

  return (
    <div style={{ maxWidth:430, margin:'0 auto', minHeight:'100dvh',
      display:'flex', flexDirection:'column', background:'var(--bg)' }}>
      <div style={{ flex:1, overflowY:'auto', paddingBottom:72 }}>
        {screen === 'home' && (
          <HomeScreen sets={SETS} progress={progress} stats={stats}
            onStartAdaptive={queue => {
              // The queue is presented to the rest of the flow as a set, so
              // PracticeScreen keeps working unchanged — it just happens to be
              // a set the scheduler assembled rather than one an editor did.
              setSet({ id:'adaptive', name:'今日练习', nameEn:'Today', nameIt:'Oggi', chars:queue });
              setCharIdx(0);
              setScreen('practice');
            }}
            onBack={null}/>
        )}
        {screen === 'set' && activeSet && (
          <SetScreen set={activeSet} progress={progress}
            onSelectChar={i=>{ setCharIdx(i); setScreen('practice'); }}
            onBack={()=>setScreen('home')}/>
        )}
        {screen === 'practice' && currentChar && (
          <PracticeScreen
            char={currentChar} set={activeSet}
            initialMode="free"
            onBack={()=>setScreen('home')}
            onNext={(nextCharObj) => {
              const pool = activeSet?.chars || [];
              if (nextCharObj?.c) {
                const idx = pool.findIndex(c => c.c === nextCharObj.c);
                if (idx >= 0) { setCharIdx(idx); return; }
              }
              const n = charIdx + 1;
              if (n < pool.length) setCharIdx(n);
              else setScreen('home');   // queue finished — home rebuilds the next one
            }}
            onPracticed={c=>recordPractice(c)}
            onQuizComplete={(c,m)=>recordQuiz(c,m)}/>
        )}
        {screen === 'progress' && (
          <ProgressScreen progress={progress} stats={stats} sets={SETS}
            onReset={resetProgress}
            onMyStats={()=>setScreen('mystats')}/>
        )}
        {screen === 'mystats' && (
          <MyStatsScreen onBack={()=>setScreen('progress')}/>
        )}
        {screen === 'settings' && (
          <SettingsScreen onBack={()=>setScreen('home')}/>
        )}
      </div>
      <LianziBottomNav active={navActive} onNav={handleNav}/>
    </div>
  );
}

export default function LianziApp() {
  return (
    <LanguageProvider>
      <FloatingLangMenu/>
      <LianziAppInner/>
    </LanguageProvider>
  );
}

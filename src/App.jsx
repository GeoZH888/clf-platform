import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase.js';
import AdminApp       from './admin/AdminApp.jsx';
import PlatformHome   from './components/PlatformHome.jsx';
import HomeScreen     from './components/HomeScreen.jsx';
import SetScreen      from './components/SetScreen.jsx';
import PracticeScreen from './components/PracticeScreen.jsx';
import ProgressScreen from './components/ProgressScreen.jsx';
import MyStatsScreen  from './components/MyStatsScreen.jsx';
import PinyinApp      from './pinyin/PinyinApp.jsx';
import WordsApp       from './words/WordsApp.jsx';
import GrammarApp     from './grammar/GrammarApp.jsx';
import HSKApp         from './hsk/HSKApp.jsx';
import PoetryApp      from './poetry/PoetryApp.jsx';
import GamesApp       from './games/GamesApp.jsx';
import ChengyuApp     from './chengyu/ChengyuApp.jsx';
import BottomNav      from './components/BottomNav.jsx';
import GameHub        from './components/game/GameHub.jsx';
import SearchScreen   from './components/SearchScreen.jsx';
import CameraScreen   from './components/CameraScreen.jsx';
import FindCharScreen from './components/FindCharScreen.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';
import { useProgress } from './hooks/useProgress.js';
import { useCharacters } from './hooks/useCharacters.js';
import { useDeviceAuth } from './hooks/useDeviceAuth.js';
import QRGate from './components/QRGate.jsx';
import { SETS } from './data/characters.js';
import CLFApp from './clf/CLFApp.jsx';

// Inside your router, add:
{screen === 'clf' && <CLFApp/>}

// And a button somewhere to launch it:
<button onClick={() => setScreen('clf')}>新平台 New Platform</button>
// ── Fix title + random panda favicon ─────────────────────────────
document.title = '大卫学中文';

const PANDA_EMOTIONS = ['normal','excited','happy','thinking','cheering','surprised','writing'];

async function setRandomPandaFavicon() {
  try {
    const { data } = await supabase
      .from('jgw_panda_assets')
      .select('image_url');
    if (!data || data.length === 0) return;
    const random = data[Math.floor(Math.random() * data.length)];
    if (!random?.image_url) return;

    // Set favicon
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = random.image_url;
    link.type = 'image/png';

    // Also set apple-touch-icon for iOS home screen
    let apple = document.querySelector("link[rel='apple-touch-icon']");
    if (!apple) {
      apple = document.createElement('link');
      apple.rel = 'apple-touch-icon';
      document.head.appendChild(apple);
    }
    apple.href = random.image_url;

  } catch(e) { /* silent fail */ }
}

setRandomPandaFavicon();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}

const IS_ADMIN = window.location.pathname.startsWith('/admin');

import PWAInstallGuide from './components/PWAInstallGuide.jsx';
import PWAInstallCard  from './components/PWAInstallCard.jsx';

// ── PWA Install Banner ────────────────────────────────────────────
function PWAInstallBanner() {
  const [prompt,    setPrompt]    = React.useState(null);
  const [showGuide, setShowGuide] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(
    () => localStorage.getItem('pwa_dismissed') === '1'
  );

  React.useEffect(() => {
    // Chrome/Edge Android — native prompt
    const handler = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);

    // Show guide automatically on first visit after scan (once only)
    const shown = localStorage.getItem('pwa_guide_shown');
    if (!shown && !window.matchMedia('(display-mode: standalone)').matches) {
      setTimeout(() => { setShowGuide(true); localStorage.setItem('pwa_guide_shown','1'); }, 3000);
    }
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa_dismissed', '1');
  };

  if (window.matchMedia('(display-mode: standalone)').matches) return null;
  if (dismissed) return null;

  return (
    <>
      {showGuide && <PWAInstallGuide onDismiss={() => setShowGuide(false)}/>}

      <div style={{ background:'#1a0a05', padding:'8px 14px', display:'flex',
        alignItems:'center', justifyContent:'space-between', gap:10 }}>
        <span style={{ fontSize:12, color:'#fdf6e3' }}>
          📲 安装到桌面，下次直接打开
        </span>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          <button onClick={() => {
            if (prompt) {
              prompt.prompt();
              prompt.userChoice.then(() => { setPrompt(null); dismiss(); });
            } else {
              setShowGuide(true);
            }
          }} style={{ padding:'5px 14px', fontSize:12, cursor:'pointer',
            borderRadius:8, border:'none', background:'#C8A050',
            color:'#1a0a05', fontWeight:500 }}>
            安装
          </button>
          <button onClick={dismiss}
            style={{ padding:'5px 10px', fontSize:12, cursor:'pointer',
              borderRadius:8, border:'1px solid #555',
              background:'transparent', color:'#aaa' }}>✕</button>
        </div>
      </div>
    </>
  );
}

function UserApp() {
  const { status, label, expiresAt, daysLeft, expiring, error, logout,
    modules, loginWithPassword } = useDeviceAuth();
  const [screen,     setScreen]  = useState('platform'); // start at platform hub
  const [activeSet,  setSet]     = useState(null);
  const [charIdx,    setCharIdx] = useState(0);
  const [prevScreen, setPrev]    = useState('platform');
  const { progress, stats, recordPractice, recordQuiz, resetProgress } = useProgress();
  const { sets: SETS, loading: setsLoading } = useCharacters();

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const c = p.get('char');
    if (c) {
      setSet({ id:'custom', chars:[{ c, p:'', m:'' }] });
      setCharIdx(0); setScreen('practice');
    }
  }, []);

  if (status === 'checking') return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center',
      justifyContent:'center', background:'#fdf6e3', color:'#a07850', fontSize:14 }}>
      Loading…
    </div>
  );

  if (['guest','expired','paused'].includes(status)) {
    return (
      <LanguageProvider>
        <QRGate status={status} error={error} loginWithPassword={loginWithPassword}/>
      </LanguageProvider>
    );
  }

  const currentChar = activeSet?.chars?.[charIdx] ?? null;

  if (setsLoading && SETS.length === 0) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center',
      justifyContent:'center', background:'var(--bg)', color:'var(--text2)', fontSize:14 }}>
      Loading characters…
    </div>
  );

  const practiceChar = (charObj) => {
    const foundSet = SETS.find(s => s.chars.some(c => c.c === charObj.c));
    const charInSet = foundSet?.chars.find(c => c.c === charObj.c);
    const idx = foundSet ? foundSet.chars.indexOf(charInSet) : 0;
    setSet(charObj.set || foundSet || { id:'custom', chars:[charObj] });
    setCharIdx(idx >= 0 ? idx : 0);
    setPrev(screen);
    setScreen('practice');
  };

  const navActive = screen === 'progress' || screen === 'mystats' ? 'progress'
    : screen === 'settings' ? 'settings'
    : screen === 'platform' ? 'home'
    : 'practice';

  function handleNav(id) {
    if (id === 'home')     setScreen('platform');
    if (id === 'practice') setScreen(screen === 'platform' ? 'home' : screen);
    if (id === 'progress') setScreen('progress');
    if (id === 'settings') setScreen('settings');
  }

  return (
    <LanguageProvider>
      <div style={{ maxWidth:430, margin:'0 auto', minHeight:'100dvh',
        display:'flex', flexDirection:'column', background:'var(--bg)' }}>

        {/* ── PWA install banner (shows once after first scan) ── */}
        {expiring && (
          <div style={{ background: daysLeft <= 2 ? '#FFEBEE' : '#FFF8E1',
            borderBottom: `1px solid ${daysLeft <= 2 ? '#ffcccc' : '#ffe082'}`,
            padding:'8px 14px', fontSize:12, display:'flex',
            alignItems:'center', justifyContent:'space-between', gap:8 }}>
            <span style={{ color: daysLeft <= 2 ? '#c0392b' : '#8B6914' }}>
              {daysLeft <= 0
                ? '⚠️ Access expires today.'
                : `⏳ Access expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`}
            </span>
          </div>
        )}
        <PWAInstallBanner/>
        <PWAInstallCard lang={typeof lang !== 'undefined' ? lang : 'zh'}/>

        <div style={{ flex:1, overflowY:'auto', paddingBottom:72 }}>

          {screen === 'platform' && (
            <PlatformHome
              onSelect={mod => setScreen(mod==='lianzi'?'home':mod)}
              allowedModules={modules || ['lianzi','pinyin','words','chengyu','grammar','hsk','poetry','games']}
              onSettings={() => setScreen('settings')}
              onLogout={logout}
              userLabel={label}/>
          )}
          {screen === 'home' && (
            <HomeScreen sets={SETS} progress={progress} stats={stats}
              onSelectSet={s=>{ setSet(s); setCharIdx(0); setScreen('set'); }}
              onGames={()=>setScreen('games')}
              onBack={()=>setScreen('platform')}/>
          )}
          {screen === 'set' && activeSet && (
            <SetScreen set={activeSet} progress={progress}
              onSelectChar={i=>{ setCharIdx(i); setScreen('practice'); }}
              onBack={()=>setScreen('home')}/>
          )}
          {screen === 'practice' && currentChar && (
            <PracticeScreen
              char={currentChar} set={activeSet}
              onBack={()=>setScreen(prevScreen==='practice'?'home':(prevScreen||'home'))}
              onNext={()=>{ const n=charIdx+1; n<(activeSet?.chars?.length??0)?setCharIdx(n):setScreen('set'); }}
              onPracticed={c=>recordPractice(c)}
              onQuizComplete={(c,m)=>recordQuiz(c,m)}/>
          )}
          {screen === 'progress' && (
            <ProgressScreen progress={progress} stats={stats} sets={SETS} onReset={resetProgress}
              onMyStats={()=>setScreen('mystats')}/>
          )}
          {screen === 'mystats' && (
            <MyStatsScreen onBack={()=>setScreen('progress')}/>
          )}
          {screen === 'pinyin' && (
            <PinyinApp onBack={()=>setScreen('platform')}/>
          )}
          {screen === 'words' && (
            <WordsApp onBack={()=>setScreen('platform')}/>
          )}
          {screen === 'grammar' && (
            <GrammarApp onBack={()=>setScreen('platform')}/>
          )}
          {screen === 'hsk' && (
            <HSKApp onBack={()=>setScreen('platform')}/>
          )}
          {screen === 'poetry' && (
            <PoetryApp onBack={()=>setScreen('platform')}/>
          )}
          {screen === 'chengyu' && (
            <ChengyuApp onBack={()=>setScreen('platform')}/>
          )}
          {screen === 'games' && (
            <GamesApp onBack={()=>setScreen('platform')}/>
          )}
          {screen === 'games' && (
            <GameHub onBack={()=>setScreen('home')}/>
          )}
          {screen === 'search' && (
            <SearchScreen onPractice={practiceChar}/>
          )}
          {screen === 'camera' && (
            <CameraScreen onPractice={practiceChar}/>
          )}
          {screen === 'find' && (
            <FindCharScreen onPractice={practiceChar}/>
          )}

        </div>
        <BottomNav active={navActive} onNav={handleNav}/>
      </div>
    </LanguageProvider>
  );
}

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding:'2rem', textAlign:'center', color:'#c0392b' }}>
        <div style={{ fontSize:32, marginBottom:8 }}>⚠️</div>
        <div style={{ fontSize:14 }}>{this.state.error.message}</div>
        <button onClick={()=>window.location.reload()}
          style={{ marginTop:16, padding:'8px 20px', cursor:'pointer', borderRadius:8,
            border:'none', background:'#8B4513', color:'#fdf6e3' }}>
          Reload
        </button>
      </div>
    );
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      {IS_ADMIN
        ? <LanguageProvider><AdminApp/></LanguageProvider>
        : <UserApp/>}
    </ErrorBoundary>
  );
}

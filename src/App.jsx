import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase.js';
import AdminApp       from './admin/AdminApp.jsx';
import PlatformHome   from './components/PlatformHome.jsx';
import HomeScreen     from './components/HomeScreen.jsx';
import SetScreen      from './components/SetScreen.jsx';
import PracticeScreen from './components/PracticeScreen.jsx';
import ProgressScreen from './components/ProgressScreen.jsx';
import MyStatsScreen  from './components/MyStatsScreen.jsx';
import PracticeModeScreen from './components/PracticeModeScreen.jsx';
import PracticeSession    from './components/PracticeSession.jsx';
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
import { LanguageProvider, useLang } from './context/LanguageContext.jsx';
import { useProgress } from './hooks/useProgress.js';
import { useCharacters } from './hooks/useCharacters.js';
import { useDeviceAuth } from './hooks/useDeviceAuth.js';
import QRGate from './components/QRGate.jsx';
import { SETS } from './data/characters.js';
import CLFApp from './clf/CLFApp.jsx';

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

const IS_ADMIN       = window.location.pathname.startsWith('/admin');
const IS_REGISTER    = window.location.pathname.startsWith('/register');
const IS_QUICK_LOGIN = window.location.pathname.startsWith('/quick-login');

import PWAInstallGuide from './components/PWAInstallGuide.jsx';
import PWAInstallCard  from './components/PWAInstallCard.jsx';
import RegisterScreen       from './components/RegisterScreen.jsx';
import RegisterStatusScreen from './components/RegisterStatusScreen.jsx';
import QuickLoginScreen     from './components/QuickLoginScreen.jsx';

// ── Minimal Settings screen ───────────────────────────────────────
// Language switcher + user info + logout. Split into own file when it grows.
function SettingsScreen({ userLabel, expiresAt, daysLeft, onLogout, onBack }) {
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

      {/* Language */}
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

      {/* Account */}
      <div style={{ background:'#fff', borderRadius:12, padding:'14px', marginBottom:14,
        border:'1px solid #e8d5b0' }}>
        <div style={{ fontSize:12, color:'#a07850', marginBottom:8 }}>
          👤 {t('账户','Account','Account')}
        </div>
        <div style={{ fontSize:14, color:'#5D2E0C', marginBottom:4 }}>
          {userLabel || t('访客','Guest','Ospite')}
        </div>
        {expiresAt && (
          <div style={{ fontSize:11, color:'#a07850' }}>
            {t('有效期','Expires','Scade')}: {new Date(expiresAt).toLocaleDateString()}
            {typeof daysLeft === 'number' && ` · ${daysLeft} ${t('天','days','giorni')}`}
          </div>
        )}
        <button onClick={onLogout} style={{
          marginTop:10, padding:'8px 16px', fontSize:13, cursor:'pointer',
          borderRadius:8, border:'1px solid #c0392b', background:'#fff',
          color:'#c0392b',
        }}>{t('退出登录','Log out','Esci')}</button>
      </div>

      <div style={{ fontSize:10, color:'#a07850', textAlign:'center', marginTop:20 }}>
        大卫学中文 · Miaohong
      </div>
    </div>
  );
}

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
  const [practiceMode, setPracticeMode] = useState('free');  // 'free' | 'dictation' | 'completion' | 'speak'
  const [practiceModule,     setPracticeModule]     = useState(null);  // null | 'lianzi' | 'pinyin' — for 2-layer picker
  const [pinyinInitialScreen, setPinyinInitialScreen] = useState(null); // 'home' | 'table' | 'tones' | 'listen' | 'type' | 'speak'
  const [wordsInitialScreen,  setWordsInitialScreen]  = useState(null); // 'home' | 'flashcard' | 'listen' | 'fill'
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
    : screen === 'practice-session' || screen === 'practice-modes' ? 'practice'
    : 'practice';

  function handleNav(id) {
    if (id === 'home')     setScreen('platform');
    if (id === 'practice') setScreen('practice-session');   // reinforcement session
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
          {screen === 'practice-session' && (
            <PracticeSession onExit={() => setScreen('platform')}/>
          )}
          {screen === 'practice-modes' && (
            <PracticeModeScreen
              module={practiceModule}
              onSelectModule={setPracticeModule}
              onSelectMode={(mod, modeId) => {
                if (mod === 'lianzi') {
                  setPracticeMode(modeId === 'list' ? 'free' : modeId);
                  setScreen('home');
                } else if (mod === 'pinyin') {
                  setPinyinInitialScreen(modeId);
                  setScreen('pinyin');
                }
              }}
              onBack={() => setScreen('platform')}/>
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
              initialMode={practiceMode}
              onBack={()=>setScreen(prevScreen==='practice'?'home':(prevScreen||'home'))}
              onNext={(nextCharObj) => {
                // Adaptive: PracticeScreen may pass the next char chosen by
                // getNextLearningChar. Look up its index in the current set.
                const pool = activeSet?.chars || [];
                if (nextCharObj?.c) {
                  const idx = pool.findIndex(c => c.c === nextCharObj.c);
                  if (idx >= 0) { setCharIdx(idx); return; }
                }
                // Fallback: sequential (preserves old behavior if picker returns nothing)
                const n = charIdx + 1;
                n < pool.length ? setCharIdx(n) : setScreen('set');
              }}
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
          {screen === 'settings' && (
            <SettingsScreen
              userLabel={label}
              expiresAt={expiresAt}
              daysLeft={daysLeft}
              onLogout={logout}
              onBack={()=>setScreen('platform')}/>
          )}
          {screen === 'pinyin' && (
            <PinyinApp
              initialScreen={pinyinInitialScreen}
              onBack={()=>{ setPinyinInitialScreen(null); setScreen('platform'); }}/>
          )}
          {screen === 'words' && (
            <WordsApp
              initialScreen={wordsInitialScreen}
              onBack={()=>{ setWordsInitialScreen(null); setScreen('platform'); }}/>
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
        : IS_QUICK_LOGIN
          ? <LanguageProvider><QuickLoginScreen/></LanguageProvider>
          : IS_REGISTER
            ? <LanguageProvider><RegisterRouter/></LanguageProvider>
            : <UserApp/>}
    </ErrorBoundary>
  );
}

// ── Register routing ────────────────────────────────────────────
// Handles:
//   /register                      → RegisterScreen (form)
//   /register?invite=XYZ           → RegisterScreen with invite prefilled
//   /register/status               → RegisterStatusScreen
//   /register/success              → "account created, please log in" (after QR auto-approve)
function RegisterRouter() {
  const path = window.location.pathname;
  const isStatus  = path.startsWith('/register/status');
  const isSuccess = path.startsWith('/register/success');
  const [view, setView] = useState(
    isSuccess ? 'success' : isStatus ? 'status' : 'form'
  );
  const [statusToken, setStatusToken] = useState(
    new URLSearchParams(window.location.search).get('token') || ''
  );
  const [createdUsername, setCreatedUsername] = useState(
    new URLSearchParams(window.location.search).get('u') || ''
  );

  function goHome()  { window.location.href = '/'; }
  function goLogin() { window.location.href = '/admin'; }   // reuse admin login page

  if (view === 'success') {
    return <DirectLoginSuccessScreen
      username={createdUsername}
      onGoLogin={goLogin}
      onGoHome={goHome}/>;
  }

  if (view === 'status') {
    return <RegisterStatusScreen onBack={goHome} token={statusToken}/>;
  }

  return (
    <RegisterScreen
      onBack={goHome}
      onSuccess={(token) => {
        setStatusToken(token);
        setView('status');
        try {
          window.history.pushState({}, '',
            `/register/status${token ? `?token=${token}` : ''}`);
        } catch {}
      }}
      onDirectLogin={(username) => {
        setCreatedUsername(username);
        setView('success');
        try {
          window.history.pushState({}, '',
            `/register/success?u=${encodeURIComponent(username)}`);
        } catch {}
      }}/>
  );
}

function DirectLoginSuccessScreen({ username, onGoLogin, onGoHome }) {
  return (
    <div style={{ minHeight: '100dvh', background: '#fdf6e3',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20 }}>
      <div style={{ background: '#fff', border: '1px solid #e8d5b0',
        borderRadius: 16, padding: 32, maxWidth: 440, width: '100%',
        textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
        <h1 style={{ fontSize: 20, color: '#2E7D32', margin: '0 0 8px',
          fontFamily: "'STKaiti','KaiTi',serif" }}>
          账号创建成功
        </h1>
        <p style={{ fontSize: 13, color: '#6b4c2a', margin: '0 0 20px',
          lineHeight: 1.5 }}>
          您的账号 <code style={{ background: '#fdf6e3', padding: '2px 8px',
          borderRadius: 4, fontWeight: 600, color: '#8B4513' }}>{username}</code> 已开通。<br/>
          请使用刚才设置的密码登录。
        </p>
        <button onClick={onGoLogin} style={{
          padding: '12px 24px', background: '#8B4513', color: '#fff',
          border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 500,
          cursor: 'pointer', width: '100%', marginBottom: 8,
        }}>
          前往登录 →
        </button>
        <button onClick={onGoHome} style={{
          padding: '10px 24px', background: 'transparent', color: '#8B4513',
          border: 'none', fontSize: 12, cursor: 'pointer',
        }}>
          返回首页
        </button>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useScreenHistory, useExitConfirm } from './hooks/useScreenHistory.js';
import { supabase } from './lib/supabase.js';
import AdminApp       from './admin/AdminApp.jsx';
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
import PoetryApp      from './poetry/PoetryApp.jsx';
import GamesApp       from './games/GamesApp.jsx';
import RiddleGame     from './games/RiddleGame.jsx';
import RadicalGame    from './games/RadicalGame.jsx';
import CompositionGame from './games/CompositionGame.jsx';
import ChengyuApp     from './chengyu/ChengyuApp.jsx';
import ScenarioApp    from './scenario/ScenarioApp.jsx';
import StoryApp       from './story/StoryApp.jsx';
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
import PWAInstallGuide from './components/PWAInstallGuide.jsx';
import PWAInstallCard  from './components/PWAInstallCard.jsx';
import FloatingLangMenu from './components/FloatingLangMenu.jsx';
import BackChevron      from './components/BackChevron.jsx';
import KechuangApp from './kechuang/KechuangApp.jsx';
import LoginGate         from './auth/LoginGate.jsx';
import RoleRedirectGate from './auth/RoleRedirectGate.jsx';
import TeacherApp       from './teacher/TeacherApp.jsx';
import SchoolMasterApp  from './school-master/SchoolMasterApp.jsx';
import StudentApp       from './student/StudentApp.jsx';
import ParentApp        from './parent/ParentApp.jsx';
import CommunityApp from './community/CommunityApp.jsx';
import KnowledgeMapGate from './knowledge/KnowledgeMapGate.jsx';
import { IS_TEACHING } from './lib/appMode.js';
// ── Fix title + random panda favicon ─────────────────────────────
document.title = '中文世界';

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

// Toggle the PWA install nudges (top banner + bottom card). Off for now —
// flip to true to re-enable both.
const PWA_INSTALL_ENABLED = false;

// /admin-v2 was merged into /admin — the panel is called /admin, full stop.
// This redirect only keeps old bookmarks and the v2 sidebar's own links alive.
if (window.location.pathname.startsWith('/admin-v2')) {
  window.location.replace('/admin' + window.location.search + window.location.hash);
}
const IS_ADMIN    = window.location.pathname.startsWith('/admin');
const IS_KECHUANG = window.location.pathname.startsWith('/kechuang');
const IS_LOGIN          = window.location.pathname.startsWith('/login');
  const IS_COMMUNITY      = window.location.pathname.startsWith('/community');
const IS_KNOWLEDGE_MAP            = window.location.pathname.startsWith('/knowledge-map');
const IS_ROLE_REDIRECT  = window.location.pathname.startsWith('/role-redirect');
const IS_TEACHER        = window.location.pathname.startsWith('/teacher');
const IS_SCHOOL_MASTER  = window.location.pathname.startsWith('/school-master');
const IS_STUDENT        = window.location.pathname.startsWith('/student');
const IS_PARENT         = window.location.pathname.startsWith('/parent');
const IS_LEARN          = window.location.pathname.startsWith('/learn');
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
        <button onClick={() => {
          if (window.confirm(t(
            '确定要退出登录吗?退出后下次需要重新输入账号密码。',
            'Log out? You will need to enter your username and password again next time.',
            'Esci? Dovrai inserire nome utente e password al prossimo accesso.'
          ))) {
            onLogout();
          }
        }} style={{
          marginTop:10, padding:'8px 16px', fontSize:13, cursor:'pointer',
          borderRadius:8, border:'1px solid #c0392b', background:'#fff',
          color:'#c0392b',
        }}>{t('退出登录','Log out','Esci')}</button>
      </div>

      <div style={{ fontSize:10, color:'#a07850', textAlign:'center', marginTop:20 }}>
        大卫学中文 · 汉字学习平台
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
    // (Previously: auto-opened the install guide 3s after first visit.
    //  Removed — the guide now appears only when the user taps 安装.)
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
          📲 安装到桌面,下次直接打开
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
  // ── Start at entrance so users always see the two-door menu first ──
  const [screen,     setScreen]  = useScreenHistory('entrance', 'app');
  const [activeSet,  setSet]     = useState(null);
  const [charIdx,    setCharIdx] = useState(0);
  const [prevScreen, setPrev]    = useState('entrance');
  const [practiceMode, setPracticeMode] = useState('free');
  const [practiceModule,     setPracticeModule]     = useState(null);
  const [pinyinInitialScreen, setPinyinInitialScreen] = useState(null);
  const { progress, stats, recordPractice, recordQuiz, resetProgress } = useProgress();
  const { sets: SETS, loading: setsLoading } = useCharacters();
  // ── Get language safely (UserApp wraps LanguageProvider so we default here) ──
  const [uiLang, setUiLang] = useState(
    () => localStorage.getItem('david_lang') || 'zh'
  );

  // ── Phone back button: when user is on platform home, intercept the first
  // back press, show "press again to exit" toast. Second press exits the PWA.
  useExitConfirm(screen === 'platform' || screen === 'entrance', '再按一次退出 · Press again to exit');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const c = p.get('char');
    if (c) {
      setSet({ id:'custom', chars:[{ c, p:'', m:'' }] });
      setCharIdx(0); setScreen('practice');
      return;
    }
    // Deep-link from /community tiles (or any external link):
    //   /learn?module=lianzi  → start on character-writing home
    //   /learn?module=words   → start on WordsApp
    //   /learn?module=pinyin  → start on PinyinApp
    //   ...etc for chengyu, poetry, grammar, riddles
    // 'lianzi' is special-cased like PlatformHome's onSelect does (→ 'home').
    const m = p.get('module');
    if (m) {
      // A stale #app:entrance (or #app:platform) hash from a previous session
      // can be restored by useScreenHistory and override the module routing,
      // dumping the user on the entrance screen. Strip the hash first so the
      // module param wins, then route.
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      setScreen(m === 'lianzi' ? 'home' : m);
    } else {
      // No module param → there's nothing for /learn to show on its own.
      // CommunityHome (/community) is THE home now; PlatformHome/entrance
      // are retired. Bounce to the community hub.
      window.location.replace('/community');
    }
  }, []);

  if (status === 'checking') return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center',
      justifyContent:'center', background:'#fdf6e3', color:'#a07850', fontSize:14 }}>
      Loading…
    </div>
  );

  if (['expired','paused'].includes(status)) {
    // Account is real but blocked (expired session / paused account) — force
    // them through the login screen. Anonymous 'guest' status falls through
    // to the module screens below: useProgress is localStorage-only and
    // useCharacters has a static fallback, so /learn?module=X works without
    // a Supabase session. Progress is local-only until they log in.
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
    : screen === 'entrance' || screen === 'platform' ? 'home'
    : screen === 'practice-session' || screen === 'practice-modes' ? 'practice'
    : 'practice';

  function handleNav(id) {
    if (id === 'home')     { window.location.href = '/community'; return; }
    if (id === 'practice') setScreen('practice-session');
    if (id === 'progress') setScreen('progress');
    if (id === 'settings') setScreen('settings');
  }

  return (
    <LanguageProvider>
      <div style={{ maxWidth:430, margin:'0 auto', minHeight:'100dvh',
        display:'flex', flexDirection:'column', background:'var(--bg)' }}>

        {/* PWA install nudges — disabled via PWA_INSTALL_ENABLED. Flip the
            flag at the top of this file to re-enable both the top banner
            and the bottom install card. */}
        {PWA_INSTALL_ENABLED && (
          <>
            <PWAInstallBanner/>
            <PWAInstallCard lang={uiLang}/>
          </>
        )}

        <div style={{ flex:1, overflowY:'auto', paddingBottom:72 }}>
        {(screen === 'entrance' || screen === 'platform') && (() => {
            // entrance & platform (MainEntrance / PlatformHome) are retired —
            // CommunityHome is THE home. Anything that lands here (e.g. a stale
            // restored hash) bounces to /community.
            window.location.replace('/community');
            return null;
          })()}
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
              onBack={()=>{ window.location.href = '/community'; }}/>
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
              onBack={()=>{ window.location.href = '/community'; }}/>
          )}
        {screen === 'pinyin' && (
              <PinyinApp
                onBack={()=>{ setPinyinInitialScreen(null); window.location.href = '/community'; }}/>
            )}

            {screen === 'scenario' && (
              <ScenarioApp onBack={()=>{ window.location.href = '/community'; }}/>
            )}
            {screen === 'story' && (
              <StoryApp onBack={()=>{ window.location.href = '/community'; }}/>
            )}
          {screen === 'words' && (
            <WordsApp onBack={()=>{ window.location.href = '/community'; }}/>
          )}
          {screen === 'grammar' && (
            <GrammarApp onBack={()=>{ window.location.href = '/community'; }}/>
          )}
          {screen === 'poetry' && (
            <PoetryApp onBack={()=>{ window.location.href = '/community'; }}/>
          )}
          {screen === 'chengyu' && (
            <ChengyuApp onBack={()=>{ window.location.href = '/community'; }}/>
          )}
          {screen === 'games' && (
            <GamesApp onBack={()=>setScreen('platform')}/>
          )}
          {screen === 'games' && (
            <GameHub onBack={()=>setScreen('home')}/>
          )}
          {screen === 'riddles' && (
            <RiddleGame onClose={()=>setScreen('platform')}/>
          )}
          {screen === 'radicals' && (
            <RadicalGame onBack={()=>{ window.location.href = '/community'; }}/>
          )}
          {screen === 'compose' && (
            <CompositionGame onBack={()=>{ window.location.href = '/community'; }}/>
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

// Public home depends on deployment mode:
//   teaching (david-zhongwen.net) → /role-redirect (login → role panel)
//   allinone (zhongwen.ci-world.com) → /community (public hub)
// Replace, not push, so the browser back button still escapes the SPA.
function RootRedirect() {
  React.useEffect(() => {
    window.location.replace(IS_TEACHING ? '/role-redirect' : '/community');
  }, []);
  return null;
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
         {/* Universal floating widgets — present on every route. The chevron
             auto-hides on the community root home; the language menu shows
             everywhere. */}
         <BackChevron/>
         <FloatingLangMenu/>
         {IS_ADMIN    ? <LanguageProvider><AdminApp/></LanguageProvider>
        : IS_LOGIN          ? <LoginGate/>
        : IS_KNOWLEDGE_MAP            ? <KnowledgeMapGate/>
        : IS_ROLE_REDIRECT  ? <RoleRedirectGate/>
        : IS_TEACHER        ? <TeacherApp/>
        : IS_SCHOOL_MASTER  ? <SchoolMasterApp/>
        : IS_STUDENT        ? <StudentApp/>
        : IS_PARENT         ? <ParentApp/>
        : IS_LEARN          ? <LanguageProvider><UserApp/></LanguageProvider>
        : IS_KECHUANG ? <LanguageProvider><KechuangApp/></LanguageProvider>
        : IS_COMMUNITY      ? (IS_TEACHING ? <RootRedirect/> : <CommunityApp/>)
        :              <RootRedirect/>}
       </ErrorBoundary>
     );
   }
// build trigger: 2026-05-04 01:18:03

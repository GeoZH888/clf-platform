import React, { useState, useEffect } from 'react';
import { useScreenHistory, useExitConfirm } from './hooks/useScreenHistory.js';
import { supabase } from './lib/supabase.js';
import AdminApp       from './admin/AdminApp.jsx';
import AdminAppV2     from './admin/AdminAppV2.jsx';
import { AuthProvider } from './school/contexts/AuthContext';
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
import RiddleGame     from './games/RiddleGame.jsx';
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
import MainEntrance from './components/MainEntrance.jsx';
import PWAInstallGuide from './components/PWAInstallGuide.jsx';
import PWAInstallCard  from './components/PWAInstallCard.jsx';
import KechuangApp from './kechuang/KechuangApp.jsx';
import LoginGate         from './auth/LoginGate.jsx';
import HeritageApp      from './heritage/HeritageApp.jsx';
import RoleRedirectGate from './auth/RoleRedirectGate.jsx';
import TeacherApp       from './teacher/TeacherApp.jsx';
import SchoolMasterApp  from './school-master/SchoolMasterApp.jsx';
import StudentApp       from './student/StudentApp.jsx';
import ParentApp        from './parent/ParentApp.jsx';
import CommunityApp from './community/CommunityApp.jsx';
import KnowledgeMapGate from './knowledge/KnowledgeMapGate.jsx';
// â”€â”€ Fix title + random panda favicon â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

const IS_ADMIN_V2 = window.location.pathname.startsWith('/admin-v2');
const IS_ADMIN    = window.location.pathname.startsWith('/admin') && !IS_ADMIN_V2;
const IS_KECHUANG = window.location.pathname.startsWith('/kechuang');
const IS_LOGIN          = window.location.pathname.startsWith('/login');
  const IS_COMMUNITY      = window.location.pathname.startsWith('/community');
const IS_INTANGIBLE_HERITAGE      = window.location.pathname.startsWith('/feiyi');
const IS_KNOWLEDGE_MAP            = window.location.pathname.startsWith('/knowledge-map');
const IS_ROLE_REDIRECT  = window.location.pathname.startsWith('/role-redirect');
const IS_TEACHER        = window.location.pathname.startsWith('/teacher');
const IS_SCHOOL_MASTER  = window.location.pathname.startsWith('/school-master');
const IS_STUDENT        = window.location.pathname.startsWith('/student');
const IS_PARENT         = window.location.pathname.startsWith('/parent');
// â”€â”€ Minimal Settings screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Language switcher + user info + logout. Split into own file when it grows.
function SettingsScreen({ userLabel, expiresAt, daysLeft, onLogout, onBack }) {
  const { lang, setLang } = useLang();
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it||en) : en;

  const LANGS = [
    { id:'zh', label:'ä¸­æ–‡' },
    { id:'en', label:'English' },
    { id:'it', label:'Italiano' },
  ];

  return (
    <div style={{ padding:'16px', maxWidth:430, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <button onClick={onBack} style={{
          padding:'6px 12px', fontSize:13, cursor:'pointer', borderRadius:8,
          border:'1px solid #e8d5b0', background:'#fff', color:'#8B4513',
        }}>â† {t('è¿”å›ž','Back','Indietro')}</button>
        <h2 style={{ margin:0, fontSize:20, color:'#8B4513' }}>
          âš™ï¸ {t('è®¾ç½®','Settings','Impostazioni')}
        </h2>
      </div>

      {/* Language */}
      <div style={{ background:'#fff', borderRadius:12, padding:'14px', marginBottom:14,
        border:'1px solid #e8d5b0' }}>
        <div style={{ fontSize:12, color:'#a07850', marginBottom:8 }}>
          ðŸŒ {t('è¯­è¨€','Language','Lingua')}
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
          ðŸ‘¤ {t('è´¦æˆ·','Account','Account')}
        </div>
        <div style={{ fontSize:14, color:'#5D2E0C', marginBottom:4 }}>
          {userLabel || t('è®¿å®¢','Guest','Ospite')}
        </div>
        {expiresAt && (
          <div style={{ fontSize:11, color:'#a07850' }}>
            {t('æœ‰æ•ˆæœŸ','Expires','Scade')}: {new Date(expiresAt).toLocaleDateString()}
            {typeof daysLeft === 'number' && ` Â· ${daysLeft} ${t('å¤©','days','giorni')}`}
          </div>
        )}
        <button onClick={() => {
          if (window.confirm(t(
            'ç¡®å®šè¦é€€å‡ºç™»å½•å—ï¼Ÿé€€å‡ºåŽä¸‹æ¬¡éœ€è¦é‡æ–°è¾“å…¥è´¦å·å¯†ç ã€‚',
            'Log out? You will need to enter your username and password again next time.',
            'Esci? Dovrai inserire nome utente e password al prossimo accesso.'
          ))) {
            onLogout();
          }
        }} style={{
          marginTop:10, padding:'8px 16px', fontSize:13, cursor:'pointer',
          borderRadius:8, border:'1px solid #c0392b', background:'#fff',
          color:'#c0392b',
        }}>{t('é€€å‡ºç™»å½•','Log out','Esci')}</button>
      </div>

      <div style={{ fontSize:10, color:'#a07850', textAlign:'center', marginTop:20 }}>
        å¤§å«å­¦ä¸­æ–‡ Â· æ±‰å­—å­¦ä¹ å¹³å°
      </div>
    </div>
  );
}

// â”€â”€ Placeholder for upcoming modules â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ComingSoonScreen({ title, titleEn, titleIt, emoji, onBack }) {
  return (
    <div style={{
      minHeight:'100dvh', background:'#fdf6e3',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:24, gap:8, textAlign:'center',
    }}>
      <div style={{ fontSize:72, marginBottom:8 }}>{emoji}</div>
      <div style={{ fontSize:28, fontWeight:700, color:'#1a0a05',
        fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:2 }}>{title}</div>
      <div style={{ fontSize:13, color:'#a07850', marginTop:2 }}>
        {titleEn} Â· {titleIt}
      </div>
      <div style={{ marginTop:20, padding:'12px 18px', borderRadius:14,
        background:'#f5ede0', color:'#5D2E0C', fontSize:13, maxWidth:340,
        lineHeight:1.6, border:'1px solid #e8d5b0' }}>
        æœ¬ä¸“åŒºæ­£åœ¨å»ºè®¾ä¸­,æ•¬è¯·æœŸå¾…ã€‚<br/>
        <span style={{ fontSize:11, opacity:0.7 }}>
          Section under construction Â· Sezione in costruzione
        </span>
      </div>
      <button onClick={onBack} style={{
        marginTop:20, padding:'10px 22px', fontSize:13, fontWeight:500,
        cursor:'pointer', borderRadius:8, border:'none',
        background:'#8B4513', color:'#fdf6e3',
      }}>
        â† è¿”å›ž Back
      </button>
    </div>
  );
}






// â”€â”€ PWA Install Banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PWAInstallBanner() {
  const [prompt,    setPrompt]    = React.useState(null);
  const [showGuide, setShowGuide] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(
    () => localStorage.getItem('pwa_dismissed') === '1'
  );

  React.useEffect(() => {
    // Chrome/Edge Android â€” native prompt
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
          ðŸ“² å®‰è£…åˆ°æ¡Œé¢ï¼Œä¸‹æ¬¡ç›´æŽ¥æ‰“å¼€
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
            å®‰è£…
          </button>
          <button onClick={dismiss}
            style={{ padding:'5px 10px', fontSize:12, cursor:'pointer',
              borderRadius:8, border:'1px solid #555',
              background:'transparent', color:'#aaa' }}>âœ•</button>
        </div>
      </div>
    </>
  );
}

function UserApp() {
  const { status, label, expiresAt, daysLeft, expiring, error, logout,
    modules, loginWithPassword } = useDeviceAuth();
  // â”€â”€ Start at entrance so users always see the two-door menu first â”€â”€
  const [screen,     setScreen]  = useScreenHistory('entrance', 'app');
  const [activeSet,  setSet]     = useState(null);
  const [charIdx,    setCharIdx] = useState(0);
  const [prevScreen, setPrev]    = useState('entrance');
  const [practiceMode, setPracticeMode] = useState('free');
  const [practiceModule,     setPracticeModule]     = useState(null);
  const [pinyinInitialScreen, setPinyinInitialScreen] = useState(null);
  const { progress, stats, recordPractice, recordQuiz, resetProgress } = useProgress();
  const { sets: SETS, loading: setsLoading } = useCharacters();
  // â”€â”€ Get language safely (UserApp wraps LanguageProvider so we default here) â”€â”€
  const [uiLang, setUiLang] = useState(
    () => localStorage.getItem('david_lang') || 'zh'
  );

  // â”€â”€ Phone back button: when user is on platform home, intercept the first
  // back press, show "press again to exit" toast. Second press exits the PWA.
  useExitConfirm(screen === 'platform' || screen === 'entrance', 'å†æŒ‰ä¸€æ¬¡é€€å‡º Â· Press again to exit');

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
      Loadingâ€¦
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
      Loading charactersâ€¦
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
    if (id === 'home')     setScreen('entrance');
    if (id === 'practice') setScreen('practice-session');
    if (id === 'progress') setScreen('progress');
    if (id === 'settings') setScreen('settings');
  }

  return (
    <LanguageProvider>
      <div style={{ maxWidth:430, margin:'0 auto', minHeight:'100dvh',
        display:'flex', flexDirection:'column', background:'var(--bg)' }}>

        {/* â”€â”€ PWA install banner (shows once after first scan) â”€â”€ */}
        {expiring && (
          <div style={{ background: daysLeft <= 2 ? '#FFEBEE' : '#FFF8E1',
            borderBottom: `1px solid ${daysLeft <= 2 ? '#ffcccc' : '#ffe082'}`,
            padding:'8px 14px', fontSize:12, display:'flex',
            alignItems:'center', justifyContent:'space-between', gap:8 }}>
            <span style={{ color: daysLeft <= 2 ? '#c0392b' : '#8B6914' }}>
              {daysLeft <= 0
                ? 'âš ï¸ Access expires today.'
                : `â³ Access expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`}
            </span>
          </div>
        )}
        <PWAInstallBanner/>
        <PWAInstallCard lang={uiLang}/>

        <div style={{ flex:1, overflowY:'auto', paddingBottom:72 }}>
        {screen === 'entrance' && (
            <MainEntrance
              onKetang={() => { window.location.href = '/school'; }}
              onShequ={() => setScreen('platform')}
              onFeiyi={() => setScreen('feiyi')}
            />
        )}

          {screen === 'platform' && (
            <PlatformHome
              onSelect={mod => setScreen(mod==='lianzi'?'home':mod)}
              allowedModules={modules || []}
              onSettings={() => setScreen('settings')}
              onLogout={logout}
              userLabel={label}
              onBack={() => setScreen('entrance')}/>
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
                onBack={()=>{ setPinyinInitialScreen(null); setScreen('platform'); }}/>
            )}

            {screen === 'scenario' && (
              <ComingSoonScreen
                title="åœºæ™¯å¯¹è¯"  titleEn="Scenario Dialogues"  titleIt="Dialoghi di Scenari"
                emoji="ðŸ’¬"  onBack={() => setScreen('platform')}/>
            )}
            {screen === 'story' && (
              <ComingSoonScreen
                title="æ•…äº‹ä¼š"  titleEn="Story Time"  titleIt="Ora delle Storie"
                emoji="ðŸ“–"  onBack={() => setScreen('platform')}/>
            )}
            {screen === 'feiyi' && (
              <ComingSoonScreen
                title="éžé—"  titleEn="Heritage"  titleIt="Patrimonio"
                emoji="ðŸ®"  onBack={() => setScreen('entrance')}/>
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
          {screen === 'riddles' && (
            <RiddleGame onClose={()=>setScreen('platform')}/>
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
        <div style={{ fontSize:32, marginBottom:8 }}>âš ï¸</div>
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
         {IS_ADMIN_V2 ? <LanguageProvider><AuthProvider><AdminAppV2/></AuthProvider></LanguageProvider>
         : IS_ADMIN    ? <LanguageProvider><AdminApp/></LanguageProvider>
        : IS_LOGIN          ? <LoginGate/>
        : IS_INTANGIBLE_HERITAGE      ? <HeritageApp/>
        : IS_KNOWLEDGE_MAP            ? <KnowledgeMapGate/>
        : IS_ROLE_REDIRECT  ? <RoleRedirectGate/>
        : IS_TEACHER        ? <TeacherApp/>
        : IS_SCHOOL_MASTER  ? <SchoolMasterApp/>
        : IS_STUDENT        ? <StudentApp/>
        : IS_PARENT         ? <ParentApp/>
        : IS_KECHUANG ? <LanguageProvider><KechuangApp/></LanguageProvider>
        : IS_COMMUNITY      ? <CommunityApp/>
        :              <LoginGate/>}
       </ErrorBoundary>
     );
   }
// build trigger: 2026-05-04 01:18:03

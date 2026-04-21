import { useState, useEffect } from 'react';
import AdminApp       from './admin/AdminApp.jsx';
import HomeScreen     from './components/HomeScreen.jsx';
import SetScreen      from './components/SetScreen.jsx';
import PracticeScreen from './components/PracticeScreen.jsx';
import ProgressScreen from './components/ProgressScreen.jsx';
import BottomNav      from './components/BottomNav.jsx';
import GameHub        from './components/game/GameHub.jsx';
import SearchScreen   from './components/SearchScreen.jsx';
import CameraScreen   from './components/CameraScreen.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';
import { useProgress } from './hooks/useProgress.js';
import { SETS } from './data/characters.js';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}

const IS_ADMIN = window.location.pathname.startsWith('/admin');

function UserApp() {
  const [screen, setScreen]  = useState('home');
  const [activeSet, setSet]  = useState(null);
  const [charIdx, setCharIdx] = useState(0);
  const [prevScreen, setPrev] = useState('home');

  const { progress, stats, recordPractice, recordQuiz, resetProgress } = useProgress();

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const c = p.get('char');
    if (c) {
      setSet({ id:'custom', chars:[{ c, p:'', m:'' }] });
      setCharIdx(0); setScreen('practice');
    }
  }, []);

  const currentChar = activeSet?.chars?.[charIdx] ?? null;

  const goTo = (s) => { setPrev(screen); setScreen(s); };

  const practiceChar = (charObj) => {
    // Find the set this character belongs to
    const foundSet = SETS.find(s => s.chars.some(c => c.c === charObj.c));
    const charInSet = foundSet?.chars.find(c => c.c === charObj.c);
    const idx = foundSet ? foundSet.chars.indexOf(charInSet) : 0;
    setSet(charObj.set || foundSet || { id:'custom', chars:[charObj] });
    setCharIdx(idx >= 0 ? idx : 0);
    setPrev(screen);
    setScreen('practice');
  };

  const navActive = ['home','set','practice'].includes(screen) ? 'home'
    : screen === 'search' ? 'search'
    : screen === 'camera' ? 'camera'
    : screen === 'games' ? 'games'
    : screen === 'progress' ? 'progress'
    : 'home';

  return (
    <LanguageProvider>
      <div style={{ maxWidth:430, margin:'0 auto', minHeight:'100dvh', display:'flex', flexDirection:'column', background:'var(--bg)' }}>
        <div style={{ flex:1, overflowY:'auto', paddingBottom:72 }}>

          {screen === 'home' && (
            <HomeScreen sets={SETS} progress={progress} stats={stats}
              onSelectSet={s => { setSet(s); setCharIdx(0); goTo('set'); }}
              onGames={() => goTo('games')}/>
          )}

          {screen === 'set' && activeSet && (
            <SetScreen set={activeSet} progress={progress}
              onSelectChar={i => { setCharIdx(i); goTo('practice'); }}
              onBack={() => setScreen('home')}/>
          )}

          {screen === 'practice' && currentChar && (
            <PracticeScreen
              char={currentChar} set={activeSet}
              onBack={() => setScreen(prevScreen === 'practice' ? 'home' : (prevScreen || 'home'))}
              onNext={() => {
                const n = charIdx + 1;
                n < (activeSet?.chars?.length ?? 0) ? setCharIdx(n) : setScreen('set');
              }}
              onPracticed={c => recordPractice(c)}
              onQuizComplete={(c, m) => recordQuiz(c, m)}
            />
          )}

          {screen === 'progress' && (
            <ProgressScreen progress={progress} stats={stats} sets={SETS} onReset={resetProgress}/>
          )}

          {screen === 'games' && (
            <GameHub onBack={() => setScreen('home')}/>
          )}

          {screen === 'search' && (
            <SearchScreen onPractice={practiceChar}/>
          )}

          {screen === 'camera' && (
            <CameraScreen onPractice={practiceChar}/>
          )}

        </div>
        <BottomNav
          active={navActive}
          onHome={() => setScreen('home')}
          onProgress={() => setScreen('progress')}
          onGames={() => setScreen('games')}
          onSearch={() => setScreen('search')}
          onCamera={() => setScreen('camera')}
        />
      </div>
    </LanguageProvider>
  );
}

export default function App() {
  return IS_ADMIN
    ? <LanguageProvider><AdminApp /></LanguageProvider>
    : <UserApp />;
}

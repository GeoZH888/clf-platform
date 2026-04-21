// src/words/WordsApp.jsx
import { useState } from 'react';
import WordsHomeScreen from './WordsHomeScreen';
import Flashcards      from './Flashcards';
import WordsListen     from './WordsListen';
import WordsFill       from './WordsFill';
import { useLang }     from '../context/LanguageContext';

export default function WordsApp({ onBack }) {
  const [screen, setScreen] = useState('home');
  const [mode,   setMode]   = useState(null);
  const [theme,  setTheme]  = useState('all');
  const { lang } = useLang();

  function handleMode(m) {
    setMode(m === 'flash' ? 'flashcard' : m);
    setTheme('all');
    setScreen('practice');
  }

  function goHome() { setScreen('home'); setMode(null); }

  if (screen === 'practice') {
    if (mode === 'flashcard') return <Flashcards  theme={theme} onBack={goHome} lang={lang}/>;
    if (mode === 'listen')    return <WordsListen theme={theme} onBack={goHome} lang={lang}/>;
    if (mode === 'fill')      return <WordsFill   theme={theme} onBack={goHome} lang={lang}/>;
  }

  return (
    <WordsHomeScreen
      onBack={onBack}
      onMode={handleMode}
      lang={lang}
    />
  );
}

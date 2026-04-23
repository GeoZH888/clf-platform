// src/words/WordsApp.jsx
// Hub for 词语 module. Routes between home screen and practice modes.
// Supports initialScreen prop for deep-linking from PracticeModeScreen.

import { useState, useEffect } from 'react';
import WordsHomeScreen from './WordsHomeScreen';
import Flashcards      from './Flashcards';
import WordsListen     from './WordsListen';
import WordsFill       from './WordsFill';

const VALID_SCREENS = new Set(['home','flashcard','listen','fill']);

export default function WordsApp({ onBack, initialScreen }) {
  const start = VALID_SCREENS.has(initialScreen) ? initialScreen : 'home';
  const [screen, setScreen] = useState(start);
  const [theme,  setTheme]  = useState('all');    // 'all' | specific theme id

  // Sync if parent passes a new initialScreen after mount
  useEffect(() => {
    if (VALID_SCREENS.has(initialScreen) && initialScreen !== screen) {
      setScreen(initialScreen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScreen]);

  function handleSelect({ type, mode, theme: t }) {
    if (type === 'mode') {
      setTheme('all');
      setScreen(mode);    // 'flashcard' | 'listen' | 'fill'
    } else if (type === 'theme') {
      setTheme(t);
      setScreen('flashcard');    // themes default to flashcard
    }
  }

  function goHome() {
    setScreen('home');
    setTheme('all');
  }

  if (screen === 'flashcard') return <Flashcards  theme={theme} onBack={goHome}/>;
  if (screen === 'listen')    return <WordsListen theme={theme} onBack={goHome}/>;
  if (screen === 'fill')      return <WordsFill   theme={theme} onBack={goHome}/>;

  return <WordsHomeScreen onBack={onBack} onSelect={handleSelect}/>;
}

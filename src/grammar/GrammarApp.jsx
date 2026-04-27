// src/grammar/GrammarApp.jsx
// Main entry for the 语法 (Grammar) module.
// Routes between the topic list (home) and individual topic screens.

import { useState } from 'react';
import { useScreenHistory } from '../hooks/useScreenHistory.js';
import GrammarHomeScreen from './GrammarHomeScreen.jsx';
import GrammarTopicScreen from './GrammarTopicScreen.jsx';

export default function GrammarApp({ onBack, onExit }) {
  // Accept either onBack (App.jsx convention) or onExit (generic)
  const exitHandler = onBack || onExit;
  // topicId: null means home, otherwise a string topic id.
  // Use useScreenHistory so phone back returns to topic list (not platform).
  const [topicId, setTopicId] = useScreenHistory(null, 'grammar');

  if (topicId) {
    return (
      <GrammarTopicScreen
        topicId={topicId}
        onBack={() => setTopicId(null)}
      />
    );
  }

  return (
    <GrammarHomeScreen
      onSelectTopic={setTopicId}
      onExit={exitHandler}
    />
  );
}

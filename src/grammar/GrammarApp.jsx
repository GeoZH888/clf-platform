// src/grammar/GrammarApp.jsx
// Main entry for the 语法 (Grammar) module.
// Routes between the topic list (home) and individual topic screens.

import { useState } from 'react';
import GrammarHomeScreen from './GrammarHomeScreen.jsx';
import GrammarTopicScreen from './GrammarTopicScreen.jsx';

export default function GrammarApp({ onBack, onExit }) {
  // Accept either onBack (App.jsx convention) or onExit (generic)
  const exitHandler = onBack || onExit;
  const [topicId, setTopicId] = useState(null);

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

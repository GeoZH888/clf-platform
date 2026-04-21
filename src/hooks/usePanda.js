// src/hooks/usePanda.js
// Tracks study days, triggers panda teacher at right moments

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const TOKEN_KEY = 'jgw_device_token';
const DAY_KEY   = 'jgw_study_start';

function getStudyDays() {
  const start = localStorage.getItem(DAY_KEY);
  if (!start) {
    localStorage.setItem(DAY_KEY, new Date().toISOString());
    return 1;
  }
  const diff = Date.now() - new Date(start).getTime();
  return Math.max(1, Math.floor(diff / 86400000) + 1);
}

function getStreak() {
  const key = 'jgw_streak';
  const data = JSON.parse(localStorage.getItem(key) || '{"count":0,"last":""}');
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (data.last === today) return data.count;
  if (data.last === yesterday) {
    const updated = { count: data.count + 1, last: today };
    localStorage.setItem(key, JSON.stringify(updated));
    return updated.count;
  }
  // Streak broken
  const reset = { count: 1, last: today };
  localStorage.setItem(key, JSON.stringify(reset));
  return 1;
}

export function usePanda() {
  const [dayCount, setDayCount] = useState(1);
  const [streak,   setStreak]   = useState(1);
  const [pandaCtx, setPandaCtx] = useState(null); // { context, character, score, ... }
  const [visible,  setVisible]  = useState(false);

  useEffect(() => {
    setDayCount(getStudyDays());
    setStreak(getStreak());
  }, []);

  // Show panda with context
  function showPanda(context, extras = {}) {
    setPandaCtx({ context, ...extras });
    setVisible(true);
    // Auto-hide after 6 seconds (except hints)
    if (context !== 'hint') {
      setTimeout(() => setVisible(false), 6000);
    }
  }

  function hidePanda() { setVisible(false); }

  // Convenience triggers
  function onCorrect(character) { showPanda('correct', { character }); }
  function onWrong(character, wrong_count) { showPanda('wrong', { character, wrong_count }); }
  function onHint(character) { showPanda('hint', { character }); }
  function onComplete(score) { showPanda('complete', { score }); }
  function onAchievement() { showPanda('achievement'); }

  return {
    dayCount, streak, pandaCtx, visible,
    showPanda, hidePanda,
    onCorrect, onWrong, onHint, onComplete, onAchievement,
  };
}

// src/hooks/useCharacterProgress.js
// Self-adaptive learning Level 2: localStorage-backed per-character progress
//
// Records each practice attempt (char + score + timestamp) and derives:
//   isLearned(char)   — practiced ≥ 3 times OR max score ≥ 70
//   isMastered(char)  — practiced ≥ 5 times AND avg score ≥ 80
//   getLearnedChars() — list of chars that pass isLearned (for memory game pool)
//   getWeakChars()    — chars with lowest recent scores (for "continue practice")
//
// Storage schema (localStorage key 'character_progress_v1'):
// {
//   "山": { practiced: 4, scores: [65, 72, 78, 81], maxScore: 81, avgScore: 74, lastAt: 1735...},
//   ...
// }

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'character_progress_v1';
const MAX_SCORES_KEPT = 10;  // keep last N scores per char (rolling window)

// Thresholds — tuned so typical learner reaches "learned" after a few sessions
const LEARNED_MIN_PRACTICES = 3;
const LEARNED_MIN_MAX_SCORE = 70;
const MASTERED_MIN_PRACTICES = 5;
const MASTERED_MIN_AVG_SCORE = 80;

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (e) {
    console.warn('useCharacterProgress: load failed', e);
    return {};
  }
}

function saveToStorage(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.warn('useCharacterProgress: save failed', e);
  }
}

function computeDerivedFields(entry) {
  const scores = entry.scores || [];
  const maxScore = scores.length ? Math.max(...scores) : 0;
  const avgScore = scores.length ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length) : 0;
  return { ...entry, maxScore, avgScore };
}

export function useCharacterProgress() {
  const [progress, setProgress] = useState(() => loadFromStorage());

  // Sync across browser tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setProgress(loadFromStorage());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const recordPractice = useCallback((char, score) => {
    if (!char || typeof score !== 'number') return;
    const clamped = Math.max(0, Math.min(100, Math.round(score)));

    setProgress(prev => {
      const existing = prev[char] || { practiced: 0, scores: [], lastAt: 0 };
      const scores = [...(existing.scores || []), clamped].slice(-MAX_SCORES_KEPT);
      const updated = computeDerivedFields({
        practiced: (existing.practiced || 0) + 1,
        scores,
        lastAt: Date.now(),
      });
      const next = { ...prev, [char]: updated };
      saveToStorage(next);
      return next;
    });
  }, []);

  const isLearned = useCallback((char) => {
    const e = progress[char];
    if (!e) return false;
    return (e.practiced >= LEARNED_MIN_PRACTICES) || ((e.maxScore || 0) >= LEARNED_MIN_MAX_SCORE);
  }, [progress]);

  const isMastered = useCallback((char) => {
    const e = progress[char];
    if (!e) return false;
    return (e.practiced >= MASTERED_MIN_PRACTICES) && ((e.avgScore || 0) >= MASTERED_MIN_AVG_SCORE);
  }, [progress]);

  const getLearnedChars = useCallback(() => {
    return Object.keys(progress).filter(c => isLearned(c));
  }, [progress, isLearned]);

  const getMasteredChars = useCallback(() => {
    return Object.keys(progress).filter(c => isMastered(c));
  }, [progress, isMastered]);

  // Weakest-first (lowest max score among learned chars) — useful for "continue practice"
  const getWeakChars = useCallback((limit = 5) => {
    return Object.entries(progress)
      .filter(([, e]) => e.practiced > 0)
      .sort(([, a], [, b]) => (a.maxScore || 0) - (b.maxScore || 0))
      .slice(0, limit)
      .map(([c]) => c);
  }, [progress]);

  const resetProgress = useCallback(() => {
    setProgress({});
    saveToStorage({});
  }, []);

  return {
    progress,
    recordPractice,
    isLearned,
    isMastered,
    getLearnedChars,
    getMasteredChars,
    getWeakChars,
    resetProgress,
  };
}

// Stand-alone helper for components that only need to READ (not re-render on change)
export function readCharacterProgress() {
  return loadFromStorage();
}

// Stand-alone helper for components that only need to WRITE
export function recordCharacterProgress(char, score) {
  if (!char || typeof score !== 'number') return;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const progress = loadFromStorage();
  const existing = progress[char] || { practiced: 0, scores: [], lastAt: 0 };
  const scores = [...(existing.scores || []), clamped].slice(-MAX_SCORES_KEPT);
  progress[char] = computeDerivedFields({
    practiced: (existing.practiced || 0) + 1,
    scores,
    lastAt: Date.now(),
  });
  saveToStorage(progress);
  // Notify any hook listeners in this tab (storage event only fires across tabs)
  try { window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY })); } catch {}
}

// src/hooks/useCharacterProgress.js
// Self-adaptive learning Level 2+3: progress tracking + adaptive difficulty + next-char picker

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'character_progress_v1';
const MAX_SCORES_KEPT = 10;
const LEARNED_MIN_PRACTICES = 3;
const LEARNED_MIN_MAX_SCORE = 70;
const MASTERED_MIN_PRACTICES = 5;
const MASTERED_MIN_AVG_SCORE = 80;

function loadFromStorage() {
  try { const r = localStorage.getItem(STORAGE_KEY); if (!r) return {}; const p = JSON.parse(r); return typeof p === 'object' && p !== null ? p : {}; } catch { return {}; }
}
function saveToStorage(p) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {} }
function computeDerivedFields(entry) {
  const s = entry.scores || [];
  return { ...entry, maxScore: s.length ? Math.max(...s) : 0, avgScore: s.length ? Math.round(s.reduce((a,b)=>a+b,0)/s.length) : 0 };
}

export function useCharacterProgress() {
  const [progress, setProgress] = useState(() => loadFromStorage());

  useEffect(() => {
    const onStorage = e => { if (e.key === STORAGE_KEY) setProgress(loadFromStorage()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const recordPractice = useCallback((char, score) => {
    if (!char || typeof score !== 'number') return;
    const clamped = Math.max(0, Math.min(100, Math.round(score)));
    setProgress(prev => {
      const existing = prev[char] || { practiced: 0, scores: [], lastAt: 0 };
      const scores = [...(existing.scores || []), clamped].slice(-MAX_SCORES_KEPT);
      const next = { ...prev, [char]: computeDerivedFields({ practiced: (existing.practiced || 0) + 1, scores, lastAt: Date.now() }) };
      saveToStorage(next);
      return next;
    });
  }, []);

  const isLearned = useCallback(c => { const e = progress[c]; if (!e) return false; return e.practiced >= LEARNED_MIN_PRACTICES || (e.maxScore || 0) >= LEARNED_MIN_MAX_SCORE; }, [progress]);
  const isMastered = useCallback(c => { const e = progress[c]; if (!e) return false; return e.practiced >= MASTERED_MIN_PRACTICES && (e.avgScore || 0) >= MASTERED_MIN_AVG_SCORE; }, [progress]);
  const getLearnedChars = useCallback(() => Object.keys(progress).filter(isLearned), [progress, isLearned]);
  const getMasteredChars = useCallback(() => Object.keys(progress).filter(isMastered), [progress, isMastered]);
  const getWeakChars = useCallback((limit = 5) => {
    return Object.entries(progress).filter(([, e]) => e.practiced > 0)
      .sort(([, a], [, b]) => (a.maxScore || 0) - (b.maxScore || 0))
      .slice(0, limit).map(([c]) => c);
  }, [progress]);

  // Self-adaptive difficulty for stroke-completion: how many strokes to hide
  const getHideStrokeCount = useCallback((char) => {
    const max = progress[char]?.maxScore || 0;
    if (max < 60) return 1;
    if (max < 80) return 2;
    if (max < 90) return 3;
    return 4;
  }, [progress]);

  // Pick next character to practice (weak chars preferred 70%, new 30%)
  const pickNextChar = useCallback((pool) => {
    if (!pool || pool.length === 0) return null;
    const weak = getWeakChars(3);
    const weakInPool = pool.filter(c => weak.includes(c.glyph_modern || c.c));
    if (weakInPool.length > 0 && Math.random() < 0.7) {
      return weakInPool[Math.floor(Math.random() * weakInPool.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }, [getWeakChars]);

  // Self-adaptive "Next →" picker:
  //   1) weak chars (maxScore < 60) cooled down >1h ago, worst first
  //   2) unpracticed chars (pool is stroke-sorted, so first = simplest)
  //   3) sequential fallback (next in pool)
  //   4) wrap to start
  const getNextLearningChar = useCallback((currentChar, pool) => {
    if (!pool || pool.length === 0) return null;
    const now = Date.now();
    const HOUR = 3600 * 1000;
    const keyOf = c => c.glyph_modern || c.c;

    // 1. Weak chars with cooldown
    const weak = pool.filter(c => {
      const k = keyOf(c);
      if (k === currentChar) return false;
      const e = progress[k];
      return e && (e.maxScore || 0) < 60 && (now - (e.lastAt || 0)) > HOUR;
    });
    if (weak.length > 0) {
      weak.sort((a, b) => (progress[keyOf(a)]?.maxScore || 0) - (progress[keyOf(b)]?.maxScore || 0));
      return { char: weak[0], reason: 'weak' };
    }

    // 2. Unpracticed chars (pool is stroke-sorted)
    const unpracticed = pool.find(c => {
      const k = keyOf(c);
      return k !== currentChar && !progress[k];
    });
    if (unpracticed) return { char: unpracticed, reason: 'new' };

    // 3. Sequential fallback
    const idx = pool.findIndex(c => keyOf(c) === currentChar);
    if (idx >= 0 && idx < pool.length - 1) return { char: pool[idx + 1], reason: 'sequence' };

    // 4. Wrap
    return { char: pool[0], reason: 'wrap' };
  }, [progress]);

  const resetProgress = useCallback(() => { setProgress({}); saveToStorage({}); }, []);

  return { progress, recordPractice, isLearned, isMastered, getLearnedChars, getMasteredChars, getWeakChars, getHideStrokeCount, pickNextChar, getNextLearningChar, resetProgress };
}

export function readCharacterProgress() { return loadFromStorage(); }
export function recordCharacterProgress(char, score) {
  if (!char || typeof score !== 'number') return;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const progress = loadFromStorage();
  const existing = progress[char] || { practiced: 0, scores: [], lastAt: 0 };
  const scores = [...(existing.scores || []), clamped].slice(-MAX_SCORES_KEPT);
  progress[char] = computeDerivedFields({ practiced: (existing.practiced || 0) + 1, scores, lastAt: Date.now() });
  saveToStorage(progress);
  try { window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY })); } catch {}
}

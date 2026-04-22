// src/hooks/usePinyinProgress.js
// Per-item progress tracking for pinyin sub-modules, scoped by module.
// Mirrors useCharacterProgress.js but with a `scope` parameter so a single
// localStorage table tracks progress across all pinyin sub-apps.
//
// Storage structure (localStorage key: "pinyin_progress_v1"):
// {
//   "listen:你":  { practiced, scores[], maxScore, avgScore, lastAt },
//   "type:你":    { ... },
//   "tone:1":     { ... },
//   "speak:nǐ":   { ... },
//   "table:zh":   { ... },
// }
//
// Scope values (add as needed): 'listen' | 'type' | 'tone' | 'speak' | 'table'
// itemKey values: whatever uniquely identifies a practiced item in that scope.

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'pinyin_progress_v1';
const MAX_SCORES_KEPT = 10;

// Thresholds — match the character module so users get consistent mental models.
const LEARNED_MIN_PRACTICES  = 3;
const LEARNED_MIN_MAX_SCORE  = 70;
const MASTERED_MIN_PRACTICES = 5;
const MASTERED_MIN_AVG_SCORE = 80;

// ── Storage helpers ─────────────────────────────────────────────────
function loadFromStorage() {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (!r) return {};
    const p = JSON.parse(r);
    return typeof p === 'object' && p !== null ? p : {};
  } catch { return {}; }
}
function saveToStorage(p) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
}
function computeDerivedFields(entry) {
  const s = entry.scores || [];
  return {
    ...entry,
    maxScore: s.length ? Math.max(...s) : 0,
    avgScore: s.length ? Math.round(s.reduce((a,b)=>a+b,0)/s.length) : 0,
  };
}
function keyOf(scope, itemKey) { return `${scope}:${itemKey}`; }

// ── React hook ─────────────────────────────────────────────────────
export function usePinyinProgress() {
  const [progress, setProgress] = useState(() => loadFromStorage());

  // Cross-tab sync (if user has two windows open)
  useEffect(() => {
    const onStorage = e => { if (e.key === STORAGE_KEY) setProgress(loadFromStorage()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Record one attempt: score is 0-100
  const recordPractice = useCallback((scope, itemKey, score) => {
    if (!scope || !itemKey || typeof score !== 'number') return;
    const clamped = Math.max(0, Math.min(100, Math.round(score)));
    const k = keyOf(scope, itemKey);
    setProgress(prev => {
      const existing = prev[k] || { practiced: 0, scores: [], lastAt: 0 };
      const scores = [...(existing.scores || []), clamped].slice(-MAX_SCORES_KEPT);
      const next = { ...prev, [k]: computeDerivedFields({
        practiced: (existing.practiced || 0) + 1,
        scores,
        lastAt: Date.now(),
      })};
      saveToStorage(next);
      return next;
    });
  }, []);

  // Direct lookup for a single item
  const getEntry = useCallback(
    (scope, itemKey) => progress[keyOf(scope, itemKey)] || null,
    [progress]
  );

  // Classification (same bar as character module, so "mastered" means the same thing everywhere)
  const isLearned = useCallback((scope, itemKey) => {
    const e = progress[keyOf(scope, itemKey)];
    if (!e) return false;
    return e.practiced >= LEARNED_MIN_PRACTICES || (e.maxScore || 0) >= LEARNED_MIN_MAX_SCORE;
  }, [progress]);

  const isMastered = useCallback((scope, itemKey) => {
    const e = progress[keyOf(scope, itemKey)];
    if (!e) return false;
    return e.practiced >= MASTERED_MIN_PRACTICES && (e.avgScore || 0) >= MASTERED_MIN_AVG_SCORE;
  }, [progress]);

  // Weak items in a scope — worst maxScore first
  const getWeakItems = useCallback((scope, limit = 5) => {
    const prefix = `${scope}:`;
    return Object.entries(progress)
      .filter(([k, e]) => k.startsWith(prefix) && e.practiced > 0)
      .sort(([, a], [, b]) => (a.maxScore || 0) - (b.maxScore || 0))
      .slice(0, limit)
      .map(([k]) => k.slice(prefix.length));
  }, [progress]);

  // Sort a pool so that weak items come first, then unpracticed, then original
  // order. This is the "adaptive ordering at session start" variant — simpler
  // than per-question adaptive picking, works with the existing sub-module
  // session UX (ListenIdentify, TypePinyin, PinyinSpeak).
  const sortAdaptively = useCallback((scope, pool, keyFn = x => x) => {
    const now = Date.now();
    const HOUR = 3600 * 1000;
    const prefix = `${scope}:`;
    return [...pool].sort((a, b) => {
      const eA = progress[prefix + keyFn(a)];
      const eB = progress[prefix + keyFn(b)];
      const weakA = eA && (eA.maxScore || 0) < 60 && (now - (eA.lastAt || 0)) > HOUR;
      const weakB = eB && (eB.maxScore || 0) < 60 && (now - (eB.lastAt || 0)) > HOUR;
      // Weak first
      if (weakA !== weakB) return weakA ? -1 : 1;
      if (weakA && weakB) return (eA.maxScore || 0) - (eB.maxScore || 0);
      // Unpracticed next
      if (!eA !== !eB) return !eA ? -1 : 1;
      // Otherwise stable (original order)
      return 0;
    });
  }, [progress]);

  // Self-adaptive "Next →" picker:
  //   1) weak (maxScore < 60, cooldown > 1h), worst first
  //   2) unpracticed (in pool order — pool is assumed pre-sorted by difficulty)
  //   3) sequence (next in pool after current)
  //   4) wrap to pool[0]
  //
  // `keyFn` extracts the itemKey from each pool element so callers with
  // different data shapes (string, { char, py }, etc.) can plug in.
  const getNextItem = useCallback((scope, pool, currentItemKey, keyFn = x => x) => {
    if (!pool || pool.length === 0) return null;
    const now = Date.now();
    const HOUR = 3600 * 1000;
    const prefix = `${scope}:`;

    // 1. Weak with cooldown
    const weak = pool.filter(c => {
      const k = keyFn(c);
      if (k === currentItemKey) return false;
      const e = progress[prefix + k];
      return e && (e.maxScore || 0) < 60 && (now - (e.lastAt || 0)) > HOUR;
    });
    if (weak.length > 0) {
      weak.sort((a, b) => (progress[prefix + keyFn(a)]?.maxScore || 0) - (progress[prefix + keyFn(b)]?.maxScore || 0));
      return { item: weak[0], reason: 'weak' };
    }

    // 2. Unpracticed
    const unpracticed = pool.find(c => {
      const k = keyFn(c);
      return k !== currentItemKey && !progress[prefix + k];
    });
    if (unpracticed) return { item: unpracticed, reason: 'new' };

    // 3. Sequence
    const idx = pool.findIndex(c => keyFn(c) === currentItemKey);
    if (idx >= 0 && idx < pool.length - 1) return { item: pool[idx + 1], reason: 'sequence' };

    // 4. Wrap
    return { item: pool[0], reason: 'wrap' };
  }, [progress]);

  // Stats roll-up for one scope — useful for PinyinApp home badges
  const getScopeStats = useCallback((scope) => {
    const prefix = `${scope}:`;
    const entries = Object.entries(progress).filter(([k]) => k.startsWith(prefix));
    const practicedCount  = entries.length;
    const totalPractices  = entries.reduce((n, [, e]) => n + (e.practiced || 0), 0);
    const masteredCount   = entries.filter(([k, e]) =>
      (e.practiced || 0) >= MASTERED_MIN_PRACTICES && (e.avgScore || 0) >= MASTERED_MIN_AVG_SCORE
    ).length;
    const avgMax = practicedCount > 0
      ? Math.round(entries.reduce((s, [, e]) => s + (e.maxScore || 0), 0) / practicedCount)
      : 0;
    return { practicedCount, totalPractices, masteredCount, avgMax };
  }, [progress]);

  const resetProgress = useCallback(() => { setProgress({}); saveToStorage({}); }, []);
  const resetScope = useCallback((scope) => {
    const prefix = `${scope}:`;
    setProgress(prev => {
      const next = {};
      for (const [k, v] of Object.entries(prev)) if (!k.startsWith(prefix)) next[k] = v;
      saveToStorage(next);
      return next;
    });
  }, []);

  return {
    progress,
    recordPractice,
    getEntry,
    isLearned, isMastered,
    getWeakItems,
    sortAdaptively,
    getNextItem,
    getScopeStats,
    resetProgress, resetScope,
  };
}

// ── Non-hook API ──────────────────────────────────────────────────────
// For places where adding a React hook is awkward (e.g. inside an event
// handler in a deep child, or inside a utility module).
export function readPinyinProgress() { return loadFromStorage(); }

export function recordPinyinProgress(scope, itemKey, score) {
  if (!scope || !itemKey || typeof score !== 'number') return;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const p = loadFromStorage();
  const k = `${scope}:${itemKey}`;
  const existing = p[k] || { practiced: 0, scores: [], lastAt: 0 };
  const scores = [...(existing.scores || []), clamped].slice(-MAX_SCORES_KEPT);
  p[k] = computeDerivedFields({
    practiced: (existing.practiced || 0) + 1,
    scores,
    lastAt: Date.now(),
  });
  saveToStorage(p);
  // Nudge any open tabs to re-read
  try { window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY })); } catch {}
}

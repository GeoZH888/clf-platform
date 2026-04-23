// src/hooks/useWordsProgress.js
// Adaptive progress tracking for 词语 module.
// Mirrors usePinyinProgress: same thresholds, same API shape.
//
// Storage: localStorage key "words_progress_v1"
// Structure: { "flashcard:你好": {...}, "listen:你好": {...}, "fill:你好": {...} }
//
// Each entry:
//   practices      number   — total times user has answered this item in this mode
//   maxScore       number   — best score achieved (0-100)
//   avgScore       number   — rolling average
//   lastPracticed  number   — unix ms timestamp
//
// Mode-scoped: same word can be "learned" for flashcard but "weak" for fill.

const STORAGE_KEY = 'words_progress_v1';

// Thresholds match useCharacterProgress / usePinyinProgress
export const LEARNED_MIN_PRACTICES  = 3;
export const LEARNED_MIN_MAX_SCORE  = 70;
export const MASTERED_MIN_PRACTICES = 5;
export const MASTERED_MIN_AVG_SCORE = 80;

const WEAK_MAX_SCORE    = 60;
const HOUR              = 60 * 60 * 1000;
const COOLDOWN          = 1 * HOUR;

// ── Non-hook API (usable outside React) ────────────────────────────
export function readWordsProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

export function recordWordsProgress(mode, wordZh, score) {
  if (!mode || !wordZh) return null;
  const store = readWordsProgress();
  const key   = `${mode}:${wordZh}`;
  const prev  = store[key] || { practices: 0, maxScore: 0, avgScore: 0, lastPracticed: 0 };
  const n     = prev.practices + 1;
  const next = {
    practices:     n,
    maxScore:      Math.max(prev.maxScore, score),
    avgScore:      Math.round(((prev.avgScore * prev.practices) + score) / n),
    lastPracticed: Date.now(),
  };
  store[key] = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch {}
  return next;
}

export function getEntry(mode, wordZh) {
  const store = readWordsProgress();
  return store[`${mode}:${wordZh}`] || null;
}

export function isLearned(mode, wordZh) {
  const e = getEntry(mode, wordZh);
  if (!e) return false;
  return e.practices >= LEARNED_MIN_PRACTICES || e.maxScore >= LEARNED_MIN_MAX_SCORE;
}

export function isMastered(mode, wordZh) {
  const e = getEntry(mode, wordZh);
  if (!e) return false;
  return e.practices >= MASTERED_MIN_PRACTICES && e.avgScore >= MASTERED_MIN_AVG_SCORE;
}

// Sort a word list adaptively for a given mode:
//   weak first → unpracticed → medium → mastered
export function sortAdaptively(mode, words, keyFn = w => w.word_zh) {
  const store = readWordsProgress();
  const now   = Date.now();

  const withStats = words.map(w => {
    const key = keyFn(w);
    const e   = store[`${mode}:${key}`] || null;
    const cooldownActive = e && (now - e.lastPracticed) < COOLDOWN;
    const bucket =
      !e                                              ? 'fresh' :
      e.maxScore < WEAK_MAX_SCORE && !cooldownActive  ? 'weak' :
      e.avgScore < MASTERED_MIN_AVG_SCORE             ? 'medium' :
                                                         'mastered';
    return { w, e, bucket };
  });

  const order = { weak: 0, fresh: 1, medium: 2, mastered: 3 };
  withStats.sort((a, b) => {
    if (order[a.bucket] !== order[b.bucket]) return order[a.bucket] - order[b.bucket];
    // Within same bucket, shuffle lightly for variety
    return Math.random() - 0.5;
  });
  return withStats.map(x => x.w);
}

// Get the weakest N items across all modes for a given word pool
export function getWeakItems(words, n = 5) {
  const store = readWordsProgress();
  const scored = words.map(w => {
    const modes = ['flashcard', 'listen', 'fill'];
    const entries = modes
      .map(m => store[`${m}:${w.word_zh}`])
      .filter(Boolean);
    if (entries.length === 0) return { w, score: -1 };    // never practiced
    const avgMax = entries.reduce((s, e) => s + e.maxScore, 0) / entries.length;
    return { w, score: avgMax };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, n).map(x => x.w);
}

// Aggregate stats for a mode — used by home screen dashboard
export function getModeStats(mode, words) {
  const store = readWordsProgress();
  let practiced = 0, learned = 0, mastered = 0;
  for (const w of words) {
    const e = store[`${mode}:${w.word_zh}`];
    if (!e) continue;
    practiced++;
    if (e.practices >= LEARNED_MIN_PRACTICES || e.maxScore >= LEARNED_MIN_MAX_SCORE) learned++;
    if (e.practices >= MASTERED_MIN_PRACTICES && e.avgScore >= MASTERED_MIN_AVG_SCORE) mastered++;
  }
  return { total: words.length, practiced, learned, mastered };
}

// Reset helpers (debug + user settings)
export function resetProgress() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
export function resetMode(mode) {
  const store = readWordsProgress();
  const next = {};
  for (const key of Object.keys(store)) {
    if (!key.startsWith(`${mode}:`)) next[key] = store[key];
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
}

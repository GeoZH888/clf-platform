// src/lib/placement.js
//
// 新生分班测试 — adaptive staircase + local scoring helpers.
//
// Everything here is pure. The answer key never reaches the browser: item
// delivery and grading go through the clf_placement_* RPCs (migration 012).
// This module only decides *which level to ask next* and renders results.
//
// Staircase: start at YCT 2 (mid-scale, so a strong or weak candidate is
// bracketed within ~4 items). Two right in a row moves up, two wrong in a
// row moves down. Skills rotate so every candidate gets all four.

export const YCT_MIN = 1;
export const YCT_MAX = 4;

export const PLACEMENT_CONFIG = {
  startLevel:  2,
  maxItems:    16,
  streakUp:    2,   // consecutive correct before moving up a level
  streakDown:  2,   // consecutive wrong before moving down a level
  minPerLevel: 3,   // items needed at a level before it can be the result
  passRatio:   0.70,
};

export const SKILLS = ['vocab', 'listening', 'reading', 'grammar'];

export const SKILL_LABELS = {
  vocab:     '词汇',
  listening: '听力',
  reading:   '阅读',
  grammar:   '语法',
};

export const YCT_LABELS = {
  1: 'YCT 1 · 入门',
  2: 'YCT 2 · 初级',
  3: 'YCT 3 · 中级',
  4: 'YCT 4 · 中高级',
};

// ── Run state ────────────────────────────────────────────────────────

export function initRun(startLevel = PLACEMENT_CONFIG.startLevel, maxItems) {
  return {
    level:         clampLevel(startLevel),
    streakCorrect: 0,
    streakWrong:   0,
    maxItems:      maxItems || PLACEMENT_CONFIG.maxItems,
    asked:         [],   // [{ itemId, level, skill, isCorrect }]
  };
}

/**
 * Rebuild a run for a candidate who closed the tab and came back.
 * The server already knows which items they answered (and excludes them),
 * but the browser has lost the staircase. We only restore the *count* so the
 * test still ends at maxItems instead of running a second full pass — the
 * level resets to the start. Placeholder entries carry level/skill = null and
 * are skipped by the local scorers; the server's score is authoritative.
 */
export function resumeRun(answeredCount = 0, startLevel, maxItems) {
  const run = initRun(startLevel, maxItems);
  run.asked = Array.from({ length: Math.max(0, answeredCount) }, () => ({
    itemId: null, level: null, skill: null, isCorrect: null, resumed: true,
  }));
  return run;
}

/** Skill to request next — rotates so all four get covered evenly. */
export function nextSkill(run) {
  return SKILLS[run.asked.length % SKILLS.length];
}

/** Level to request next. Already updated by the previous recordAnswer. */
export function nextLevel(run) {
  return run.level;
}

function runMax(run) {
  return run.maxItems || PLACEMENT_CONFIG.maxItems;
}

export function isFinished(run) {
  return run.asked.length >= runMax(run);
}

export function progress(run) {
  return Math.min(1, run.asked.length / runMax(run));
}

/**
 * Fold one graded answer into the run and move the staircase.
 * Returns a NEW run object.
 */
export function recordAnswer(run, { itemId, level, skill, isCorrect }) {
  const { streakUp, streakDown } = PLACEMENT_CONFIG;

  const streakCorrect = isCorrect ? run.streakCorrect + 1 : 0;
  const streakWrong   = isCorrect ? 0 : run.streakWrong + 1;

  let level_ = run.level;
  let sc = streakCorrect;
  let sw = streakWrong;

  if (streakCorrect >= streakUp && level_ < YCT_MAX) {
    level_ += 1;
    sc = 0;                 // reset on a move so it takes another 2 to climb again
  } else if (streakWrong >= streakDown && level_ > YCT_MIN) {
    level_ -= 1;
    sw = 0;
  }

  return {
    level:         level_,
    streakCorrect: sc,
    streakWrong:   sw,
    asked:         [...run.asked, { itemId, level, skill, isCorrect }],
  };
}

function clampLevel(l) {
  return Math.max(YCT_MIN, Math.min(YCT_MAX, Number(l) || YCT_MIN));
}

// ── Local scoring (mirrors clf_placement_submit) ─────────────────────
// The server's numbers are authoritative — these exist so the quiz can show
// a result immediately and so the review page can re-render a breakdown
// without a round trip.

export function levelScores(asked) {
  const out = {};
  asked.filter(a => a.level != null).forEach(a => {
    const k = String(a.level);
    if (!out[k]) out[k] = { n: 0, correct: 0 };
    out[k].n += 1;
    if (a.isCorrect) out[k].correct += 1;
  });
  return out;
}

export function skillScores(asked) {
  const tally = {};
  asked.filter(a => a.skill != null).forEach(a => {
    if (!tally[a.skill]) tally[a.skill] = { n: 0, correct: 0 };
    tally[a.skill].n += 1;
    if (a.isCorrect) tally[a.skill].correct += 1;
  });
  return Object.fromEntries(
    Object.entries(tally).map(([k, v]) => [k, round2(v.correct / Math.max(v.n, 1))])
  );
}

/** Highest level answered with >= minPerLevel items and >= passRatio correct. */
export function estimateLevel(asked) {
  const { minPerLevel, passRatio } = PLACEMENT_CONFIG;
  const scores = levelScores(asked);
  let level = YCT_MIN;
  let confidence = 0;
  for (let l = YCT_MIN; l <= YCT_MAX; l++) {
    const s = scores[String(l)];
    if (!s || s.n < minPerLevel) continue;
    const ratio = s.correct / s.n;
    if (ratio >= passRatio) { level = l; confidence = round2(ratio); }
  }
  return { level, confidence, levelScores: scores, skillScores: skillScores(asked) };
}

/**
 * Rank classes for a placed level. Exact level match first, then one level
 * away, then the rest. Classes at or over capacity sink to the bottom but
 * are still listed — the teacher may override.
 */
export function suggestClasses(level, classes = [], memberCounts = {}) {
  return [...classes]
    .map(c => {
      const count = memberCounts[c.id] ?? null;
      const full  = c.capacity != null && count != null && count >= c.capacity;
      const gap   = c.yct_level == null ? 99 : Math.abs(c.yct_level - level);
      return { ...c, memberCount: count, full, gap };
    })
    .sort((a, b) => (a.full - b.full) || (a.gap - b.gap)
                 || String(a.name).localeCompare(String(b.name)));
}

// ── Option shuffling ─────────────────────────────────────────────────
// The seed bank stores the right answer at index 0. Options are shuffled for
// display, and the original index is sent back to the server for grading.

export function shuffleOptions(options, seedKey = '') {
  const idx = options.map((_, i) => i);
  // Deterministic per item so a re-render (or a resumed session) doesn't
  // reshuffle the buttons under the candidate's finger.
  let h = 2166136261;
  for (let i = 0; i < seedKey.length; i++) {
    h ^= seedKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return Math.abs(h) / 2147483647;
  };
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1)) % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.map(originalIndex => ({ originalIndex, text: options[originalIndex] }));
}

// ── Misc ─────────────────────────────────────────────────────────────

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** 6-char code, no ambiguous glyphs. Used when staff creates a session. */
export function generateAccessCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = new Uint8Array(6);
  (globalThis.crypto || window.crypto).getRandomValues(bytes);
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function placementUrl(code) {
  return `${window.location.origin}/placement?code=${code}`;
}

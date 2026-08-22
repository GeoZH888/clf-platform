// src/lib/adaptiveChars.js
//
// Picks which character to practise next, across every character the learner
// has, with no set or category in the way.
//
// Reads the progress useProgress() already keeps in localStorage rather than a
// Supabase table, so it works before login and offline — which is what the
// character module has always assumed. That store records a practice COUNT and
// a last-practised DAY (not a timestamp per attempt), so the schedule below is
// in days; there is no finer signal to spend.
//
//   characters[glyph] = { practiced, quizTotal, quizPerfect, lastDate }

// Spaced repetition, in days: after the nth practice, wait this long.
const INTERVALS = [0, 1, 3, 7, 14, 30];

const DAY = 86400000;

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const then = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(then.getTime())) return Infinity;
  return Math.floor((Date.now() - then.getTime()) / DAY);
}

/** Quiz accuracy, or null when the character has never been quizzed. */
function accuracyOf(rec) {
  if (!rec?.quizTotal) return null;
  return rec.quizPerfect / rec.quizTotal;
}

/**
 * 0 (unseen) → 1 (mastered).
 * Practice count carries most of the weight, accuracy scales it, and long
 * absence decays it so an old character resurfaces instead of sitting "done".
 */
export function masteryOf(rec) {
  if (!rec?.practiced) return 0;
  const reps = Math.min(1, Math.sqrt(rec.practiced) / Math.sqrt(6));
  const acc  = accuracyOf(rec);
  const quality = acc === null ? 0.75 : 0.4 + acc * 0.6;   // unquizzed ≠ perfect
  const decay = Math.max(0.4, 1 - daysSince(rec.lastDate) / 90);
  return Math.max(0, Math.min(1, reps * quality * decay));
}

/** Due for review? Never-practised characters are due by definition. */
export function isDue(rec) {
  if (!rec?.practiced) return true;
  const step = Math.min(rec.practiced - 1, INTERVALS.length - 1);
  return daysSince(rec.lastDate) >= INTERVALS[step];
}

// ── How hard is this character? ───────────────────────────────────────────
// Everything is expressed on the HSK 1-9 scale, because that is the ladder
// learners, parents and teachers already think in — and the one the syllabus
// is written against. Stroke count was only ever a stand-in for it.
//
// Sources, in order of authority:
//   1. hsk_level      the real answer where we have it
//   2. renjiao_grade  人教版 primary grade 1-6, read as a comparable band
//   3. stroke count   a guess, for characters carrying neither
//
// Filling hsk_level or renjiao_grade in the admin therefore improves the
// ordering on its own, with no code change.
const STROKES_TO_LEVEL = [
  [4, 1], [7, 2], [10, 3], [13, 4], [16, 5],
];

export function levelOf(ch = {}) {
  const hsk = Number(ch.hsk_level);
  if (Number.isFinite(hsk) && hsk >= 1) return Math.min(9, hsk);

  // 人教版 grade 1-6 spans roughly the same ground as HSK 1-6 for characters,
  // close enough to order by and better than falling through to strokes.
  const grade = Number(ch.renjiao_grade);
  if (Number.isFinite(grade) && grade >= 1) return Math.min(9, grade);

  const strokes = Number(ch.strokes ?? ch.stroke_count);
  if (!Number.isFinite(strokes) || strokes <= 0) return 3;   // unknown: mid
  for (const [maxStrokes, level] of STROKES_TO_LEVEL) {
    if (strokes <= maxStrokes) return level;
  }
  return 6;
}

/** True when a character carries a real syllabus level rather than a guess. */
export function hasKnownLevel(ch = {}) {
  return Number(ch.hsk_level) >= 1 || Number(ch.renjiao_grade) >= 1;
}

/** Cold start and tie-break: easiest first, strokes breaking ties within a level. */
function easierFirst(a, b) {
  const la = levelOf(a), lb = levelOf(b);
  if (la !== lb) return la - lb;
  const sa = a.strokes ?? a.stroke_count ?? 99;
  const sb = b.strokes ?? b.stroke_count ?? 99;
  if (sa !== sb) return sa - sb;
  return (a.difficulty || 1) - (b.difficulty || 1);
}

// ── Starting point ────────────────────────────────────────────────────────
// Asked once, on the first visit. Nothing about a learner is known yet, and
// guessing wrong in either direction is costly: start too high and they cannot
// write anything, start too low and a literate child spends a week on 一二三.
// The ceiling is a stroke count, and it only governs the cold start — after a
// few practices the measured level takes over and this value stops mattering.
// `ceiling` is an HSK band, so the choice means the same thing to a learner,
// a parent and a teacher — and matches how the content itself is graded.
export const START_LEVELS = [
  { id: 'zero',   ceiling: 1, emoji: '🌱', zh: '从零开始',     en: 'Complete beginner', it: 'Da zero',
    descZh: '没写过汉字 · HSK 1',        descEn: 'Never written Chinese · HSK 1', descIt: 'Mai scritto cinese · HSK 1' },
  { id: 'some',   ceiling: 2, emoji: '🌿', zh: '认识一些字',   en: 'I know some',       it: 'Ne conosco alcuni',
    descZh: '会写常用简单字 · HSK 1-2',  descEn: 'Common simple characters · HSK 1-2', descIt: 'Caratteri semplici · HSK 1-2' },
  { id: 'solid',  ceiling: 4, emoji: '🌳', zh: '有一定基础',   en: 'I have a foundation', it: 'Ho una base',
    descZh: '想练复杂一点的字 · HSK 3-4', descEn: 'Ready for harder characters · HSK 3-4', descIt: 'Caratteri complessi · HSK 3-4' },
];

export const DEFAULT_START = 'zero';

const ceilingFor = id =>
  (START_LEVELS.find(l => l.id === id) || START_LEVELS[0]).ceiling;

/**
 * Estimate what the learner can handle, so new characters are introduced near
 * their level instead of alphabetically or by whatever set they sat in.
 * Returns a stroke count, not a difficulty band — strokes are what actually
 * makes a character hard to write.
 *
 * With no history at all, the answer is whatever starting point they chose.
 */
export function estimateLevel(chars = [], characters = {}, startLevel = DEFAULT_START) {
  const known = chars.filter(c => masteryOf(characters[c.c]) >= 0.5);
  if (!known.length) return ceilingFor(startLevel);

  // Where the learner is comfortable, plus one band — the next rung, not a leap.
  const avg = known.reduce((s, c) => s + levelOf(c), 0) / known.length;
  // Never fall below the declared start: someone who said they have a
  // foundation should not be dragged back to HSK 1 by two shaky practices.
  return Math.min(9, Math.max(ceilingFor(startLevel), Math.round(avg) + 1));
}

/**
 * Order every character by what is worth practising now.
 *
 * Reviews that are due come first, because a character forgotten is worth more
 * than a character never met. New characters follow, easiest first and capped
 * near the learner's level. Mastered characters trail behind so the queue never
 * runs dry.
 *
 * @param {array}  chars      flat list of character objects ({ c, strokes, … })
 * @param {object} characters progress map from useProgress(), keyed by glyph
 * @param {number} limit      how many to return
 */
export function buildQueue(chars = [], characters = {}, limit = 20, startLevel = DEFAULT_START) {
  if (!chars.length) return [];
  // Where they said they were starting, and how far they have actually got.
  const startBand = ceilingFor(startLevel);
  const ceiling   = estimateLevel(chars, characters, startLevel);

  const scored = chars.map(ch => {
    const rec     = characters[ch.c];
    const mastery = masteryOf(rec);
    const seen    = !!rec?.practiced;
    const due     = isDue(rec);
    const level   = levelOf(ch);

    let priority;
    if (seen && due) {
      // Weakest overdue characters first.
      priority = 300 - mastery * 100 + Math.min(60, daysSince(rec.lastDate));
    } else if (!seen) {
      // New characters, in three tiers. `* 8` keeps a whole band clear of the
      // next, so one band is worked through before the following one appears
      // rather than the two interleaving.
      if (level < startBand) {
        // Below what they told us they can already do. Not skipped — a claimed
        // level is a claim, and gaps are common — but it waits its turn.
        priority = 140 - level * 8;
      } else if (level <= ceiling) {
        priority = 200 - level * 8;      // the band they are working in
      } else {
        priority = 120 - level * 8;      // beyond reach for now
      }
    } else {
      // Known and not yet due — only to pad the queue.
      priority = 50 - mastery * 40;
    }
    return { ch, priority, mastery, seen, due };
  });

  scored.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return easierFirst(a.ch, b.ch);
  });

  return scored.slice(0, limit).map(s => s.ch);
}

/** Headline counts for the practice card. */
export function queueStats(chars = [], characters = {}) {
  let due = 0, fresh = 0, mastered = 0;
  for (const ch of chars) {
    const rec = characters[ch.c];
    if (!rec?.practiced) { fresh++; continue; }
    if (masteryOf(rec) >= 0.8) mastered++;
    if (isDue(rec)) due++;
  }
  return { due, fresh, mastered, total: chars.length };
}

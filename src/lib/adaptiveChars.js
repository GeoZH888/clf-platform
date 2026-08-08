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

/** Cold start and tie-break: simplest character first. */
function easierFirst(a, b) {
  const sa = a.strokes ?? a.stroke_count ?? 99;
  const sb = b.strokes ?? b.stroke_count ?? 99;
  if (sa !== sb) return sa - sb;
  return (a.difficulty || 1) - (b.difficulty || 1);
}

/**
 * Estimate what the learner can handle, so new characters are introduced near
 * their level instead of alphabetically or by whatever set they sat in.
 * Returns a stroke count, not a difficulty band — strokes are what actually
 * makes a character hard to write.
 */
export function estimateLevel(chars = [], characters = {}) {
  const known = chars.filter(c => masteryOf(characters[c.c]) >= 0.5);
  if (!known.length) return 4;                    // beginner: 1-4 stroke chars
  const avg = known.reduce((s, c) => s + (c.strokes || 1), 0) / known.length;
  return Math.max(4, Math.round(avg) + 3);        // reach a little past comfort
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
export function buildQueue(chars = [], characters = {}, limit = 20) {
  if (!chars.length) return [];
  const ceiling = estimateLevel(chars, characters);

  const scored = chars.map(ch => {
    const rec     = characters[ch.c];
    const mastery = masteryOf(rec);
    const seen    = !!rec?.practiced;
    const due     = isDue(rec);
    const strokes = ch.strokes ?? 99;

    let priority;
    if (seen && due) {
      // Weakest overdue characters first.
      priority = 300 - mastery * 100 + Math.min(60, daysSince(rec.lastDate));
    } else if (!seen) {
      // New: prefer simple, and hold back anything well past the learner.
      priority = (strokes <= ceiling ? 200 : 120) - strokes;
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

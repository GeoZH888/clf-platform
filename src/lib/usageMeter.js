// src/lib/usageMeter.js
//
// Counts how long an unpaid visitor has been learning today.
//
// Per device, no login — chosen deliberately so someone can try the app before
// anyone creates them an account. That means clearing browser storage resets
// the allowance. It is a nudge toward paying, not a wall, and it cannot be
// made into one without forcing a login before the first character.
//
// What is counted is ACTIVE time, not wall-clock: the meter is ticked by the
// screen the learner is on, and stops while the tab is hidden. Otherwise
// leaving a tab open over lunch would burn the whole day's allowance without
// anyone learning anything.

const DEVICE_KEY = 'clf_device_id';
const USAGE_KEY  = 'clf_usage_v1';

// Beyond this, a gap between ticks is treated as the learner having walked
// away rather than as time spent. Slightly above the tick interval so an
// ordinary slow frame does not get discarded.
const MAX_TICK_GAP_MS = 15_000;

function today() {
  // Local date, not UTC: "4 minutes a day" should roll over at the learner's
  // midnight, not at a time that drifts with their timezone.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readState() {
  try {
    const raw = JSON.parse(localStorage.getItem(USAGE_KEY) || 'null');
    if (raw && raw.date === today()) return raw;
  } catch { /* corrupt or unavailable — start fresh */ }
  return { date: today(), seconds: 0 };
}

function writeState(state) {
  try { localStorage.setItem(USAGE_KEY, JSON.stringify(state)); }
  catch { /* private mode — the meter simply will not persist */ }
}

/** A stable id for this browser. Not an identity; only a key for the counter. */
export function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = (crypto?.randomUUID?.() || `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'no-storage';
  }
}

/** Seconds used today. Resets on its own when the local date changes. */
export function secondsUsedToday() {
  return readState().seconds;
}

/**
 * Add elapsed time. Called by the ticker; `ms` is the gap since the last tick.
 * Gaps longer than MAX_TICK_GAP_MS are dropped — a backgrounded tab, a sleeping
 * laptop, or a phone in a pocket is not study time.
 */
export function addUsage(ms) {
  if (!(ms > 0) || ms > MAX_TICK_GAP_MS) return secondsUsedToday();
  const state = readState();
  state.seconds += ms / 1000;
  writeState(state);
  return state.seconds;
}

/** Wipe today's usage. For the superadmin and for tests — not reachable by learners. */
export function resetUsage() {
  writeState({ date: today(), seconds: 0 });
}

/**
 * Has this device spent its free allowance?
 * `limitMinutes <= 0` means unlimited, which is how a paid tier opts out.
 */
export function hasExceeded(limitMinutes) {
  if (!(limitMinutes > 0)) return false;
  return secondsUsedToday() >= limitMinutes * 60;
}

/** Whole seconds left, floored at zero. Infinity when unlimited. */
export function secondsRemaining(limitMinutes) {
  if (!(limitMinutes > 0)) return Infinity;
  return Math.max(0, Math.round(limitMinutes * 60 - secondsUsedToday()));
}

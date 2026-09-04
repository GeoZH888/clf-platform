// src/lib/chatQuota.js
//
// Counts how many tutor replies an unpaid visitor has used today.
//
// The minute meter in usageMeter.js is the wrong unit for a chatbot. Reading a
// reply, looking up a character and typing an answer is mostly thinking time,
// and thinking time is exactly what a language learner should be spending. A
// learner who takes four minutes over one sentence has done the exercise
// properly, and would be cut off for it. Messages are the unit the cost is
// actually in, so messages are what is counted.
//
// Per device and per local day, matching usageMeter — same trade-off, same
// reasons: no login before the first sentence, and clearing storage resets it.
// It is a nudge toward an account, not a wall.

const QUOTA_KEY = 'clf_chat_quota_v1';

function today() {
  // Local date, so the allowance rolls over at the learner's midnight.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readState() {
  try {
    const raw = JSON.parse(localStorage.getItem(QUOTA_KEY) || 'null');
    if (raw && raw.date === today()) return raw;
  } catch { /* corrupt or unavailable — start fresh */ }
  return { date: today(), used: 0 };
}

function writeState(state) {
  try { localStorage.setItem(QUOTA_KEY, JSON.stringify(state)); }
  catch { /* private mode — the counter simply will not persist */ }
}

/** Replies used today. Resets on its own when the local date changes. */
export function messagesUsedToday() {
  return readState().used;
}

/** Count one reply. Called after the tutor answers, not when the learner sends. */
export function recordChatMessage() {
  const state = readState();
  state.used += 1;
  writeState(state);
  return state.used;
}

/**
 * Has this device spent its free messages?
 * `limit <= 0` means unlimited — how the launch policy and any paid tier opt out.
 */
export function chatExceeded(limit) {
  if (!(limit > 0)) return false;
  return messagesUsedToday() >= limit;
}

/** Replies left today. Infinity when unlimited. */
export function messagesRemaining(limit) {
  if (!(limit > 0)) return Infinity;
  return Math.max(0, limit - messagesUsedToday());
}

/** Wipe today's count. For the superadmin and for tests. */
export function resetChatQuota() {
  writeState({ date: today(), used: 0 });
}

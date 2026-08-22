// src/lib/learningLog.js
//
// The single way any module records what a learner did.
//
//   import { recordLearning } from '../lib/learningLog.js';
//   recordLearning({ module:'lianzi', itemType:'character', itemId:'日',
//                    event:'quiz', correct:true, score:92, durationMs:8400 });
//
// Fire-and-forget: it never throws and never blocks the UI. A learner mid-
// stroke must not wait on a network round trip, and a failed write must never
// interrupt a lesson.
//
// Offline is normal, not exceptional — this runs on phones, often installed as
// a PWA, frequently on poor connections. Anything that cannot be sent is
// queued in localStorage and flushed on the next opportunity.

import { supabase } from './supabase.js';
import { deviceId } from './deviceId.js';

const QUEUE_KEY = 'clf_learning_queue_v1';

// Keeps the queue from growing without bound on a device that is offline for
// weeks. Oldest events are dropped first: recent activity is what dashboards
// and the scheduler actually use.
const MAX_QUEUE = 500;

// Sent in one request when flushing.
const FLUSH_BATCH = 50;

let flushing = false;

function readQueue() {
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(q) ? q : [];
  } catch { return []; }
}

function writeQueue(q) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE))); }
  catch { /* private mode or full — drop silently rather than break a lesson */ }
}

function enqueue(row) {
  const q = readQueue();
  q.push(row);
  writeQueue(q);
}

/** Current auth user id, or null for a guest. Never throws. */
async function currentUserId() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch { return null; }
}

/**
 * Record one learning event.
 *
 * @param {string} module     'lianzi' | 'words' | 'pinyin' | 'chengyu' | …
 * @param {string} [itemType] 'character' | 'word' | 'idiom' | …
 * @param {string} [itemId]   the character, the word, a row id
 * @param {string} [event]    'practice' (default) | 'quiz' | 'complete'
 * @param {boolean} [correct] omit when the activity is not scored
 * @param {number} [score]    0-100
 * @param {number} [durationMs]
 * @param {object} [meta]
 */
export async function recordLearning({
  module,
  itemType = null,
  itemId = null,
  event = 'practice',
  correct = null,
  score = null,
  durationMs = null,
  meta = {},
} = {}) {
  if (!module) return;

  const row = {
    user_id:     await currentUserId(),
    device_id:   deviceId(),
    module,
    item_type:   itemType,
    item_id:     itemId != null ? String(itemId) : null,
    event,
    correct,
    score,
    duration_ms: durationMs,
    meta,
    // Stamped client-side so a queued event keeps the time it happened rather
    // than the time it was finally uploaded.
    created_at:  new Date().toISOString(),
  };

  try {
    const { error } = await supabase.from('clf_learning_events').insert(row);
    if (error) throw error;
    // A successful write is a good moment to drain anything stranded earlier.
    if (readQueue().length) flushQueue();
  } catch {
    enqueue(row);
  }
}

/**
 * Try to upload queued events. Safe to call often — it no-ops when the queue
 * is empty or a flush is already running.
 */
export async function flushQueue() {
  if (flushing) return 0;
  const queued = readQueue();
  if (!queued.length) return 0;

  flushing = true;
  let sent = 0;
  try {
    // A guest who has since signed in should not upload their backlog as
    // anonymous — attribute anything unattributed to whoever is here now.
    const uid = await currentUserId();

    while (true) {
      const q = readQueue();
      if (!q.length) break;

      const batch = q.slice(0, FLUSH_BATCH).map(r => ({
        ...r, user_id: r.user_id ?? uid,
      }));

      const { error } = await supabase.from('clf_learning_events').insert(batch);
      if (error) break;                       // still offline — keep the queue

      writeQueue(readQueue().slice(batch.length));
      sent += batch.length;
      if (batch.length < FLUSH_BATCH) break;
    }
  } catch {
    /* leave the queue for next time */
  } finally {
    flushing = false;
  }
  return sent;
}

/**
 * Attach this device's anonymous history to the signed-in account.
 *
 * Call once after a successful login. Without it, a visitor who tried the app,
 * liked it and was then given an account appears to start from zero — the
 * worst possible first impression of the thing they just paid for.
 *
 * @returns {number} events claimed, or 0 if nothing to do / not signed in
 */
export async function claimDeviceHistory() {
  try {
    await flushQueue();                       // claim the backlog too
    const { data, error } = await supabase.rpc('claim_device_events', {
      p_device_id: deviceId(),
    });
    if (error) return 0;
    return Number(data) || 0;
  } catch {
    return 0;
  }
}

// Opportunistic flushes: coming back online, and returning to the tab.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushQueue(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flushQueue();
  });
}

// src/lib/localMastery.js
//
// Turns the device's own practice record into the same shape the server's
// per-user learning state has, so a signed-out visitor's knowledge map is drawn
// from what they have actually done rather than being a wall of grey.
//
// A guest on this platform is not a user with no history — useProgress has been
// writing jgw_progress_v1 to localStorage since long before anyone logs in.
// That record was simply never read by anything except the character screens.
//
// The mapping is by GLYPH: local progress is keyed by character, and a
// character atom's display_text is that character. Atoms of other types (words,
// grammar points) have no local counterpart and stay unseen — honestly so,
// because nothing local tracks them yet.
//
// The forgetting curve is deliberately the same effectiveMastery() the signed-in
// path uses. Two different decay rules would make the same learner's map change
// shape at the moment they logged in, which would look like a bug and would in
// a sense be one.

import { effectiveMastery } from './mastery.js';

const PROGRESS_KEY = 'jgw_progress_v1';

// A local record has no stability estimate — that comes from the server's
// scheduler. One week is the neutral assumption: long enough that yesterday's
// practice still counts, short enough that a character last seen in April does
// not read as mastered.
const ASSUMED_STABILITY_DAYS = 7;

/** The device's practice record, or an empty one. Never throws. */
export function readLocalProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    return raw && typeof raw.characters === 'object' && raw.characters ? raw.characters : {};
  } catch {
    return {};
  }
}

/**
 * One character's local record → { state, mastery, practiceCount }.
 *
 * Quiz accuracy is the mastery signal; tracing practice alone only ever reaches
 * 'exposed'. Copying a character correctly is not the same as knowing it, and
 * a map that called it mastered would be lying to the learner about what is
 * safe to stop revising.
 */
export function stateFromLocal(rec, now = Date.now()) {
  if (!rec) return { state: 'unseen', mastery: 0, practiceCount: 0 };

  const practiced = rec.practiced || 0;
  const total     = rec.quizTotal || 0;
  const perfect   = rec.quizPerfect || 0;

  if (practiced === 0 && total === 0) {
    return { state: 'unseen', mastery: 0, practiceCount: 0 };
  }
  if (total === 0) {
    return { state: 'exposed', mastery: 0, practiceCount: practiced };
  }

  const stored = perfect / total;
  const eff = effectiveMastery(stored, rec.lastDate || null, ASSUMED_STABILITY_DAYS, now);

  let state;
  if (eff < 0.4)       state = 'forgotten';
  else if (eff >= 0.85) state = 'mastered';
  else                  state = 'practicing';

  return { state, mastery: eff, practiceCount: practiced };
}

/**
 * atom_id → state row, for every atom this device has a record of.
 * Atoms with no local record are simply absent, exactly as they would be
 * absent from the server's learning-state table.
 */
export function localStateByAtom(atoms, now = Date.now()) {
  const local = readLocalProgress();
  if (!atoms?.length) return {};

  const out = {};
  for (const a of atoms) {
    const rec = local[a.display_text];
    if (!rec) continue;
    out[a.id] = stateFromLocal(rec, now);
  }
  return out;
}

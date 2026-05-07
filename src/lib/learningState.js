// src/lib/learningState.js
// Activity tracking — write attempts and update learning state.
// Per LEARNING_DECISIONS_LOCKED.md (Phase G.3).
//
// Public API:
//   recordExposure(userId, atomId, context)
//   recordAttempt(userId, atomId, outcome, context)
//   recordAttemptByRef(userId, refTable, refId, outcome, context)
//   getLearningState(userId, atomId)
//   getDueAtoms(userId, limit)
//   getRecentActivity(userId, limit)

import { supabase } from '../school/services/supabase';
import {
  buildAttemptUpdate,
  MASTERY_CONFIG,
} from './mastery';

const ATTEMPTS_LOOKBACK_LIMIT = 30;  // how many recent attempts to use for recency-weighted score

// ============================================================
// Helper — fetch recent attempts for an atom
// ============================================================
async function fetchRecentAttempts(userId, atomId, limit = ATTEMPTS_LOOKBACK_LIMIT) {
  const { data, error } = await supabase
    .from('clf_attempts')
    .select('outcome, attempt_at, context')
    .eq('user_id', userId)
    .eq('atom_id', atomId)
    .order('attempt_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[learningState] fetchRecentAttempts:', error);
    return [];
  }
  return data || [];
}

// ============================================================
// Helper — fetch atom metadata (for difficulty + level)
// ============================================================
async function fetchAtom(atomId) {
  const { data, error } = await supabase
    .from('clf_atoms')
    .select('id, type, level, difficulty')
    .eq('id', atomId)
    .maybeSingle();
  if (error) {
    console.warn('[learningState] fetchAtom:', error);
    return null;
  }
  return data;
}

// ============================================================
// Helper — fetch user skill rating
// ============================================================
async function fetchUserSkill(userId) {
  const { data, error } = await supabase
    .from('clf_user_profiles')
    .select('skill_rating')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return MASTERY_CONFIG.USER_SKILL_DEFAULT;
  return data.skill_rating ?? MASTERY_CONFIG.USER_SKILL_DEFAULT;
}

// ============================================================
// Helper — fetch existing learning state row
// ============================================================
async function fetchLearningStateRow(userId, atomId) {
  const { data, error } = await supabase
    .from('clf_user_learning_state')
    .select('*')
    .eq('user_id', userId)
    .eq('atom_id', atomId)
    .maybeSingle();
  if (error) {
    console.warn('[learningState] fetchLearningStateRow:', error);
    return null;
  }
  return data;
}

// ============================================================
// Public — record an exposure (just viewed, not practiced)
// Lightweight: increments exposure_count + last_seen_at.
// Does NOT write to clf_attempts (those are practice events only).
// ============================================================
export async function recordExposure(userId, atomId, context = 'view') {
  if (!userId || !atomId) return;
  const now = new Date().toISOString();
  const prev = await fetchLearningStateRow(userId, atomId);
  const patch = {
    user_id: userId,
    atom_id: atomId,
    state: prev?.state === 'unseen' ? 'exposed' : (prev?.state ?? 'exposed'),
    exposure_count: (prev?.exposure_count ?? 0) + 1,
    practice_count: prev?.practice_count ?? 0,
    correct_count: prev?.correct_count ?? 0,
    stored_mastery: prev?.stored_mastery ?? 0,
    mastery_score: prev?.mastery_score ?? 0,
    stability_days: prev?.stability_days ?? MASTERY_CONFIG.INITIAL_STABILITY_DAYS,
    first_seen_at: prev?.first_seen_at ?? now,
    last_seen_at: now,
  };
  const { error } = await supabase
    .from('clf_user_learning_state')
    .upsert(patch, { onConflict: 'user_id,atom_id' });
  if (error) console.warn('[learningState] recordExposure upsert:', error);
}

// ============================================================
// Public — record a practice attempt
// outcome: 0.0 (wrong) | 0.5 (partial) | 1.0 (correct)
// context: 'flashcard' | 'quiz' | 'homework' | 'spelling' | 'listen' | etc.
// Writes to clf_attempts AND updates clf_user_learning_state AND
// updates Elo on clf_user_profiles + clf_atoms.
// ============================================================
export async function recordAttempt(userId, atomId, outcome, context = 'flashcard', difficulty = null) {
  if (!userId || !atomId) {
    console.warn('[learningState] recordAttempt missing userId or atomId');
    return null;
  }
  const now = new Date().toISOString();

  // 1. Insert into clf_attempts
  const { data: attemptRow, error: attemptErr } = await supabase
    .from('clf_attempts')
    .insert({
      user_id: userId,
      atom_id: atomId,
      outcome,
      context,
      difficulty,
      attempt_at: now,
    })
    .select()
    .single();
  if (attemptErr) {
    console.warn('[learningState] recordAttempt insert clf_attempts:', attemptErr);
    return null;
  }

  // 2. Fetch atom + user + recent attempts for state computation
  const [atom, userSkill, prevState, recentAttempts] = await Promise.all([
    fetchAtom(atomId),
    fetchUserSkill(userId),
    fetchLearningStateRow(userId, atomId),
    fetchRecentAttempts(userId, atomId, ATTEMPTS_LOOKBACK_LIMIT),
  ]);

  // 3. Compute updates
  const { learningStatePatch, eloUpdates } = buildAttemptUpdate({
    prevState,
    prevUser: { skill_rating: userSkill },
    atom: atom || { difficulty: 1200 },
    attempt: { outcome, context, attempt_at: now },
    recentAttempts: [
      // include the just-inserted attempt at the front
      { outcome, attempt_at: now, context },
      ...recentAttempts,
    ],
  });

  // 4. Write learning state
  const { error: ulsErr } = await supabase
    .from('clf_user_learning_state')
    .upsert(
      {
        user_id: userId,
        atom_id: atomId,
        ...learningStatePatch,
      },
      { onConflict: 'user_id,atom_id' }
    );
  if (ulsErr) console.warn('[learningState] recordAttempt upsert clf_user_learning_state:', ulsErr);

  // 5. Apply Elo updates (best-effort; don't block on failures)
  if (eloUpdates) {
    await Promise.all([
      supabase
        .from('clf_user_profiles')
        .update({ skill_rating: eloUpdates.newUserSkill })
        .eq('user_id', userId)
        .then(({ error }) => {
          if (error) console.warn('[learningState] elo user_skill:', error);
        }),
      supabase
        .from('clf_atoms')
        .update({ difficulty: eloUpdates.newAtomDifficulty })
        .eq('id', atomId)
        .then(({ error }) => {
          if (error) console.warn('[learningState] elo atom_difficulty:', error);
        }),
    ]);
  }

  return {
    attemptId: attemptRow.id,
    newState: learningStatePatch.state,
    newMastery: learningStatePatch.stored_mastery,
    eloUpdates,
  };
}

// ============================================================
// Public — record attempt by source ref (when calling code only knows
// the source row id, not the atom_id). Resolves atom_id via clf_atoms.
// Useful for legacy modules that work with clf_chengyu / clf_words / etc.
// ============================================================
export async function recordAttemptByRef(userId, refTable, refId, outcome, context = 'flashcard') {
  const { data: atom, error } = await supabase
    .from('clf_atoms')
    .select('id')
    .eq('ref_table', refTable)
    .eq('ref_id', String(refId))
    .maybeSingle();
  if (error || !atom) {
    console.warn(`[learningState] recordAttemptByRef no atom for ${refTable}/${refId}:`, error);
    return null;
  }
  return recordAttempt(userId, atom.id, outcome, context);
}

// ============================================================
// Public — get the current learning state for one (user, atom)
// Returns the row including computed effective_mastery via the view.
// ============================================================
export async function getLearningState(userId, atomId) {
  const { data, error } = await supabase
    .from('clf_user_learning_state_effective')
    .select('*')
    .eq('user_id', userId)
    .eq('atom_id', atomId)
    .maybeSingle();
  if (error) {
    console.warn('[learningState] getLearningState:', error);
    return null;
  }
  return data;
}

// ============================================================
// Public — get atoms due for review (SM-2 next_review_at <= now)
// Limited to flashcard-style atoms (Q4: 字 / 词 / 拼音).
// ============================================================
export async function getDueAtoms(userId, limit = 20) {
  const { data, error } = await supabase
    .from('clf_user_learning_state')
    .select('*, clf_atoms!inner(id, type, display_text, level, difficulty, metadata)')
    .eq('user_id', userId)
    .lte('next_review_at', new Date().toISOString())
    .in('clf_atoms.type', ['character', 'word', 'pinyin'])
    .order('next_review_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.warn('[learningState] getDueAtoms:', error);
    return [];
  }
  return data || [];
}

// ============================================================
// Public — recent activity feed (last N attempts by this user)
// Used by personal dashboard "recently learned" section.
// ============================================================
export async function getRecentActivity(userId, limit = 10) {
  const { data, error } = await supabase
    .from('clf_attempts')
    .select('*, clf_atoms!inner(display_text, type, level)')
    .eq('user_id', userId)
    .order('attempt_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[learningState] getRecentActivity:', error);
    return [];
  }
  return data || [];
}

// ============================================================
// Public — summary stats per atom type (for dashboard)
// Returns: { word: { total, mastered, practicing, ... }, character: {...}, ... }
// ============================================================
export async function getMasterySummary(userId) {
  const { data, error } = await supabase
    .from('clf_user_learning_state')
    .select('state, clf_atoms!inner(type)')
    .eq('user_id', userId);
  if (error) {
    console.warn('[learningState] getMasterySummary:', error);
    return {};
  }
  const summary = {};
  for (const row of data || []) {
    const t = row.clf_atoms?.type || 'unknown';
    if (!summary[t]) summary[t] = { total: 0, unseen: 0, exposed: 0,
                                    practicing: 0, mastered: 0, forgotten: 0 };
    summary[t].total += 1;
    summary[t][row.state] = (summary[t][row.state] ?? 0) + 1;
  }
  return summary;
}

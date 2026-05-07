# patch_phase_g3_g5_g6.py
# Phase G.3 — learningState.js (writes to clf_attempts + updates clf_user_learning_state)
# Phase G.5 — Netlify function embed-chunk.js (OpenAI text-embedding-3-small)
# Phase G.6 — mastery.js (recency-weighted + forgetting curve + Elo)
#
# G.4 (HSK ingestion) deferred — needs source HSK wordlist data.

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

(ROOT / "src" / "lib").mkdir(parents=True, exist_ok=True)
(ROOT / "netlify" / "functions").mkdir(parents=True, exist_ok=True)

files = {}

# ============================================================
# G.6 — mastery.js
# Pure algorithm. No DB calls.
# ============================================================
files["src/lib/mastery.js"] = '''// src/lib/mastery.js
// Mastery algorithm per LEARNING_DECISIONS_LOCKED.md (Q6 + Appendix A).
//
// Components:
//   1. Recency-weighted mastery score (exponential decay of attempt weights)
//   2. Forgetting curve (Ebbinghaus, stability factor)
//   3. Elo-style difficulty adjustment

export const MASTERY_CONFIG = {
  // Recency weighting (Component 1)
  RECENCY_LAMBDA: 0.05,            // attempt weight half-life ~14 days

  // Forgetting curve (Component 2)
  INITIAL_STABILITY_DAYS: 1.0,
  STABILITY_MULTIPLIER: 2.5,       // SM-2 ease factor on success
  STABILITY_PENALTY: 0.5,          // halved on failure
  STABILITY_MIN: 1.0,
  STABILITY_MAX: 365.0,

  // Elo (Component 3)
  ELO_K: 32,
  USER_SKILL_DEFAULT: 1200,        // HSK 2 baseline

  // State thresholds (Q6)
  MASTERY_SCORE_THRESHOLD: 0.85,
  FORGOTTEN_THRESHOLD: 0.4,
  PRACTICE_THRESHOLD: 0.5,
  SKILL_GAP_FOR_MASTERY: -200,     // user can be 200 Elo below atom and still master
};

// ============================================================
// Component 1 — Recency-weighted score
// Given an array of attempts (each with `outcome` 0..1 and `attempt_at` Date or ms),
// returns a score in [0,1] weighted toward recent attempts.
// ============================================================
export function recencyWeightedScore(attempts, now = Date.now()) {
  if (!attempts || attempts.length === 0) return 0;
  const lambda = MASTERY_CONFIG.RECENCY_LAMBDA;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const a of attempts) {
    const t = (a.attempt_at instanceof Date) ? a.attempt_at.getTime()
            : (typeof a.attempt_at === 'string') ? Date.parse(a.attempt_at)
            : a.attempt_at;
    const daysAgo = Math.max(0, (now - t) / 86400000);
    const w = Math.exp(-lambda * daysAgo);
    weightedSum += w * (a.outcome ?? 0);
    totalWeight += w;
  }
  if (totalWeight === 0) return 0;
  return weightedSum / totalWeight;
}

// ============================================================
// Component 2 — Effective mastery (forgetting curve)
// ============================================================
export function effectiveMastery(storedMastery, lastSeenAt, stabilityDays, now = Date.now()) {
  if (!lastSeenAt) return 0;
  const lastT = (lastSeenAt instanceof Date) ? lastSeenAt.getTime()
              : (typeof lastSeenAt === 'string') ? Date.parse(lastSeenAt)
              : lastSeenAt;
  const daysSince = Math.max(0, (now - lastT) / 86400000);
  const s = Math.max(MASTERY_CONFIG.STABILITY_MIN, stabilityDays || 1);
  return (storedMastery || 0) * Math.exp(-daysSince / s);
}

// ============================================================
// Component 3 — Elo update for one attempt
// Returns { newUserSkill, newAtomDifficulty }
// ============================================================
export function eloUpdate(userSkill, atomDifficulty, outcome) {
  const expected = 1 / (1 + Math.pow(10, (atomDifficulty - userSkill) / 400));
  const k = MASTERY_CONFIG.ELO_K;
  const delta = k * (outcome - expected);
  return {
    newUserSkill: userSkill + delta,
    newAtomDifficulty: atomDifficulty - delta,
  };
}

// ============================================================
// Update stability after an attempt (Component 2)
// Successful review: stability *= ease_factor
// Failed review: stability /= 2
// ============================================================
export function updateStability(currentStability, outcome) {
  let s = currentStability || MASTERY_CONFIG.INITIAL_STABILITY_DAYS;
  if (outcome >= 0.5) {
    s *= MASTERY_CONFIG.STABILITY_MULTIPLIER;
  } else {
    s *= MASTERY_CONFIG.STABILITY_PENALTY;
  }
  return Math.max(MASTERY_CONFIG.STABILITY_MIN,
         Math.min(MASTERY_CONFIG.STABILITY_MAX, s));
}

// ============================================================
// State machine — given current state row + atom + user, return state
// ============================================================
export function computeState({ state, atom, user }) {
  // Unseen: never exposed
  if ((state.exposure_count ?? 0) === 0 && (state.practice_count ?? 0) === 0) {
    return 'unseen';
  }
  // Exposed: seen but never practiced
  if ((state.practice_count ?? 0) === 0) {
    return 'exposed';
  }

  // Compute effective mastery with forgetting curve
  const effMastery = effectiveMastery(
    state.stored_mastery ?? state.mastery_score ?? 0,
    state.last_seen_at,
    state.stability_days ?? 1
  );

  // Forgotten
  if (effMastery < MASTERY_CONFIG.FORGOTTEN_THRESHOLD) {
    return 'forgotten';
  }

  // Mastered (with Elo skill check)
  const userSkill = user?.skill_rating ?? MASTERY_CONFIG.USER_SKILL_DEFAULT;
  const atomDiff = atom?.difficulty ?? 1200;
  const skillGap = userSkill - atomDiff;
  if (effMastery >= MASTERY_CONFIG.MASTERY_SCORE_THRESHOLD &&
      skillGap >= MASTERY_CONFIG.SKILL_GAP_FOR_MASTERY) {
    return 'mastered';
  }

  // Practicing
  return 'practicing';
}

// ============================================================
// Helper: full update bundle after an attempt
// Returns the new state values to write back to clf_user_learning_state
//
// Inputs:
//   - prevState: current row from clf_user_learning_state (may be null)
//   - prevUser: user profile { skill_rating }
//   - atom: { id, difficulty }
//   - attempt: { outcome 0..1, context, attempt_at }
//   - recentAttempts: array of recent attempts including this one
// ============================================================
export function buildAttemptUpdate({ prevState, prevUser, atom, attempt, recentAttempts }) {
  const isPractice = attempt.context && attempt.context !== 'view';
  const isCorrect = (attempt.outcome ?? 0) >= MASTERY_CONFIG.PRACTICE_THRESHOLD;
  const now = attempt.attempt_at instanceof Date
            ? attempt.attempt_at
            : new Date(attempt.attempt_at || Date.now());

  // Counts
  const exposure_count = (prevState?.exposure_count ?? 0) + 1;
  const practice_count = (prevState?.practice_count ?? 0) + (isPractice ? 1 : 0);
  const correct_count = (prevState?.correct_count ?? 0) + (isPractice && isCorrect ? 1 : 0);

  // Recency-weighted mastery score (uses passed recent attempts)
  const stored_mastery = isPractice
    ? recencyWeightedScore(recentAttempts, now.getTime())
    : (prevState?.stored_mastery ?? 0);

  // Forgetting stability
  const stability_days = isPractice
    ? updateStability(prevState?.stability_days, attempt.outcome ?? 0)
    : (prevState?.stability_days ?? MASTERY_CONFIG.INITIAL_STABILITY_DAYS);

  // Elo update (only on practice events)
  let elo = null;
  if (isPractice) {
    elo = eloUpdate(
      prevUser?.skill_rating ?? MASTERY_CONFIG.USER_SKILL_DEFAULT,
      atom?.difficulty ?? 1200,
      attempt.outcome ?? 0
    );
  }

  // Compute new state
  const newState = computeState({
    state: { exposure_count, practice_count, stored_mastery,
             stability_days, last_seen_at: now },
    atom: { difficulty: elo?.newAtomDifficulty ?? atom?.difficulty },
    user: { skill_rating: elo?.newUserSkill ?? prevUser?.skill_rating },
  });

  return {
    learningStatePatch: {
      state: newState,
      exposure_count,
      practice_count,
      correct_count,
      stored_mastery,
      mastery_score: stored_mastery,  // mirror for compat
      stability_days,
      first_seen_at: prevState?.first_seen_at ?? now.toISOString(),
      last_seen_at: now.toISOString(),
    },
    eloUpdates: elo ? {
      newUserSkill: elo.newUserSkill,
      newAtomDifficulty: elo.newAtomDifficulty,
    } : null,
  };
}
'''

# ============================================================
# G.3 — learningState.js
# Talks to Supabase. Imports from mastery.js
# ============================================================
files["src/lib/learningState.js"] = '''// src/lib/learningState.js
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
'''

# ============================================================
# G.5 — Netlify function: embed-chunk
# ============================================================
files["netlify/functions/embed-chunk.js"] = '''// netlify/functions/embed-chunk.js
// Phase G.5 — Embedding pipeline.
// Takes { chunk_id } (or { chunks: [...] } for batch), calls OpenAI
// text-embedding-3-small, writes vector to clf_chunk_embeddings.
//
// Required env vars:
//   OPENAI_API_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY (NOT anon — needs to write to clf_chunk_embeddings)

import { createClient } from '@supabase/supabase-js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EMBED_MODEL = 'text-embedding-3-small';
const EMBED_DIM = 1536;

const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

async function embedTexts(texts) {
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texts,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI embed error ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  return data.data.map(d => d.embedding);
}

export default async function handler(req) {
  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not set' }),
      { status: 500, headers: { 'Content-Type': 'application/json' }});
  }
  if (!supabase) {
    return new Response(JSON.stringify({ error: 'Supabase service key not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' }});
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' }});
  }

  // Resolve list of chunk_ids to embed
  let chunkIds = [];
  if (body.chunk_id) chunkIds = [body.chunk_id];
  else if (body.chunks && Array.isArray(body.chunks)) chunkIds = body.chunks;
  else {
    return new Response(JSON.stringify({ error: 'Provide chunk_id or chunks[]' }),
      { status: 400, headers: { 'Content-Type': 'application/json' }});
  }
  if (chunkIds.length === 0) {
    return new Response(JSON.stringify({ error: 'No chunk_ids' }),
      { status: 400, headers: { 'Content-Type': 'application/json' }});
  }
  if (chunkIds.length > 100) {
    return new Response(JSON.stringify({ error: 'Max 100 chunks per call' }),
      { status: 400, headers: { 'Content-Type': 'application/json' }});
  }

  // Fetch chunks
  const { data: chunks, error: fetchErr } = await supabase
    .from('clf_corpus_chunks')
    .select('id, content, title')
    .in('id', chunkIds);
  if (fetchErr) {
    return new Response(JSON.stringify({ error: 'Fetch chunks failed: ' + fetchErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' }});
  }
  if (!chunks || chunks.length === 0) {
    return new Response(JSON.stringify({ error: 'No chunks found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' }});
  }

  // Build text inputs (prefer content, fallback to title)
  const texts = chunks.map(c => (c.content || c.title || '').slice(0, 8000));

  // Get embeddings
  let embeddings;
  try {
    embeddings = await embedTexts(texts);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Embedding API failed: ' + e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' }});
  }

  if (embeddings.length !== chunks.length) {
    return new Response(JSON.stringify({
      error: `Embedding count mismatch (got ${embeddings.length}, expected ${chunks.length})`,
    }), { status: 500, headers: { 'Content-Type': 'application/json' }});
  }

  // Upsert into clf_chunk_embeddings
  const rows = chunks.map((c, i) => ({
    chunk_id: c.id,
    embedding: embeddings[i],
    model: EMBED_MODEL,
    embedded_at: new Date().toISOString(),
  }));
  const { error: upsertErr } = await supabase
    .from('clf_chunk_embeddings')
    .upsert(rows, { onConflict: 'chunk_id' });
  if (upsertErr) {
    return new Response(JSON.stringify({ error: 'Upsert failed: ' + upsertErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' }});
  }

  return new Response(JSON.stringify({
    ok: true,
    embedded: rows.length,
    model: EMBED_MODEL,
    dim: EMBED_DIM,
  }), { status: 200, headers: { 'Content-Type': 'application/json' }});
}
'''

# ============================================================
# Write everything
# ============================================================
print("=== Writing files ===")
for rel, content in files.items():
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    data = content.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
    p.write_bytes(data)
    print(f"  [OK] {rel}  ({len(data)} bytes)")

# ============================================================
# Verify
# ============================================================
print("\n=== Verification ===")
import re
checks = [
    ('mastery.js: MASTERY_CONFIG', 'src/lib/mastery.js', 'MASTERY_CONFIG'),
    ('mastery.js: recencyWeightedScore', 'src/lib/mastery.js', 'recencyWeightedScore'),
    ('mastery.js: effectiveMastery', 'src/lib/mastery.js', 'effectiveMastery'),
    ('mastery.js: eloUpdate', 'src/lib/mastery.js', 'eloUpdate'),
    ('mastery.js: computeState', 'src/lib/mastery.js', 'computeState'),
    ('mastery.js: buildAttemptUpdate', 'src/lib/mastery.js', 'buildAttemptUpdate'),
    ('learningState.js: recordExposure', 'src/lib/learningState.js', 'recordExposure'),
    ('learningState.js: recordAttempt', 'src/lib/learningState.js', 'recordAttempt'),
    ('learningState.js: recordAttemptByRef', 'src/lib/learningState.js', 'recordAttemptByRef'),
    ('learningState.js: getLearningState', 'src/lib/learningState.js', 'getLearningState'),
    ('learningState.js: getMasterySummary', 'src/lib/learningState.js', 'getMasterySummary'),
    ('embed-chunk.js: handler', 'netlify/functions/embed-chunk.js', 'export default async function handler'),
    ('embed-chunk.js: text-embedding-3-small', 'netlify/functions/embed-chunk.js', 'text-embedding-3-small'),
]
all_ok = True
for label, rel, marker in checks:
    p = ROOT / rel
    if not p.exists():
        print(f"  [MISSING] {label}")
        all_ok = False
        continue
    if marker in p.read_text(encoding='utf-8'):
        print(f"  [OK] {label}")
    else:
        print(f"  [FAIL] {label}: missing '{marker}'")
        all_ok = False

# Escape check
hex_chars = set('0123456789abcdefABCDEF')
total_escapes = 0
for rel in files.keys():
    p = ROOT / rel
    txt = p.read_text(encoding='utf-8')
    i = 0
    while i < len(txt) - 5:
        if txt[i] == chr(92) and txt[i+1] == 'u':
            if all(c in hex_chars for c in txt[i+2:i+6]):
                total_escapes += 1
                i += 6
                continue
        i += 1
print(f"  Raw escapes: {total_escapes}")

print("\n" + ("=== ALL OK ===" if all_ok and total_escapes == 0 else "=== SOME FAIL ==="))

print()
print("=" * 60)
print("PHASE G.3 + G.5 + G.6 SHIPPED")
print("=" * 60)
print()
print("FILES:")
print("  src/lib/mastery.js          (G.6 — algorithm, no DB calls)")
print("  src/lib/learningState.js    (G.3 — DB writers, calls mastery.js)")
print("  netlify/functions/embed-chunk.js  (G.5 — OpenAI embeddings)")
print()
print("NO BREAKING CHANGES — these are NEW files. Build will succeed.")
print("They become USEFUL when wired into existing modules (next sessions).")
print()
print("BEFORE EMBEDDING ACTUALLY WORKS:")
print("  1. Set OPENAI_API_KEY in Netlify env vars (Site config > env)")
print("  2. Set SUPABASE_SERVICE_ROLE_KEY in Netlify env vars (NOT the anon key)")
print("     Get it from: Supabase Dashboard > Settings > API > service_role secret")
print()
print("  Without these, embed-chunk will return 500 errors.")
print()
print("WHAT'S G.4 STILL BLOCKED ON:")
print("  HSK 1+2 wordlist source data. Options for next session:")
print("  - Find a public HSK 2025 wordlist CSV/JSON online")
print("  - Use the legacy HSK 2.0 lists (well-documented)")
print("  - Manual curation (slow but accurate)")
print()
print("BUILD + DEPLOY (next steps for these files):")
print("  npm run build")
print("  netlify deploy --prod --dir dist --no-build")
print()
print("These files don't change any UI. Build is just to verify they")
print("compile cleanly. No visible change on the live site yet.")
print()
print("HOW TO TEST G.3 LOCALLY (no deploy needed):")
print("  In your dev tools console while logged in:")
print("    import { recordExposure } from '/src/lib/learningState.js'")
print("    await recordExposure(yourUserId, someAtomId, 'view')")
print("  Then check Supabase: SELECT * FROM clf_user_learning_state ORDER BY last_seen_at DESC LIMIT 1")
print()
print("HOW TO TEST G.5 (after deploy + env vars):")
print("  curl https://david-zhongwen.net/.netlify/functions/embed-chunk \\")
print("    -X POST -H 'Content-Type: application/json' \\")
print("    -d '{\"chunks\": [\"some-chunk-uuid\"]}'")
print("  Should return: { ok: true, embedded: 1, model: 'text-embedding-3-small', dim: 1536 }")

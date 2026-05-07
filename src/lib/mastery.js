// src/lib/mastery.js
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

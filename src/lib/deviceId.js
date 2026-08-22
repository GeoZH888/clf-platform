// src/lib/deviceId.js
//
// One id for this browser, shared by everything that needs to attribute
// activity to a device rather than to an account.
//
// It reuses `jgw_device_token`, which usePracticeLog and useAdaptiveLearning
// have always written into clf_lianzi_progress and jgw_practice_log. Minting a
// second id would split one learner's history in two the moment a second
// system started writing — the existing rows would belong to a device nothing
// else recognised.

const TOKEN_KEY = 'jgw_device_token';

/** Stable per browser. An identifier, not an identity — it proves nothing. */
export function deviceId() {
  try {
    let id = localStorage.getItem(TOKEN_KEY);
    if (!id) {
      id = crypto?.randomUUID?.()
        || `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(TOKEN_KEY, id);
    }
    return id;
  } catch {
    // Private mode with storage blocked. Activity still records, but it cannot
    // be tied to anything later — acceptable, and better than throwing.
    return 'no-storage';
  }
}

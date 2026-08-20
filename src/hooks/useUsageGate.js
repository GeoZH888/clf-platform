// src/hooks/useUsageGate.js
//
// Decides whether the learner may keep going, and ticks the meter while they do.
//
//   paid    → unlimited, meter never runs
//   unpaid  → free_minutes_per_day, metered per device
//
// The allowance comes from clf_app_settings so the superadmin can change it
// without a deploy. Anonymous visitors can read that table by design — it is
// the one number the meter needs before anybody has an account.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  addUsage, hasExceeded, secondsRemaining, secondsUsedToday,
} from '../lib/usageMeter.js';

const TICK_MS = 5000;

// Used until the setting loads, and if it never does. It must match the seeded
// row, so that a failed read behaves like the intended policy rather than like
// some other one.
//
// 0 = unlimited, matching the launch policy of open free use. This is also the
// safe direction while the limit is off: if the settings table is unreachable —
// or the migration has not been applied yet — learners keep learning instead of
// being cut off after a few minutes by a limit nobody meant to impose.
// Revisit this together with the seeded value when metering is switched on.
const FALLBACK_MINUTES = 0;

export function useUsageGate({ enabled = true } = {}) {
  const [limitMinutes, setLimitMinutes] = useState(null);   // null = still loading
  const [isPaid,       setIsPaid]       = useState(false);
  const [ready,        setReady]        = useState(false);
  const [blocked,      setBlocked]      = useState(false);
  const [remaining,    setRemaining]    = useState(Infinity);

  const lastTick = useRef(null);

  // ── Who is this, and what is the allowance? ─────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // The tier decides everything: a paid learner is never metered, so the
      // allowance does not even need to be right for them.
      let paid = false;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data } = await supabase
            .from('clf_user_profiles')
            .select('tier_id, clf_tiers ( slug, is_time_limited )')
            .eq('user_id', session.user.id)
            .maybeSingle();
          const tier = data?.clf_tiers;
          // Only an explicit metered tier is metered. A logged-in user whose
          // tier row is missing is treated as paid rather than cut off — the
          // failure mode should be a free lesson, not a locked-out customer.
          paid = !!data?.tier_id && tier?.is_time_limited !== true;
        }
      } catch { /* offline or no session — treat as unpaid guest */ }

      let minutes = FALLBACK_MINUTES;
      try {
        const { data } = await supabase
          .from('clf_app_settings')
          .select('value')
          .eq('key', 'free_minutes_per_day')
          .maybeSingle();
        const v = Number(data?.value);
        if (Number.isFinite(v) && v >= 0) minutes = v;
      } catch { /* keep the fallback */ }

      if (cancelled) return;
      setIsPaid(paid);
      setLimitMinutes(minutes);
      setBlocked(!paid && enabled && hasExceeded(minutes));
      setRemaining(paid ? Infinity : secondsRemaining(minutes));
      setReady(true);
    })();

    return () => { cancelled = true; };
  }, [enabled]);

  // ── Tick while the learner is actually here ─────────────────────────────
  useEffect(() => {
    if (!ready || isPaid || !enabled || blocked) return;
    const limit = limitMinutes ?? FALLBACK_MINUTES;
    if (!(limit > 0)) return;

    lastTick.current = Date.now();

    const id = setInterval(() => {
      // A hidden tab is not study time. Resetting the marker means the hidden
      // stretch is never billed, rather than arriving as one large gap.
      if (document.visibilityState !== 'visible') {
        lastTick.current = Date.now();
        return;
      }
      const now = Date.now();
      addUsage(now - lastTick.current);
      lastTick.current = now;

      setRemaining(secondsRemaining(limit));
      if (hasExceeded(limit)) setBlocked(true);
    }, TICK_MS);

    return () => clearInterval(id);
  }, [ready, isPaid, enabled, blocked, limitMinutes]);

  // Re-check on return to the tab, so a device left open past midnight picks
  // up the new day without a reload.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible' || isPaid) return;
      const limit = limitMinutes ?? FALLBACK_MINUTES;
      lastTick.current = Date.now();
      setRemaining(secondsRemaining(limit));
      setBlocked(hasExceeded(limit));
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isPaid, limitMinutes]);

  const refresh = useCallback(() => {
    const limit = limitMinutes ?? FALLBACK_MINUTES;
    setRemaining(isPaid ? Infinity : secondsRemaining(limit));
    setBlocked(!isPaid && hasExceeded(limit));
  }, [isPaid, limitMinutes]);

  return {
    ready,
    isPaid,
    blocked,
    limitMinutes: limitMinutes ?? FALLBACK_MINUTES,
    secondsRemaining: remaining,
    secondsUsed: secondsUsedToday(),
    refresh,
  };
}

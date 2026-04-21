/**
 * src/hooks/useXP.js
 * XP / leveling system with Supabase persistence
 */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { getLevel } from '../context/LanguageContext.jsx';

const XP_REWARDS = {
  trace_free:       5,   // free-mode tracing
  trace_perfect:    25,  // perfect quiz (0 mistakes)
  trace_good:       15,  // quiz with ≤2 mistakes
  trace_done:       8,   // quiz finished
  speak_perfect:    20,
  speak_good:       10,
  memory_match:     15,  // per matched pair
  memory_complete:  30,  // all pairs matched bonus
  quiz_correct:     10,  // per correct answer (base)
  quiz_time_bonus:  1,   // × seconds remaining
  daily_complete:   50,  // daily challenge done
  daily_streak:     10,  // × streak days
  first_character:  20,  // very first character
};

export function useXP() {
  const [xp, setXP]         = useState(() => Number(localStorage.getItem('jgw_xp') || 0));
  const [level, setLevel]   = useState(() => getLevel(Number(localStorage.getItem('jgw_xp') || 0)));
  const [levelUp, setLevelUp] = useState(false);
  const [lastGain, setLastGain] = useState(null);

  // Sync XP to Supabase when user is logged in
  useEffect(() => {
    const save = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('jgw_learner_profiles').upsert({
        user_id: user.id,
        xp,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    };
    save();
  }, [xp]);

  const addXP = useCallback((amount, reason = '') => {
    setXP(prev => {
      const next = prev + amount;
      localStorage.setItem('jgw_xp', String(next));

      const oldLevel = getLevel(prev);
      const newLevel = getLevel(next);
      if (newLevel.index > oldLevel.index) {
        setLevelUp(true);
        setTimeout(() => setLevelUp(false), 3000);
      }
      setLevel(newLevel);
      setLastGain({ amount, reason, ts: Date.now() });
      return next;
    });
  }, []);

  const reward = useCallback((type, multiplier = 1) => {
    const base = XP_REWARDS[type] ?? 5;
    addXP(Math.round(base * multiplier), type);
  }, [addXP]);

  return { xp, level, levelUp, lastGain, addXP, reward, XP_REWARDS };
}

import { useState, useCallback } from 'react';

const KEY = 'jgw_progress_v1';

const defaults = {
  characters: {},
  streak: { count: 0, lastDate: null },
  totalSessions: 0,
};

function load() {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return defaults; }
}

function today() { return new Date().toISOString().split('T')[0]; }

export function useProgress() {
  const [progress, setProgress] = useState(load);

  const update = useCallback((fn) => {
    setProgress(prev => {
      const next = fn(prev);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const recordPractice = useCallback((glyph) => {
    update(prev => {
      const d = today();
      const char = prev.characters[glyph] || { practiced: 0, quizTotal: 0, quizPerfect: 0 };
      const streak = { ...prev.streak };
      if (streak.lastDate !== d) {
        const yest = new Date(Date.now() - 864e5).toISOString().split('T')[0];
        streak.count = streak.lastDate === yest ? streak.count + 1 : 1;
        streak.lastDate = d;
      }
      return {
        ...prev, streak,
        totalSessions: prev.totalSessions + 1,
        characters: { ...prev.characters, [glyph]: { ...char, practiced: char.practiced + 1, lastDate: d } },
      };
    });
  }, [update]);

  const recordQuiz = useCallback((glyph, mistakes) => {
    update(prev => {
      const char = prev.characters[glyph] || { practiced: 0, quizTotal: 0, quizPerfect: 0 };
      return {
        ...prev,
        characters: {
          ...prev.characters,
          [glyph]: { ...char, quizTotal: char.quizTotal + 1, quizPerfect: mistakes === 0 ? char.quizPerfect + 1 : char.quizPerfect },
        },
      };
    });
  }, [update]);

  const resetProgress = useCallback(() => {
    try { localStorage.removeItem(KEY); } catch {}
    setProgress(defaults);
  }, []);

  const stats = {
    totalPracticed: Object.values(progress.characters).reduce((s, c) => s + c.practiced, 0),
    uniqueChars:    Object.keys(progress.characters).length,
    streak:         progress.streak.count,
    accuracy: (() => {
      const cs = Object.values(progress.characters);
      const total = cs.reduce((s, c) => s + c.quizTotal, 0);
      const perf  = cs.reduce((s, c) => s + c.quizPerfect, 0);
      return total > 0 ? Math.round((perf / total) * 100) : null;
    })(),
  };

  return { progress, stats, recordPractice, recordQuiz, resetProgress };
}

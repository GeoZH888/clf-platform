# 🩹 Two small fixes noticed while reviewing your existing code

## 1. ListenIdentify.jsx — total count bug

Your `total` state currently only increments on correct answers (via `setTotal(t=>t+1)` inside the correct-answer branch). That means the end screen can show `✓ 5  ✗ -2` when the user got a question wrong. Also `setScore` is used for two different things (points and count) which is confusing.

**Fix** — replace the existing `choose()` function in `src/pinyin/ListenIdentify.jsx` with this:

```js
function choose(option) {
  if (chosen || !played) return;
  const newAttempts = attempts + 1;
  setAttempts(newAttempts);
  const correct = option === ex.py;

  if (!correct) {
    setChosen(option);
    setTimeout(() => setChosen(null), 800);
    return;
  }

  const pts = attemptScore(newAttempts);
  const newScore = score + pts;
  setChosen(option);
  setScore(newScore);
  setTotal(t => t + 1);            // count this question as done — once
  setStreak(s => s + 1);

  setTimeout(() => {
    if (idx + 1 >= exercises.length) {
      setFinished(true);
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) supabase.from('pinyin_practice_log').insert({
        device_token: token, module: 'listen',
        score: Math.round(newScore / exercises.length),
        correct: total + 1, total: exercises.length,
        attempts: newAttempts,
      });
      // Also award points to jgw_points so AdaptiveCard picks it up
      if (token) supabase.from('jgw_points').insert({
        device_token: token, module: 'pinyin',
        action: 'pinyin_listen_right', points: newScore,
      });
    } else {
      setIdx(i => i + 1); setChosen(null);
      setPlayed(false); setAttempts(0);
    }
  }, 1000);
}
```

The end screen's `✗ {total-score}` counter also needs to change — it currently mixes score (points) with total (question count). Use a dedicated wrongCount state if you want an accurate wrong counter.

## 2. TypePinyin.jsx — missing jgw_points write

Your `AdaptiveCard` looks for `pinyin_type_right` rows in `jgw_points`, but `TypePinyin.jsx` only logs to `pinyin_practice_log`. So the adaptive tier never advances from typing practice. Add this inside `checkAnswer()` right after the `pinyin_practice_log` insert:

```js
if (token && correct) {
  supabase.from('jgw_points').insert({
    device_token: token, module: 'pinyin',
    action: 'pinyin_type_right', points: 3,
  });
}
```

## 3. Optional: centralize the points write

Both pinyin modules and the Miaohong module write to `jgw_points` slightly differently. Consider a small helper at `src/lib/points.js`:

```js
import { supabase } from './supabase.js';

const TOKEN_KEY = 'jgw_device_token';

export function awardPoints(module, action, points = 1, metadata = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return Promise.resolve();
  return supabase.from('jgw_points').insert({
    device_token: token, module, action, points, metadata,
  });
}
```

Then call `awardPoints('pinyin', 'pinyin_type_right', 3)` from anywhere. This keeps the adaptive tier logic consistent across all modules.

# Adaptive "Next →" Button Patch

## Patch 1: add method to useCharacterProgress.js

Find `const pickNextChar = useCallback((pool) => {` (around line 70).

After that whole function (its closing `}, [getWeakChars]);`), add:

```js
// For "Next →" button: weak-first, then unpracticed, then sequence
const getNextLearningChar = useCallback((currentChar, pool) => {
  if (!pool || pool.length === 0) return null;
  const now = Date.now();
  const HOUR = 3600 * 1000;

  // Helper: get the character string from pool item
  const keyOf = c => c.glyph_modern || c.c;

  // 1. Weak chars: practiced but scored < 60, last practiced > 1h ago
  const weak = pool.filter(c => {
    const k = keyOf(c);
    if (k === currentChar) return false;
    const e = progress[k];
    return e && (e.maxScore || 0) < 60 && (now - (e.lastAt || 0)) > HOUR;
  });
  if (weak.length > 0) {
    weak.sort((a, b) => (progress[keyOf(a)]?.maxScore || 0) - (progress[keyOf(b)]?.maxScore || 0));
    return weak[0];
  }

  // 2. Unpracticed chars in pool (pool is already stroke-sorted so first = simplest)
  const unpracticed = pool.find(c => {
    const k = keyOf(c);
    return k !== currentChar && !progress[k];
  });
  if (unpracticed) return unpracticed;

  // 3. Fallback: next in sequence
  const idx = pool.findIndex(c => keyOf(c) === currentChar);
  if (idx >= 0 && idx < pool.length - 1) return pool[idx + 1];

  return pool[0];  // wrap to start
}, [progress]);
```

Then in the return statement at the bottom, add `getNextLearningChar`:

```js
return {
  progress, recordPractice, isLearned, isMastered,
  getLearnedChars, getMasteredChars, getWeakChars,
  getHideStrokeCount, pickNextChar, getNextLearningChar,  // ← add this
  resetProgress,
};
```

---

## Patch 2: use it in PracticeScreen.jsx

Find the "→" (next) button. It probably has `onClick={() => onSelectChar(nextIdx)}`
or similar. If you can't find it, search for `→` or `onSelectChar` in the file.

The button likely looks like one of these patterns:

### Pattern A (onClick with hardcoded advance)
```jsx
<button onClick={() => onSelectChar?.(Math.min(totalChars-1, charIdx+1))}>
```

### Pattern B (uses onNext prop)
```jsx
<button onClick={onNext}>
```

### Pattern C (direct state)
```jsx
<button onClick={() => setCharIdx(i => i+1)}>
```

---

## Replace the onClick with this adaptive version

First, at the top of PracticeScreen.jsx (where useCharacterProgress is
destructured), make sure you extract `getNextLearningChar`:

```js
const { getHideStrokeCount, pickNextChar, getNextLearningChar } = useCharacterProgress();
```

Then for the "→" button's onClick, replace with:

```jsx
onClick={() => {
  const pool = setData?.chars || [];
  const next = getNextLearningChar(char?.c, pool);
  if (!next) return;
  const nextIdx = pool.findIndex(c => (c.glyph_modern || c.c) === (next.glyph_modern || next.c));
  if (nextIdx >= 0 && onSelectChar) {
    onSelectChar(nextIdx);
  } else if (onSelectChar) {
    // fallback: sequential if for some reason adaptive pick not in pool
    const curIdx = pool.findIndex(c => (c.glyph_modern || c.c) === char?.c);
    onSelectChar(Math.min(pool.length - 1, curIdx + 1));
  }
}}
```

---

## Patch 3 (optional cosmetic): add ✨ hint on the button

If you want users to know this is smart, add a small indicator:

Find the button JSX and add a ✨ after the arrow:

```jsx
<button ...>
  →
  <span style={{ fontSize: 9, opacity: 0.6, marginLeft: 2 }}>✨</span>
</button>
```

Or use the `title` attribute for a tooltip:

```jsx
<button title="智能推荐下一个字 · Smart next">
  →
</button>
```

---

## Deploy

```powershell
cd C:\Users\Lun_z\Desktop\coding_assistant\clf-platform
git add src/hooks/useCharacterProgress.js src/components/PracticeScreen.jsx
git commit -m "feat: adaptive Next button picks weak chars first, then unpracticed"
git push
```

## Test after deploy

1. Enter a set, practice a few chars with low scores (under 60)
2. Wait 1+ hour (or practice different set, then come back)
3. Click → — should take you back to your weakest char
4. If no weak chars eligible, takes you to first unpracticed
5. If all practiced and no weak, sequence fallback kicks in

## Tuning knobs (in code, if behavior feels wrong)

- **Threshold for "weak"**: change `< 60` → stricter (`< 70`) or looser (`< 50`)
- **Cool-down**: change `HOUR * 1` → `HOUR * 0` (no wait) or `HOUR * 6` (6 hours between re-reviews)
- **Random factor**: if it always picks the same weak char, add randomness:
  ```js
  const weakTop = weak.slice(0, 3);
  return weakTop[Math.floor(Math.random() * weakTop.length)];
  ```

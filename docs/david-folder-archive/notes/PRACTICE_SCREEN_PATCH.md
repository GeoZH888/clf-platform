# PracticeScreen.jsx Patch Instructions

## Goal
Add 2 new modes to PracticeScreen: **Dictation (⏱)** and **Completion (◧)**.
Both are new components; PracticeScreen just routes to them.

## Overall approach
Import the new mode components, add 'dictation' and 'completion' to the mode
toggle, conditionally render the right component based on `mode` value.

---

## Patch 1 — Add imports (near top of file, with other imports)

Find:
```jsx
import { recordCharacterProgress } from '../hooks/useCharacterProgress.js';
```

Add below it:
```jsx
import { useCharacterProgress } from '../hooks/useCharacterProgress.js';
import DictationMode from './modes/DictationMode.jsx';
import CompletionMode from './modes/CompletionMode.jsx';
```

## Patch 2 — Add hint mode state (near other useState calls, around line 350)

Find (in the component body):
```jsx
const [scoreInfo, setScoreInfo] = useState(null);
```

Add below it:
```jsx
const [hintMode, setHintMode] = useState(() => localStorage.getItem('dictationHintMode') || 'both');
useEffect(() => { localStorage.setItem('dictationHintMode', hintMode); }, [hintMode]);

const { getHideStrokeCount, pickNextChar } = useCharacterProgress();
```

## Patch 3 — Expand mode toggle array

Find:
```jsx
{[['free','✏'],['speak','🎤']].map(([m,icon])=>(
```

Replace with:
```jsx
{[['free','✏'],['dictation','⏱'],['completion','◧'],['speak','🎤']].map(([m,icon])=>(
```

## Patch 4 — Add hint mode selector to SettingsDrawer

Find the SettingsDrawer component (around line 30-40 in file). It takes props.
Add a `hintMode` + `onHintMode` prop pair.

In the drawer's rendered body (inside the panel), add:
```jsx
<div style={{ padding: '10px 12px', borderTop: '0.5px solid var(--border)' }}>
  <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6 }}>
    {lang === 'zh' ? '默写提示' : lang === 'it' ? 'Hint dettato' : 'Dictation hint'}
  </div>
  <div style={{ display: 'flex', gap: 4 }}>
    {[['both','拼音+意思'],['pinyin','拼音'],['meaning','意思']].map(([v,l]) => (
      <button key={v} onClick={() => onHintMode(v)}
        style={{ flex: 1, padding: '5px', fontSize: 10, borderRadius: 6,
          background: hintMode===v ? '#8B4513' : '#f5ede0',
          color: hintMode===v ? '#fdf6e3' : 'var(--text-2)', border: 'none', cursor: 'pointer' }}>
        {l}
      </button>
    ))}
  </div>
</div>
```

At the SettingsDrawer call site (bottom of PracticeScreen return):
```jsx
<SettingsDrawer
  ...existing props...
  hintMode={hintMode}
  onHintMode={setHintMode}
/>
```

## Patch 5 — Render the new modes conditionally

In the main render area, the existing structure shows:
- Canvas when in 'free' mode
- Some quiz UI when in 'quiz' mode (dead code)

Before the canvas wrapper `<div className="canvas-wrap">`, add:
```jsx
{mode === 'dictation' && (
  <DictationMode
    char={char}
    nextChar={() => {
      const next = pickNextChar(setData?.chars || []);
      if (next && onSelectChar) onSelectChar(setData.chars.indexOf(next));
    }}
    hintMode={hintMode}
    lang={lang}
    onScore={(c, s) => recordCharacterProgress(c, s)}
    onClose={() => setMode('free')}
    selBrush={selBrush}
    selScript={selScript}
    sizeScale={sizeScale}
    inkColor={inkColor}
    penMode={penMode}
  />
)}

{mode === 'completion' && (
  <CompletionMode
    char={char}
    nextChar={() => {
      const next = pickNextChar(setData?.chars || []);
      if (next && onSelectChar) onSelectChar(setData.chars.indexOf(next));
    }}
    hideCount={getHideStrokeCount(char?.c)}
    lang={lang}
    onScore={(c, s) => recordCharacterProgress(c, s)}
    onClose={() => setMode('free')}
    selBrush={selBrush}
    selScript={selScript}
    sizeScale={sizeScale}
    inkColor={inkColor}
    penMode={penMode}
  />
)}
```

Wrap the existing canvas/grid UI in a `{mode === 'free' && ( ... )}` guard,
so the old canvas only shows in free mode. Dictation/completion have their own canvas.

## Patch 6 — onSelectChar prop

PracticeScreen needs a way to advance to the next char. Check if it has
`onSelectChar` or similar in its props. If not, you'll need to add it
from the parent component (App.jsx router area).

If missing, for now skip "Next →" advancement — user exits to free mode,
picks a new char manually from SetScreen.

Simpler fallback: replace `pickNextChar` logic with just reloading the same char:
```jsx
nextChar={() => {
  // Force re-mount by clearing and re-setting
  setMode('free'); setTimeout(() => setMode('dictation'), 50);  // or 'completion'
}}
```

---

## Testing checklist after patch

1. Click `⏱` → see hint banner with pinyin/meaning, canvas blank, 1s "Ready..." then countdown starts
2. Draw during countdown → when timer hits 0, watermark character reveals + score shows
3. "Next →" picks weak char (if you have practiced some chars)
4. Click `◧` → see character with visible strokes + glow hint boxes for hidden ones
5. Draw in glow boxes → click "Complete ✓" → score displayed
6. Adaptive: if you haven't practiced char, hide 1 stroke; practice it to 80+ score, next time hide 2-3

## Known limitations (deferred)

- CompletionMode uses stroke bounding boxes, not exact path shapes. User drawing anywhere
  in the box counts as "covered". True stroke-path matching would need ray-casting into SVG.
- DictationMode auto-advance only works if `onSelectChar` prop exists. Otherwise user
  manually navigates via SetScreen.
- Self-adaptive "next char" picks from current set only. Cross-set recommendation deferred.

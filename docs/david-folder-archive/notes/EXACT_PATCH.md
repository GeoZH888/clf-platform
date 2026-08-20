# Exact Patches for PracticeScreen.jsx

Your PracticeScreen is 953 lines. Patches 1-3 are **already done**.
This doc covers remaining patches 4-6, all as exact find+replace.

---

## ✅ Already done (do not re-apply)

- Imports for DictationMode/CompletionMode/useCharacterProgress (lines 11-14)
- `hintMode` state (lines 360-361)
- Mode toggle has `⏱` and `◧` buttons (line 813)

---

## ❌ Patch 4: SettingsDrawer hint mode selector

### Step 4a — Update SettingsDrawer signature

**Find this** (line 96-97):

```jsx
function SettingsDrawer({ penMode, onPenMode, selBrush, onBrush, inkColor, onInkColor,
  selScript, onScript, sizeScale, onSize, lang }) {
```

**Replace with**:

```jsx
function SettingsDrawer({ penMode, onPenMode, selBrush, onBrush, inkColor, onInkColor,
  selScript, onScript, sizeScale, onSize, lang, hintMode, onHintMode }) {
```

### Step 4b — Add hint mode UI inside the drawer panel

Find the line that ends the drawer panel. Look for a block that has the
pen-type/brush/color/script/size settings. At the **end of the drawer panel**
(just before the closing `</div>` that wraps the drawer content), find this
closing pattern and add the hint mode picker above it.

**Search for**: `{/* Size */}` — this is one of the last settings blocks.
Scroll down and find its closing `</div>`, then find the next closing `</div>`
that ends the whole drawer panel.

**Safer approach**: add the hint mode picker at the **very beginning** of the
drawer panel instead. Look for this pattern (around line 144):

```jsx
            {/* 软笔/硬笔 */}
            <div style={{fontSize:11,color:'var(--text-3)',marginBottom:6}}>
              {lang==='zh'?'笔类':lang==='it'?'Tipo':'Pen type'}
            </div>
```

**Right BEFORE** that `{/* 软笔/硬笔 */}` comment, paste this:

```jsx
            {/* Dictation hint mode */}
            <div style={{fontSize:11,color:'var(--text-3)',marginBottom:6}}>
              {lang==='zh'?'默写提示':lang==='it'?'Hint dettato':'Dictation hint'}
            </div>
            <div style={{display:'flex',gap:4,marginBottom:12}}>
              {[['both','拼音+意思'],['pinyin','拼音'],['meaning','意思']].map(([v,l]) => (
                <button key={v} onClick={()=>onHintMode?.(v)}
                  style={{flex:1,padding:'5px',fontSize:10,borderRadius:6,
                    background:hintMode===v?'#8B4513':'#f5ede0',
                    color:hintMode===v?'#fdf6e3':'var(--text-2)',
                    border:'none',cursor:'pointer'}}>
                  {l}
                </button>
              ))}
            </div>

```

### Step 4c — Pass props at call site

**Find this** (line 835):

```jsx
        <SettingsDrawer
          penMode={penMode}   onPenMode={setPenMode}
          selBrush={selBrush} onBrush={setSelBrush}
          inkColor={inkColor} onInkColor={setInkColor}
          selScript={selScript} onScript={setSelScript}
          sizeScale={sizeScale} onSize={setSizeScale}
          lang={lang}
        />
```

**Replace with**:

```jsx
        <SettingsDrawer
          penMode={penMode}   onPenMode={setPenMode}
          selBrush={selBrush} onBrush={setSelBrush}
          inkColor={inkColor} onInkColor={setInkColor}
          selScript={selScript} onScript={setSelScript}
          sizeScale={sizeScale} onSize={setSizeScale}
          lang={lang}
          hintMode={hintMode} onHintMode={setHintMode}
        />
```

---

## ❌ Patch 5: Conditionally render Dictation/Completion modes

**Find this** (line 687-696):

```jsx
      {/* ── Canvas + overlay controls ─────────────────────────────── */}
      <div style={{position:'relative',width:'100%',maxWidth:320,margin:'0 auto'}}>
        {/* Grid canvas */}
        <div className="canvas-wrap">
          <canvas ref={gridRef} width={S} height={S} style={{zIndex:1}}/>
          <div ref={hzRef} className={`hz-layer ${mode==='quiz'?'quiz-active':''}`}
            style={{touchAction:'none', userSelect:'none'}}/>
          <canvas ref={drawRef} className="draw-canvas" width={S} height={S}
            style={{zIndex:3,touchAction:'none',cursor:mode==='free'?'crosshair':'default',pointerEvents:mode==='free'?'all':'none'}}/>
        </div>
```

**Replace with** (add Dictation and Completion BEFORE the canvas-wrap, and wrap
the canvas-wrap itself in a `{mode !== 'dictation' && mode !== 'completion' && ...}`
guard so the old canvas hides when in new modes):

```jsx
      {/* ── Dictation mode (6A) ─────────────────────────────────────── */}
      {mode === 'dictation' && (
        <DictationMode
          char={char}
          nextChar={() => { clearDraw(); onNext?.(char); }}
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

      {/* ── Completion mode (6B) ────────────────────────────────────── */}
      {mode === 'completion' && (
        <CompletionMode
          char={char}
          nextChar={() => { clearDraw(); onNext?.(char); }}
          hideCount={getHideStrokeCount?.(char?.c) || 1}
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

      {/* ── Canvas + overlay controls ─────────────────────────────── */}
      {mode !== 'dictation' && mode !== 'completion' && (
      <div style={{position:'relative',width:'100%',maxWidth:320,margin:'0 auto'}}>
        {/* Grid canvas */}
        <div className="canvas-wrap">
          <canvas ref={gridRef} width={S} height={S} style={{zIndex:1}}/>
          <div ref={hzRef} className={`hz-layer ${mode==='quiz'?'quiz-active':''}`}
            style={{touchAction:'none', userSelect:'none'}}/>
          <canvas ref={drawRef} className="draw-canvas" width={S} height={S}
            style={{zIndex:3,touchAction:'none',cursor:mode==='free'?'crosshair':'default',pointerEvents:mode==='free'?'all':'none'}}/>
        </div>
```

### Step 5b — Close the guard

The `{mode !== 'dictation' && mode !== 'completion' && (` block needs a closing `)}`.
Find where the canvas+overlay block ends (look for the closing `</div>` right
before the mode toggle section at line ~810):

```jsx
        {mode==='quiz' && qFb.msg && (
          ...
        )}

      </div>
```

After that closing `</div>` (on its own line), add `)}`:

```jsx
        {mode==='quiz' && qFb.msg && (
          ...
        )}

      </div>
      )}
```

**Double-check by searching for**: just before `{/* ── Mode toggle + stroke buttons + settings ─────────────────── */}`
there should be a closing `</div>` for the canvas section. After that `</div>`
add `)}` on its own line.

---

## ✅ Patch 6: onSelectChar → use onNext (ALREADY HANDLED)

Your PracticeScreen uses `onNext?.(char)` (line 719) which works fine.
The Dictation/Completion components just call it through the `nextChar` prop.

Nothing to do here, because I adjusted the new mode renders in Patch 5 to call
`onNext?.(char)` directly.

---

## 🎯 Also needed: extract getHideStrokeCount from hook

In the component body (around line 362, right after the hintMode effect), add:

**Find**:
```jsx
  useEffect(() => { localStorage.setItem('dictationHintMode', hintMode); }, [hintMode]);
```

**Replace with**:
```jsx
  useEffect(() => { localStorage.setItem('dictationHintMode', hintMode); }, [hintMode]);

  const { getHideStrokeCount, pickNextChar } = useCharacterProgress();
```

This gives you the hook methods in scope.

---

## Testing after these patches

```powershell
cd C:\Users\Lun_z\Desktop\coding_assistant\clf-platform
npm run build
```

If build succeeds → commit + push:
```powershell
git add src/components/PracticeScreen.jsx
git commit -m "feat: integrate DictationMode + CompletionMode with SettingsDrawer hint picker"
git push
```

Then after Netlify Published + Ctrl+Shift+R:

1. Click `⏱` → Dictation mode — hint banner + countdown
2. Click `◧` → Completion mode — HanziWriter chars + glow boxes
3. Open settings drawer → see "默写提示" radio with 3 options

## If build fails

Most likely errors:
- **"getHideStrokeCount is not defined"** → didn't extract it from hook, do the last step above
- **"Unexpected token )"** or syntax error → Patch 5 closing `)}` is in wrong place
- **"onHintMode is not defined"** → didn't add it to SettingsDrawer signature

Bring the full error log to a new conversation — there's almost no context left here.

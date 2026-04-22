// src/components/modes/CompletionMode.jsx
// Mode 6B: Stroke Completion
//
// Shows character with N random strokes hidden. User fills them in.
// When user clicks "Complete", judge by IoU whether hidden strokes were covered.
//
// Self-adaptive:  N based on user's max score for this char (1-4 strokes hidden)
//
// Uses HanziWriter's stroke data internally. Renders:
//   - Visible strokes: normal display via HanziWriter
//   - Hidden strokes: glow-box hint boxes at their bounding areas
//   - User's ink: rendered on draw canvas

import React, { useState, useEffect, useRef, useCallback } from 'react';
import HanziWriter from 'hanzi-writer';
import { drawBrushStroke } from '../BrushSelector.jsx';
import { readCharacterProgress } from '../../hooks/useCharacterProgress.js';

const S = 300;

// Return bounding box of a HanziWriter stroke path
// HanziWriter path data: "M ... L ... Z" — parse to get min/max points
function getStrokeBoundingBox(strokePath) {
  if (!strokePath) return null;
  const nums = strokePath.match(/-?\d+\.?\d*/g);
  if (!nums || nums.length < 4) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < nums.length - 1; i += 2) {
    const x = parseFloat(nums[i]), y = parseFloat(nums[i+1]);
    if (!isNaN(x) && !isNaN(y)) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  // HanziWriter uses 1024 viewBox; scale to our 300
  const scale = S / 1024;
  return {
    x: minX * scale, y: (900 - maxY) * scale,        // y-flip: HanziWriter origin is bottom-left
    w: (maxX - minX) * scale, h: (maxY - minY) * scale,
  };
}

// Pick N random stroke indices to hide (avoid duplicates)
function pickHiddenIndices(total, count) {
  if (count >= total) return Array.from({ length: total }, (_, i) => i);
  const set = new Set();
  while (set.size < count) set.add(Math.floor(Math.random() * total));
  return Array.from(set).sort((a,b) => a-b);
}

export default function CompletionMode({
  char, nextChar, hideCount = 1, lang = 'en',
  onScore, onClose, selBrush, selScript, sizeScale = 1, inkColor,
  penMode = 'soft', forceUniform = false,
}) {
  const hzRef = useRef(null);
  const drawRef = useRef(null);
  const writer = useRef(null);
  const [strokes, setStrokes] = useState([]);   // all stroke paths
  const [hiddenIndices, setHidden] = useState([]);
  const [hintBoxes, setHintBoxes] = useState([]);
  const [phase, setPhase] = useState('loading');  // 'loading' | 'drawing' | 'done'
  const [scoreInfo, setScoreInfo] = useState(null);

  // Timer: adaptive duration based on past performance + stroke count.
  // Full-character completion (hiding all strokes), so we budget per stroke:
  //   Fresh char (no past score):   5s per stroke
  //   Mastered (maxScore ≥ 80):     3s per stroke
  // Linear interpolation between. Floor at 10s total.
  const pastMax = char?.c ? (readCharacterProgress()[char.c]?.maxScore || 0) : 0;
  const strokeCount = char?.strokes || char?.stroke_count || hideCount || 5;
  const secondsPerStroke = pastMax >= 80 ? 3 : pastMax <= 0 ? 5 : (5 - (pastMax / 80) * 2);
  const totalTime = Math.max(10, Math.round(strokeCount * secondsPerStroke));
  const [timeLeft, setTimeLeft] = useState(totalTime);

  const painting = useRef(false);
  const last = useRef({ x:0, y:0, t:0 });

  // Set up HanziWriter: load char, hide chosen strokes
  useEffect(() => {
    if (!hzRef.current || !char?.c) return;
    hzRef.current.innerHTML = '';
    setPhase('loading');
    setScoreInfo(null);
    setTimeLeft(totalTime);     // reset countdown for new char

    // Clear draw canvas
    const dc = drawRef.current;
    if (dc) dc.getContext('2d').clearRect(0, 0, S, S);

    HanziWriter.loadCharacterData(char.c).then(data => {
      if (!data || !data.strokes) {
        setPhase('done');
        return;
      }
      // Full-character completion: hide ALL strokes. User draws every one.
      // hideCount prop is ignored — the adaptive difficulty lives in the
      // timer duration, not in how many strokes are hidden.
      const total = data.strokes.length;
      const hide = Array.from({ length: total }, (_, i) => i);
      setStrokes(data.strokes);
      setHidden(hide);

      // Build bounding boxes for hidden strokes (for glow hints)
      const boxes = hide.map(i => {
        const bb = getStrokeBoundingBox(data.strokes[i]);
        if (!bb) return null;
        // Add padding
        return { x: bb.x - 8, y: bb.y - 8, w: bb.w + 16, h: bb.h + 16 };
      }).filter(Boolean);
      setHintBoxes(boxes);

      // Create HanziWriter with all strokes visible except hidden ones
      const w = HanziWriter.create(hzRef.current, char.c, {
        width: S, height: S, padding: 20,
        showOutline: false, showCharacter: true,
        strokeColor: '#5D2E0C', drawingColor: '#1a0a05',
        charDataLoader: (ch, onComplete) => onComplete(data),
      });
      writer.current = w;

      // Hide the chosen strokes
      w.hideCharacter().then(() => {
        // Show only non-hidden strokes
        for (let i = 0; i < total; i++) {
          if (!hide.includes(i)) w.animateStroke(i, { duration: 0 });
        }
        setPhase('drawing');
      });
    }).catch(() => setPhase('done'));

    return () => { try { writer.current?.hideCharacter(); } catch {} };
  }, [char?.c, hideCount]);

  // User draws on overlay canvas
  useEffect(() => {
    const c = drawRef.current;
    if (!c || phase !== 'drawing') return;

    const getPos = e => {
      const r = c.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (S / r.width), y: (e.clientY - r.top) * (S / r.height) };
    };
    const onStart = e => {
      e.preventDefault();
      try { c.setPointerCapture(e.pointerId); } catch {}
      painting.current = true;
      const p = getPos(e);
      last.current = { ...p, t: Date.now() };
      const ctx = c.getContext('2d');
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.5, selBrush.baseW * sizeScale * 0.38), 0, Math.PI * 2);
      ctx.fillStyle = inkColor || selBrush.color;
      ctx.fill();
    };
    const onMove = e => {
      if (!painting.current) return;
      e.preventDefault();
      const p = getPos(e), now = Date.now();
      const dx = p.x - last.current.x, dy = p.y - last.current.y;
      const speed = Math.sqrt(dx*dx + dy*dy) / Math.max(now - last.current.t, 1);
      drawBrushStroke(c.getContext('2d'), selBrush, last.current, p, speed, sizeScale, inkColor, penMode === 'hard' && forceUniform);
      last.current = { ...p, t: now };
    };
    const onEnd = e => {
      if (!painting.current) return;
      painting.current = false;
      try { c.releasePointerCapture(e.pointerId); } catch {}
    };
    c.addEventListener('pointerdown', onStart);
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerup', onEnd);
    c.addEventListener('pointercancel', onEnd);
    c.addEventListener('pointerleave', onEnd);
    return () => {
      c.removeEventListener('pointerdown', onStart);
      c.removeEventListener('pointermove', onMove);
      c.removeEventListener('pointerup', onEnd);
      c.removeEventListener('pointercancel', onEnd);
      c.removeEventListener('pointerleave', onEnd);
    };
  }, [phase, selBrush, sizeScale, inkColor, penMode, forceUniform]);

  // User clicks Complete -> score by IoU between user ink and the hidden stroke bounding boxes
  const onComplete = useCallback(() => {
    const c = drawRef.current;
    if (!c || hintBoxes.length === 0) return;

    const userData = c.getContext('2d').getImageData(0, 0, S, S).data;

    // Build mask of hidden-stroke regions
    let totalRegionPixels = 0, userInRegion = 0, userTotal = 0;

    for (let i = 3, idx = 0; i < userData.length; i += 4, idx++) {
      const hasInk = userData[i] > 40;
      if (hasInk) userTotal++;
      // Check if this pixel is inside any hint box
      const px = idx % S, py = Math.floor(idx / S);
      let inRegion = false;
      for (const box of hintBoxes) {
        if (px >= box.x && px < box.x + box.w && py >= box.y && py < box.y + box.h) {
          inRegion = true; break;
        }
      }
      if (inRegion) totalRegionPixels++;
      if (inRegion && hasInk) userInRegion++;
    }

    const coverage = totalRegionPixels > 0 ? userInRegion / totalRegionPixels : 0;
    const precision = userTotal > 0 ? userInRegion / userTotal : 0;
    const score = Math.round(100 * (coverage * 0.6 + precision * 0.4));

    const info = { score, coverage, precision };
    setScoreInfo(info);
    onScore?.(char?.c, score);
    setPhase('done');
  }, [hintBoxes, char, onScore]);

  // Countdown tick (only while in drawing phase)
  useEffect(() => {
    if (phase !== 'drawing') return;
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 0.1) { clearInterval(id); return 0; }
        return t - 0.1;
      });
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  // Auto-submit when timer hits zero (fires onComplete with whatever the user
  // has drawn — that's the "fixed time to fill in" model)
  useEffect(() => {
    if (phase === 'drawing' && timeLeft <= 0) onComplete();
  }, [phase, timeLeft, onComplete]);

  // Read past progress to explain adaptive difficulty. Now full-character mode,
  // so adaptation happens in timer duration, not in how many strokes are hidden.
  const pastProgress = char?.c ? readCharacterProgress()[char.c] : null;
  const adaptiveReason = (() => {
    if (!pastProgress) return lang === 'zh' ? `初次练习 · ${strokeCount}笔全字` :
                               lang === 'it' ? `Prima volta · ${strokeCount} tratti` :
                               `First time · ${strokeCount} strokes`;
    const m = pastProgress.maxScore || 0;
    const zh = `最高 ${m}分 → ${strokeCount}笔 · ${totalTime}秒`;
    const it = `Max ${m} → ${strokeCount} tratti · ${totalTime}s`;
    const en = `Max ${m} → ${strokeCount} strokes · ${totalTime}s`;
    return lang === 'zh' ? zh : lang === 'it' ? it : en;
  })();

  // Actual hidden count (becomes known after HanziWriter loads).
  // Defaults to the metadata stroke count while loading.
  const shownStrokeCount = hiddenIndices.length || strokeCount;

  return (
    <div style={{ width: '100%', maxWidth: 320, margin: '0 auto' }}>

      <div style={{ padding: '8px 12px', margin: '0 0 8px', background: 'rgba(106,27,154,0.08)', border: '1.5px solid #6A1B9A', borderRadius: 10, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: '#6A1B9A' }}>
          {lang === 'zh' ? `补齐全字 (${shownStrokeCount} 笔)` :
           lang === 'it' ? `Completa il carattere (${shownStrokeCount} tratti)` :
           `Complete the character (${shownStrokeCount} strokes)`}
          {phase === 'drawing' && (
            <span style={{ marginLeft: 8, fontWeight: 600 }}>· {Math.ceil(timeLeft)}s</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: '#6A1B9A', opacity: 0.75, marginTop: 2, display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center' }}>
          <span>✨</span><span>{adaptiveReason}</span>
        </div>
      </div>

      {/* Timer bar */}
      {phase === 'drawing' && (() => {
        const pct = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
        const c = pct > 50 ? '#6A1B9A' : pct > 25 ? '#F9A825' : '#C62828';
        return (
          <div style={{ height: 5, background: '#ece0f2', borderRadius: 3, margin: '0 0 6px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: c, transition: 'width 100ms linear, background 200ms' }}/>
          </div>
        );
      })()}

      <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: '#fdf6e3', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(139,69,19,0.2)' }}>
        {/* HanziWriter layer (visible strokes) */}
        <div ref={hzRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />

        {/* Hint box glow for hidden strokes */}
        {phase === 'drawing' && hintBoxes.map((box, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${(box.x/S)*100}%`, top: `${(box.y/S)*100}%`,
            width: `${(box.w/S)*100}%`, height: `${(box.h/S)*100}%`,
            border: '2px dashed #6A1B9A', borderRadius: 6,
            background: 'rgba(106,27,154,0.05)',
            boxShadow: '0 0 12px rgba(106,27,154,0.35), inset 0 0 12px rgba(106,27,154,0.15)',
            animation: 'hintPulse 1.8s ease-in-out infinite',
            zIndex: 2, pointerEvents: 'none',
          }} />
        ))}

        {/* Draw canvas on top */}
        <canvas ref={drawRef} width={S} height={S} style={{
          position: 'absolute', inset: 0, zIndex: 3,
          width: '100%', height: '100%', display: 'block',
          touchAction: 'none', cursor: phase === 'drawing' ? 'crosshair' : 'default',
          pointerEvents: phase === 'drawing' ? 'all' : 'none',
        }} />

        <style>{`
          @keyframes hintPulse {
            0%, 100% { box-shadow: 0 0 12px rgba(106,27,154,0.35), inset 0 0 12px rgba(106,27,154,0.15); }
            50%     { box-shadow: 0 0 20px rgba(106,27,154,0.6), inset 0 0 20px rgba(106,27,154,0.3); }
          }
        `}</style>

        {/* Score overlay */}
        {scoreInfo && phase === 'done' && (() => {
          const lvl = scoreInfo.score >= 70 ? 'great' : scoreInfo.score >= 50 ? 'good' : 'practice';
          const c = lvl==='great' ? '#2E7D32' : lvl==='good' ? '#E65100' : '#C62828';
          return (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(253,246,227,0.97)', border: `1.5px solid ${c}`, borderRadius: 12, padding: '6px 14px', zIndex: 5, display: 'flex', gap: 8, alignItems: 'center', color: c }}>
              <span style={{ fontSize: 22, fontWeight: 700 }}>{scoreInfo.score}</span>
              <span style={{ fontSize: 10 }}>{lang === 'zh' ? '覆盖' : 'cov'} {Math.round(scoreInfo.coverage*100)}%</span>
            </div>
          );
        })()}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center' }}>
        {phase === 'drawing' && (
          <button onClick={onComplete} style={{ flex: 1, padding: '10px 16px', borderRadius: 10, background: '#6A1B9A', color: '#fdf6e3', border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            {lang === 'zh' ? '完成 ✓' : lang === 'it' ? 'Completo ✓' : 'Complete ✓'}
          </button>
        )}
        {phase === 'done' && (
          <button onClick={() => nextChar?.()} style={{ flex: 1, padding: '10px 16px', borderRadius: 10, background: '#8B4513', color: '#fdf6e3', border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            {lang === 'zh' ? '下一个 →' : 'Next →'}
          </button>
        )}
        <button onClick={onClose} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--card)', border: '0.5px solid var(--border)', fontSize: 13, cursor: 'pointer' }}>
          {lang === 'zh' ? '退出' : 'Exit'}
        </button>
      </div>
    </div>
  );
}

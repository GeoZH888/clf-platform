// src/components/modes/DictationMode.jsx
// Mode 6A: Timed Dictation
//
// Shows hint (pinyin/meaning), hides character glyph, user draws from memory
// within time limit. Score via computeScore, auto-advance to next char.
//
// Props:
//   char           { c, p, m, mi, mz, strokes }  — current character
//   nextChar       () => char                    — function returning next char
//   hintMode       'both' | 'pinyin' | 'meaning' — from settings
//   lang           'zh' | 'en' | 'it'
//   onScore        (char, score) => void         — callback for each completed attempt
//   onClose        () => void                    — user exits mode
//   selBrush       brush object
//   selScript      script object (for font rendering at reveal)
//   sizeScale      1
//   inkColor       string

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { drawBrushStroke } from '../BrushSelector.jsx';
import { readCharacterProgress } from '../../hooks/useCharacterProgress.js';

const S = 300;

// Calculate adaptive time based on stroke count
function calcDuration(strokes) {
  return Math.max(8, (strokes || 5) * 2.5);  // min 8s, +2.5s per stroke
}

// IoU scoring — compare user ink to target character raster
function scoreDrawing(userCanvas, char, fontCss) {
  if (!char) return null;
  const off = document.createElement('canvas');
  off.width = S; off.height = S;
  const ctx = off.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `230px ${fontCss || "'STKaiti','KaiTi',serif"}`;
  ctx.fillText(char, S/2, S/2+6);
  const guide = ctx.getImageData(0,0,S,S).data;
  const user = userCanvas.getContext('2d').getImageData(0,0,S,S).data;

  let up = 0, gp = 0, ov = 0;
  for (let i = 3; i < user.length; i += 4) {
    const u = user[i] > 40, g = guide[i] > 128;
    if (u) up++; if (g) gp++; if (u && g) ov++;
  }
  if (gp < 100) return { score: 0, coverage: 0, precision: 0 };
  const coverage  = Math.min(1, ov / gp);
  const precision = up > 0 ? ov / up : 0;
  const score = Math.round(100 * (coverage * 0.7 + precision * 0.3));
  return { score, coverage, precision };
}

export default function DictationMode({
  char, nextChar, hintMode = 'both', lang = 'en',
  onScore, onClose, selBrush, selScript, sizeScale = 1, inkColor,
  penMode = 'soft', forceUniform = false,
}) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('prompt');  // 'prompt' | 'drawing' | 'reveal'
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [scoreInfo, setScoreInfo] = useState(null);

  const painting = useRef(false);
  const last = useRef({ x:0, y:0, t:0 });

  // Setup new char
  useEffect(() => {
    if (!char?.c) return;
    setScoreInfo(null);
    const dur = calcDuration(char.strokes || char.stroke_count);
    setTotalTime(dur);
    setTimeLeft(dur);
    setPhase('prompt');
    // Clear canvas
    const c = canvasRef.current;
    if (c) c.getContext('2d').clearRect(0, 0, S, S);

    // Brief "prompt" phase (1s) before drawing starts
    const promptTimer = setTimeout(() => setPhase('drawing'), 1000);
    return () => clearTimeout(promptTimer);
  }, [char?.c]);

  // Countdown
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

  // Time up → reveal and score
  useEffect(() => {
    if (phase !== 'drawing' || timeLeft > 0) return;
    // Score now
    const canvas = canvasRef.current;
    if (canvas && char?.c) {
      const info = scoreDrawing(canvas, char.c, selScript?.css);
      if (info) {
        setScoreInfo(info);
        onScore?.(char.c, info.score);
      }
    }
    setPhase('reveal');
  }, [phase, timeLeft, char, selScript, onScore]);

  // Canvas pointer events (only when drawing)
  useEffect(() => {
    const c = canvasRef.current;
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

  // Build hint text based on mode
  const hint = (() => {
    const pinyin = char?.p || char?.pinyin || '';
    const meaning = lang === 'zh' ? (char?.mz || char?.meaning_zh)
                  : lang === 'it' ? (char?.mi || char?.meaning_it)
                  : (char?.m || char?.meaning_en);
    if (hintMode === 'pinyin') return { primary: pinyin, secondary: null };
    if (hintMode === 'meaning') return { primary: meaning, secondary: null };
    return { primary: pinyin, secondary: meaning };
  })();

  const pct = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
  const timeColor = pct > 50 ? '#2E7D32' : pct > 25 ? '#F9A825' : '#C62828';

  // Read past progress for this char to show adaptive status
  const pastProgress = char?.c ? readCharacterProgress()[char.c] : null;

  return (
    <div style={{ width: '100%', maxWidth: 320, margin: '0 auto' }}>
      {/* Hint banner */}
      <div style={{
        padding: '10px 14px', margin: '0 0 8px',
        background: 'rgba(139,69,19,0.08)', border: '1.5px solid #8B4513',
        borderRadius: 12, textAlign: 'center',
      }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#8B4513', letterSpacing: 1 }}>
          {hint.primary || '—'}
        </div>
        {hint.secondary && (
          <div style={{ fontSize: 12, color: '#5D2E0C', marginTop: 2 }}>
            {hint.secondary}
          </div>
        )}
        {/* ── Adaptive status: shows user this system tracks their progress ── */}
        <div style={{ fontSize: 10, color: '#a07850', marginTop: 4, display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
          <span>✨</span>
          {pastProgress ? (
            <span>
              {lang === 'zh' ? `已练 ${pastProgress.practiced} 次 · 最高 ${pastProgress.maxScore}分 · ${Math.round(totalTime)}秒` :
               lang === 'it' ? `Praticato ${pastProgress.practiced}× · max ${pastProgress.maxScore} · ${Math.round(totalTime)}s` :
               `Practiced ${pastProgress.practiced}× · max ${pastProgress.maxScore} · ${Math.round(totalTime)}s`}
            </span>
          ) : (
            <span>
              {lang === 'zh' ? `初次练习 · ${Math.round(totalTime)}秒` :
               lang === 'it' ? `Prima volta · ${Math.round(totalTime)}s` :
               `First time · ${Math.round(totalTime)}s`}
            </span>
          )}
        </div>
      </div>

      {/* Timer bar */}
      {phase === 'drawing' && (
        <div style={{ height: 6, background: '#f0e6d2', borderRadius: 3, margin: '0 0 6px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: timeColor, transition: 'width 100ms linear, background 200ms',
          }} />
        </div>
      )}

      {/* Canvas */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: '#fdf6e3', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(139,69,19,0.2)' }}>
        <canvas ref={canvasRef} width={S} height={S} style={{
          width: '100%', height: '100%', display: 'block',
          touchAction: 'none', cursor: phase === 'drawing' ? 'crosshair' : 'default',
          pointerEvents: phase === 'drawing' ? 'all' : 'none',
        }} />

        {/* Phase overlays */}
        {phase === 'prompt' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(253,246,227,0.8)', fontSize: 24, color: '#8B4513' }}>
            {lang === 'zh' ? '准备…' : lang === 'it' ? 'Pronti…' : 'Ready…'}
          </div>
        )}

        {phase === 'reveal' && char?.c && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{
              fontSize: 220, fontFamily: selScript?.css || "'STKaiti','KaiTi',serif",
              color: 'rgba(139,69,19,0.35)',
            }}>
              {char.c}
            </div>
          </div>
        )}

        {/* Score overlay */}
        {scoreInfo && phase === 'reveal' && (() => {
          const lvl = scoreInfo.score >= 80 ? 'great' : scoreInfo.score >= 60 ? 'good' : scoreInfo.score >= 40 ? 'fair' : 'practice';
          const c = lvl==='great' ? '#2E7D32' : lvl==='good' ? '#558B2F' : lvl==='fair' ? '#E65100' : '#C62828';
          return (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(253,246,227,0.97)', border: `1.5px solid ${c}`, borderRadius: 12, padding: '6px 14px', display: 'flex', gap: 8, alignItems: 'center', color: c }}>
              <span style={{ fontSize: 22, fontWeight: 700 }}>{scoreInfo.score}</span>
              <span style={{ fontSize: 10, opacity: 0.7 }}>
                {lang === 'zh' ? '覆盖' : 'cov'} {Math.round(scoreInfo.coverage*100)}%
              </span>
            </div>
          );
        })()}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center' }}>
        {phase === 'reveal' && (
          <button onClick={() => nextChar?.()} style={{ flex: 1, padding: '10px 16px', borderRadius: 10, background: '#8B4513', color: '#fdf6e3', border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            {lang === 'zh' ? '下一个 →' : lang === 'it' ? 'Prossimo →' : 'Next →'}
          </button>
        )}
        <button onClick={onClose} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--card)', border: '0.5px solid var(--border)', fontSize: 13, cursor: 'pointer' }}>
          {lang === 'zh' ? '退出' : 'Exit'}
        </button>
      </div>
    </div>
  );
}

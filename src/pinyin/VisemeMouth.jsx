// src/pinyin/VisemeMouth.jsx
// Real-time animated side-profile mouth SVG driven by Azure viseme IDs.
// Drop-in replacement for MouthDiagramSide when used with useAzureViseme().
//
// Props:
//   visemeId   (number 0-21)  — current viseme from Azure, updates ~30ms
//   speaking   (bool)         — true while TTS is playing
//   baseSound  (string)       — static sound key for idle state (e.g. 'b')
//   color      (string)       — accent hex color
//   size       (number)       — SVG width in px (default 260)
//   showLabel  (bool)         — show viseme label badge

import { useEffect, useRef, useState } from 'react';
import { VISEME_SHAPES } from '../hooks/useAzureViseme';

// ── Linear interpolation helper ───────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }

// ── Smooth shape interpolation ────────────────────────────────────────────────
// We keep a "displayed shape" that smoothly chases the "target shape"
// so mouth movements look fluid rather than frame-snapping.
function interpShape(current, target, speed = 0.28) {
  return {
    lipGap:      lerp(current.lipGap,      target.lipGap,      speed),
    tongueY:     lerp(current.tongueY,     target.tongueY,     speed),
    tongueX:     lerp(current.tongueX,     target.tongueX,     speed),
    tongueCurve: lerp(current.tongueCurve, target.tongueCurve, speed),
    rounded:     target.rounded,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The SVG renderer — same anatomical structure as MouthDiagramSide
// but all geometry is derived from a single `shape` object that
// updates every animation frame.
// ─────────────────────────────────────────────────────────────────────────────
function SideProfileSVG({ shape, color, size, speaking }) {
  const W = size, H = size * 0.88;
  const cx = W * 0.52, cy = H * 0.5;
  const hr = W * 0.38, vr = H * 0.44;

  const gapPx      = shape.lipGap * (size / 60);
  const lipMidX    = cx + hr * 0.52;
  const lipY       = cy + H * 0.04;
  const upperLipY  = lipY - gapPx;
  const lowerLipY  = lipY + gapPx;

  // Tongue geometry from shape
  const tongueBaseX = cx - hr * 0.5;
  const tongueBaseY = cy + H * 0.22;
  const tongueTipX  = tongueBaseX + (shape.tongueX / 100) * hr * 1.1;
  const tongueTopY  = tongueBaseY - (shape.tongueY / 100) * H * 0.32;
  const tongueCtrlY = tongueTopY  + (shape.tongueCurve / 100) * H * 0.1;
  const hardPalateY = cy - H * 0.08;

  // Lip width — rounded sounds protrude the lips forward (visually narrows gap)
  const lipProtrudeX = shape.rounded ? W * 0.025 : 0;

  // Airflow particles only while speaking
  const showAir = speaking && shape.lipGap > 0.3;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxWidth: size }}>
      <defs>
        <radialGradient id="vm-skin" cx="44%" cy="42%" r="56%">
          <stop offset="0%" stopColor="#FDECD6" />
          <stop offset="100%" stopColor="#F5C89B" />
        </radialGradient>
        <radialGradient id="vm-mouth" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#E8939A" />
          <stop offset="100%" stopColor="#C0454E" />
        </radialGradient>
        <linearGradient id="vm-tongue" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F06292" />
          <stop offset="100%" stopColor="#E91E63" />
        </linearGradient>
        <linearGradient id="vm-nasal" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E8EEF2" />
          <stop offset="100%" stopColor="#CFD8DC" />
        </linearGradient>
        {showAir && (
          <style>{`
            @keyframes vm-air {
              0%   { transform:translateX(0); opacity:0.85; }
              100% { transform:translateX(${size * 0.22}px); opacity:0; }
            }
            .vm-air-p { animation: vm-air 1.1s ease-out infinite; }
          `}</style>
        )}
      </defs>

      {/* Head */}
      <ellipse cx={cx} cy={cy} rx={hr} ry={vr}
        fill="url(#vm-skin)" stroke="#EAAA70" strokeWidth="1.5" />

      {/* Nasal cavity */}
      <path d={`M ${cx-hr*0.3} ${cy-vr*0.55}
                Q ${cx+hr*0.1} ${cy-vr*0.7} ${cx+hr*0.38} ${cy-vr*0.45}
                Q ${cx+hr*0.42} ${cy-vr*0.2} ${cx+hr*0.35} ${cy-vr*0.05}
                Q ${cx+hr*0.1} ${cy-vr*0.18} ${cx-hr*0.28} ${cy-vr*0.12} Z`}
        fill="url(#vm-nasal)" stroke="#B0BEC5" strokeWidth="1.2" />
      <text x={cx+hr*0.05} y={cy-vr*0.42} textAnchor="middle"
        fontSize={size*0.042} fill="#546E7A" fontFamily="sans-serif">鼻腔</text>

      {/* Mouth interior */}
      {shape.lipGap > 0.2 && (
        <path d={`M ${cx-hr*0.3} ${cy-H*0.04}
                  Q ${cx+hr*0.1} ${cy+H*0.05} ${lipMidX} ${lipY}
                  Q ${cx+hr*0.1} ${cy+H*0.12} ${cx-hr*0.32} ${cy+H*0.14} Z`}
          fill="url(#vm-mouth)" opacity={Math.min(0.8, shape.lipGap * 0.2)} />
      )}

      {/* Hard palate */}
      <path d={`M ${cx-hr*0.28} ${hardPalateY}
                Q ${cx+hr*0.1} ${hardPalateY-H*0.04} ${cx+hr*0.42} ${cy-H*0.05}`}
        fill="none" stroke="#BDBDBD" strokeWidth="2" strokeLinecap="round" />
      {/* Soft palate */}
      <path d={`M ${cx-hr*0.28} ${hardPalateY}
                Q ${cx-hr*0.35} ${cy+H*0.02} ${cx-hr*0.28} ${cy+H*0.1}`}
        fill="none" stroke="#EF9A9A" strokeWidth="2" strokeLinecap="round" />

      {/* Tongue */}
      <path d={`M ${tongueBaseX-W*0.06} ${tongueBaseY+H*0.04}
                Q ${tongueBaseX} ${tongueBaseY}
                  ${(tongueBaseX+tongueTipX)/2} ${tongueCtrlY}
                Q ${tongueTipX-W*0.02} ${tongueTopY-H*0.01}
                  ${tongueTipX} ${tongueTopY}
                Q ${tongueTipX-W*0.01} ${tongueTopY+H*0.05}
                  ${tongueTipX} ${tongueTopY+H*0.1}
                Q ${(tongueBaseX+tongueTipX)/2} ${tongueBaseY+H*0.08}
                  ${tongueBaseX-W*0.06} ${tongueBaseY+H*0.09} Z`}
        fill="url(#vm-tongue)" stroke="#C2185B" strokeWidth="0.8" opacity="0.92" />

      {/* Upper lip */}
      <path d={`M ${cx+hr*0.2} ${upperLipY-H*0.04}
                Q ${lipMidX-W*0.05+lipProtrudeX} ${upperLipY-H*0.01}
                  ${lipMidX+lipProtrudeX} ${upperLipY}`}
        fill="none" stroke="#E57373" strokeWidth={size*0.022} strokeLinecap="round" />
      {/* Lower lip */}
      <path d={`M ${cx+hr*0.22} ${lowerLipY+H*0.04}
                Q ${lipMidX-W*0.05+lipProtrudeX} ${lowerLipY+H*0.01}
                  ${lipMidX+lipProtrudeX} ${lowerLipY}`}
        fill="none" stroke="#C62828" strokeWidth={size*0.022} strokeLinecap="round" />

      {/* Nose bump */}
      <path d={`M ${cx+hr*0.3} ${cy-vr*0.15}
                Q ${cx+hr*0.48} ${cy-vr*0.2} ${cx+hr*0.5} ${cy-vr*0.08}
                Q ${cx+hr*0.44} ${cy-vr*0.04} ${cx+hr*0.38} ${cy-vr*0.05}`}
        fill="#F5C89B" stroke="#EAAA70" strokeWidth="1" />
      <circle cx={cx+hr*0.44} cy={cy-vr*0.1} r={size*0.015}
        fill="#D4956A" opacity="0.6" />

      {/* Airflow particles */}
      {showAir && [0, 0.3, 0.6, 0.9].map((d, i) => (
        <ellipse key={i}
          cx={lipMidX + lipProtrudeX + W * 0.01}
          cy={lipY + (i - 1.5) * H * 0.022}
          rx={size * 0.01} ry={size * 0.007}
          fill={color} opacity="0.8"
          className="vm-air-p"
          style={{ animationDelay: `${d}s` }} />
      ))}

      {/* Accent dot */}
      <circle cx={W*0.88} cy={H*0.1} r={size*0.028} fill={color} opacity={speaking ? 1 : 0.4} />

      {/* Speaking pulse ring */}
      {speaking && (
        <circle cx={W*0.88} cy={H*0.1} r={size*0.028} fill="none"
          stroke={color} strokeWidth="2" opacity="0.5">
          <animate attributeName="r" values={`${size*0.028};${size*0.05};${size*0.028}`}
            dur="1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0;0.5" dur="1s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public component: VisemeMouth
// ─────────────────────────────────────────────────────────────────────────────
export default function VisemeMouth({
  visemeId  = 0,
  speaking  = false,
  color     = '#1E88E5',
  size      = 260,
  showLabel = true,
}) {
  // Smoothly interpolate displayed shape toward target shape each frame
  const targetShape  = VISEME_SHAPES[visemeId] ?? VISEME_SHAPES[0];
  const displayRef   = useRef({ ...VISEME_SHAPES[0] });
  const [shape, setShape] = useState({ ...VISEME_SHAPES[0] });
  const rafRef       = useRef(null);

  useEffect(() => {
    function tick() {
      const current = displayRef.current;
      const next    = interpShape(current, targetShape, speaking ? 0.35 : 0.15);
      displayRef.current = next;
      setShape({ ...next });
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [targetShape, speaking]);

  const label = VISEME_SHAPES[visemeId]?.label ?? '';

  return (
    <div style={{
      background: 'linear-gradient(135deg, #FAFAFA 0%, #F0F4FF 100%)',
      borderRadius: 18,
      padding: '10px 10px 8px',
      border: `2px solid ${color}${speaking ? '88' : '33'}`,
      boxShadow: `0 4px 18px ${color}${speaking ? '33' : '15'}`,
      textAlign: 'center',
      maxWidth: size + 20,
      position: 'relative',
      overflow: 'hidden',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at 70% 40%, ${color}${speaking ? '18' : '08'}, transparent 65%)`,
        pointerEvents: 'none',
        transition: 'background 0.3s',
      }} />

      <SideProfileSVG shape={shape} color={color} size={size} speaking={speaking} />

      {/* Viseme label */}
      {showLabel && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          marginTop: 6,
          background: speaking ? color : color + '22',
          color: speaking ? '#fff' : color,
          borderRadius: 20, padding: '3px 12px',
          fontSize: size * 0.048, fontWeight: 600,
          transition: 'all 0.2s',
          minWidth: 80, justifyContent: 'center',
        }}>
          {speaking
            ? <><span style={{ fontSize: 11 }}>▶</span> {label || '…'}</>
            : <span>🎙 准备</span>}
        </div>
      )}
    </div>
  );
}

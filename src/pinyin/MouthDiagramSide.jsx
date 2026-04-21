// src/pinyin/MouthDiagramSide.jsx
// Beautiful animated side-profile (侧面口型) diagrams for all pinyin sounds
// Features: scalable SVG, animated airflow particles, tongue position, lip shape
import { useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Mouth profile data for each articulation type
// Each entry defines:
//   lipGap: 0=closed, 1=slightly open, 2=open, 3=wide
//   tongueY: 0=low flat, 50=mid, 90=raised to palate
//   tongueX: 0=back, 50=mid, 90=front
//   tongueCurve: how arched the tongue is
//   airflow: 'front'|'nasal'|'side'|'none'
//   palateTouchX: if tongue touches palate, where (0-100)
//   label: Chinese label
//   color: accent color
// ─────────────────────────────────────────────────────────────────────────────
const PROFILES = {
  // ── Finals ───────────────────────────────────────────────────────────────
  a: {
    label: 'a  广口，舌低平', sounds: ['a','ā','á','ǎ','à'],
    lipGap: 3, tongueY: 5, tongueX: 50, tongueCurve: 0,
    airflow: 'front', color: '#E53935',
    desc: '嘴巴大开，舌头低平',  descEn: 'Wide open, tongue low and flat'
  },
  o: {
    label: 'o  圆唇，舌后中', sounds: ['o'],
    lipGap: 2, tongueY: 35, tongueX: 20, tongueCurve: 30,
    airflow: 'front', color: '#F4511E',
    desc: '嘴唇圆形，舌体后中', descEn: 'Round lips, tongue back-mid'
  },
  e: {
    label: 'e  半开，舌后中', sounds: ['e'],
    lipGap: 2, tongueY: 40, tongueX: 25, tongueCurve: 20,
    airflow: 'front', color: '#FB8C00',
    desc: '自然开口，舌后中部', descEn: 'Natural open, tongue back-mid'
  },
  i: {
    label: 'i  扁唇，舌前高', sounds: ['i','yi'],
    lipGap: 1, tongueY: 75, tongueX: 80, tongueCurve: 50,
    airflow: 'front', color: '#43A047',
    desc: '嘴唇展开，舌前高', descEn: 'Spread lips, tongue front-high'
  },
  u: {
    label: 'u  圆唇突出，舌后高', sounds: ['u','wu'],
    lipGap: 1, tongueY: 70, tongueX: 15, tongueCurve: 60,
    airflow: 'front', color: '#1E88E5',
    desc: '嘴唇圆突，舌后高', descEn: 'Protruded round lips, tongue back-high'
  },
  ü: {
    label: 'ü  圆唇，舌前高', sounds: ['ü','yu'],
    lipGap: 1, tongueY: 75, tongueX: 75, tongueCurve: 55,
    airflow: 'front', color: '#8E24AA',
    desc: '圆唇前伸，舌前高', descEn: 'Round lips forward, tongue front-high'
  },
  // ── Initials ──────────────────────────────────────────────────────────────
  b: {
    label: 'b  双唇爆破', sounds: ['b'],
    lipGap: 0, tongueY: 15, tongueX: 50, tongueCurve: 0,
    airflow: 'burst', color: '#E53935',
    desc: '双唇紧闭后爆破', descEn: 'Both lips closed, then burst'
  },
  p: {
    label: 'p  双唇送气爆破', sounds: ['p'],
    lipGap: 0, tongueY: 15, tongueX: 50, tongueCurve: 0,
    airflow: 'burstStrong', color: '#D81B60',
    desc: '双唇紧闭，送气爆破', descEn: 'Bilabial stop with aspiration'
  },
  m: {
    label: 'm  双唇鼻音', sounds: ['m'],
    lipGap: 0, tongueY: 15, tongueX: 50, tongueCurve: 0,
    airflow: 'nasal', color: '#5E35B1',
    desc: '双唇闭合，气流从鼻腔出', descEn: 'Lips closed, airflow through nose'
  },
  f: {
    label: 'f  唇齿音', sounds: ['f'],
    lipGap: 1, tongueY: 10, tongueX: 50, tongueCurve: 0,
    airflow: 'front', color: '#00897B',
    teethOnLip: true,
    desc: '上齿轻触下唇', descEn: 'Upper teeth on lower lip'
  },
  d: {
    label: 'd  舌尖爆破', sounds: ['d'],
    lipGap: 2, tongueY: 60, tongueX: 82, tongueCurve: 40,
    palateTouchX: 85, airflow: 'burst', color: '#F4511E',
    desc: '舌尖抵上齿龈爆破', descEn: 'Tongue tip alveolar stop'
  },
  t: {
    label: 't  舌尖送气爆破', sounds: ['t'],
    lipGap: 2, tongueY: 60, tongueX: 82, tongueCurve: 40,
    palateTouchX: 85, airflow: 'burstStrong', color: '#FB8C00',
    desc: '舌尖抵齿龈，送气', descEn: 'Alveolar stop with aspiration'
  },
  n: {
    label: 'n  舌尖鼻音', sounds: ['n'],
    lipGap: 2, tongueY: 60, tongueX: 82, tongueCurve: 40,
    palateTouchX: 85, airflow: 'nasal', color: '#5E35B1',
    desc: '舌尖抵齿龈，气从鼻出', descEn: 'Alveolar nasal'
  },
  l: {
    label: 'l  舌尖侧音', sounds: ['l'],
    lipGap: 2, tongueY: 65, tongueX: 82, tongueCurve: 35,
    palateTouchX: 83, airflow: 'side', color: '#1E88E5',
    desc: '舌尖抵齿龈，气从两侧流出', descEn: 'Lateral: air flows around tongue sides'
  },
  g: {
    label: 'g  舌根爆破', sounds: ['g'],
    lipGap: 2, tongueY: 70, tongueX: 15, tongueCurve: 60,
    palateTouchX: 20, airflow: 'burst', color: '#E53935',
    desc: '舌根抵软腭爆破', descEn: 'Velar stop'
  },
  k: {
    label: 'k  舌根送气爆破', sounds: ['k'],
    lipGap: 2, tongueY: 70, tongueX: 15, tongueCurve: 60,
    palateTouchX: 20, airflow: 'burstStrong', color: '#D81B60',
    desc: '舌根软腭，送气', descEn: 'Velar stop with aspiration'
  },
  h: {
    label: 'h  舌根摩擦', sounds: ['h'],
    lipGap: 2, tongueY: 60, tongueX: 20, tongueCurve: 55,
    airflow: 'front', color: '#43A047',
    desc: '舌根接近软腭，气流摩擦', descEn: 'Velar fricative'
  },
  j: {
    label: 'j  舌面前送气', sounds: ['j'],
    lipGap: 1, tongueY: 70, tongueX: 70, tongueCurve: 50,
    palateTouchX: 70, airflow: 'front', color: '#00897B',
    desc: '舌面前部接近硬腭', descEn: 'Palatal affricate (unaspirated)'
  },
  q: {
    label: 'q  舌面前送气', sounds: ['q'],
    lipGap: 1, tongueY: 70, tongueX: 70, tongueCurve: 50,
    palateTouchX: 70, airflow: 'burstStrong', color: '#0288D1',
    desc: '舌面前部接近硬腭，送气', descEn: 'Palatal affricate (aspirated)'
  },
  x: {
    label: 'x  舌面摩擦', sounds: ['x'],
    lipGap: 1, tongueY: 65, tongueX: 72, tongueCurve: 48,
    airflow: 'front', color: '#00897B',
    desc: '舌面接近硬腭，摩擦音', descEn: 'Palatal fricative'
  },
  zh: {
    label: 'zh  舌尖后卷', sounds: ['zh'],
    lipGap: 2, tongueY: 72, tongueX: 60, tongueCurve: 65,
    retroflexed: true, palateTouchX: 55, airflow: 'burst', color: '#E65100',
    desc: '舌尖上卷接近硬腭前', descEn: 'Retroflex stop (unaspirated)'
  },
  ch: {
    label: 'ch  舌尖后送气', sounds: ['ch'],
    lipGap: 2, tongueY: 72, tongueX: 60, tongueCurve: 65,
    retroflexed: true, palateTouchX: 55, airflow: 'burstStrong', color: '#F4511E',
    desc: '舌尖后卷，送气', descEn: 'Retroflex stop (aspirated)'
  },
  sh: {
    label: 'sh  卷舌摩擦', sounds: ['sh'],
    lipGap: 2, tongueY: 68, tongueX: 62, tongueCurve: 60,
    retroflexed: true, airflow: 'front', color: '#FB8C00',
    desc: '舌尖后卷，气流摩擦', descEn: 'Retroflex fricative'
  },
  r: {
    label: 'r  卷舌近音', sounds: ['r'],
    lipGap: 2, tongueY: 68, tongueX: 58, tongueCurve: 62,
    retroflexed: true, airflow: 'front', color: '#8E24AA',
    desc: '舌尖后卷，卷舌近音', descEn: 'Retroflex approximant'
  },
  z: {
    label: 'z  舌尖齿音', sounds: ['z'],
    lipGap: 2, tongueY: 62, tongueX: 85, tongueCurve: 38,
    palateTouchX: 87, airflow: 'front', color: '#43A047',
    desc: '舌尖抵上齿背，摩擦', descEn: 'Dental affricate (unaspirated)'
  },
  c: {
    label: 'c  舌尖齿送气', sounds: ['c'],
    lipGap: 2, tongueY: 62, tongueX: 85, tongueCurve: 38,
    palateTouchX: 87, airflow: 'burstStrong', color: '#1E88E5',
    desc: '舌尖齿背，送气', descEn: 'Dental affricate (aspirated)'
  },
  s: {
    label: 's  舌尖摩擦', sounds: ['s'],
    lipGap: 2, tongueY: 60, tongueX: 83, tongueCurve: 36,
    airflow: 'front', color: '#00ACC1',
    desc: '舌尖接近上齿背，摩擦', descEn: 'Dental fricative'
  },
  y: {
    label: 'y  舌面半元音', sounds: ['y'],
    lipGap: 1, tongueY: 72, tongueX: 78, tongueCurve: 52,
    airflow: 'front', color: '#43A047',
    desc: '舌面接近硬腭，半元音', descEn: 'Palatal glide'
  },
  w: {
    label: 'w  圆唇半元音', sounds: ['w'],
    lipGap: 1, tongueY: 68, tongueX: 15, tongueCurve: 58,
    airflow: 'front', color: '#1E88E5',
    desc: '圆唇，舌后高半元音', descEn: 'Labiovelar glide'
  },
};

// Map a raw sound string (b, p, zh, i, …) to a profile
export function getProfile(sound) {
  if (!sound) return null;
  const s = sound.toLowerCase().replace(/[āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ]/g, c =>
    'aaaaooooeeeeiiiiuuuuüüüü'['āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ'.indexOf(c)] || c
  );
  return PROFILES[s] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG Side-Profile Mouth Component
// ─────────────────────────────────────────────────────────────────────────────
function SideProfileSVG({ profile, size = 280, animated = true }) {
  const W = size, H = size * 0.9;
  const p = profile;

  // Derived geometry
  const cx = W * 0.52, cy = H * 0.5; // center of head
  const hr = W * 0.38, vr = H * 0.44; // head radii

  // Lip opening
  const lipMidX = cx + hr * 0.52;
  const lipY = cy + H * 0.04;
  const gapPx = [0, 4, 14, 30][p.lipGap] * (size / 200);
  const upperLipY = lipY - gapPx;
  const lowerLipY = lipY + gapPx;

  // Tongue path construction
  const tongueBaseX = cx - hr * 0.5;
  const tongueBaseY = cy + H * 0.22;
  const tongueTipX = tongueBaseX + (p.tongueX / 100) * hr * 1.1;
  const tongueTopY = tongueBaseY - (p.tongueY / 100) * H * 0.32;
  const tongueControlY = tongueTopY + (p.tongueCurve / 100) * H * 0.1;

  // Palate touch point
  const palateTouchX = p.palateTouchX
    ? tongueBaseX + (p.palateTouchX / 100) * hr * 1.1
    : null;
  const hardPalateY = cy - H * 0.08;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxWidth: size }}>
      <defs>
        {/* Skin gradient */}
        <radialGradient id="skinGrad" cx="45%" cy="42%" r="55%">
          <stop offset="0%" stopColor="#FDECD6" />
          <stop offset="100%" stopColor="#F5C89B" />
        </radialGradient>
        {/* Mouth interior */}
        <radialGradient id="mouthInt" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#E8939A" />
          <stop offset="100%" stopColor="#C0454E" />
        </radialGradient>
        {/* Tongue gradient */}
        <linearGradient id="tongueGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F06292" />
          <stop offset="100%" stopColor="#E91E63" />
        </linearGradient>
        {/* Nasal cavity */}
        <linearGradient id="nasalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={p.airflow === 'nasal' ? '#B2EBF2' : '#E8EEF2'} />
          <stop offset="100%" stopColor={p.airflow === 'nasal' ? '#80DEEA' : '#CFD8DC'} />
        </linearGradient>
        {/* Airflow particle animation */}
        {animated && (
          <>
            <style>{`
              @keyframes airFront {
                0%   { transform: translateX(0) translateY(0); opacity: 0.9; }
                100% { transform: translateX(${size * 0.25}px) translateY(0px); opacity: 0; }
              }
              @keyframes airNasal {
                0%   { transform: translateX(0) translateY(0); opacity: 0.9; }
                100% { transform: translateX(${size * 0.22}px) translateY(-${size * 0.08}px); opacity: 0; }
              }
              @keyframes airBurst {
                0%   { transform: translateX(0) scale(0.5); opacity: 1; }
                40%  { transform: translateX(${size * 0.1}px) scale(1.4); opacity: 0.8; }
                100% { transform: translateX(${size * 0.3}px) scale(0.8); opacity: 0; }
              }
              @keyframes airSide {
                0%   { transform: translateX(0) translateY(0); opacity: 0.9; }
                50%  { transform: translateX(${size * 0.08}px) translateY(-${size * 0.06}px); opacity: 0.6; }
                100% { transform: translateX(${size * 0.18}px) translateY(${size * 0.04}px); opacity: 0; }
              }
              .air-particle { animation-duration: 1.4s; animation-iteration-count: infinite; animation-timing-function: ease-out; }
              .air-front  { animation-name: airFront; }
              .air-nasal  { animation-name: airNasal; }
              .air-burst  { animation-name: airBurst; }
              .air-side   { animation-name: airSide; }
            `}</style>
          </>
        )}
        <clipPath id="headClip">
          <ellipse cx={cx} cy={cy} rx={hr + 5} ry={vr + 5} />
        </clipPath>
      </defs>

      {/* ── Head silhouette ── */}
      <ellipse cx={cx} cy={cy} rx={hr} ry={vr} fill="url(#skinGrad)" stroke="#EAAA70" strokeWidth="1.5" />

      {/* ── Nasal cavity ── */}
      <path
        d={`M ${cx - hr * 0.3} ${cy - vr * 0.55}
            Q ${cx + hr * 0.1} ${cy - vr * 0.7}
              ${cx + hr * 0.38} ${cy - vr * 0.45}
            Q ${cx + hr * 0.42} ${cy - vr * 0.2}
              ${cx + hr * 0.35} ${cy - vr * 0.05}
            Q ${cx + hr * 0.1} ${cy - vr * 0.18}
              ${cx - hr * 0.28} ${cy - vr * 0.12}
            Z`}
        fill="url(#nasalGrad)"
        stroke={p.airflow === 'nasal' ? '#26C6DA' : '#B0BEC5'}
        strokeWidth="1.2"
      />
      {/* Nasal label */}
      <text x={cx + hr * 0.05} y={cy - vr * 0.42} textAnchor="middle"
        fontSize={size * 0.042} fill="#546E7A" fontFamily="sans-serif">鼻腔</text>

      {/* ── Oral cavity (mouth interior) ── */}
      {p.lipGap > 0 && (
        <path
          d={`M ${cx - hr * 0.3} ${cy - H * 0.04}
              Q ${cx + hr * 0.1} ${cy + H * 0.05}
                ${lipMidX} ${lipY}
              Q ${cx + hr * 0.1} ${cy + H * 0.12}
                ${cx - hr * 0.32} ${cy + H * 0.14}
              Z`}
          fill="url(#mouthInt)"
          opacity="0.75"
        />
      )}

      {/* ── Hard palate ── */}
      <path
        d={`M ${cx - hr * 0.28} ${hardPalateY}
            Q ${cx + hr * 0.1} ${hardPalateY - H * 0.04}
              ${cx + hr * 0.42} ${cy - H * 0.05}`}
        fill="none" stroke="#BDBDBD" strokeWidth="2" strokeLinecap="round"
      />
      {/* Soft palate / velum */}
      <path
        d={`M ${cx - hr * 0.28} ${hardPalateY}
            Q ${cx - hr * 0.35} ${cy + H * 0.02}
              ${cx - hr * 0.28} ${cy + H * 0.1}`}
        fill="none" stroke="#EF9A9A" strokeWidth="2" strokeLinecap="round"
      />

      {/* ── Tongue ── */}
      {/* Tongue body */}
      <path
        d={`M ${tongueBaseX - W * 0.06} ${tongueBaseY + H * 0.04}
            Q ${tongueBaseX} ${tongueBaseY}
              ${(tongueBaseX + tongueTipX) / 2} ${tongueControlY}
            Q ${tongueTipX - W * 0.02} ${tongueTopY - H * 0.01}
              ${p.retroflexed ? tongueTipX - W * 0.03 : tongueTipX} 
              ${p.retroflexed ? tongueTopY + H * 0.04 : tongueTopY}
            ${p.retroflexed
              ? `Q ${tongueTipX + W * 0.01} ${tongueTopY - H * 0.04} ${tongueTipX + W * 0.02} ${tongueTopY - H * 0.02}`
              : ''}
            Q ${tongueTipX - W * 0.01} ${tongueTopY + H * 0.05}
              ${tongueTipX} ${tongueTopY + H * 0.1}
            Q ${(tongueBaseX + tongueTipX) / 2} ${tongueBaseY + H * 0.08}
              ${tongueBaseX - W * 0.06} ${tongueBaseY + H * 0.09}
            Z`}
        fill="url(#tongueGrad)"
        stroke="#C2185B"
        strokeWidth="0.8"
        opacity="0.92"
      />

      {/* Tongue touch to palate highlight */}
      {palateTouchX && (
        <circle
          cx={palateTouchX}
          cy={hardPalateY + H * 0.01}
          r={size * 0.022}
          fill={p.color}
          opacity="0.7"
        />
      )}

      {/* ── Upper / Lower Lip ── */}
      {/* Upper lip */}
      <path
        d={`M ${cx + hr * 0.2} ${upperLipY - H * 0.04}
            Q ${lipMidX - W * 0.05} ${upperLipY - H * 0.01}
              ${lipMidX} ${upperLipY}`}
        fill="none" stroke="#E57373" strokeWidth={size * 0.022} strokeLinecap="round"
      />
      {/* Lower lip */}
      <path
        d={`M ${cx + hr * 0.22} ${lowerLipY + H * 0.04}
            Q ${lipMidX - W * 0.05} ${lowerLipY + H * 0.01}
              ${lipMidX} ${lowerLipY}`}
        fill="none" stroke="#C62828" strokeWidth={size * 0.022} strokeLinecap="round"
      />

      {/* Teeth for labiodental */}
      {p.teethOnLip && (
        <>
          <rect x={lipMidX - W * 0.1} y={upperLipY - H * 0.025}
            width={W * 0.018} height={H * 0.04} rx={2} fill="#FFF9C4" stroke="#F9A825" strokeWidth="0.5" />
          <rect x={lipMidX - W * 0.075} y={upperLipY - H * 0.025}
            width={W * 0.018} height={H * 0.04} rx={2} fill="#FFF9C4" stroke="#F9A825" strokeWidth="0.5" />
        </>
      )}

      {/* ── Nose bump ── */}
      <path
        d={`M ${cx + hr * 0.3} ${cy - vr * 0.15}
            Q ${cx + hr * 0.48} ${cy - vr * 0.2}
              ${cx + hr * 0.5} ${cy - vr * 0.08}
            Q ${cx + hr * 0.44} ${cy - vr * 0.04}
              ${cx + hr * 0.38} ${cy - vr * 0.05}`}
        fill="#F5C89B" stroke="#EAAA70" strokeWidth="1"
      />
      {/* Nostril */}
      <circle cx={cx + hr * 0.44} cy={cy - vr * 0.1} r={size * 0.015}
        fill="#D4956A" opacity="0.6" />

      {/* ── Airflow particles ── */}
      {animated && p.airflow !== 'none' && (() => {
        const aClass = p.airflow === 'nasal' ? 'air-nasal'
          : p.airflow === 'burstStrong' || p.airflow === 'burst' ? 'air-burst'
          : p.airflow === 'side' ? 'air-side'
          : 'air-front';
        const isNasal = p.airflow === 'nasal';
        const isBurst = p.airflow === 'burst' || p.airflow === 'burstStrong';
        const airColor = p.airflow === 'nasal' ? '#26C6DA'
          : p.airflow === 'burstStrong' ? p.color
          : '#64B5F6';
        const airY = isNasal ? cy - vr * 0.28 : lipY - (gapPx * 0.3);
        const airX = isNasal ? cx + hr * 0.45 : lipMidX + W * 0.01;
        const delays = [0, 0.35, 0.7, 1.05];
        const spread = isBurst ? H * 0.04 : H * 0.022;

        return delays.map((d, i) => (
          <ellipse key={i}
            cx={airX} cy={airY + (i - 1.5) * spread}
            rx={isBurst ? size * 0.018 : size * 0.01}
            ry={isBurst ? size * 0.012 : size * 0.007}
            fill={airColor} opacity="0.85"
            className={`air-particle ${aClass}`}
            style={{ animationDelay: `${d}s` }}
          />
        ));
      })()}

      {/* ── Accent color dot for touch point ── */}
      <circle cx={W * 0.88} cy={H * 0.1} r={size * 0.028}
        fill={p.color} opacity="0.9" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public component: MouthDiagramSide
// Props: sound (string), lang ('zh'|'en'|'it'), size (px), animated (bool)
// ─────────────────────────────────────────────────────────────────────────────
export default function MouthDiagramSide({ sound, lang = 'zh', size = 220, animated = true }) {
  const profile = getProfile(sound);
  if (!profile) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #FAFAFA 0%, #F0F4FF 100%)',
      borderRadius: 18,
      padding: '10px 10px 8px',
      border: `2px solid ${profile.color}33`,
      boxShadow: `0 4px 16px ${profile.color}22`,
      textAlign: 'center',
      maxWidth: size + 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle background radial */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at 70% 40%, ${profile.color}0A, transparent 65%)`,
        pointerEvents: 'none',
      }} />

      {/* The SVG diagram */}
      <SideProfileSVG profile={profile} size={size} animated={animated} />

      {/* Sound label chip */}
      <div style={{
        display: 'inline-block',
        background: profile.color,
        color: '#fff',
        borderRadius: 20,
        padding: '2px 12px',
        fontSize: size * 0.052,
        fontWeight: 700,
        marginTop: 4,
        letterSpacing: 0.5,
      }}>
        {sound}
      </div>

      {/* Description */}
      <div style={{
        marginTop: 4,
        fontSize: size * 0.044,
        color: '#546E7A',
        lineHeight: 1.4,
        padding: '0 6px',
      }}>
        {lang === 'zh' ? profile.desc : lang === 'it' ? profile.desc : profile.descEn}
      </div>
    </div>
  );
}

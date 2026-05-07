// src/knowledge/KnowledgeGalaxy.jsx
// Galaxy view — atoms as stars, types as constellations.
// Brightness = mastery score. Dark background.

import React, { useState, useMemo } from 'react';

const TYPE_COLORS = {
  character: '#7dd3fc', word: '#c4b5fd', pinyin: '#67e8f9',
  grammar: '#86efac', chengyu: '#fcd34d', poem: '#f9a8d4',
  topic: '#fca5a5',
};

const TYPE_LABELS = {
  character: '汉字', word: '词语', pinyin: '拼音',
  grammar: '语法', chengyu: '成语', poem: '诗歌',
  topic: '游戏',
};

const STATE_OPACITY = {
  unseen: 0.15, exposed: 0.35, practicing: 0.55,
  mastered: 1.0, forgotten: 0.4,
};

const W = 1100;
const H = 700;

export default function KnowledgeGalaxy({ atoms }) {
  const [hovered, setHovered] = useState(null);

  // Position stars deterministically by atom id (so they don't move on re-render)
  const positioned = useMemo(() => {
    const byType = {};
    for (const a of atoms) {
      if (!byType[a.type]) byType[a.type] = [];
      byType[a.type].push(a);
    }
    const types = Object.keys(byType).sort();

    // Each type gets a constellation region
    const cols = Math.ceil(Math.sqrt(types.length));
    const rows = Math.ceil(types.length / cols);
    const cellW = W / cols;
    const cellH = H / rows;

    const out = [];
    const constellations = [];

    types.forEach((type, idx) => {
      const list = byType[type];
      const colIdx = idx % cols;
      const rowIdx = Math.floor(idx / cols);
      const cx = cellW * colIdx + cellW / 2;
      const cy = cellH * rowIdx + cellH / 2;
      constellations.push({ type, cx, cy, count: list.length });

      list.forEach((a, i) => {
        // Pseudo-random offset based on id
        const hash = hashStr(a.id);
        const angle = (hash % 1000) / 1000 * Math.PI * 2;
        const dist = (hash % 200) + 30;
        const x = cx + dist * Math.cos(angle);
        const y = cy + dist * Math.sin(angle);
        const baseSize = 2 + Math.min(4, (a.practiceCount || 0) * 0.4);
        const opacity = STATE_OPACITY[a.state] || 0.3;
        const color = TYPE_COLORS[a.type] || '#fff';
        out.push({ ...a, x, y, baseSize, opacity, color });
      });
    });
    return { stars: out, constellations };
  }, [atoms]);

  return (
    <div style={{ position: 'relative', background: '#0a0e27' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', maxHeight: 700 }}>

        {/* Background nebula gradient */}
        <defs>
          <radialGradient id="nebula1" cx="30%" cy="30%">
            <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="transparent"/>
          </radialGradient>
          <radialGradient id="nebula2" cx="70%" cy="70%">
            <stop offset="0%" stopColor="#831843" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="transparent"/>
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#nebula1)"/>
        <rect width={W} height={H} fill="url(#nebula2)"/>

        {/* Constellation labels (faint) */}
        {positioned.constellations.map(c => (
          <text key={c.type}
            x={c.cx} y={c.cy - 80}
            textAnchor="middle"
            style={{
              fontSize: 13, fontWeight: 700,
              fill: TYPE_COLORS[c.type] || '#fff',
              opacity: 0.4,
              letterSpacing: 4,
              fontFamily: "'STKaiti','KaiTi',serif",
            }}>
            {TYPE_LABELS[c.type] || c.type}
          </text>
        ))}

        {/* Stars */}
        {positioned.stars.map(a => {
          const isHovered = hovered?.id === a.id;
          return (
            <g key={a.id}
              onMouseEnter={() => setHovered(a)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}>
              {/* Glow halo */}
              <circle cx={a.x} cy={a.y} r={a.baseSize * 3}
                fill={a.color} opacity={a.opacity * 0.2}/>
              {/* Star core */}
              <circle cx={a.x} cy={a.y} r={a.baseSize}
                fill={a.color} opacity={a.opacity}
                stroke={isHovered ? '#fff' : 'none'}
                strokeWidth={isHovered ? 1.5 : 0}/>
            </g>
          );
        })}
      </svg>
      {hovered && <GalaxyTooltip atom={hovered}/>}
    </div>
  );
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function GalaxyTooltip({ atom }) {
  return (
    <div style={{
      position: 'fixed', top: 80, right: 24, zIndex: 100,
      background: '#0a0e27', border: '1px solid #1e3a8a',
      borderRadius: 8, padding: 14, minWidth: 220, maxWidth: 320,
      boxShadow: '0 4px 20px rgba(125, 211, 252, 0.3)',
      color: '#e0e7ff',
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff',
        fontFamily: "'STKaiti','KaiTi',serif", marginBottom: 6 }}>
        {atom.display_text}
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
        {TYPE_LABELS[atom.type] || atom.type} · 等级 {atom.level ?? '—'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>状态</span>
          <span style={{ fontWeight: 600 }}>{atom.state}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>掌握度</span>
          <span style={{ fontWeight: 600 }}>{(atom.mastery * 100).toFixed(0)}%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>练习次数</span>
          <span style={{ fontWeight: 600 }}>{atom.practiceCount}</span>
        </div>
      </div>
    </div>
  );
}

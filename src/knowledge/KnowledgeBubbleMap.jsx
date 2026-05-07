// src/knowledge/KnowledgeBubbleMap.jsx
// Bubble map view — atoms as circles, clustered by type.
// Static positioning (no force simulation needed for ~150 atoms).

import React, { useState, useMemo } from 'react';

const TYPE_COLORS = {
  character: '#3b82f6', word: '#8b5cf6', pinyin: '#06b6d4',
  grammar: '#10b981', chengyu: '#f59e0b', poem: '#ec4899',
  topic: '#ef4444',
};

const TYPE_LABELS = {
  character: '汉字', word: '词语', pinyin: '拼音',
  grammar: '语法', chengyu: '成语', poem: '诗歌',
  topic: '游戏',
};

const STATE_FILL = {
  unseen: '#cbd5e1', exposed: '#fde68a', practicing: '#fbbf24',
  mastered: '#10b981', forgotten: '#dc2626',
};

const W = 1100;
const H = 600;

export default function KnowledgeBubbleMap({ atoms }) {
  const [hovered, setHovered] = useState(null);

  const positioned = useMemo(() => {
    // Group by type
    const byType = {};
    for (const a of atoms) {
      if (!byType[a.type]) byType[a.type] = [];
      byType[a.type].push(a);
    }
    const types = Object.keys(byType).sort();
    const numTypes = types.length;

    // Place clusters in a grid
    const cols = Math.ceil(Math.sqrt(numTypes));
    const rows = Math.ceil(numTypes / cols);
    const cellW = W / cols;
    const cellH = H / rows;

    const out = [];
    types.forEach((type, idx) => {
      const list = byType[type];
      const colIdx = idx % cols;
      const rowIdx = Math.floor(idx / cols);
      const cx = cellW * colIdx + cellW / 2;
      const cy = cellH * rowIdx + cellH / 2;

      // Spiral atoms outward from center
      list.forEach((a, i) => {
        const r = 8 + Math.min(8, (a.practiceCount || 0) * 0.5);  // size by practice
        const angle = i * 137.5 * Math.PI / 180;  // golden angle
        const dist = 8 * Math.sqrt(i);  // spiral
        const x = cx + dist * Math.cos(angle);
        const y = cy + dist * Math.sin(angle);
        out.push({ ...a, x, y, r, clusterX: cx, clusterY: cy, clusterType: type });
      });
    });
    return { positioned: out, types, cellW, cellH, cols };
  }, [atoms]);

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', maxHeight: 700 }}>

        {/* Cluster labels */}
        {positioned.types.map((type, idx) => {
          const cols = positioned.cols;
          const cw = positioned.cellW;
          const ch = positioned.cellH;
          const colIdx = idx % cols;
          const rowIdx = Math.floor(idx / cols);
          const cx = cw * colIdx + cw / 2;
          const cyTop = ch * rowIdx + 24;
          return (
            <text key={type} x={cx} y={cyTop} textAnchor="middle"
              style={{ fontSize: 14, fontWeight: 700, fill: TYPE_COLORS[type] || '#888' }}>
              {TYPE_LABELS[type] || type}
            </text>
          );
        })}

        {/* Bubbles */}
        {positioned.positioned.map(a => (
          <g key={a.id}
            onMouseEnter={() => setHovered(a)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer' }}>
            <circle cx={a.x} cy={a.y} r={a.r}
              fill={STATE_FILL[a.state] || STATE_FILL.unseen}
              stroke={TYPE_COLORS[a.type] || '#888'}
              strokeWidth={hovered?.id === a.id ? 3 : 1.5}
              opacity={hovered && hovered.id !== a.id ? 0.5 : 0.95}/>
          </g>
        ))}
      </svg>
      {hovered && <BubbleTooltip atom={hovered}/>}
    </div>
  );
}

function BubbleTooltip({ atom }) {
  return (
    <div style={{
      position: 'fixed', top: 80, right: 24, zIndex: 100,
      background: '#fff', border: '1px solid #e8d5b0',
      borderRadius: 8, padding: 14, minWidth: 220, maxWidth: 320,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif", marginBottom: 6 }}>
        {atom.display_text}
      </div>
      <div style={{ fontSize: 11, color: '#8b6f47', marginBottom: 8 }}>
        {TYPE_LABELS[atom.type] || atom.type} · 等级 {atom.level ?? '—'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#8b6f47' }}>状态</span>
          <span style={{ fontWeight: 600 }}>{atom.state}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#8b6f47' }}>掌握度</span>
          <span style={{ fontWeight: 600 }}>{(atom.mastery * 100).toFixed(0)}%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#8b6f47' }}>练习次数</span>
          <span style={{ fontWeight: 600 }}>{atom.practiceCount}</span>
        </div>
      </div>
    </div>
  );
}

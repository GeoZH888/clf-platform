// src/knowledge/KnowledgeTreeMap.jsx
// Tree map view — atoms grouped by type, sized equally within type.
// Pure SVG, no D3 dependency.

import React, { useState } from 'react';

const TYPE_LABELS = {
  character: { label: '汉字', icon: '✍️', color: '#3b82f6' },
  word:      { label: '词语', icon: '📚', color: '#8b5cf6' },
  pinyin:    { label: '拼音', icon: '🔤', color: '#06b6d4' },
  grammar:   { label: '语法', icon: '📐', color: '#10b981' },
  chengyu:   { label: '成语', icon: '🎋', color: '#f59e0b' },
  poem:      { label: '诗歌', icon: '🪶', color: '#ec4899' },
  topic:     { label: '游戏', icon: '🏮', color: '#ef4444' },
};

const STATE_FILL = {
  unseen:     '#cbd5e1',
  exposed:    '#fde68a',
  practicing: '#fbbf24',
  mastered:   '#10b981',
  forgotten:  '#dc2626',
};

export default function KnowledgeTreeMap({ atoms }) {
  const [hovered, setHovered] = useState(null);

  // Group atoms by type
  const byType = {};
  for (const a of atoms) {
    if (!byType[a.type]) byType[a.type] = [];
    byType[a.type].push(a);
  }
  const types = Object.keys(byType).sort();

  // Layout: each type is a row. Within row, atoms wrap as squares.
  const CELL_SIZE = 40;
  const CELL_GAP = 4;
  const ROW_PADDING = 12;
  const HEADER_H = 28;

  // Estimate width — assume container is ~1100 wide (we'll use viewport)
  const containerWidth = 1100;
  const cellsPerRow = Math.floor((containerWidth - 40) / (CELL_SIZE + CELL_GAP));

  let yCursor = 0;
  const rendered = types.map(type => {
    const list = byType[type];
    const meta = TYPE_LABELS[type] || { label: type, icon: '·', color: '#888' };
    const rows = Math.ceil(list.length / cellsPerRow);
    const rowHeight = HEADER_H + rows * (CELL_SIZE + CELL_GAP) + ROW_PADDING;
    const block = (
      <g key={type} transform={`translate(0, ${yCursor})`}>
        <text x={4} y={18} style={{
          fontSize: 14, fontWeight: 700, fill: meta.color,
        }}>
          {meta.icon} {meta.label} · {list.length}
        </text>
        {list.map((a, i) => {
          const col = i % cellsPerRow;
          const row = Math.floor(i / cellsPerRow);
          const x = col * (CELL_SIZE + CELL_GAP);
          const y = HEADER_H + row * (CELL_SIZE + CELL_GAP);
          return (
            <g key={a.id} transform={`translate(${x}, ${y})`}
               onMouseEnter={() => setHovered(a)}
               onMouseLeave={() => setHovered(null)}
               style={{ cursor: 'pointer' }}>
              <rect width={CELL_SIZE} height={CELL_SIZE} rx={4}
                fill={STATE_FILL[a.state] || STATE_FILL.unseen}
                stroke={hovered?.id === a.id ? '#000' : 'none'}
                strokeWidth={hovered?.id === a.id ? 2 : 0}
                opacity={hovered && hovered.id !== a.id ? 0.7 : 1}/>
              <text x={CELL_SIZE / 2} y={CELL_SIZE / 2 + 5}
                textAnchor="middle"
                style={{
                  fontSize: a.display_text?.length > 3 ? 10 : 14,
                  fontWeight: 600,
                  fill: a.state === 'unseen' ? '#475569' : '#fff',
                  pointerEvents: 'none',
                }}>
                {(a.display_text || '').slice(0, 4)}
              </text>
            </g>
          );
        })}
      </g>
    );
    yCursor += rowHeight;
    return block;
  });

  const totalHeight = yCursor + 20;

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" height={totalHeight}
        viewBox={`0 0 ${containerWidth} ${totalHeight}`}
        preserveAspectRatio="xMinYMin meet"
        style={{ display: 'block' }}>
        {rendered}
      </svg>
      {hovered && <Tooltip atom={hovered}/>}
    </div>
  );
}

function Tooltip({ atom }) {
  return (
    <div style={{
      position: 'fixed', top: 80, right: 24, zIndex: 100,
      background: '#fff', border: '1px solid #e8d5b0',
      borderRadius: 8, padding: 14, minWidth: 220, maxWidth: 320,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#1a0a05',
        marginBottom: 6,
        fontFamily: "'STKaiti','KaiTi',serif" }}>
        {atom.display_text}
      </div>
      <div style={{ fontSize: 11, color: '#8b6f47', marginBottom: 8 }}>
        {atom.type} · 等级 {atom.level ?? '—'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
        <Row label="状态" value={atom.state}/>
        <Row label="掌握度" value={`${(atom.mastery * 100).toFixed(0)}%`}/>
        <Row label="练习次数" value={atom.practiceCount}/>
        <Row label="难度 (Elo)" value={Math.round(atom.difficulty || 0)}/>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: '#8b6f47' }}>{label}</span>
      <span style={{ color: '#1a0a05', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

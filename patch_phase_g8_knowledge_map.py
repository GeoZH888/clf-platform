# patch_phase_g8_knowledge_map.py
# Phase G.8 — Knowledge Map.
#
# 3 visualizations sharing one data feed:
#   - TreeMap (default): per-type rectangles colored by mastery state
#   - BubbleMap: clustered circles, size = practice_count, color = state
#   - GalaxyMap: stars on dark sky, brightness = mastery_score
#
# Lives at /knowledge-map. Also linked from PersonalDashboard.
# Per Q7 decision: multiple views user toggles between (localStorage).

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

KMAP_DIR = ROOT / "src" / "knowledge"
KMAP_DIR.mkdir(parents=True, exist_ok=True)

files = {}

# ============================================================
# 1. KnowledgeMap.jsx — main page with view toggle
# ============================================================
files["src/knowledge/KnowledgeMap.jsx"] = '''// src/knowledge/KnowledgeMap.jsx
// Phase G.8 — Knowledge map root component.
// Reads atoms + per-user learning state, passes to selected view.

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../school/contexts/AuthContext';
import { effectiveMastery } from '../lib/mastery';
import KnowledgeTreeMap from './KnowledgeTreeMap';
import KnowledgeBubbleMap from './KnowledgeBubbleMap';
import KnowledgeGalaxy from './KnowledgeGalaxy';

const VIEWS = [
  { id: 'tree',   label: '树状图', icon: '🌳' },
  { id: 'bubble', label: '气泡图', icon: '🫧' },
  { id: 'galaxy', label: '星系图', icon: '✨' },
];

const STORAGE_KEY = 'clf_knowledge_map_view';

export default function KnowledgeMap() {
  const { user } = useAuth();
  const [view, setView] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'tree';
  });
  const [atoms, setAtoms] = useState([]);
  const [stateMap, setStateMap] = useState({});  // atom_id -> learning_state row
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, view);
  }, [view]);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      supabase.from('clf_atoms')
        .select('id, type, display_text, level, difficulty')
        .order('type'),
      supabase.from('clf_user_learning_state')
        .select('*')
        .eq('user_id', user.id),
    ])
      .then(([atomsRes, stateRes]) => {
        if (cancelled) return;
        if (atomsRes.error) throw atomsRes.error;
        if (stateRes.error) console.warn('[KnowledgeMap] state load:', stateRes.error);
        const map = {};
        for (const row of stateRes.data || []) {
          map[row.atom_id] = row;
        }
        setAtoms(atomsRes.data || []);
        setStateMap(map);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[KnowledgeMap] load:', err);
        setError(err.message || String(err));
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [user?.id]);

  // Decorate atoms with state derived from stateMap + forgetting curve
  const decoratedAtoms = useMemo(() => {
    const now = Date.now();
    return atoms.map(a => {
      const s = stateMap[a.id];
      let stateName = 'unseen';
      let mastery = 0;
      let practiceCount = 0;
      if (s) {
        practiceCount = s.practice_count || 0;
        const eff = effectiveMastery(
          s.stored_mastery ?? s.mastery_score ?? 0,
          s.last_seen_at,
          s.stability_days ?? 1,
          now
        );
        mastery = eff;
        if (s.state) {
          stateName = s.state;
        } else if ((s.exposure_count ?? 0) === 0) {
          stateName = 'unseen';
        } else if ((s.practice_count ?? 0) === 0) {
          stateName = 'exposed';
        } else if (eff < 0.4) {
          stateName = 'forgotten';
        } else if (eff >= 0.85) {
          stateName = 'mastered';
        } else {
          stateName = 'practicing';
        }
      }
      return { ...a, state: stateName, mastery, practiceCount };
    });
  }, [atoms, stateMap]);

  if (!user?.id) {
    return (
      <Wrapper>
        <Empty icon="🔐" title="请先登录" subtitle="登录后查看你的知识地图"/>
      </Wrapper>
    );
  }
  if (loading) {
    return (
      <Wrapper>
        <div style={{ padding: 60, textAlign: 'center', color: '#8b6f47' }}>
          加载中…
        </div>
      </Wrapper>
    );
  }
  if (error) {
    return (
      <Wrapper>
        <Empty icon="⚠️" title="加载失败" subtitle={error} color="#991b1b"/>
      </Wrapper>
    );
  }
  if (atoms.length === 0) {
    return (
      <Wrapper>
        <Empty icon="🌱" title="还没有学习内容"
          subtitle="知识地图将随着你的学习逐步呈现"/>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      {/* View toggle */}
      <div style={{
        display: 'flex', gap: 8, padding: '12px 16px',
        background: '#fff', borderRadius: 10,
        border: '1px solid #e8d5b0', marginBottom: 16,
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 13, color: '#5d4630' }}>
          {atoms.length} 个学习单元 · {Object.keys(stateMap).length} 个有记录
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)} style={{
              padding: '6px 12px', borderRadius: 6, border: 'none',
              background: view === v.id ? '#c41e3a' : 'transparent',
              color: view === v.id ? '#fff' : '#5d4630',
              cursor: 'pointer', fontSize: 12,
              fontWeight: view === v.id ? 700 : 400,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <span>{v.icon}</span>{v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Selected view */}
      <div style={{
        background: view === 'galaxy' ? '#0a0e27' : '#fff',
        border: '1px solid #e8d5b0',
        borderRadius: 12,
        padding: view === 'galaxy' ? 0 : 16,
        overflow: 'hidden',
      }}>
        {view === 'tree'   && <KnowledgeTreeMap atoms={decoratedAtoms}/>}
        {view === 'bubble' && <KnowledgeBubbleMap atoms={decoratedAtoms}/>}
        {view === 'galaxy' && <KnowledgeGalaxy atoms={decoratedAtoms}/>}
      </div>

      {/* Legend */}
      <Legend/>
    </Wrapper>
  );
}

function Wrapper({ children }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(180deg, #fdf6e3 0%, #f5e6c8 100%)',
      padding: '24px 20px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          fontSize: 24, fontWeight: 700, color: '#5d4630',
          marginBottom: 4, fontFamily: "'STKaiti','KaiTi',serif",
          letterSpacing: 4,
        }}>
          知识地图
        </div>
        <div style={{ fontSize: 12, color: '#8b6f47', marginBottom: 20 }}>
          Knowledge Map · 你已掌握的内容 · 待复习 · 建议下一步
        </div>
        <button onClick={() => window.location.href = '/community'} style={{
          padding: '6px 12px', fontSize: 12,
          background: '#fff', border: '1px solid #e8d5b0',
          borderRadius: 6, color: '#5d4630', cursor: 'pointer',
          marginBottom: 16,
        }}>← 返回</button>
        {children}
      </div>
    </div>
  );
}

function Empty({ icon, title, subtitle, color = '#5d4630' }) {
  return (
    <div style={{
      padding: 60, textAlign: 'center',
      background: '#fff', border: '1px dashed #e8d5b0',
      borderRadius: 12,
    }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#8b6f47' }}>{subtitle}</div>
    </div>
  );
}

function Legend() {
  const items = [
    { color: '#10b981', label: '已掌握 mastered' },
    { color: '#fbbf24', label: '练习中 practicing' },
    { color: '#fde68a', label: '已见 exposed' },
    { color: '#dc2626', label: '需复习 forgotten' },
    { color: '#cbd5e1', label: '未学 unseen' },
  ];
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 12,
      marginTop: 16, padding: '10px 14px',
      background: '#fff', borderRadius: 8,
      border: '1px solid #e8d5b0',
      fontSize: 11, color: '#5d4630',
    }}>
      {items.map(i => (
        <div key={i.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 10, height: 10, borderRadius: 2,
            background: i.color,
            display: 'inline-block',
          }}/>
          <span>{i.label}</span>
        </div>
      ))}
    </div>
  );
}
'''

# ============================================================
# 2. KnowledgeTreeMap.jsx — squarified treemap
# ============================================================
files["src/knowledge/KnowledgeTreeMap.jsx"] = '''// src/knowledge/KnowledgeTreeMap.jsx
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
'''

# ============================================================
# 3. KnowledgeBubbleMap.jsx — clustered bubbles
# ============================================================
files["src/knowledge/KnowledgeBubbleMap.jsx"] = '''// src/knowledge/KnowledgeBubbleMap.jsx
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
'''

# ============================================================
# 4. KnowledgeGalaxy.jsx — stars on dark sky
# ============================================================
files["src/knowledge/KnowledgeGalaxy.jsx"] = '''// src/knowledge/KnowledgeGalaxy.jsx
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
'''

# ============================================================
# 5. KnowledgeMapGate.jsx — wraps in providers
# ============================================================
files["src/knowledge/KnowledgeMapGate.jsx"] = '''// src/knowledge/KnowledgeMapGate.jsx
import React from 'react';
import { AuthProvider } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import KnowledgeMap from './KnowledgeMap';

export default function KnowledgeMapGate() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <KnowledgeMap/>
      </AuthProvider>
    </LanguageProvider>
  );
}
'''

# ============================================================
# Write all files
# ============================================================
print("=== Writing knowledge map files ===")
for rel, content in files.items():
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    data = content.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
    p.write_bytes(data)
    print(f"  [OK] {rel}  ({len(data)} bytes)")

# ============================================================
# Patch App.jsx — add /knowledge-map route
# ============================================================
print("\n=== Patching App.jsx ===")
p_app = ROOT / "src" / "App.jsx"
src = p_app.read_text(encoding="utf-8")

# Edit 1: Add IS_KNOWLEDGE_MAP constant near other IS_ constants
old1 = "const IS_INTANGIBLE_HERITAGE      = window.location.pathname.startsWith('/feiyi');"
new1 = """const IS_INTANGIBLE_HERITAGE      = window.location.pathname.startsWith('/feiyi');
const IS_KNOWLEDGE_MAP            = window.location.pathname.startsWith('/knowledge-map');"""
if old1 in src and "IS_KNOWLEDGE_MAP" not in src:
    src = src.replace(old1, new1, 1)
    print("[OK] added IS_KNOWLEDGE_MAP constant")
elif "IS_KNOWLEDGE_MAP" in src:
    print("[SKIP] IS_KNOWLEDGE_MAP already present")
else:
    print("[FAIL] could not find IS_INTANGIBLE_HERITAGE anchor")

# Edit 2: Add import for KnowledgeMapGate (lazy-load not required for first version)
old2 = "import CommunityApp from './community/CommunityApp.jsx';"
new2 = """import CommunityApp from './community/CommunityApp.jsx';
import KnowledgeMapGate from './knowledge/KnowledgeMapGate.jsx';"""
if old2 in src and "KnowledgeMapGate" not in src:
    src = src.replace(old2, new2, 1)
    print("[OK] added KnowledgeMapGate import")
elif "KnowledgeMapGate" in src:
    print("[SKIP] KnowledgeMapGate import already present")
else:
    print("[FAIL] could not find CommunityApp import line")

# Edit 3: Add route branch in the ternary chain.
# Insert after IS_INTANGIBLE_HERITAGE branch
old3 = ": IS_INTANGIBLE_HERITAGE      ? <HeritageApp/>"
new3 = """: IS_INTANGIBLE_HERITAGE      ? <HeritageApp/>
        : IS_KNOWLEDGE_MAP            ? <KnowledgeMapGate/>"""
if old3 in src and "IS_KNOWLEDGE_MAP            ? <KnowledgeMapGate" not in src:
    src = src.replace(old3, new3, 1)
    print("[OK] added /knowledge-map route to ternary chain")
elif "IS_KNOWLEDGE_MAP            ? <KnowledgeMapGate" in src:
    print("[SKIP] /knowledge-map route already in ternary chain")
else:
    print("[WARN] could not find IS_INTANGIBLE_HERITAGE branch — file may have different formatting")
    print("       manual edit may be required for routing")

data = src.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
p_app.write_bytes(data)
print(f"[OK] wrote App.jsx ({len(data)} bytes)")

# ============================================================
# Verify
# ============================================================
print("\n=== Verification ===")
final = p_app.read_text(encoding="utf-8")
checks = [
    ('KnowledgeMap.jsx exists',         (KMAP_DIR / "KnowledgeMap.jsx").exists()),
    ('KnowledgeTreeMap.jsx exists',     (KMAP_DIR / "KnowledgeTreeMap.jsx").exists()),
    ('KnowledgeBubbleMap.jsx exists',   (KMAP_DIR / "KnowledgeBubbleMap.jsx").exists()),
    ('KnowledgeGalaxy.jsx exists',      (KMAP_DIR / "KnowledgeGalaxy.jsx").exists()),
    ('KnowledgeMapGate.jsx exists',     (KMAP_DIR / "KnowledgeMapGate.jsx").exists()),
    ('App.jsx: import KnowledgeMapGate', "import KnowledgeMapGate" in final),
    ('App.jsx: IS_KNOWLEDGE_MAP const',  "IS_KNOWLEDGE_MAP" in final),
    ('App.jsx: route branch',            "IS_KNOWLEDGE_MAP            ? <KnowledgeMapGate" in final),
]
all_ok = True
for label, val in checks:
    print(f"  [{'OK' if val else 'FAIL'}] {label}")
    if not val: all_ok = False

# Escape check
hex_chars = set('0123456789abcdefABCDEF')
total_escapes = 0
for rel in files.keys():
    p = ROOT / rel
    txt = p.read_text(encoding="utf-8")
    i = 0
    while i < len(txt) - 5:
        if txt[i] == chr(92) and txt[i+1] == 'u':
            if all(c in hex_chars for c in txt[i+2:i+6]):
                total_escapes += 1
                i += 6
                continue
        i += 1
print(f"  Raw escapes: {total_escapes}")

print("\n" + ("=== ALL OK ===" if all_ok and total_escapes == 0 else "=== SOME FAIL ==="))

print()
print("=" * 60)
print("PHASE G.8 SHIPPED — Knowledge Map")
print("=" * 60)
print()
print("Test:")
print("  npm run build")
print("  Should succeed")
print()
print("In browser:")
print("  Login as any user")
print("  Navigate to localhost:5174/knowledge-map")
print("  See 3 view toggle buttons: 树状图 / 气泡图 / 星系图")
print("  Toggle between them")
print()
print("EXPECTED CONTENT:")
print("  - 154 atoms shown (the ones we seeded)")
print("  - All in 'unseen' state (gray) for marco/laoshi (no practice yet)")
print("  - Tree view: 5 row blocks (chengyu/grammar/poem/topic/word)")
print("  - Bubble view: 5 cluster regions")
print("  - Galaxy view: 5 constellations on dark background")
print()
print("INTEGRATION TO-DO (later, optional):")
print("  - Add a button on PersonalDashboard linking to /knowledge-map")
print("  - For now just navigate via URL bar to test")

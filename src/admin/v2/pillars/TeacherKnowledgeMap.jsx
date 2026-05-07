// src/admin/v2/pillars/TeacherKnowledgeMap.jsx
// Phase G.9 — Aggregated knowledge map across all students.
// For super_admin/teacher view in admin-v2.
//
// Per-atom stats: total students who have a state record, % per state.
// Per Q5: per-student names visible by default (drill-down on click).

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';

const TYPE_LABELS = {
  character: { label: '汉字', icon: '✍️', color: '#3b82f6' },
  word:      { label: '词语', icon: '📚', color: '#8b5cf6' },
  pinyin:    { label: '拼音', icon: '🔤', color: '#06b6d4' },
  grammar:   { label: '语法', icon: '📐', color: '#10b981' },
  chengyu:   { label: '成语', icon: '🎋', color: '#f59e0b' },
  poem:      { label: '诗歌', icon: '🪶', color: '#ec4899' },
  topic:     { label: '游戏', icon: '🏮', color: '#ef4444' },
};

function classMasteryColor(masteredPct) {
  // Heat scale: red (low mastery) -> yellow -> green
  if (masteredPct < 0.2) return '#fee2e2';        // pale red — class struggling
  if (masteredPct < 0.4) return '#fed7aa';
  if (masteredPct < 0.6) return '#fef3c7';
  if (masteredPct < 0.8) return '#bbf7d0';
  return '#86efac';                                // green — class doing well
}

export default function TeacherKnowledgeMap() {
  const [atoms, setAtoms] = useState([]);
  const [stateRows, setStateRows] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drilldownAtom, setDrilldownAtom] = useState(null);
  const [filterLevel, setFilterLevel] = useState(null);
  const [filterType, setFilterType] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      // All atoms
      supabase.from('clf_atoms')
        .select('id, type, display_text, level, difficulty')
        .order('type, level'),
      // All learning state rows
      supabase.from('clf_user_learning_state')
        .select('user_id, atom_id, state'),
      // All student profiles (for name drilldown)
      supabase.from('clf_user_profiles')
        .select('user_id, name, email, role')
        .in('role', ['student', 'parent']),
    ])
      .then(([aRes, sRes, uRes]) => {
        if (cancelled) return;
        if (aRes.error) throw aRes.error;
        if (sRes.error) console.warn('[TKM] state:', sRes.error);
        if (uRes.error) console.warn('[TKM] users:', uRes.error);
        setAtoms(aRes.data || []);
        setStateRows(sRes.data || []);
        setStudents(uRes.data || []);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[TKM] load:', err);
        setError(err.message || String(err));
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // Aggregate state per atom
  const atomStats = useMemo(() => {
    const byAtom = {};
    for (const row of stateRows) {
      if (!byAtom[row.atom_id]) {
        byAtom[row.atom_id] = {
          mastered: 0, practicing: 0, exposed: 0,
          forgotten: 0, unseen: 0, total: 0,
          students: [],
        };
      }
      byAtom[row.atom_id][row.state] = (byAtom[row.atom_id][row.state] || 0) + 1;
      byAtom[row.atom_id].total += 1;
      byAtom[row.atom_id].students.push({ user_id: row.user_id, state: row.state });
    }
    return byAtom;
  }, [stateRows]);

  const studentMap = useMemo(() => {
    const m = {};
    for (const s of students) m[s.user_id] = s;
    return m;
  }, [students]);

  // Filter atoms
  const filtered = useMemo(() => {
    return atoms.filter(a =>
      (filterLevel === null || a.level === filterLevel) &&
      (filterType === null || a.type === filterType)
    );
  }, [atoms, filterLevel, filterType]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#8b6f47' }}>加载中…</div>;
  }
  if (error) {
    return (
      <div style={{ padding: 30, background: '#fef2f2',
        border: '1px solid #fecaca', borderRadius: 10, color: '#991b1b' }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠ 加载失败</div>
        <div style={{ fontSize: 12 }}>{error}</div>
      </div>
    );
  }

  // Compute totals
  const totalAtoms = atoms.length;
  const atomsWithRecords = Object.keys(atomStats).length;
  const totalStudents = students.length;

  // Levels available
  const levels = Array.from(new Set(atoms.map(a => a.level).filter(l => l != null)))
    .sort((a, b) => a - b);
  const types = Array.from(new Set(atoms.map(a => a.type)));

  return (
    <div>
      {/* Stat strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
        marginBottom: 16,
      }}>
        <Stat label="知识单元" value={totalAtoms.toLocaleString()} icon="🧩"/>
        <Stat label="有学习记录" value={atomsWithRecords.toLocaleString()}
              sub={totalAtoms > 0 ? `${(atomsWithRecords/totalAtoms*100).toFixed(0)}%` : ''}
              icon="📊"/>
        <Stat label="学生人数" value={totalStudents.toLocaleString()} icon="👥"/>
        <Stat label="活动记录" value={stateRows.length.toLocaleString()} icon="📝"/>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        padding: 12, background: '#fff', borderRadius: 10,
        border: '1px solid #e8d5b0', marginBottom: 16,
      }}>
        <span style={{ fontSize: 12, color: '#5d4630', fontWeight: 600 }}>类型:</span>
        <button onClick={() => setFilterType(null)} style={chipStyle(filterType === null)}>全部</button>
        {types.map(t => (
          <button key={t} onClick={() => setFilterType(t === filterType ? null : t)}
            style={chipStyle(filterType === t)}>
            {TYPE_LABELS[t]?.icon || ''} {TYPE_LABELS[t]?.label || t}
          </button>
        ))}
        <span style={{ marginLeft: 16, fontSize: 12, color: '#5d4630', fontWeight: 600 }}>HSK 等级:</span>
        <button onClick={() => setFilterLevel(null)} style={chipStyle(filterLevel === null)}>全部</button>
        {levels.map(l => (
          <button key={l} onClick={() => setFilterLevel(l === filterLevel ? null : l)}
            style={chipStyle(filterLevel === l)}>
            HSK {l}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {atomsWithRecords === 0 && (
        <div style={{
          padding: 30, background: '#fff', borderRadius: 10,
          border: '1px dashed #e8d5b0', textAlign: 'center',
          color: '#8b6f47', fontSize: 13, marginBottom: 16,
        }}>
          目前还没有学生活动记录。学生开始练习后这里会显示班级整体掌握情况。
        </div>
      )}

      {/* Heatmap grid */}
      <div style={{
        background: '#fff', border: '1px solid #e8d5b0',
        borderRadius: 12, padding: 12, maxHeight: 600, overflowY: 'auto',
      }}>
        <div style={{
          fontSize: 11, color: '#8b6f47', marginBottom: 8,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{filtered.length.toLocaleString()} 个单元</span>
          <span>颜色 = 班级掌握率（红 = 困难，绿 = 良好）</span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
          gap: 4,
        }}>
          {filtered.slice(0, 1500).map(a => {
            const stats = atomStats[a.id];
            const masteredPct = stats && stats.total > 0
              ? stats.mastered / stats.total : 0;
            const hasData = stats && stats.total > 0;
            return (
              <div key={a.id}
                onClick={() => hasData && setDrilldownAtom(a)}
                style={{
                  padding: '6px 4px', textAlign: 'center',
                  background: hasData ? classMasteryColor(masteredPct) : '#f5f5f4',
                  border: '1px solid #e8d5b0',
                  borderRadius: 4, cursor: hasData ? 'pointer' : 'default',
                  fontSize: 11, color: '#1a0a05',
                  opacity: hasData ? 1 : 0.5,
                  fontWeight: hasData ? 600 : 400,
                }}
                title={hasData
                  ? `${a.display_text} | 已掌握 ${stats.mastered}/${stats.total}`
                  : `${a.display_text} (无记录)`}>
                {(a.display_text || '').slice(0, 4)}
              </div>
            );
          })}
        </div>
        {filtered.length > 1500 && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#8b6f47',
            textAlign: 'center' }}>
            显示前 1500 / {filtered.length.toLocaleString()} 单元 — 用筛选器缩小范围
          </div>
        )}
      </div>

      {/* Drilldown modal */}
      {drilldownAtom && (
        <DrilldownModal atom={drilldownAtom}
          stats={atomStats[drilldownAtom.id]}
          studentMap={studentMap}
          onClose={() => setDrilldownAtom(null)}/>
      )}
    </div>
  );
}

function Stat({ label, value, sub, icon }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e8d5b0',
      borderRadius: 10, padding: 12, textAlign: 'center',
    }}>
      <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1a0a05' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#8b6f47', marginTop: 2 }}>
        {label}{sub ? ` · ${sub}` : ''}
      </div>
    </div>
  );
}

function chipStyle(active) {
  return {
    padding: '4px 10px', fontSize: 11, fontWeight: 600,
    background: active ? '#c41e3a' : '#fff',
    color: active ? '#fff' : '#5d4630',
    border: `1px solid ${active ? '#c41e3a' : '#e8d5b0'}`,
    borderRadius: 6, cursor: 'pointer',
  };
}

function DrilldownModal({ atom, stats, studentMap, onClose }) {
  const groups = useMemo(() => {
    const g = { mastered: [], practicing: [], exposed: [], forgotten: [], unseen: [] };
    if (stats?.students) {
      for (const s of stats.students) {
        const profile = studentMap[s.user_id] || {};
        if (g[s.state]) {
          g[s.state].push({ ...s, name: profile.name || profile.email || s.user_id });
        }
      }
    }
    return g;
  }, [stats, studentMap]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, maxWidth: 500, width: '90%',
        maxHeight: '80vh', overflow: 'auto', padding: 20,
      }}>
        <div style={{
          fontSize: 18, fontWeight: 700, color: '#1a0a05',
          fontFamily: "'STKaiti','KaiTi',serif", marginBottom: 4,
        }}>
          {atom.display_text}
        </div>
        <div style={{ fontSize: 11, color: '#8b6f47', marginBottom: 16 }}>
          {atom.type} · 等级 {atom.level ?? '—'} · 难度 {Math.round(atom.difficulty || 0)}
        </div>

        {Object.entries(groups).map(([state, list]) => list.length > 0 && (
          <div key={state} style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: '#5d4630', marginBottom: 4,
            }}>
              {state} ({list.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {list.map(s => (
                <span key={s.user_id} style={{
                  fontSize: 11, padding: '3px 8px',
                  background: '#fef3e2', border: '1px solid #f59e0b40',
                  borderRadius: 4, color: '#92400e',
                }}>
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        ))}

        <button onClick={onClose} style={{
          marginTop: 12, padding: '8px 16px', fontSize: 12,
          background: '#fff', border: '1px solid #e8d5b0',
          borderRadius: 6, color: '#5d4630', cursor: 'pointer',
        }}>关闭</button>
      </div>
    </div>
  );
}

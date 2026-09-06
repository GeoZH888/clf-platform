// src/knowledge/KnowledgeMap.jsx
// Phase G.8 — Knowledge map root component.
// Reads atoms + per-user learning state, passes to selected view.

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../school/contexts/AuthContext';
import { effectiveMastery } from '../lib/mastery';
import { localStateByAtom } from '../lib/localMastery';
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

  // The map used to refuse to load at all without a session. But the atoms are
  // the curriculum, not anybody's private data, and this device has been
  // recording practice in localStorage since long before anyone logs in — so a
  // signed-out visitor has both halves of a real map. Only the SERVER half of
  // the progress needs an account.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      supabase.from('clf_atoms')
        .select('id, type, display_text, level, difficulty')
        .order('type'),
      user?.id
        ? supabase.from('clf_user_learning_state').select('*').eq('user_id', user.id)
        : Promise.resolve({ data: [], error: null }),
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

  // What this device knows, for the signed-out case. Keyed by atom id, same as
  // stateMap, so the decorator below reads one or the other without branching
  // on auth in the middle of the loop.
  const localState = useMemo(
    () => (user?.id ? {} : localStateByAtom(atoms)),
    [atoms, user?.id],
  );

  // "有记录" must count whichever source is actually in play, or a guest with
  // real local practice is told they have none.
  const trackedCount = user?.id
    ? Object.keys(stateMap).length
    : Object.keys(localState).length;

  // Decorate atoms with state derived from stateMap + forgetting curve
  const decoratedAtoms = useMemo(() => {
    const now = Date.now();
    return atoms.map(a => {
      if (!user?.id) {
        const l = localState[a.id];
        return l ? { ...a, ...l } : { ...a, state: 'unseen', mastery: 0, practiceCount: 0 };
      }
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
  }, [atoms, stateMap, localState, user?.id]);

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
      {!user?.id && <GuestNotice/>}

      {/* View toggle */}
      <div style={{
        display: 'flex', gap: 8, padding: '12px 16px',
        background: '#fff', borderRadius: 10,
        border: '1px solid #e8d5b0', marginBottom: 16,
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 13, color: '#5d4630' }}>
          {atoms.length} 个学习单元 · {trackedCount} 个有记录
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

// Signed out is a normal way to use this platform, not an error — so this says
// what a guest gets and what signing in would add, and does not nag.
function GuestNotice() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '10px 14px', marginBottom: 12,
      background: '#fffbeb', border: '1px solid #fcd34d',
      borderRadius: 10, fontSize: 12, color: '#92400e',
    }}>
      <span style={{ fontSize: 15 }}>📍</span>
      <span style={{ flex: 1, minWidth: 200, lineHeight: 1.5 }}>
        进度只保存在这台设备上 · Progress on this device only
      </span>
      <button onClick={() => { window.location.href = '/login'; }} style={{
        background: '#92400e', color: '#fffbeb', border: 'none',
        padding: '5px 14px', borderRadius: 14,
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}>登录 · Sign in</button>
    </div>
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

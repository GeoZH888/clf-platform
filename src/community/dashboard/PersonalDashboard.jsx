// src/community/dashboard/PersonalDashboard.jsx
// Phase G.7 — Personal learning dashboard.
// Read-only. Calls learningState.js queries.
// Empty state handled gracefully (most users will have no data initially).

import React, { useEffect, useState } from 'react';
import {
  getMasterySummary,
  getRecentActivity,
  getDueAtoms,
} from '../../lib/learningState';

const TYPE_LABELS = {
  character: { label: '汉字', icon: '✍️', color: '#3b82f6' },
  word:      { label: '词语', icon: '📚', color: '#8b5cf6' },
  pinyin:    { label: '拼音', icon: '🔤', color: '#06b6d4' },
  grammar:   { label: '语法', icon: '📐', color: '#10b981' },
  chengyu:   { label: '成语', icon: '🎋', color: '#f59e0b' },
  poem:      { label: '诗歌', icon: '🪶', color: '#ec4899' },
  topic:     { label: '游戏', icon: '🏮', color: '#ef4444' },
};

const STATE_COLORS = {
  unseen:     '#e8d5b0',
  exposed:    '#fde68a',
  practicing: '#fbbf24',
  mastered:   '#10b981',
  forgotten:  '#dc2626',
};

const STATE_LABELS = {
  unseen:     '未学',
  exposed:    '已见',
  practicing: '练习中',
  mastered:   '已掌握',
  forgotten:  '需复习',
};

function relativeTime(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const s = ms / 1000;
  if (s < 60) return '刚刚';
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

export default function PersonalDashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({});
  const [recent, setRecent] = useState([]);
  const [due, setDue] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getMasterySummary(user.id),
      getRecentActivity(user.id, 5),
      getDueAtoms(user.id, 5),
    ])
      .then(([s, r, d]) => {
        if (cancelled) return;
        setSummary(s || {});
        setRecent(r || []);
        setDue(d || []);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[PersonalDashboard] load error:', err);
        setError(err.message || String(err));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

  // Compute totals across all types
  const totals = Object.values(summary).reduce(
    (acc, t) => ({
      total:      acc.total      + (t.total      || 0),
      mastered:   acc.mastered   + (t.mastered   || 0),
      practicing: acc.practicing + (t.practicing || 0),
      forgotten:  acc.forgotten  + (t.forgotten  || 0),
    }),
    { total: 0, mastered: 0, practicing: 0, forgotten: 0 }
  );

  if (!user?.id) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
        <div style={{ fontSize: 14, color: '#5d4630' }}>请先登录</div>
      </div>
    );
  }
  if (loading) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 13, color: '#8b6f47' }}>加载中…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
        <div style={{ fontSize: 13, color: '#991b1b' }}>加载失败</div>
        <div style={{ fontSize: 11, color: '#a07850', marginTop: 4 }}>{error}</div>
      </div>
    );
  }

  // Detect empty state — no learning state at all
  const isEmpty = totals.total === 0 && recent.length === 0 && due.length === 0;
  if (isEmpty) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🌱</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#5d4630', marginBottom: 6 }}>
          欢迎，{user.name || user.username || '学习者'}
        </div>
        <div style={{ fontSize: 12, color: '#8b6f47', marginBottom: 14 }}>
          你还没有学习记录。开始一个模块，记录就会出现在这里。
        </div>
        <div style={{ fontSize: 11, color: '#a07850' }}>
          建议从「社区」中选择一个模块开始
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* === Stat strip === */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
      }}>
        <StatCard label="已掌握" value={totals.mastered} total={totals.total} color="#10b981" icon="✅"/>
        <StatCard label="练习中" value={totals.practicing} total={totals.total} color="#fbbf24" icon="📖"/>
        <StatCard label="待复习" value={due.length} total={null} color="#3b82f6" icon="🔁"/>
      </div>

      {/* === Mastery by type === */}
      <Section title="按类型掌握情况" icon="📊">
        {Object.keys(TYPE_LABELS)
          .filter(t => summary[t]?.total > 0)
          .map(t => (
            <MasteryBar key={t} type={t} stats={summary[t]} typeMeta={TYPE_LABELS[t]}/>
          ))}
        {Object.values(summary).every(s => !s?.total) && (
          <div style={{ fontSize: 11, color: '#a07850', padding: 8 }}>
            （还没有任何类型的学习记录）
          </div>
        )}
      </Section>

      {/* === Recent activity === */}
      <Section title="最近学习" icon="🕐">
        {recent.length === 0 ? (
          <div style={{ fontSize: 11, color: '#a07850', padding: 8 }}>
            （没有近期活动）
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recent.map(a => {
              const atomMeta = a.clf_atoms || {};
              const typeMeta = TYPE_LABELS[atomMeta.type] || { icon: '·', color: '#8b6f47' };
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 10px', background: '#fff',
                  border: '1px solid #f3e7d2', borderRadius: 6,
                  fontSize: 12,
                }}>
                  <span style={{ fontSize: 14 }}>{typeMeta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#1a0a05', fontWeight: 600,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {atomMeta.display_text || '(unknown atom)'}
                    </div>
                    <div style={{ fontSize: 10, color: '#8b6f47' }}>
                      {a.context || 'practice'} · {relativeTime(a.attempt_at)}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: a.outcome >= 0.5 ? '#047857' : '#991b1b',
                  }}>
                    {a.outcome >= 1 ? '✓' : a.outcome >= 0.5 ? '◐' : '✗'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* === Due for review === */}
      <Section title="待复习" icon="🔁">
        {due.length === 0 ? (
          <div style={{ fontSize: 11, color: '#a07850', padding: 8 }}>
            （目前没有待复习的内容）
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {due.map(d => {
              const atomMeta = d.clf_atoms || {};
              const typeMeta = TYPE_LABELS[atomMeta.type] || { icon: '·', color: '#8b6f47' };
              return (
                <div key={d.atom_id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 10px', background: '#fff',
                  border: '1px solid #f3e7d2', borderRadius: 6,
                  fontSize: 12,
                }}>
                  <span style={{ fontSize: 14 }}>{typeMeta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#1a0a05', fontWeight: 600,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {atomMeta.display_text || '(atom)'}
                    </div>
                    <div style={{ fontSize: 10, color: '#8b6f47' }}>
                      {typeMeta.label || atomMeta.type} · 等级 {atomMeta.level ?? '?'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================
function StatCard({ label, value, total, color, icon }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #f3e7d2',
      borderRadius: 10, padding: 12, textAlign: 'center',
    }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: '#8b6f47', marginTop: 2 }}>
        {label}{total !== null && total > 0 ? ` / ${total}` : ''}
      </div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div>
      <div style={{
        fontSize: 12, fontWeight: 700, color: '#5d4630',
        marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>{icon}</span><span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function MasteryBar({ type, stats, typeMeta }) {
  const total = stats.total || 0;
  if (total === 0) return null;
  const segs = [
    { state: 'mastered',   n: stats.mastered   || 0 },
    { state: 'practicing', n: stats.practicing || 0 },
    { state: 'exposed',    n: stats.exposed    || 0 },
    { state: 'forgotten',  n: stats.forgotten  || 0 },
    { state: 'unseen',     n: stats.unseen     || 0 },
  ].filter(s => s.n > 0);

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 11, color: '#5d4630', marginBottom: 4,
      }}>
        <span>{typeMeta.icon}</span>
        <span style={{ fontWeight: 600 }}>{typeMeta.label}</span>
        <span style={{ marginLeft: 'auto', color: '#8b6f47' }}>
          {stats.mastered || 0} / {total} 已掌握
        </span>
      </div>
      <div style={{
        display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden',
        background: STATE_COLORS.unseen,
      }}>
        {segs.map((s, i) => (
          <div key={i} style={{
            flex: s.n,
            background: STATE_COLORS[s.state],
          }} title={`${STATE_LABELS[s.state]}: ${s.n}`}/>
        ))}
      </div>
    </div>
  );
}

const emptyStyle = {
  padding: 40, textAlign: 'center',
  background: '#fff', border: '1px dashed #e8d5b0',
  borderRadius: 12,
};

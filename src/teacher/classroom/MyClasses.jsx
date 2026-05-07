// src/teacher/classroom/MyClasses.jsx
// ════════════════════════════════════════════════════════════════════════════
// Stage b1.1 — Left sidebar with class list + playground entry.
// Loads from dwxz_classes WHERE teacher_id = me AND is_active = true.
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { supabase } from '../../school/services/supabase';
import { useAuth } from '../../school/contexts/AuthContext';
import { PLAYGROUND_KEY } from './useCoTeacher';

const C = {
  primary: '#c41e3a',
  text: '#1a0a05',
  muted: '#94714d',
  cardBg: '#fff',
  border: '#e8d5b0',
  activeBg: '#fef3e2',
};

export default function MyClasses({ activeClassId, onSelectClass }) {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: e } = await supabase
        .from('dwxz_classes')
        .select('id,name,name_zh,hsk_level,level,color,is_active,max_students,description')
        .eq('teacher_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (e) {
        setError(e.message);
        console.error('[MyClasses] load failed:', e);
      } else {
        setClasses(data || []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const isPlaygroundActive = !activeClassId || activeClassId === PLAYGROUND_KEY;

  return (
    <div style={S.root}>
      <div style={S.header}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>📚 我的班级</span>
        <span style={{ fontSize: 11, color: C.muted }}>My Classes</span>
      </div>

      {/* Playground (always present) */}
      <ClassRow
        active={isPlaygroundActive}
        onClick={() => onSelectClass(PLAYGROUND_KEY)}
        emoji="🎓"
        title="试用 / Practice"
        subtitle="无班级 · 用来试一试"
        accent="#a07850"
      />

      {/* Divider */}
      {classes.length > 0 && <div style={S.divider} />}

      {/* Real classes */}
      {loading && <div style={S.empty}>加载中…</div>}
      {error && (
        <div style={{ ...S.empty, color: '#dc2626' }}>
          ⚠️ {error}
        </div>
      )}
      {!loading && !error && classes.length === 0 && (
        <div style={S.empty}>
          还没有班级。<br/>
          <span style={{ fontSize: 11 }}>用上面的"试用"开始体验</span>
        </div>
      )}

      {classes.map(cls => (
        <ClassRow
          key={cls.id}
          active={cls.id === activeClassId}
          onClick={() => onSelectClass(cls.id)}
          emoji="📚"
          title={cls.name_zh || cls.name || '未命名班级'}
          subtitle={formatSubtitle(cls)}
          accent={cls.color || C.primary}
        />
      ))}

      <div style={S.footer}>
        <button style={S.newBtn} disabled title="Stage b1.4 will add this">
          + 新建班级 (later)
        </button>
      </div>
    </div>
  );
}

function ClassRow({ active, onClick, emoji, title, subtitle, accent }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...S.row,
        background: active ? C.activeBg : 'transparent',
        borderLeft: active ? `3px solid ${accent}` : '3px solid transparent',
      }}
    >
      <div style={{ fontSize: 20, marginRight: 10 }}>{emoji}</div>
      <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
        <div style={{
          fontSize: 13, fontWeight: active ? 700 : 600, color: C.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 11, color: C.muted, marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {subtitle}
        </div>
      </div>
    </button>
  );
}

function formatSubtitle(cls) {
  const parts = [];
  if (cls.hsk_level) parts.push(`HSK${cls.hsk_level}`);
  else if (cls.level) parts.push(cls.level);
  if (cls.max_students) parts.push(`${cls.max_students}人`);
  return parts.join(' · ') || '无信息';
}

const S = {
  root: {
    width: 240, minWidth: 240,
    height: '100%',
    background: C.cardBg,
    borderRight: `1px solid ${C.border}`,
    display: 'flex', flexDirection: 'column',
    overflowY: 'auto',
  },
  header: {
    padding: '14px 16px 8px',
    display: 'flex', flexDirection: 'column', gap: 2,
    borderBottom: `1px solid ${C.border}`,
  },
  row: {
    display: 'flex', alignItems: 'center',
    padding: '10px 14px',
    border: 'none',
    borderLeft: '3px solid transparent',
    cursor: 'pointer',
    width: '100%',
    transition: 'background 0.12s',
  },
  divider: {
    height: 1, background: C.border,
    margin: '4px 16px',
  },
  empty: {
    padding: '14px 16px',
    color: C.muted, fontSize: 12,
    lineHeight: 1.5,
  },
  footer: {
    marginTop: 'auto',
    padding: '12px 16px',
    borderTop: `1px solid ${C.border}`,
  },
  newBtn: {
    width: '100%',
    padding: '8px 12px',
    background: 'transparent',
    border: `1px dashed ${C.border}`,
    borderRadius: 8,
    color: C.muted,
    fontSize: 12,
    cursor: 'not-allowed',
  },
};

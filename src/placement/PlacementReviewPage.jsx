// src/placement/PlacementReviewPage.jsx
//
// Staff side of 新生分班测试. Mounted at /teacher/placement and
// /school-master/placement — same component, RequireRole already gated it.
//
//   1. 新建测试 → creates a session + access code, hands back a link to send
//      to the family.
//   2. 待审核 → shows the auto-suggested YCT level with the per-level and
//      per-skill breakdown behind it.
//   3. 确认分班 → teacher sets the final level, picks a class, and the
//      candidate becomes a clf_class_members row.
//
// The auto level is a suggestion. final_level is what the school acts on.

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../school/contexts/AuthContext';
import {
  YCT_LABELS, SKILL_LABELS, YCT_MIN, YCT_MAX,
  suggestClasses, generateAccessCode, placementUrl,
} from '../lib/placement.js';
import { Copy, Check, UserPlus, ClipboardList, RefreshCw } from 'lucide-react';

const ACCENT = '#c41e3a';
const INK    = '#1a0a05';
const MUTED  = '#a07850';
const KAI    = "'STKaiti','KaiTi',serif";

const TABS = [
  { key: 'submitted',   label: '待审核' },
  { key: 'in_progress', label: '待测试' },
  { key: 'placed',      label: '已分班' },
];

export default function PlacementReviewPage() {
  const { user } = useAuth();
  const [tab,      setTab]      = useState('submitted');
  const [sessions, setSessions] = useState([]);
  const [classes,  setClasses]  = useState([]);
  const [counts,   setCounts]   = useState({});
  const [loading,  setLoading]  = useState(true);
  const [openId,   setOpenId]   = useState(null);
  const [creating, setCreating] = useState(false);
  const [msg,      setMsg]      = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, { data: c }, { data: m }] = await Promise.all([
      supabase.from('clf_placement_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('clf_classes').select('id, name, grade_level, yct_level, capacity').order('name'),
      supabase.from('clf_class_members').select('class_id'),
    ]);
    setSessions(s || []);
    setClasses(c || []);
    const tally = {};
    (m || []).forEach(r => { tally[r.class_id] = (tally[r.class_id] || 0) + 1; });
    setCounts(tally);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = sessions.filter(s =>
    tab === 'placed' ? (s.status === 'placed' || s.status === 'reviewed') : s.status === tab
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: INK, fontFamily: KAI, flex: 1 }}>
          分班测试
        </h1>
        <button onClick={load} style={ghostBtn}>
          <RefreshCw size={13}/> 刷新
        </button>
        <button onClick={() => setCreating(v => !v)} style={primaryBtn}>
          <UserPlus size={14}/> 新建测试
        </button>
      </div>

      {msg && (
        <div style={{ background: '#eefaf0', border: '1px solid #b7e2c4', color: '#217a41',
          padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{msg}</div>
      )}

      {creating && (
        <NewSessionForm
          onCancel={() => setCreating(false)}
          onCreated={(s) => { setCreating(false); setSessions(p => [s, ...p]); setTab('in_progress'); }}
          createdBy={user?.id}
        />
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {TABS.map(t => {
          const n = sessions.filter(s => t.key === 'placed'
            ? (s.status === 'placed' || s.status === 'reviewed') : s.status === t.key).length;
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              background: active ? ACCENT : '#fff',
              color: active ? '#fff' : MUTED,
              border: `1px solid ${active ? ACCENT : '#e8d5b0'}`,
            }}>{t.label} {n > 0 && <span style={{ opacity: .8 }}>({n})</span>}</button>
          );
        })}
      </div>

      {loading ? (
        <Empty>加载中…</Empty>
      ) : visible.length === 0 ? (
        <Empty>暂无记录</Empty>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {visible.map(s => (
            <SessionCard
              key={s.id}
              session={s}
              classes={classes}
              counts={counts}
              open={openId === s.id}
              onToggle={() => setOpenId(openId === s.id ? null : s.id)}
              onPlaced={(updated) => {
                setSessions(prev => prev.map(x => x.id === updated.id ? updated : x));
                setCounts(prev => updated.assigned_class_id
                  ? { ...prev, [updated.assigned_class_id]: (prev[updated.assigned_class_id] || 0) + 1 }
                  : prev);
                setOpenId(null);
                setMsg(`${updated.candidate_name} 已分班`);
                setTimeout(() => setMsg(''), 4000);
              }}
              reviewerId={user?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── New session ──────────────────────────────────────────────────────

function NewSessionForm({ onCancel, onCreated, createdBy }) {
  const [name,    setName]    = useState('');
  const [age,     setAge]     = useState('');
  const [contact, setContact] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [made,    setMade]    = useState(null);
  const [copied,  setCopied]  = useState(false);
  const [err,     setErr]     = useState('');

  const create = async () => {
    if (!name.trim()) { setErr('请填写学生姓名'); return; }
    setSaving(true); setErr('');
    const { data, error } = await supabase.from('clf_placement_sessions')
      .insert({
        access_code:    generateAccessCode(),
        candidate_name: name.trim(),
        candidate_age:  age ? Number(age) : null,
        contact:        contact.trim() || null,
        created_by:     createdBy || null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setMade(data);
  };

  if (made) {
    const link = placementUrl(made.access_code);
    return (
      <Panel>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 6 }}>
          {made.candidate_name} 的测试已创建，把链接或测试码发给家长：
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 26, letterSpacing: 6,
          color: ACCENT, textAlign: 'center', padding: '10px 0' }}>
          {made.access_code}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input readOnly value={link} style={{ ...input, flex: 1, fontSize: 12 }} />
          <button
            onClick={() => {
              navigator.clipboard?.writeText(link);
              setCopied(true); setTimeout(() => setCopied(false), 2000);
            }}
            style={primaryBtn}
          >{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? '已复制' : '复制'}</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => onCreated(made)} style={ghostBtn}>完成</button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <div style={{ display: 'grid', gap: 8,
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <Field label="学生姓名 *">
          <input value={name} onChange={e => setName(e.target.value)} style={input}/>
        </Field>
        <Field label="年龄">
          <input value={age} onChange={e => setAge(e.target.value.replace(/\D/g, ''))}
            style={input} inputMode="numeric"/>
        </Field>
        <Field label="家长联系方式">
          <input value={contact} onChange={e => setContact(e.target.value)} style={input}/>
        </Field>
      </div>
      {err && <div style={{ color: ACCENT, fontSize: 12, marginTop: 8 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={create} disabled={saving} style={primaryBtn}>
          {saving ? '创建中…' : '生成测试码'}
        </button>
        <button onClick={onCancel} style={ghostBtn}>取消</button>
      </div>
    </Panel>
  );
}

// ── One session ──────────────────────────────────────────────────────

function SessionCard({ session, classes, counts, open, onToggle, onPlaced, reviewerId }) {
  const [answers,  setAnswers]  = useState(null);
  const [level,    setLevel]    = useState(session.final_level ?? session.auto_level ?? 2);
  const [classId,  setClassId]  = useState(session.assigned_class_id || '');
  const [note,     setNote]     = useState(session.teacher_note || '');
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');

  useEffect(() => {
    if (!open || answers || session.status === 'in_progress') return;
    (async () => {
      const { data } = await supabase
        .from('clf_placement_answers')
        .select('id, yct_level, skill, is_correct, answered_at, clf_placement_items(prompt, options, correct_index)')
        .eq('session_id', session.id)
        .order('answered_at');
      setAnswers(data || []);
    })();
  }, [open, answers, session.id, session.status]);

  const ranked = suggestClasses(level, classes, counts);

  const place = async () => {
    if (!classId) { setErr('请选择班级'); return; }
    setSaving(true); setErr('');

    const { error: memberErr } = await supabase.from('clf_class_members').insert({
      class_id:     classId,
      student_name: session.candidate_name,
      user_id:      session.student_user_id || null,
    });
    if (memberErr) { setErr(memberErr.message); setSaving(false); return; }

    const { data, error } = await supabase.from('clf_placement_sessions')
      .update({
        final_level:       level,
        teacher_note:      note.trim() || null,
        assigned_class_id: classId,
        reviewed_by:       reviewerId || null,
        reviewed_at:       new Date().toISOString(),
        status:            'placed',
      })
      .eq('id', session.id)
      .select()
      .single();
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onPlaced(data);
  };

  const done   = session.status === 'placed' || session.status === 'reviewed';
  const auto   = session.auto_level;
  const skills = session.skill_scores || {};
  const levels = session.level_scores || {};

  return (
    <div style={{ background: '#fff', border: '1px solid #e8d5b0', borderRadius: 12,
      overflow: 'hidden' }}>
      <button onClick={onToggle} style={{
        width: '100%', padding: 14, display: 'flex', alignItems: 'center', gap: 10,
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        <ClipboardList size={16} color={ACCENT}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>
            {session.candidate_name}
            {session.candidate_age ? <span style={{ color: MUTED, fontWeight: 400,
              fontSize: 12 }}> · {session.candidate_age}岁</span> : null}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
            {session.status === 'in_progress'
              ? `测试码 ${session.access_code} · 未完成`
              : `${new Date(session.submitted_at || session.created_at).toLocaleDateString('zh-CN')}`}
          </div>
        </div>
        {auto != null && (
          <span style={pill(done ? '#217a41' : ACCENT)}>
            {done ? YCT_LABELS[session.final_level ?? auto] : `建议 ${YCT_LABELS[auto]}`}
          </span>
        )}
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid #fdf6e3' }}>
          {session.status === 'in_progress' ? (
            <div style={{ padding: '14px 0', fontSize: 13, color: MUTED }}>
              学生还没有完成测试。测试链接：<br/>
              <code style={{ fontSize: 12 }}>{placementUrl(session.access_code)}</code>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gap: 14,
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', padding: '14px 0' }}>
                <div>
                  <SubTitle>各等级正确率</SubTitle>
                  {Object.keys(levels).length === 0 ? <Dim>无数据</Dim> :
                    Object.entries(levels).sort().map(([l, v]) => (
                      <Row key={l}
                        label={`YCT ${l}`}
                        value={`${v.correct}/${v.n}`}
                        ratio={v.n ? v.correct / v.n : 0}
                        highlight={String(auto) === l}
                      />
                    ))}
                </div>
                <div>
                  <SubTitle>各技能正确率</SubTitle>
                  {Object.keys(skills).length === 0 ? <Dim>无数据</Dim> :
                    Object.entries(skills).map(([k, v]) => (
                      <Row key={k} label={SKILL_LABELS[k] || k}
                        value={`${Math.round(Number(v) * 100)}%`} ratio={Number(v)} />
                    ))}
                </div>
              </div>

              {answers && answers.length > 0 && (
                <details style={{ marginBottom: 12 }}>
                  <summary style={{ fontSize: 12, color: MUTED, cursor: 'pointer' }}>
                    逐题记录（{answers.length}）
                  </summary>
                  <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                    {answers.map(a => (
                      <div key={a.id} style={{ fontSize: 12, color: '#5d4630',
                        display: 'flex', gap: 8, alignItems: 'baseline' }}>
                        <span style={{ color: a.is_correct ? '#217a41' : ACCENT }}>
                          {a.is_correct ? '✓' : '✗'}
                        </span>
                        <span style={{ color: MUTED, fontSize: 11, minWidth: 74 }}>
                          YCT{a.yct_level} · {SKILL_LABELS[a.skill] || a.skill}
                        </span>
                        <span style={{ flex: 1 }}>{a.clf_placement_items?.prompt}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {done ? (
                <div style={{ fontSize: 13, color: '#217a41' }}>
                  已分班：{classes.find(c => c.id === session.assigned_class_id)?.name || '—'}
                  {session.teacher_note && (
                    <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>
                      备注：{session.teacher_note}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  <Field label="最终等级（可覆盖系统建议）">
                    <select value={level} onChange={e => setLevel(Number(e.target.value))} style={input}>
                      {Array.from({ length: YCT_MAX - YCT_MIN + 1 }, (_, i) => YCT_MIN + i).map(l => (
                        <option key={l} value={l}>{YCT_LABELS[l]}{l === auto ? '（系统建议）' : ''}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="分配班级">
                    <select value={classId} onChange={e => setClassId(e.target.value)} style={input}>
                      <option value="">— 请选择 —</option>
                      {ranked.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.yct_level ? ` · YCT${c.yct_level}` : ''}
                          {c.memberCount != null ? ` · ${c.memberCount}${c.capacity ? '/' + c.capacity : ''}人` : ''}
                          {c.full ? '（已满）' : ''}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="备注">
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                      style={{ ...input, resize: 'vertical' }}
                      placeholder="口语表现、家长意见…"/>
                  </Field>
                  {err && <div style={{ color: ACCENT, fontSize: 12 }}>{err}</div>}
                  <div>
                    <button onClick={place} disabled={saving} style={primaryBtn}>
                      {saving ? '保存中…' : '确认分班'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────

const Panel = ({ children }) => (
  <div style={{ background: '#fff', border: '1px solid #e8d5b0', borderRadius: 12,
    padding: 14, marginBottom: 14 }}>{children}</div>
);

const Field = ({ label, children }) => (
  <label style={{ display: 'block' }}>
    <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{label}</div>
    {children}
  </label>
);

const SubTitle = ({ children }) => (
  <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>{children}</div>
);

const Dim = ({ children }) => (
  <div style={{ fontSize: 12, color: '#c9b08a' }}>{children}</div>
);

const Row = ({ label, value, ratio, highlight }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
    <div style={{ width: 52, fontSize: 12, color: highlight ? ACCENT : '#5d4630',
      fontWeight: highlight ? 600 : 400 }}>{label}</div>
    <div style={{ flex: 1, height: 7, background: '#f0e4cc', borderRadius: 4 }}>
      <div style={{ width: `${Math.round((ratio || 0) * 100)}%`, height: '100%',
        background: highlight ? ACCENT : '#d8b98a', borderRadius: 4 }}/>
    </div>
    <div style={{ width: 44, fontSize: 11, color: MUTED, textAlign: 'right' }}>{value}</div>
  </div>
);

const Empty = ({ children }) => (
  <div style={{ background: '#fff', padding: 30, borderRadius: 12,
    border: '1px dashed #e8d5b0', textAlign: 'center', color: MUTED }}>{children}</div>
);

const pill = (color) => ({
  fontSize: 11, color, border: `1px solid ${color}`, borderRadius: 20,
  padding: '3px 10px', whiteSpace: 'nowrap',
});

const input = {
  width: '100%', padding: '8px 10px', fontSize: 13, color: INK,
  border: '1px solid #e8d5b0', borderRadius: 8, background: '#fff',
  boxSizing: 'border-box',
};

const primaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', fontSize: 13, background: ACCENT, color: '#fff',
  border: 'none', borderRadius: 8, cursor: 'pointer',
};

const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 12px', fontSize: 12, background: '#fdf6e3', color: MUTED,
  border: '1px solid #e8d5b0', borderRadius: 8, cursor: 'pointer',
};

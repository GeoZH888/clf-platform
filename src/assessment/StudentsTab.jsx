// src/assessment/StudentsTab.jsx
//
// 学生 tab in the teacher-facing 学生测评 page (/test/teacher and the role
// panels). Two jobs a teacher previously had to ask an admin for:
//
//   1. Enrol a student — creates the login and the class membership in one
//      step, then shows the credentials once so they can be handed over.
//   2. See how each student is doing — every student's latest result and
//      full history, without hunting through the 结果 list.
//
// Account creation goes through admin-create-user, which now accepts a
// teacher's token but forces role=student server-side. The credentials are
// shown exactly once, on creation — nothing can read a password back later.

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../school/contexts/AuthContext';
import { SKILL_LABELS, levelLabel } from '../lib/placement.js';
import {
  UserPlus, RefreshCw, Copy, Check, X, ChevronRight, Printer, GraduationCap,
} from 'lucide-react';

const ACCENT = '#c41e3a';
const INK    = '#1a0a05';
const MUTED  = '#a07850';
const KAI    = "'STKaiti','KaiTi',serif";

export default function StudentsTab() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [runs,    setRuns]    = useState([]);
  const [titles,  setTitles]  = useState({});
  const [scales,  setScales]  = useState({});
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [openId,  setOpenId]  = useState(null);
  const [search,  setSearch]  = useState('');
  const [msg,     setMsg]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: m }, { data: c }, { data: r }, { data: a }] = await Promise.all([
      supabase.from('clf_class_members')
        .select('id, student_name, user_id, class_id')
        .order('student_name'),
      supabase.from('clf_classes').select('id, name, yct_level').order('name'),
      supabase.from('clf_assessment_runs')
        .select('*').eq('status', 'submitted')
        .order('submitted_at', { ascending: false }).limit(500),
      supabase.from('clf_assessments').select('id, title, level_scale'),
    ]);
    setMembers(m || []);
    setClasses(c || []);
    setRuns(r || []);
    setTitles(Object.fromEntries((a || []).map(x => [x.id, x.title])));
    setScales(Object.fromEntries((a || []).map(x => [x.id, x.level_scale || 'yct'])));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 5000); };

  const className = (id) => classes.find(c => c.id === id)?.name || '—';
  const runsFor   = (uid) => uid ? runs.filter(r => r.student_user_id === uid) : [];

  const visible = members.filter(m =>
    !search || (m.student_name || '').includes(search));

  const linked   = members.filter(m => m.user_id).length;
  const unlinked = members.length - linked;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: INK, fontFamily: KAI, flex: 1 }}>
          学生 <span style={{ fontSize: 12, color: MUTED, fontWeight: 400 }}>
            {members.length} 人{unlinked > 0 ? ` · ${unlinked} 人还没有账号` : ''}
          </span>
        </h2>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜索姓名" style={{ ...input, width: 150 }}/>
        <button onClick={load} style={ghostBtn}><RefreshCw size={13}/> 刷新</button>
        <button onClick={() => setInviting(v => !v)} style={primaryBtn}>
          <UserPlus size={14}/> 邀请学生
        </button>
      </div>

      {msg && (
        <div style={{ background: '#eefaf0', border: '1px solid #b7e2c4', color: '#217a41',
          padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{msg}</div>
      )}

      {inviting && (
        <InviteStudent
          classes={classes}
          onCancel={() => setInviting(false)}
          onDone={(name) => { setInviting(false); load(); flash(`${name} 已加入，账号已创建`); }}
        />
      )}

      {unlinked > 0 && (
        <div style={{ background: '#fff8ec', border: '1px solid #e8d5b0', borderRadius: 8,
          padding: 10, fontSize: 12, color: '#8a6a45', marginBottom: 12 }}>
          有 {unlinked} 名学生只有名字、没有账号，他们收不到布置的测评，也无法登录 /test。
          用「邀请学生」为他们创建账号。
        </div>
      )}

      {loading ? <Empty>加载中…</Empty>
       : visible.length === 0 ? <Empty>还没有学生</Empty> : (
        <div style={{ display: 'grid', gap: 6 }}>
          {visible.map(m => {
            const mine = runsFor(m.user_id);
            const last = mine[0];
            const open = openId === m.id;
            return (
              <div key={m.id} style={{ background: '#fff', border: '1px solid #e8d5b0',
                borderRadius: 10, overflow: 'hidden' }}>
                <button
                  onClick={() => setOpenId(open ? null : m.id)}
                  style={{ width: '100%', padding: 11, display: 'flex', alignItems: 'center',
                    gap: 10, background: 'transparent', border: 'none',
                    cursor: 'pointer', textAlign: 'left' }}
                >
                  <GraduationCap size={15} color={m.user_id ? '#217a41' : '#c9b08a'}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: INK, fontWeight: 600 }}>
                      {m.student_name}
                      {!m.user_id && (
                        <span style={{ color: ACCENT, fontWeight: 400, fontSize: 11 }}> · 无账号</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                      {className(m.class_id)}
                      {mine.length > 0 && ` · 已完成 ${mine.length} 次测评`}
                    </div>
                  </div>
                  {last && (
                    <span style={pill(last.kind === 'adaptive' ? ACCENT : '#217a41')}>
                      {last.kind === 'adaptive'
                        ? (last.auto_level != null
                            ? levelLabel(scales[last.assessment_id] || 'yct', last.auto_level) : '—')
                        : (last.score_pct != null ? `${Math.round(last.score_pct * 100)}%` : '—')}
                    </span>
                  )}
                  <ChevronRight size={14} color={MUTED}
                    style={{ transform: open ? 'rotate(90deg)' : 'none' }}/>
                </button>

                {open && (
                  <div style={{ padding: '0 12px 12px' }}>
                    {mine.length === 0 ? (
                      <Dim>还没有完成过测评</Dim>
                    ) : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {mine.map(r => (
                          <div key={r.id} style={{ borderTop: '1px solid #fdf6e3', paddingTop: 8 }}>
                            <div style={{ fontSize: 12, color: INK }}>
                              {titles[r.assessment_id] || '测评'}
                              {r.is_practice && (
                                <span style={{ color: MUTED, fontSize: 11 }}> · 练习</span>
                              )}
                              <span style={{ color: MUTED, fontSize: 11 }}>
                                {' '}· {new Date(r.submitted_at).toLocaleDateString('zh-CN')}
                                {' '}· 答对 {r.n_correct}/{r.n_items}
                              </span>
                            </div>
                            {r.skill_scores && Object.keys(r.skill_scores).length > 0 && (
                              <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                                {Object.entries(r.skill_scores).map(([k, v]) => (
                                  <span key={k} style={{ fontSize: 11, color: MUTED }}>
                                    {SKILL_LABELS[k] || k} {Math.round(Number(v) * 100)}%
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Invite ───────────────────────────────────────────────────────────

function InviteStudent({ classes, onCancel, onDone }) {
  const [name,     setName]     = useState('');
  const [classId,  setClassId]  = useState(classes[0]?.id || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');
  const [made,     setMade]     = useState(null);
  const [copied,   setCopied]   = useState(false);

  const create = async () => {
    if (!name.trim())  { setErr('请填写学生姓名'); return; }
    if (!classId)      { setErr('请选择班级'); return; }
    setSaving(true); setErr('');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setErr('登录状态已失效，请重新登录'); setSaving(false); return; }

    try {
      const res = await fetch('/.netlify/functions/admin-create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          mode: 'single',
          name: name.trim(),
          username: username.trim() || undefined,
          password: password.trim() || undefined,
          role: 'student',
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);

      const created = json.result;
      // Link into the class so assignments reach them. Without this row the
      // student can log in but sees no assigned tests.
      const { error: memberErr } = await supabase.from('clf_class_members').insert({
        class_id: classId,
        user_id: created.user_id,
        student_name: name.trim(),
      });
      if (memberErr) throw new Error(`账号已创建，但加入班级失败：${memberErr.message}`);

      setMade(created);
    } catch (e) {
      setErr(String(e.message || e));
    }
    setSaving(false);
  };

  if (made) {
    const line = `姓名: ${made.name}\n用户名: ${made.username}\n密码: ${made.password}\n测评地址: ${window.location.origin}/test`;
    return (
      <Panel>
        <div style={{ fontSize: 13, color: '#217a41', marginBottom: 8 }}>
          账号已创建 — 这是唯一一次显示密码，请立即保存或打印交给学生。
        </div>
        <pre style={{
          background: '#fff8ec', border: '1px solid #e8d5b0', borderRadius: 8,
          padding: 12, fontSize: 13, color: INK, whiteSpace: 'pre-wrap', margin: 0,
        }}>{line}</pre>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={() => {
            navigator.clipboard?.writeText(line);
            setCopied(true); setTimeout(() => setCopied(false), 2000);
          }} style={primaryBtn}>
            {copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? '已复制' : '复制'}
          </button>
          <button onClick={() => {
            const w = window.open('', '_blank');
            if (!w) return;
            w.document.write(`<pre style="font-size:16px;font-family:monospace">${line}</pre>`);
            w.print();
          }} style={ghostBtn}><Printer size={13}/> 打印</button>
          <button onClick={() => onDone(made.name)} style={ghostBtn}>完成</button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ flex: 1, fontSize: 14, color: INK, fontWeight: 600 }}>邀请学生</div>
        <button onClick={onCancel} style={iconBtn}><X size={16}/></button>
      </div>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>
        创建登录账号并加入班级。用户名和密码留空则自动生成。
      </div>
      <div style={{ display: 'grid', gap: 10,
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Field label="学生姓名 *">
          <input value={name} onChange={e => setName(e.target.value)} style={input}/>
        </Field>
        <Field label="班级 *">
          <select value={classId} onChange={e => setClassId(e.target.value)} style={input}>
            <option value="">— 请选择 —</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.yct_level ? ` · YCT${c.yct_level}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="用户名（可留空）">
          <input value={username} onChange={e => setUsername(e.target.value)} style={input}
            autoCapitalize="none"/>
        </Field>
        <Field label="密码（可留空）">
          <input value={password} onChange={e => setPassword(e.target.value)} style={input}/>
        </Field>
      </div>
      {err && <div style={{ color: ACCENT, fontSize: 12, marginTop: 8 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={create} disabled={saving} style={primaryBtn}>
          {saving ? '创建中…' : '创建账号'}
        </button>
        <button onClick={onCancel} style={ghostBtn}>取消</button>
      </div>
    </Panel>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────

const Panel = ({ children }) => (
  <div style={{ background: '#fff', border: '1px solid #e8d5b0', borderRadius: 12,
    padding: 14, marginBottom: 14 }}>{children}</div>
);

const Field = ({ label, children }) => (
  <label style={{ display: 'block', marginTop: 8 }}>
    <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{label}</div>
    {children}
  </label>
);

const Empty = ({ children }) => (
  <div style={{ background: '#fff', padding: 26, borderRadius: 12,
    border: '1px dashed #e8d5b0', textAlign: 'center', color: MUTED }}>{children}</div>
);

const Dim = ({ children }) => (
  <div style={{ fontSize: 12, color: '#c9b08a', paddingTop: 6 }}>{children}</div>
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
  border: '1px solid #e8d5b0', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
};

const iconBtn = {
  background: 'transparent', border: 'none', color: MUTED,
  cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
};

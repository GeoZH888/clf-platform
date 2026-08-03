// src/assessment/TeacherAssessmentPage.jsx
//
// Staff side of 学生测评, mounted for teachers and the school master.
//
//   结果 — every submitted run, newest first. Official runs only by default;
//          practice runs are behind a toggle so they can't be mistaken for
//          an evaluation the teacher asked for.
//   测评 — the catalog. Create an adaptive test (a few numbers) or a fixed
//          one (pick items out of the shared bank), then assign either to a
//          class or to one student.
//
// The item bank is the same one 分班测试 uses — questions authored once serve
// both intake and ongoing evaluation.

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../school/contexts/AuthContext';
import {
  YCT_LABELS, SKILL_LABELS, SKILLS, YCT_MIN, YCT_MAX,
} from '../lib/placement.js';
import ItemBankTab from './ItemBankTab.jsx';
import {
  BarChart3, Plus, Users, Send, RefreshCw, ChevronRight, Check,
} from 'lucide-react';

const ACCENT = '#c41e3a';
const INK    = '#1a0a05';
const MUTED  = '#a07850';
const KAI    = "'STKaiti','KaiTi',serif";

export default function TeacherAssessmentPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('results');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: INK, fontFamily: KAI, flex: 1 }}>
          学生测评
        </h1>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[{ k: 'results', label: '结果' },
          { k: 'catalog', label: '测评管理' },
          { k: 'bank',    label: '题库' }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
            background: tab === t.k ? ACCENT : '#fff',
            color: tab === t.k ? '#fff' : MUTED,
            border: `1px solid ${tab === t.k ? ACCENT : '#e8d5b0'}`,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'results' ? <ResultsTab/>
       : tab === 'bank'  ? <ItemBankTab/>
       : <CatalogTab userId={user?.id}/>}
    </div>
  );
}

// ── Results ──────────────────────────────────────────────────────────

function ResultsTab() {
  const [runs,     setRuns]     = useState([]);
  const [titles,   setTitles]   = useState({});
  const [names,    setNames]    = useState({});
  const [practice, setPractice] = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [openId,   setOpenId]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: r } = await supabase.from('clf_assessment_runs')
      .select('*')
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false })
      .limit(300);
    const runsData = r || [];
    setRuns(runsData);

    const userIds = [...new Set(runsData.map(x => x.student_user_id))];

    // Names come from clf_class_members, not clf_user_profiles: 007 limits
    // profile reads to the owner and super_admin, so a teacher reading
    // profiles gets an empty set. Membership rows carry student_name and are
    // already readable by staff.
    const [{ data: a }, { data: m }, { data: p }] = await Promise.all([
      supabase.from('clf_assessments').select('id, title, kind'),
      userIds.length
        ? supabase.from('clf_class_members')
            .select('user_id, student_name')
            .in('user_id', userIds)
        : Promise.resolve({ data: [] }),
      // Falls back to a profile for anyone not in a class yet — this returns
      // nothing for a plain teacher, which is fine, it only ever adds names.
      userIds.length
        ? supabase.from('clf_user_profiles')
            .select('user_id, display_name')
            .in('user_id', userIds)
        : Promise.resolve({ data: [] }),
    ]);
    setTitles(Object.fromEntries((a || []).map(x => [x.id, x.title])));
    setNames({
      ...Object.fromEntries((p || []).map(x => [x.user_id, x.display_name])),
      ...Object.fromEntries((m || [])
        .filter(x => x.student_name)
        .map(x => [x.user_id, x.student_name])),
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = runs.filter(r => practice || !r.is_practice);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: MUTED, cursor: 'pointer' }}>
          <input type="checkbox" checked={practice}
            onChange={e => setPractice(e.target.checked)}/>
          显示自由练习记录
        </label>
        <div style={{ flex: 1 }}/>
        <button onClick={load} style={ghostBtn}><RefreshCw size={13}/> 刷新</button>
      </div>

      {loading ? <Empty>加载中…</Empty>
       : visible.length === 0 ? <Empty>还没有学生完成测评</Empty> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {visible.map(r => (
            <div key={r.id} style={{ background: '#fff', border: '1px solid #e8d5b0',
              borderRadius: 10, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenId(openId === r.id ? null : r.id)}
                style={{ width: '100%', padding: 12, display: 'flex', alignItems: 'center',
                  gap: 10, background: 'transparent', border: 'none',
                  cursor: 'pointer', textAlign: 'left' }}
              >
                <BarChart3 size={15} color={ACCENT}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: INK, fontWeight: 600 }}>
                    {names[r.student_user_id] || '学生'}
                    {r.is_practice && (
                      <span style={{ color: MUTED, fontWeight: 400, fontSize: 11 }}> · 练习</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                    {titles[r.assessment_id] || '测评'} ·{' '}
                    {new Date(r.submitted_at).toLocaleDateString('zh-CN')}
                  </div>
                </div>
                <span style={pill(r.kind === 'adaptive' ? ACCENT : '#217a41')}>
                  {r.kind === 'adaptive'
                    ? (YCT_LABELS[r.auto_level] || '—')
                    : (r.score_pct != null ? `${Math.round(r.score_pct * 100)}%` : '—')}
                </span>
                <ChevronRight size={14} color={MUTED}
                  style={{ transform: openId === r.id ? 'rotate(90deg)' : 'none' }}/>
              </button>

              {openId === r.id && (
                <div style={{ padding: '0 12px 12px', display: 'grid', gap: 14,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                  <div>
                    <SubTitle>各等级正确率</SubTitle>
                    {Object.keys(r.level_scores || {}).length === 0 ? <Dim>无数据</Dim> :
                      Object.entries(r.level_scores).sort().map(([l, v]) => (
                        <Row key={l} label={`YCT ${l}`} value={`${v.correct}/${v.n}`}
                          ratio={v.n ? v.correct / v.n : 0}
                          highlight={String(r.auto_level) === l}/>
                      ))}
                  </div>
                  <div>
                    <SubTitle>各技能正确率</SubTitle>
                    {Object.keys(r.skill_scores || {}).length === 0 ? <Dim>无数据</Dim> :
                      Object.entries(r.skill_scores).map(([k, v]) => (
                        <Row key={k} label={SKILL_LABELS[k] || k}
                          value={`${Math.round(Number(v) * 100)}%`} ratio={Number(v)}/>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Catalog ──────────────────────────────────────────────────────────

function CatalogTab({ userId }) {
  const [list,     setList]     = useState([]);
  const [classes,  setClasses]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [making,   setMaking]   = useState(null);   // 'adaptive' | 'fixed' | null
  const [assignTo, setAssignTo] = useState(null);   // assessment being assigned
  const [msg,      setMsg]      = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: a }, { data: c }] = await Promise.all([
      supabase.from('clf_assessments').select('*').order('created_at', { ascending: false }),
      supabase.from('clf_classes').select('id, name, yct_level').order('name'),
    ]);
    setList(a || []);
    setClasses(c || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  return (
    <>
      {msg && (
        <div style={{ background: '#eefaf0', border: '1px solid #b7e2c4', color: '#217a41',
          padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{msg}</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button onClick={() => setMaking(making === 'adaptive' ? null : 'adaptive')}
          style={primaryBtn}><Plus size={14}/> 自适应测评</button>
        <button onClick={() => setMaking(making === 'fixed' ? null : 'fixed')}
          style={primaryBtn}><Plus size={14}/> 固定题目测评</button>
      </div>

      {making === 'adaptive' && (
        <AdaptiveForm userId={userId}
          onCancel={() => setMaking(null)}
          onCreated={(a) => { setMaking(null); setList(p => [a, ...p]); flash(`已创建「${a.title}」`); }}/>
      )}
      {making === 'fixed' && (
        <FixedForm userId={userId}
          onCancel={() => setMaking(null)}
          onCreated={(a) => { setMaking(null); setList(p => [a, ...p]); flash(`已创建「${a.title}」`); }}/>
      )}

      {loading ? <Empty>加载中…</Empty>
       : list.length === 0 ? <Empty>还没有测评</Empty> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {list.map(a => (
            <div key={a.id} style={{ background: '#fff', border: '1px solid #e8d5b0',
              borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: INK, fontWeight: 600 }}>
                    {a.title}
                    {!a.is_active && <span style={{ color: MUTED, fontSize: 11 }}> · 已停用</span>}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                    {a.kind === 'adaptive'
                      ? `自适应 · 起始 ${YCT_LABELS[a.start_level]} · ${a.max_items} 题`
                      : `固定 · ${a.item_ids?.length || 0} 题`}
                    {a.allow_practice ? ' · 允许自由练习' : ''}
                  </div>
                </div>
                <button
                  onClick={() => setAssignTo(assignTo?.id === a.id ? null : a)}
                  style={ghostBtn}><Send size={13}/> 布置</button>
              </div>

              {assignTo?.id === a.id && (
                <AssignForm
                  assessment={a}
                  classes={classes}
                  userId={userId}
                  onDone={(n) => { setAssignTo(null); flash(`已布置给 ${n}`); }}
                  onCancel={() => setAssignTo(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Create: adaptive ─────────────────────────────────────────────────

function AdaptiveForm({ userId, onCancel, onCreated }) {
  const [title,    setTitle]    = useState('YCT 水平测评');
  const [desc,     setDesc]     = useState('');
  const [start,    setStart]    = useState(2);
  const [maxItems, setMaxItems] = useState(16);
  const [practice, setPractice] = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');

  const save = async () => {
    if (!title.trim()) { setErr('请填写名称'); return; }
    setSaving(true); setErr('');
    const { data, error } = await supabase.from('clf_assessments').insert({
      title: title.trim(), description: desc.trim() || null, kind: 'adaptive',
      start_level: start, max_items: maxItems, allow_practice: practice,
      created_by: userId || null,
    }).select().single();
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onCreated(data);
  };

  return (
    <Panel>
      <div style={{ display: 'grid', gap: 10,
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <Field label="名称 *">
          <input value={title} onChange={e => setTitle(e.target.value)} style={input}/>
        </Field>
        <Field label="起始等级">
          <select value={start} onChange={e => setStart(Number(e.target.value))} style={input}>
            {levels().map(l => <option key={l} value={l}>{YCT_LABELS[l]}</option>)}
          </select>
        </Field>
        <Field label="题目数量">
          <input type="number" min={4} max={60} value={maxItems}
            onChange={e => setMaxItems(Number(e.target.value))} style={input}/>
        </Field>
      </div>
      <Field label="说明">
        <input value={desc} onChange={e => setDesc(e.target.value)} style={input}/>
      </Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
        color: MUTED, marginTop: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={practice} onChange={e => setPractice(e.target.checked)}/>
        允许学生自由练习
      </label>
      {err && <div style={{ color: ACCENT, fontSize: 12, marginTop: 8 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={save} disabled={saving} style={primaryBtn}>
          {saving ? '保存中…' : '创建'}
        </button>
        <button onClick={onCancel} style={ghostBtn}>取消</button>
      </div>
    </Panel>
  );
}

// ── Create: fixed (item picker) ──────────────────────────────────────

function FixedForm({ userId, onCancel, onCreated }) {
  const [title,    setTitle]    = useState('');
  const [desc,     setDesc]     = useState('');
  const [practice, setPractice] = useState(false);
  const [bank,     setBank]     = useState([]);
  const [picked,   setPicked]   = useState([]);   // ordered item ids
  const [fLevel,   setFLevel]   = useState('');
  const [fSkill,   setFSkill]   = useState('');
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('clf_assessment_item_bank', {
        p_level: fLevel === '' ? null : Number(fLevel),
        p_skill: fSkill === '' ? null : fSkill,
      });
      setBank(data || []);
    })();
  }, [fLevel, fSkill]);

  const toggle = (id) => setPicked(p =>
    p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const save = async () => {
    if (!title.trim())  { setErr('请填写名称'); return; }
    if (picked.length === 0) { setErr('请至少选择一道题'); return; }
    setSaving(true); setErr('');
    const { data, error } = await supabase.from('clf_assessments').insert({
      title: title.trim(), description: desc.trim() || null, kind: 'fixed',
      item_ids: picked, allow_practice: practice, created_by: userId || null,
    }).select().single();
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onCreated(data);
  };

  return (
    <Panel>
      <div style={{ display: 'grid', gap: 10,
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <Field label="名称 *">
          <input value={title} onChange={e => setTitle(e.target.value)} style={input}
            placeholder="例：第一单元小测"/>
        </Field>
        <Field label="说明">
          <input value={desc} onChange={e => setDesc(e.target.value)} style={input}/>
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '12px 0 8px', alignItems: 'center' }}>
        <select value={fLevel} onChange={e => setFLevel(e.target.value)}
          style={{ ...input, width: 'auto' }}>
          <option value="">全部等级</option>
          {levels().map(l => <option key={l} value={l}>{YCT_LABELS[l]}</option>)}
        </select>
        <select value={fSkill} onChange={e => setFSkill(e.target.value)}
          style={{ ...input, width: 'auto' }}>
          <option value="">全部技能</option>
          {SKILLS.map(s => <option key={s} value={s}>{SKILL_LABELS[s]}</option>)}
        </select>
        <div style={{ flex: 1 }}/>
        <div style={{ fontSize: 12, color: MUTED }}>已选 {picked.length} 题</div>
      </div>

      <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #e8d5b0',
        borderRadius: 8 }}>
        {bank.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: MUTED, fontSize: 12 }}>
            题库里没有符合条件的题目
          </div>
        ) : bank.map(it => {
          const on = picked.includes(it.id);
          const order = picked.indexOf(it.id) + 1;
          return (
            <button key={it.id} onClick={() => toggle(it.id)} style={{
              width: '100%', padding: '9px 12px', display: 'flex', gap: 8,
              alignItems: 'center', textAlign: 'left', cursor: 'pointer',
              background: on ? '#fff8ec' : '#fff', border: 'none',
              borderBottom: '1px solid #fdf6e3',
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                border: `1px solid ${on ? ACCENT : '#e8d5b0'}`,
                background: on ? ACCENT : '#fff', color: '#fff', fontSize: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{on ? order : ''}</span>
              <span style={{ fontSize: 11, color: MUTED, minWidth: 68 }}>
                YCT{it.yct_level} · {SKILL_LABELS[it.skill] || it.skill}
              </span>
              <span style={{ flex: 1, fontSize: 12, color: INK }}>{it.prompt}</span>
            </button>
          );
        })}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
        color: MUTED, marginTop: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={practice} onChange={e => setPractice(e.target.checked)}/>
        允许学生自由练习（练习时会显示正确答案）
      </label>
      {err && <div style={{ color: ACCENT, fontSize: 12, marginTop: 8 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={save} disabled={saving} style={primaryBtn}>
          {saving ? '保存中…' : `创建（${picked.length} 题）`}
        </button>
        <button onClick={onCancel} style={ghostBtn}>取消</button>
      </div>
    </Panel>
  );
}

// ── Assign ───────────────────────────────────────────────────────────

function AssignForm({ assessment, classes, userId, onDone, onCancel }) {
  const [mode,     setMode]     = useState('class');   // class | student
  const [classId,  setClassId]  = useState('');
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [due,      setDue]      = useState('');
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');

  useEffect(() => {
    if (mode !== 'student') return;
    (async () => {
      const { data } = await supabase.from('clf_class_members')
        .select('user_id, student_name, class_id')
        .not('user_id', 'is', null)
        .order('student_name');
      setStudents(data || []);
    })();
  }, [mode]);

  const assign = async () => {
    setErr('');
    if (mode === 'class'   && !classId)   { setErr('请选择班级'); return; }
    if (mode === 'student' && !studentId) { setErr('请选择学生'); return; }
    setSaving(true);
    const { error } = await supabase.from('clf_assessment_assignments').insert({
      assessment_id:   assessment.id,
      class_id:        mode === 'class'   ? classId   : null,
      student_user_id: mode === 'student' ? studentId : null,
      due_at:          due ? new Date(due).toISOString() : null,
      assigned_by:     userId || null,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onDone(mode === 'class'
      ? (classes.find(c => c.id === classId)?.name || '班级')
      : (students.find(s => s.user_id === studentId)?.student_name || '学生'));
  };

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #fdf6e3' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[{ k: 'class', label: '整个班级', icon: <Users size={12}/> },
          { k: 'student', label: '单个学生', icon: <Check size={12}/> }].map(m => (
          <button key={m.k} onClick={() => setMode(m.k)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
            background: mode === m.k ? ACCENT : '#fff',
            color: mode === m.k ? '#fff' : MUTED,
            border: `1px solid ${mode === m.k ? ACCENT : '#e8d5b0'}`,
          }}>{m.icon}{m.label}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 10,
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {mode === 'class' ? (
          <Field label="班级">
            <select value={classId} onChange={e => setClassId(e.target.value)} style={input}>
              <option value="">— 请选择 —</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.yct_level ? ` · YCT${c.yct_level}` : ''}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="学生">
            <select value={studentId} onChange={e => setStudentId(e.target.value)} style={input}>
              <option value="">— 请选择 —</option>
              {students.map(s => (
                <option key={s.user_id} value={s.user_id}>{s.student_name}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="截止日期（可选）">
          <input type="date" value={due} onChange={e => setDue(e.target.value)} style={input}/>
        </Field>
      </div>

      {err && <div style={{ color: ACCENT, fontSize: 12, marginTop: 8 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={assign} disabled={saving} style={primaryBtn}>
          {saving ? '布置中…' : '确认布置'}
        </button>
        <button onClick={onCancel} style={ghostBtn}>取消</button>
      </div>
    </div>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────

const levels = () =>
  Array.from({ length: YCT_MAX - YCT_MIN + 1 }, (_, i) => YCT_MIN + i);

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

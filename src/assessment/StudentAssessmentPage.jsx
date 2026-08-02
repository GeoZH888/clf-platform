// src/assessment/StudentAssessmentPage.jsx
//
// 测评 in the student panel. Two lists:
//   老师布置的  — assignments aimed at this kid or their class. Official:
//                 results land in the teacher's view.
//   自由练习    — any active test with allow_practice. Logged as practice and
//                 kept out of the teacher's default results list, so a kid can
//                 try as often as they like without muddying the record.
//
// Everything a student can read here is gated by RLS (013); nothing in this
// component is trusted for authorisation.

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { YCT_LABELS, SKILL_LABELS } from '../lib/placement.js';
import AssessmentRunner from './AssessmentRunner.jsx';
import { SkillBar } from './QuizUI.jsx';
import { ClipboardCheck, Repeat, Clock, ChevronRight } from 'lucide-react';

const ACCENT = '#10b981';        // student panel accent
const INK    = '#1a0a05';
const MUTED  = '#a07850';
const KAI    = "'STKaiti','KaiTi',serif";

export default function StudentAssessmentPage() {
  const [assessments, setAssessments] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [runs,        setRuns]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [active,      setActive]      = useState(null);  // { assessment, assignmentId, practice }
  const [openRun,     setOpenRun]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: a }, { data: asg }, { data: r }] = await Promise.all([
      supabase.from('clf_assessments')
        .select('id, title, description, kind, allow_practice, item_ids, max_items')
        .eq('is_active', true),
      supabase.from('clf_assessment_assignments')
        .select('id, assessment_id, due_at, created_at'),
      supabase.from('clf_assessment_runs')
        .select('*')
        .order('started_at', { ascending: false }),
    ]);
    setAssessments(a || []);
    setAssignments(asg || []);
    setRuns(r || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (active) {
    return (
      <AssessmentRunner
        assessment={active.assessment}
        assignmentId={active.assignmentId}
        practice={active.practice}
        onDone={() => { setActive(null); load(); }}
      />
    );
  }

  const byId = Object.fromEntries(assessments.map(a => [a.id, a]));

  // An assignment is done once an official (non-practice) run is submitted.
  const assigned = assignments
    .map(asg => ({ asg, assessment: byId[asg.assessment_id] }))
    .filter(x => x.assessment);

  const practiceable = assessments.filter(a => a.allow_practice);
  const history = runs.filter(r => r.status === 'submitted');

  return (
    <div>
      <h1 style={{ margin: '0 0 16px', fontSize: 22, color: INK, fontFamily: KAI }}>
        我的测评
      </h1>

      {loading ? <Empty>加载中…</Empty> : (
        <>
          <Section icon={<ClipboardCheck size={14} color={ACCENT}/>} title="老师布置的">
            {assigned.length === 0 ? <Empty>暂时没有布置的测评</Empty> : (
              <div style={{ display: 'grid', gap: 8 }}>
                {assigned.map(({ asg, assessment }) => {
                  // Match on the assignment, never on the assessment. Adaptive
                  // tests are repeatable by design — a September run must not
                  // close out a January re-assessment of the same test.
                  const done    = runs.find(r => r.assignment_id === asg.id
                                              && r.status === 'submitted');
                  const started = runs.find(r => r.assignment_id === asg.id
                                              && r.status === 'in_progress');
                  const overdue = asg.due_at && !done && new Date(asg.due_at) < new Date();
                  return (
                    <TestRow
                      key={asg.id}
                      title={assessment.title}
                      subtitle={
                        done ? resultLine(done)
                        : asg.due_at ? `截止 ${new Date(asg.due_at).toLocaleDateString('zh-CN')}`
                        : assessment.kind === 'adaptive' ? '自适应测评' : '固定题目'
                      }
                      badge={done ? '已完成' : started ? '继续' : overdue ? '已过期' : '开始'}
                      badgeColor={done ? '#217a41' : overdue ? '#c41e3a' : ACCENT}
                      disabled={!!done}
                      onClick={() => !done && setActive({
                        assessment, assignmentId: asg.id, practice: false,
                      })}
                    />
                  );
                })}
              </div>
            )}
          </Section>

          <Section icon={<Repeat size={14} color={ACCENT}/>} title="自由练习"
            hint="练习成绩只有你自己看得到">
            {practiceable.length === 0 ? <Empty>暂无可练习的测评</Empty> : (
              <div style={{ display: 'grid', gap: 8 }}>
                {practiceable.map(a => (
                  <TestRow
                    key={a.id}
                    title={a.title}
                    subtitle={a.description || (a.kind === 'adaptive' ? '自适应测评' : '固定题目')}
                    badge="练习"
                    badgeColor={MUTED}
                    onClick={() => setActive({ assessment: a, assignmentId: null, practice: true })}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section icon={<Clock size={14} color={ACCENT}/>} title="我的记录">
            {history.length === 0 ? <Empty>还没有完成过测评</Empty> : (
              <div style={{ display: 'grid', gap: 6 }}>
                {history.map(r => (
                  <div key={r.id} style={{ background: '#fff', border: '1px solid #e8d5b0',
                    borderRadius: 10, overflow: 'hidden' }}>
                    <button
                      onClick={() => setOpenRun(openRun === r.id ? null : r.id)}
                      style={{ width: '100%', padding: '10px 12px', display: 'flex',
                        alignItems: 'center', gap: 8, background: 'transparent',
                        border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: INK }}>
                          {byId[r.assessment_id]?.title || '测评'}
                          {r.is_practice && <span style={{ color: MUTED, fontSize: 11 }}> · 练习</span>}
                        </div>
                        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                          {new Date(r.submitted_at || r.started_at).toLocaleDateString('zh-CN')} · {resultLine(r)}
                        </div>
                      </div>
                      <ChevronRight size={14} color={MUTED}
                        style={{ transform: openRun === r.id ? 'rotate(90deg)' : 'none' }}/>
                    </button>
                    {openRun === r.id && r.skill_scores && (
                      <div style={{ padding: '0 12px 12px', display: 'grid', gap: 6 }}>
                        {Object.entries(r.skill_scores).map(([k, v]) => (
                          <SkillBar key={k} label={SKILL_LABELS[k] || k} value={Number(v)}/>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function resultLine(run) {
  if (run.kind === 'adaptive' && run.auto_level != null) {
    return YCT_LABELS[run.auto_level] || `YCT ${run.auto_level}`;
  }
  if (run.score_pct != null) {
    return `${Math.round(run.score_pct * 100)}% · ${run.n_correct}/${run.n_items}`;
  }
  return '已完成';
}

const Section = ({ icon, title, hint, children }) => (
  <div style={{ marginBottom: 22 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      {icon}
      <div style={{ fontSize: 13, color: INK, fontWeight: 600 }}>{title}</div>
      {hint && <div style={{ fontSize: 11, color: MUTED }}>· {hint}</div>}
    </div>
    {children}
  </div>
);

const TestRow = ({ title, subtitle, badge, badgeColor, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      background: '#fff', border: '1px solid #e8d5b0', borderRadius: 10,
      padding: 12, display: 'flex', alignItems: 'center', gap: 10,
      cursor: disabled ? 'default' : 'pointer', textAlign: 'left', width: '100%',
      opacity: disabled ? .7 : 1,
    }}
  >
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 14, color: INK, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{subtitle}</div>
    </div>
    <span style={{ fontSize: 11, color: badgeColor, border: `1px solid ${badgeColor}`,
      borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>{badge}</span>
  </button>
);

const Empty = ({ children }) => (
  <div style={{ background: '#fff', padding: 20, borderRadius: 10,
    border: '1px dashed #e8d5b0', textAlign: 'center', color: MUTED, fontSize: 13 }}>
    {children}
  </div>
);

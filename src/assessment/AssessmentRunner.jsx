// src/assessment/AssessmentRunner.jsx
//
// Runs one test for a logged-in student. Handles both kinds:
//   adaptive — drives the YCT staircase from src/lib/placement.js, asking the
//              server for an item at the level the staircase lands on.
//   fixed    — the server hands back the teacher's items in their own order;
//              the level/skill arguments are ignored.
//
// Grading is entirely server-side (clf_assessment_answer). This component
// never sees a correct answer except on practice runs, where the server
// deliberately returns it so the child can learn from the mistake.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  resumeRun, nextSkill, nextLevel, recordAnswer, isFinished,
  shuffleOptions, SKILL_LABELS, levelLabel, scaleOf,
} from '../lib/placement.js';
import {
  Card, Shell, Spinner, ItemView, ProgressBar, SkillBar, btn,
  ACCENT, INK, MUTED, KAI,
} from './QuizUI.jsx';

function fallbackPlan(level, skill, scaleId = 'yct') {
  const { min, max } = scaleOf(scaleId);
  const plan = [{ l: level, s: skill }, { l: level, s: null }];
  for (let d = 1; d <= max - min; d++) {
    if (level + d <= max) plan.push({ l: level + d, s: null });
    if (level - d >= min) plan.push({ l: level - d, s: null });
  }
  return plan;
}

export default function AssessmentRunner({ assessment, assignmentId = null,
                                           practice = false, onDone }) {
  const [phase,  setPhase]  = useState('loading');  // loading|quiz|done|error
  const [error,  setError]  = useState('');
  const [meta,   setMeta]   = useState(null);       // { run_id, kind, max_items, … }
  const [run,    setRun]    = useState(null);
  const [item,   setItem]   = useState(null);
  const [choices, setChoices] = useState([]);
  const [picked, setPicked] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [result, setResult] = useState(null);

  const askedAt = useRef(Date.now());
  const runRef  = useRef(null);

  const loadItem = useCallback(async (currentRun, m) => {
    setPicked(null);
    setReveal(null);

    // Fixed tests take their order from the assessment — no level search.
    if (m.kind === 'fixed') {
      const { data, error: err } = await supabase.rpc('clf_assessment_next', {
        p_run: m.run_id, p_level: null, p_skill: null,
      });
      if (err) { setError(err.message); setPhase('error'); return null; }
      if (data?.ok && data.item) {
        setItem(data.item);
        setChoices(shuffleOptions(data.item.options || [], data.item.id));
        askedAt.current = Date.now();
        return data.item;
      }
      return null;
    }

    for (const { l, s } of fallbackPlan(nextLevel(currentRun), nextSkill(currentRun),
                                        m.level_scale || 'yct')) {
      const { data, error: err } = await supabase.rpc('clf_assessment_next', {
        p_run: m.run_id, p_level: l, p_skill: s,
      });
      if (err) { setError(err.message); setPhase('error'); return null; }
      if (data?.ok && data.item) {
        setItem(data.item);
        setChoices(shuffleOptions(data.item.options || [], data.item.id));
        askedAt.current = Date.now();
        return data.item;
      }
    }
    return null;   // bank exhausted
  }, []);

  const submit = useCallback(async (m) => {
    const { data } = await supabase.rpc('clf_assessment_submit', { p_run: m.run_id });
    setResult(data?.ok ? data : null);
    setPhase('done');
  }, []);

  // ── Start / resume ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase.rpc('clf_assessment_start', {
        p_assessment: assessment.id,
        p_assignment: assignmentId,
        p_practice:   practice,
      });
      if (cancelled) return;
      if (err || !data?.ok) {
        setError(err?.message || data?.error || '无法开始测评');
        setPhase('error');
        return;
      }
      setMeta(data);
      const fresh = resumeRun(data.answered || 0, data.start_level, data.max_items,
                              data.level_scale || 'yct');
      runRef.current = fresh;
      setRun(fresh);
      if (isFinished(fresh)) { await submit(data); return; }
      setPhase('quiz');
      const got = await loadItem(fresh, data);
      if (!got) await submit(data);
    })();
    return () => { cancelled = true; };
  }, [assessment.id, assignmentId, practice, loadItem, submit]);

  const choose = async (originalIndex) => {
    if (picked !== null || !item || !meta) return;
    setPicked(originalIndex);

    const { data } = await supabase.rpc('clf_assessment_answer', {
      p_run: meta.run_id, p_item: item.id, p_choice: originalIndex,
      p_ms: Date.now() - askedAt.current,
    });

    const next = recordAnswer(runRef.current, {
      itemId:    item.id,
      level:     item.yct_level,
      skill:     item.skill,
      isCorrect: !!data?.is_correct,
    });
    runRef.current = next;
    setRun(next);

    // Practice runs pause on the answer; official runs move straight on.
    const showing = data?.correct_index != null;
    if (showing) setReveal(data.correct_index);

    setTimeout(async () => {
      if (isFinished(next)) { await submit(meta); return; }
      const got = await loadItem(next, meta);
      if (!got) await submit(meta);
    }, showing ? 1400 : 400);
  };

  // ── Screens ────────────────────────────────────────────────────────
  if (phase === 'loading') return <Shell embedded><Card><Spinner/></Card></Shell>;

  if (phase === 'error') {
    return (
      <Shell embedded>
        <Card>
          <div style={{ fontSize: 36, marginBottom: 10 }}>😕</div>
          <div style={{ color: INK, fontSize: 15, marginBottom: 6 }}>{error}</div>
          <button onClick={() => onDone?.(null)} style={btn(false)}>返回</button>
        </Card>
      </Shell>
    );
  }

  if (phase === 'done') {
    const isFixed = result?.kind === 'fixed' || meta?.kind === 'fixed';
    const skills  = result?.skill_scores || {};
    return (
      <Shell embedded>
        <Card>
          <div style={{ fontSize: 40, marginBottom: 6 }}>🎉</div>
          <h2 style={{ fontFamily: KAI, fontSize: 22, color: INK, margin: '0 0 14px' }}>
            {practice ? '练习完成' : '测评完成'}
          </h2>

          <div style={{ background: '#fff8ec', border: '1px solid #e8d5b0',
            borderRadius: 12, padding: 16, marginBottom: 14 }}>
            {isFixed ? (
              <>
                <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>得分 · Score</div>
                <div style={{ fontFamily: KAI, fontSize: 28, color: ACCENT }}>
                  {result?.score_pct != null ? `${Math.round(result.score_pct * 100)}%` : '—'}
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                  答对 {result?.n_correct ?? 0} / {result?.n_items ?? 0} 题
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>当前等级 · Level</div>
                <div style={{ fontFamily: KAI, fontSize: 26, color: ACCENT }}>
                  {result?.auto_level != null
                    ? levelLabel(meta?.level_scale || 'yct', result.auto_level) : '—'}
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                  答对 {result?.n_correct ?? 0} / {result?.n_items ?? 0} 题
                </div>
              </>
            )}
          </div>

          {Object.keys(skills).length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {Object.entries(skills).map(([k, v]) => (
                <SkillBar key={k} label={SKILL_LABELS[k] || k} value={Number(v)} />
              ))}
            </div>
          )}

          {!practice && (
            <div style={{ fontSize: 12, color: MUTED, marginTop: 14 }}>
              结果已发送给老师。
            </div>
          )}
          <button onClick={() => onDone?.(result)} style={btn(true)}>返回测评列表</button>
        </Card>
      </Shell>
    );
  }

  // ── Quiz ───────────────────────────────────────────────────────────
  return (
    <Shell embedded>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>
          {assessment.title}{practice && ' · 练习'}
        </div>
        <ProgressBar
          index={run?.asked.length || 0}
          total={meta?.max_items || 0}
          skillLabel={SKILL_LABELS[item?.skill]}
        />
        <Card>
          <ItemView
            item={item}
            choices={choices}
            picked={picked}
            reveal={reveal}
            onChoose={choose}
          />
        </Card>
        <button
          onClick={() => onDone?.(null)}
          style={{ ...btn(false), marginTop: 12, fontSize: 13 }}
        >稍后再做</button>
      </div>
    </Shell>
  );
}

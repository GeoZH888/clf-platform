// src/placement/PlacementQuiz.jsx
//
// Candidate-facing 分班测试. Public route — no login. The candidate opens
// /placement?code=XXXXXX with a code their teacher gave them.
//
// The answer key stays on the server: items arrive via clf_placement_next
// (correct_index stripped) and each answer is graded by clf_placement_answer.
// This component only runs the staircase from src/lib/placement.js.
//
// The question UI itself is shared with the logged-in student 测评 —
// see src/assessment/QuizUI.jsx.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  initRun, resumeRun, nextSkill, nextLevel, recordAnswer, isFinished,
  estimateLevel, shuffleOptions, YCT_LABELS, SKILL_LABELS, YCT_MIN, YCT_MAX,
} from '../lib/placement.js';
import {
  Shell, Card, Spinner, ItemView, ProgressBar, SkillBar, btn,
  ACCENT, INK, MUTED, KAI,
} from '../assessment/QuizUI.jsx';

// Levels to try when the requested (level, skill) bucket is exhausted.
function fallbackPlan(level, skill) {
  const plan = [{ l: level, s: skill }, { l: level, s: null }];
  for (let d = 1; d <= YCT_MAX - YCT_MIN; d++) {
    if (level + d <= YCT_MAX) plan.push({ l: level + d, s: null });
    if (level - d >= YCT_MIN) plan.push({ l: level - d, s: null });
  }
  return plan;
}

export default function PlacementQuiz() {
  const params  = new URLSearchParams(window.location.search);
  const urlCode = (params.get('code') || '').trim().toUpperCase();

  const [code,      setCode]      = useState(urlCode);
  const [codeInput, setCodeInput] = useState('');
  const [phase,     setPhase]     = useState(urlCode ? 'loading' : 'code'); // code|loading|intro|quiz|done|error
  const [error,     setError]     = useState('');
  const [session,   setSession]   = useState(null);

  const [run,     setRun]     = useState(() => initRun());
  const [item,    setItem]    = useState(null);
  const [choices, setChoices] = useState([]);
  const [picked,  setPicked]  = useState(null);
  const [busy,    setBusy]    = useState(false);
  const [result,  setResult]  = useState(null);

  const askedAt = useRef(Date.now());

  // ── Open the session ───────────────────────────────────────────────
  useEffect(() => {
    if (!code) return;
    (async () => {
      setPhase('loading');
      const { data, error: err } = await supabase.rpc('clf_placement_session', { p_code: code });
      if (err || !data?.ok) {
        setError(err?.message || '测试码无效或已失效 · Invalid code');
        setPhase('error');
        return;
      }
      setSession(data);
      if (data.status !== 'in_progress') {
        setResult({ already: true, auto_level: data.auto_level });
        setPhase('done');
      } else {
        setPhase('intro');
      }
    })();
  }, [code]);

  // ── Fetch the next item ────────────────────────────────────────────
  const loadItem = useCallback(async (currentRun) => {
    setBusy(true);
    setPicked(null);
    for (const { l, s } of fallbackPlan(nextLevel(currentRun), nextSkill(currentRun))) {
      const { data, error: err } = await supabase.rpc('clf_placement_next', {
        p_code: code, p_level: l, p_skill: s,
      });
      if (err) { setError(err.message); setPhase('error'); setBusy(false); return null; }
      if (data?.ok && data.item) {
        setItem(data.item);
        setChoices(shuffleOptions(data.item.options || [], data.item.id));
        askedAt.current = Date.now();
        setBusy(false);
        return data.item;
      }
    }
    setBusy(false);
    return null;   // bank exhausted
  }, [code]);

  const submit = useCallback(async (finalRun) => {
    setBusy(true);
    const { data } = await supabase.rpc('clf_placement_submit', { p_code: code });
    setResult(data?.ok ? data : estimateLevel(finalRun.asked));
    setPhase('done');
    setBusy(false);
  }, [code]);

  const start = async () => {
    // Resuming a half-finished session picks up the item count so the test
    // still ends at maxItems rather than running a whole second pass.
    const fresh = resumeRun(session?.answered || 0);
    setRun(fresh);
    if (isFinished(fresh)) { await submit(fresh); return; }
    setPhase('quiz');
    const got = await loadItem(fresh);
    if (!got) await submit(fresh);
  };

  const choose = async (originalIndex) => {
    if (busy || picked !== null || !item) return;
    setPicked(originalIndex);
    setBusy(true);

    const { data } = await supabase.rpc('clf_placement_answer', {
      p_code: code, p_item: item.id, p_choice: originalIndex,
      p_ms: Date.now() - askedAt.current,
    });

    const nextRun = recordAnswer(run, {
      itemId:    item.id,
      level:     item.yct_level,
      skill:     item.skill,
      isCorrect: !!data?.is_correct,
    });
    setRun(nextRun);

    // Deliberately no right/wrong feedback — this is a placement test, not a
    // drill. A wrong answer at YCT 4 shouldn't discourage a YCT 2 candidate.
    setTimeout(async () => {
      if (isFinished(nextRun)) { await submit(nextRun); return; }
      const got = await loadItem(nextRun);
      if (!got) await submit(nextRun);
    }, 400);
  };

  // ── Screens ────────────────────────────────────────────────────────
  if (phase === 'code') {
    return (
      <Shell>
        <Card>
          <h1 style={{ fontFamily: KAI, fontSize: 26, color: INK, margin: '0 0 6px' }}>分班测试</h1>
          <p style={{ color: MUTED, fontSize: 13, margin: '0 0 20px' }}>
            请输入老师给你的测试码 · Enter your placement code
          </p>
          <input
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={12}
            style={{
              width: '100%', padding: '12px 14px', fontSize: 20, letterSpacing: 4,
              textAlign: 'center', border: '1px solid #e8d5b0', borderRadius: 10,
              background: '#fff', color: INK, boxSizing: 'border-box',
            }}
          />
          <button onClick={() => codeInput.trim() && setCode(codeInput.trim())} style={btn(true)}>
            开始 · Start
          </button>
        </Card>
      </Shell>
    );
  }

  if (phase === 'loading') return <Shell><Card><Spinner/></Card></Shell>;

  if (phase === 'error') {
    return (
      <Shell>
        <Card>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🚫</div>
          <div style={{ color: INK, fontSize: 16, marginBottom: 8 }}>{error}</div>
          <button onClick={() => { setCode(''); setError(''); setPhase('code'); }} style={btn(false)}>
            重新输入 · Try again
          </button>
        </Card>
      </Shell>
    );
  }

  if (phase === 'intro') {
    return (
      <Shell>
        <Card>
          <h1 style={{ fontFamily: KAI, fontSize: 26, color: INK, margin: '0 0 4px' }}>
            你好，{session?.candidate_name}
          </h1>
          <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.7, margin: '12px 0 20px' }}>
            这是一个分班测试，大约 5–10 分钟。<br/>
            题目会根据你的回答自动变难或变简单，不会的题直接选一个就好。<br/>
            <span style={{ color: '#8a6a45' }}>
              A short placement quiz. It adapts to your answers — just pick the
              best option, there is no penalty for guessing.
            </span>
          </p>
          <button onClick={start} style={btn(true)}>
            {session?.answered > 0 ? '继续测试 · Resume' : '开始测试 · Begin'}
          </button>
        </Card>
      </Shell>
    );
  }

  if (phase === 'done') {
    const lvl    = result?.auto_level ?? result?.level ?? 1;
    const skills = result?.skill_scores || result?.skillScores || {};
    return (
      <Shell>
        <Card>
          <div style={{ fontSize: 40, marginBottom: 6 }}>🎉</div>
          <h1 style={{ fontFamily: KAI, fontSize: 24, color: INK, margin: '0 0 6px' }}>测试完成</h1>
          <p style={{ color: MUTED, fontSize: 13, margin: '0 0 18px' }}>
            结果已提交，老师会确认后与你联系。<br/>
            <span style={{ fontSize: 12 }}>Submitted — your teacher will confirm your class.</span>
          </p>
          <div style={{ background: '#fff8ec', border: '1px solid #e8d5b0', borderRadius: 12,
            padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>建议等级 · Suggested level</div>
            <div style={{ fontFamily: KAI, fontSize: 26, color: ACCENT }}>{YCT_LABELS[lvl]}</div>
          </div>
          {Object.keys(skills).length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {Object.entries(skills).map(([k, v]) => (
                <SkillBar key={k} label={SKILL_LABELS[k] || k} value={Number(v)} />
              ))}
            </div>
          )}
        </Card>
      </Shell>
    );
  }

  // ── Quiz ───────────────────────────────────────────────────────────
  return (
    <Shell>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <ProgressBar
          index={run.asked.length}
          total={run.maxItems}
          skillLabel={SKILL_LABELS[item?.skill]}
        />
        <Card>
          <ItemView
            item={item}
            choices={choices}
            picked={picked}
            reveal={null}
            onChoose={choose}
          />
        </Card>
      </div>
    </Shell>
  );
}

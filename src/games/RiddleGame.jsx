// src/games/RiddleGame.jsx
//
// 猜灯谜 — student-facing game
//
// Flow:
//   1. Student picks a difficulty level (1=入门 to 6=高级)
//   2. fetch /.netlify/functions/generate-riddle → returns a riddle
//   3. Show 谜面 + 谜目 (e.g. "打一字"), accept open-text answer
//   4. Hints unlock progressively on wrong guesses (cost = hints_used)
//   5. On reveal: log attempt to clf_riddle_attempts, show explanation, vote
//   6. Next riddle button → repeat
//
// Aesthetic: warm red/gold lantern theme, festive but readable.
// Mounts with: <RiddleGame userId={...} sessionId={...} onClose={...} />

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const LEVELS = [
  { value: 1, label: '入门', desc: 'HSK 1 · 简单字谜', color: '#4CAF50' },
  { value: 2, label: '基础', desc: 'HSK 2 · 字谜', color: '#8BC34A' },
  { value: 3, label: '进阶', desc: 'HSK 3-4 · 词谜/成语', color: '#FFC107' },
  { value: 4, label: '中级', desc: 'HSK 4 · 成语谜', color: '#FF9800' },
  { value: 5, label: '高级', desc: 'HSK 5 · 文化典故', color: '#FF5722' },
  { value: 6, label: '专家', desc: 'HSK 6 · 文学性强', color: '#D32F2F' },
];

// Generate or persist an anonymous session id
function getSessionId() {
  let sid = localStorage.getItem('clf_riddle_session');
  if (!sid) {
    sid = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('clf_riddle_session', sid);
  }
  return sid;
}

export default function RiddleGame({ userId = null, onClose }) {
  const [level, setLevel]             = useState(1);
  const [phase, setPhase]             = useState('picking'); // picking | loading | playing | revealed
  const [riddle, setRiddle]           = useState(null);
  const [source, setSource]           = useState(null);
  const [guess, setGuess]             = useState('');
  const [attempts, setAttempts]       = useState(0);
  const [hintsUsed, setHintsUsed]     = useState(0);
  const [feedback, setFeedback]       = useState(null);
  const [score, setScore]             = useState({ played: 0, solved: 0, streak: 0 });
  const [error, setError]             = useState(null);
  const [voteSubmitted, setVoteSubmitted] = useState(false);

  const startTimeRef = useRef(null);
  const sessionId = useRef(getSessionId()).current;

  // ── Pick level → fetch riddle ─────────────────────────────────────────────
  const startGame = async (chosenLevel) => {
    setLevel(chosenLevel);
    setPhase('loading');
    setError(null);
    setRiddle(null);
    setGuess('');
    setAttempts(0);
    setHintsUsed(0);
    setFeedback(null);
    setVoteSubmitted(false);

    try {
      const res = await fetch('/.netlify/functions/generate-riddle', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level:      chosenLevel,
          user_id:    userId,
          session_id: sessionId,
          action:     'play',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.riddle) throw new Error(data.note || '暂无可用灯谜');

      setRiddle(data.riddle);
      setSource(data.source);
      startTimeRef.current = Date.now();
      setPhase('playing');
    } catch (err) {
      console.error('[riddle fetch]', err);
      setError(err.message);
      setPhase('picking');
    }
  };

  // ── Submit guess ──────────────────────────────────────────────────────────
  const submitGuess = () => {
    if (!riddle || !guess.trim()) return;
    const cleaned = guess.trim().replace(/[。，、？！\s.?!,]/g, '');
    setAttempts(a => a + 1);

    if (cleaned === riddle.answer || riddle.answer.includes(cleaned) || cleaned.includes(riddle.answer)) {
      reveal(true);
    } else {
      setFeedback({ kind: 'wrong', text: `不对，再想想 (${cleaned})` });
      setTimeout(() => setFeedback(null), 1800);
    }
    setGuess('');
  };

  // ── Use a hint ────────────────────────────────────────────────────────────
  const useHint = () => {
    const hints = riddle?.hints || [];
    if (hintsUsed >= hints.length) {
      setFeedback({ kind: 'info', text: '没有更多提示了' });
      setTimeout(() => setFeedback(null), 1500);
      return;
    }
    setHintsUsed(h => h + 1);
  };

  // ── Reveal (manual or correct) ────────────────────────────────────────────
  const reveal = async (success) => {
    setPhase('revealed');
    const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : null;

    setScore(s => ({
      played:  s.played + 1,
      solved:  s.solved + (success ? 1 : 0),
      streak:  success ? s.streak + 1 : 0,
    }));

    // Log attempt (best-effort, don't block UI)
    try {
      await supabase.from('clf_riddle_attempts').insert({
        user_id:       userId,
        session_id:    userId ? null : sessionId,
        riddle_id:     riddle.id,
        success,
        hints_used:    hintsUsed,
        attempts:      attempts + (success ? 1 : 0),
        time_spent_ms: elapsed,
      });
    } catch (err) {
      console.warn('[attempt log]', err);
    }
  };

  // ── Vote ──────────────────────────────────────────────────────────────────
  const vote = async (v) => {
    if (voteSubmitted || !riddle) return;
    setVoteSubmitted(true);
    try {
      await supabase.from('clf_riddle_attempts').insert({
        user_id:    userId,
        session_id: userId ? null : sessionId,
        riddle_id:  riddle.id,
        success:    score.solved > 0,
        vote:       v,
      });
    } catch (err) {
      console.warn('[vote]', err);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={S.root}>
      <LanternBackdrop />

      <div style={S.card}>
        <Header onClose={onClose} score={score} level={level} phase={phase} />

        {phase === 'picking' && (
          <LevelPicker onPick={startGame} error={error} />
        )}

        {phase === 'loading' && <Loading />}

        {phase === 'playing' && riddle && (
          <PlayingView
            riddle={riddle}
            source={source}
            guess={guess}
            setGuess={setGuess}
            onSubmit={submitGuess}
            onHint={useHint}
            onGiveUp={() => reveal(false)}
            hintsUsed={hintsUsed}
            attempts={attempts}
            feedback={feedback}
          />
        )}

        {phase === 'revealed' && riddle && (
          <RevealedView
            riddle={riddle}
            success={score.streak > 0 && score.played === score.solved + (score.streak === 0 ? 1 : 0)
                       || (score.streak > 0)}
            attempts={attempts}
            hintsUsed={hintsUsed}
            onNext={() => startGame(level)}
            onChangeLevel={() => setPhase('picking')}
            onVote={vote}
            voteSubmitted={voteSubmitted}
          />
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Header({ onClose, score, level, phase }) {
  const lvl = LEVELS.find(l => l.value === level);
  return (
    <div style={S.header}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 28 }}>🏮</span>
        <div>
          <h2 style={S.title}>猜灯谜</h2>
          <div style={S.subtitle}>Riddle Lanterns</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {phase !== 'picking' && lvl && (
          <span style={{ ...S.badge, background: lvl.color }}>{lvl.label}</span>
        )}
        {(score.played > 0) && (
          <span style={S.score}>
            🎯 {score.solved}/{score.played}
            {score.streak > 1 && <span style={{ color: '#ff6f00', marginLeft: 6 }}>🔥{score.streak}</span>}
          </span>
        )}
        {onClose && (
          <button onClick={onClose} style={S.closeBtn} aria-label="Close">✕</button>
        )}
      </div>
    </div>
  );
}

function LevelPicker({ onPick, error }) {
  return (
    <div style={S.body}>
      <p style={S.intro}>选择你的难度，开始猜灯谜！</p>
      {error && <div style={S.errorBanner}>⚠ {error}</div>}
      <div style={S.levelGrid}>
        {LEVELS.map(l => (
          <button
            key={l.value}
            onClick={() => onPick(l.value)}
            style={{ ...S.levelBtn, borderColor: l.color }}
            onMouseEnter={(e) => { e.currentTarget.style.background = l.color + '15'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
          >
            <div style={{ ...S.levelNum, background: l.color }}>{l.value}</div>
            <div style={S.levelLabel}>{l.label}</div>
            <div style={S.levelDesc}>{l.desc}</div>
          </button>
        ))}
      </div>
      <p style={S.tip}>
        💡 提示：低难度从字谜开始，高难度有成语和文化典故
      </p>
    </div>
  );
}

function Loading() {
  return (
    <div style={{ ...S.body, textAlign: 'center', padding: '60px 20px' }}>
      <div style={S.spinner}>🏮</div>
      <p style={{ marginTop: 16, color: '#888' }}>灯谜生成中...</p>
    </div>
  );
}

function PlayingView({ riddle, source, guess, setGuess, onSubmit, onHint, onGiveUp, hintsUsed, attempts, feedback }) {
  const visibleHints = (riddle.hints || []).slice(0, hintsUsed);
  const totalHints   = (riddle.hints || []).length;

  return (
    <div style={S.body}>
      {source === 'ai_generated' && (
        <div style={S.aiBadge}>✨ AI 即兴创作</div>
      )}

      <div style={S.riddleCard}>
        <div style={S.riddleText}>{riddle.riddle_text}</div>
        {riddle.category_hint && (
          <div style={S.categoryHint}>—— {riddle.category_hint}</div>
        )}
      </div>

      {visibleHints.length > 0 && (
        <div style={S.hintsBox}>
          {visibleHints.map((h, i) => (
            <div key={i} style={S.hintItem}>
              💡 {h.text}
            </div>
          ))}
        </div>
      )}

      <div style={S.inputRow}>
        <input
          type="text"
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          placeholder="输入你的答案..."
          style={S.input}
          autoFocus
        />
        <button onClick={onSubmit} style={S.btnPrimary} disabled={!guess.trim()}>
          猜
        </button>
      </div>

      {feedback && (
        <div style={feedback.kind === 'wrong' ? S.feedbackWrong : S.feedbackInfo}>
          {feedback.text}
        </div>
      )}

      <div style={S.actionsRow}>
        <button
          onClick={onHint}
          style={S.btnHint}
          disabled={hintsUsed >= totalHints}
        >
          💡 提示 ({hintsUsed}/{totalHints})
        </button>
        <span style={S.attemptCount}>已尝试 {attempts} 次</span>
        <button onClick={onGiveUp} style={S.btnGiveUp}>
          🏳️ 放弃
        </button>
      </div>
    </div>
  );
}

function RevealedView({ riddle, success, attempts, hintsUsed, onNext, onChangeLevel, onVote, voteSubmitted }) {
  return (
    <div style={S.body}>
      <div style={success ? S.resultWin : S.resultLose}>
        {success ? '🎉 答对了！' : '🤔 答案揭晓'}
      </div>

      <div style={S.answerBox}>
        <div style={S.answerLabel}>谜底</div>
        <div style={S.answerText}>{riddle.answer}</div>
        {riddle.category_hint && (
          <div style={S.answerHint}>{riddle.category_hint}</div>
        )}
      </div>

      {riddle.explanation && (
        <div style={S.explanationBox}>
          <div style={S.explLabel}>为什么？</div>
          <div style={S.explText}>{riddle.explanation}</div>
        </div>
      )}

      <div style={S.statsRow}>
        <span>尝试 {attempts} 次</span>
        <span>·</span>
        <span>用了 {hintsUsed} 个提示</span>
      </div>

      {!voteSubmitted && (
        <div style={S.voteRow}>
          <span style={{ color: '#888', fontSize: 13 }}>这条灯谜怎么样？</span>
          <button onClick={() => onVote(1)}  style={S.voteBtn}>👍 不错</button>
          <button onClick={() => onVote(-1)} style={S.voteBtn}>👎 不好</button>
        </div>
      )}
      {voteSubmitted && (
        <div style={S.voteThanks}>感谢反馈 ✓</div>
      )}

      <div style={S.actionsRow}>
        <button onClick={onNext} style={S.btnPrimary}>
          🏮 下一条
        </button>
        <button onClick={onChangeLevel} style={S.btnSecondary}>
          换难度
        </button>
      </div>
    </div>
  );
}

function LanternBackdrop() {
  // Decorative floating lantern emojis. Pure aesthetic.
  return (
    <div aria-hidden style={S.backdrop}>
      <span style={{ ...S.lantern, top: '8%',  left: '6%',  fontSize: 28 }}>🏮</span>
      <span style={{ ...S.lantern, top: '18%', right: '8%', fontSize: 36 }}>🏮</span>
      <span style={{ ...S.lantern, bottom: '12%', left: '10%', fontSize: 24 }}>🏮</span>
      <span style={{ ...S.lantern, bottom: '20%', right: '6%', fontSize: 30 }}>🏮</span>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
  root: {
    position: 'relative',
    background: 'linear-gradient(180deg, #FFF5E1 0%, #FFE4D6 100%)',
    minHeight: '100vh',
    padding: '20px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    overflow: 'hidden',
  },
  backdrop: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  lantern: {
    position: 'absolute',
    opacity: 0.4,
    animation: 'sway 4s ease-in-out infinite',
  },
  card: {
    position: 'relative',
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 12px 48px rgba(180, 60, 30, 0.15)',
    maxWidth: 640,
    width: '100%',
    overflow: 'hidden',
    border: '1px solid #FFD4A8',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    background: 'linear-gradient(90deg, #C62828 0%, #E53935 100%)',
    color: '#fff',
  },
  title: { margin: 0, fontSize: 20, fontWeight: 600 },
  subtitle: { fontSize: 11, opacity: 0.85, fontStyle: 'italic' },
  badge: {
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 12,
    color: '#fff',
    fontWeight: 600,
  },
  score: { fontSize: 14, fontWeight: 500 },
  closeBtn: {
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    color: '#fff',
    width: 28,
    height: 28,
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: 14,
  },
  body: { padding: 24 },
  intro: { textAlign: 'center', color: '#666', marginTop: 0, marginBottom: 20, fontSize: 15 },
  errorBanner: {
    padding: 12,
    background: '#FFEBEE',
    border: '1px solid #FFCDD2',
    borderRadius: 8,
    color: '#C62828',
    fontSize: 13,
    marginBottom: 16,
  },
  levelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: 12,
  },
  levelBtn: {
    background: '#fff',
    border: '2px solid',
    borderRadius: 12,
    padding: '16px 12px',
    cursor: 'pointer',
    transition: 'all .2s',
    textAlign: 'center',
  },
  levelNum: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    color: '#fff',
    fontWeight: 600,
    fontSize: 16,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  levelLabel: { fontSize: 14, fontWeight: 600, color: '#333' },
  levelDesc:  { fontSize: 11, color: '#888', marginTop: 4 },
  tip: { textAlign: 'center', fontSize: 12, color: '#999', marginTop: 20, marginBottom: 0 },
  spinner: { fontSize: 60, animation: 'sway 1.5s ease-in-out infinite' },

  riddleCard: {
    background: 'linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%)',
    border: '2px solid #FFD180',
    borderRadius: 12,
    padding: '24px 20px',
    textAlign: 'center',
    marginBottom: 20,
    boxShadow: '0 4px 12px rgba(255, 152, 0, 0.1)',
  },
  riddleText: {
    fontSize: 22,
    color: '#5D4037',
    fontWeight: 500,
    lineHeight: 1.6,
    fontFamily: '"Noto Serif SC", "Songti SC", serif',
  },
  categoryHint: {
    marginTop: 12,
    fontSize: 13,
    color: '#A0522D',
    fontStyle: 'italic',
  },
  aiBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    background: '#E8F5E9',
    color: '#2E7D32',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    marginBottom: 12,
  },
  hintsBox: {
    background: '#FFF3E0',
    border: '1px dashed #FFB74D',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  hintItem: { fontSize: 13, color: '#5D4037', marginBottom: 4 },
  inputRow: { display: 'flex', gap: 8, marginBottom: 12 },
  input: {
    flex: 1,
    padding: '12px 14px',
    border: '2px solid #FFD180',
    borderRadius: 8,
    fontSize: 16,
    outline: 'none',
    fontFamily: 'inherit',
  },
  btnPrimary: {
    padding: '12px 24px',
    background: '#C62828',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600,
  },
  btnSecondary: {
    padding: '12px 20px',
    background: '#fff',
    color: '#C62828',
    border: '2px solid #C62828',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  },
  btnHint: {
    padding: '8px 14px',
    background: '#FFF3E0',
    color: '#E65100',
    border: '1px solid #FFB74D',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
  },
  btnGiveUp: {
    padding: '8px 14px',
    background: 'transparent',
    color: '#888',
    border: '1px solid #ddd',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
  },
  attemptCount: { fontSize: 12, color: '#888', flex: 1, textAlign: 'center' },
  feedbackWrong: {
    padding: 10,
    background: '#FFEBEE',
    color: '#C62828',
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  feedbackInfo: {
    padding: 10,
    background: '#E3F2FD',
    color: '#1565C0',
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  actionsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  resultWin: {
    fontSize: 24,
    fontWeight: 600,
    color: '#2E7D32',
    textAlign: 'center',
    marginBottom: 16,
  },
  resultLose: {
    fontSize: 22,
    fontWeight: 500,
    color: '#5D4037',
    textAlign: 'center',
    marginBottom: 16,
  },
  answerBox: {
    background: 'linear-gradient(135deg, #C62828 0%, #E53935 100%)',
    color: '#fff',
    padding: '20px',
    borderRadius: 12,
    textAlign: 'center',
    marginBottom: 16,
    boxShadow: '0 6px 16px rgba(198, 40, 40, 0.2)',
  },
  answerLabel: { fontSize: 12, opacity: 0.8, marginBottom: 4 },
  answerText:  { fontSize: 36, fontWeight: 700, fontFamily: '"Noto Serif SC", serif' },
  answerHint:  { fontSize: 12, opacity: 0.85, marginTop: 6, fontStyle: 'italic' },
  explanationBox: {
    background: '#F5F5F5',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
    borderLeft: '3px solid #FF9800',
  },
  explLabel: { fontSize: 11, color: '#A0522D', fontWeight: 600, marginBottom: 4 },
  explText:  { fontSize: 14, color: '#444', lineHeight: 1.6 },
  statsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 8,
    fontSize: 12,
    color: '#888',
    marginBottom: 16,
  },
  voteRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  voteBtn: {
    padding: '6px 12px',
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
  },
  voteThanks: {
    textAlign: 'center',
    fontSize: 12,
    color: '#2E7D32',
    marginBottom: 16,
  },
};

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('riddle-keyframes')) {
  const style = document.createElement('style');
  style.id = 'riddle-keyframes';
  style.textContent = `
    @keyframes sway {
      0%, 100% { transform: rotate(-3deg) translateY(0); }
      50%      { transform: rotate(3deg) translateY(-4px); }
    }
  `;
  document.head.appendChild(style);
}

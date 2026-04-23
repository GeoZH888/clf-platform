// src/grammar/GrammarExerciseCard.jsx
// Renders a single exercise (fill or choose) and collects user input.

import { useState, useEffect } from 'react';

const V = {
  card: 'var(--card)', border: 'var(--border)',
  text: 'var(--text)', text2: 'var(--text-2)', text3: 'var(--text-3)',
  accent: '#7B3F3F', accentLight: '#F5E8E8',
};

export default function GrammarExerciseCard({ exercise, lang, onSubmit, submitting }) {
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it || en) : en;
  const [fillAnswer, setFillAnswer] = useState('');
  const [selected, setSelected] = useState(null);

  // Reset inputs when a new exercise comes in
  useEffect(() => {
    setFillAnswer('');
    setSelected(null);
  }, [exercise?.id]);

  const difficulty = exercise.difficulty;
  const diffLabel = ['易', '中', '难'][difficulty];
  const diffColor = ['#2E7D32', '#E65100', '#c62828'][difficulty];

  function handleSubmit() {
    if (exercise.type === 'fill') {
      if (!fillAnswer.trim()) return;
      onSubmit(fillAnswer.trim());
    } else {
      if (selected == null) return;
      const options = exercise.options || [];
      onSubmit(options[selected]);
    }
  }

  return (
    <div style={{
      background: V.card, border: `1px solid ${V.border}`,
      borderRadius: 10, padding: 18, marginTop: 10,
    }}>
      {/* Difficulty badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: V.text3 }}>
          {exercise.type === 'fill'
            ? t('填空题', 'Fill in', 'Completa')
            : t('选择题', 'Choose', 'Scegli')}
        </div>
        <div style={{
          padding: '2px 8px', fontSize: 10, fontWeight: 500,
          background: diffColor + '22', color: diffColor, borderRadius: 8,
          fontFamily: "'STKaiti','KaiTi',serif",
        }}>
          {diffLabel}
        </div>
      </div>

      {/* Question */}
      <div style={{
        fontSize: 18, color: V.text, lineHeight: 1.7,
        fontFamily: "'STKaiti','KaiTi',serif",
        marginBottom: 16,
      }}>
        {exercise.question}
      </div>

      {/* Input */}
      {exercise.type === 'fill' ? (
        <input
          value={fillAnswer}
          onChange={e => setFillAnswer(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !submitting && handleSubmit()}
          placeholder={t('输入答案', 'Type answer', 'Scrivi risposta')}
          autoFocus
          style={{
            width: '100%', padding: '10px 14px', fontSize: 15,
            border: `1.5px solid ${V.border}`, borderRadius: 8,
            background: '#fff', fontFamily: "'STKaiti','KaiTi',serif",
            color: V.text, boxSizing: 'border-box',
            outline: 'none',
          }}/>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {(exercise.options || []).map((opt, i) => (
            <button key={i} onClick={() => setSelected(i)} style={{
              padding: '12px 16px',
              background: selected === i ? V.accent : V.card,
              color:      selected === i ? '#fff'  : V.text,
              border: `1.5px solid ${selected === i ? V.accent : V.border}`,
              borderRadius: 8, cursor: 'pointer',
              textAlign: 'left', fontSize: 14,
              fontFamily: "'STKaiti','KaiTi',serif",
              transition: 'all 0.15s',
            }}>
              <span style={{ marginRight: 10, opacity: 0.6 }}>
                {['A', 'B', 'C', 'D'][i]}
              </span>
              {opt}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || (exercise.type === 'fill' ? !fillAnswer.trim() : selected == null)}
        style={{
          width: '100%', marginTop: 16, padding: '10px',
          background: V.accent, color: '#fff',
          border: 'none', borderRadius: 8,
          cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: (submitting || (exercise.type === 'fill' ? !fillAnswer.trim() : selected == null)) ? 0.5 : 1,
          fontSize: 14, fontFamily: "'STKaiti','KaiTi',serif",
          letterSpacing: 2,
        }}>
        {submitting
          ? t('检查中…', 'Checking…', 'Controllo…')
          : t('提交', 'Submit', 'Invia')}
      </button>
    </div>
  );
}

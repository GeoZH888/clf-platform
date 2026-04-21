// src/chengyu/ChengyuQuiz.jsx
import { useState, useEffect, useCallback } from 'react';
import LearningNav from '../components/LearningNav.jsx';
import PointsBadge from '../components/PointsBadge.jsx';
import { usePoints } from '../hooks/usePoints.js';

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildQuestion(idioms, idx, lang) {
  const correct = idioms[idx];
  const others  = shuffle(idioms.filter((_, i) => i !== idx)).slice(0, 3);
  const meaning = (i) => lang==='zh' ? i.meaning_zh
    : lang==='it' ? (i.meaning_it || i.meaning_zh)
    : (i.meaning_en || i.meaning_zh);
  const options = shuffle([
    { text: meaning(correct), correct: true },
    ...others.map(o => ({ text: meaning(o), correct: false })),
  ]);
  return { idiom: correct, options, correctMeaning: meaning(correct) };
}

export default function ChengyuQuiz({ idioms = [], lang = 'zh', onBack }) {
  const [idx,       setIdx]       = useState(0);
  const [question,  setQuestion]  = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [answered,  setAnswered]  = useState(false);
  const [score,     setScore]     = useState(0);
  const [total,     setTotal]     = useState(0);
  const { total: points, earn } = usePoints();
  const t = (zh, en, it) => lang==='zh' ? zh : lang==='it' ? it : en;

  const generateQ = useCallback(() => {
    if (idioms.length < 4) return;
    setQuestion(buildQuestion(idioms, idx % idioms.length, lang));
    setSelected(null);
    setAnswered(false);
  }, [idioms, idx, lang]);

  useEffect(() => { generateQ(); }, [generateQ]);

  if (idioms.length < 4) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#a07850' }}>
      {t('至少需要4条成语才能开始测验','Need at least 4 idioms','Servono almeno 4 proverbi')}
    </div>
  );

  async function handleSelect(opt) {
    if (answered) return;
    setSelected(opt);
    setAnswered(true);
    setTotal(t => t + 1);
    if (opt.correct) {
      setScore(s => s + 1);
      await earn('chengyu_quiz_right', 'chengyu', { idiom: question.idiom.idiom });
    }
  }

  function handleNext() {
    setIdx(i => i + 1);
  }

  function handleReset() {
    setIdx(0);
    setScore(0);
    setTotal(0);
  }

  const optColor = (opt) => {
    if (!answered) return '#fff';
    if (opt.correct) return '#E8F5E9';
    if (opt === selected && !opt.correct) return '#FFEBEE';
    return '#fff';
  };
  const optBorder = (opt) => {
    if (!answered) return '#E0E0E0';
    if (opt.correct) return '#2E7D32';
    if (opt === selected && !opt.correct) return '#C62828';
    return '#E0E0E0';
  };

  return (
    <div style={{ background: 'var(--bg,#F5F5F5)', minHeight: '100dvh', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: '#2E7D32', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none',
          fontSize: 24, color: '#fff', cursor: 'pointer' }}>‹</button>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', flex: 1 }}>
          {t('选义测验','Quiz','Quiz')}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
          {score}/{total}
        </div>
        <PointsBadge total={points} size="small" color="#FFD700"/>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: '#C8E6C9' }}>
        <div style={{ height: '100%', background: '#2E7D32',
          width: `${idioms.length ? ((idx % idioms.length) / idioms.length) * 100 : 0}%`,
          transition: 'width 0.3s' }}/>
      </div>

      {question && (
        <div style={{ padding: '20px 16px 0' }}>
          {/* Idiom display */}
          <div style={{ background: '#fff', borderRadius: 18,
            border: '2px solid #E8D5B0', padding: '20px',
            textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#a07850', marginBottom: 8 }}>
              {t('这个成语是什么意思？','What does this idiom mean?','Cosa significa questo proverbio?')}
            </div>
            <div style={{ fontSize: 38, fontWeight: 700, color: '#5D2E0C',
              fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 4 }}>
              {question.idiom.idiom}
            </div>
            <div style={{ fontSize: 14, color: '#8B4513', marginTop: 8, letterSpacing: 1 }}>
              {question.idiom.pinyin}
            </div>
          </div>

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {question.options.map((opt, i) => (
              <button key={i} onClick={() => handleSelect(opt)}
                style={{
                  padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                  background: optColor(opt),
                  border: `2px solid ${optBorder(opt)}`,
                  fontSize: 14, color: '#333', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: answered && opt.correct ? '#2E7D32'
                    : answered && opt === selected && !opt.correct ? '#C62828'
                    : '#F5F5F5',
                  color: answered && (opt.correct || opt === selected) ? '#fff' : '#666',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, flexShrink: 0,
                }}>
                  {answered && opt.correct ? '✓'
                    : answered && opt === selected && !opt.correct ? '✗'
                    : ['A','B','C','D'][i]}
                </div>
                {opt.text}
              </button>
            ))}
          </div>

          {/* Feedback */}
          {answered && (
            <div style={{
              marginTop: 14, padding: '12px 16px', borderRadius: 14,
              background: selected?.correct ? '#E8F5E9' : '#FFF3E0',
              border: `1px solid ${selected?.correct ? '#A5D6A7' : '#FFCC80'}`,
              fontSize: 13, color: selected?.correct ? '#1B5E20' : '#E65100',
            }}>
              {selected?.correct
                ? `✓ ${t('正确！','Correct!','Esatto!')} +5⭐`
                : `✗ ${t('正确答案：','Correct:','Risposta corretta:')} ${question.correctMeaning}`}
              {question.idiom.example_zh && (
                <div style={{ fontSize: 12, color: '#546E7A', marginTop: 6 }}>
                  {t('例句：','Example:','Esempio:')} {question.idiom.example_zh}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <div style={{ padding: '12px 16px' }}>
        <LearningNav
          onPrev={idx > 0 ? () => setIdx(i => i - 1) : null}
          onRefresh={handleReset}
          onNext={answered ? handleNext : null}
          label={`${(idx % idioms.length) + 1} / ${idioms.length}`}
          color="#2E7D32"
        />
      </div>
    </div>
  );
}

// src/chengyu/ChengyuFill.jsx
// See meaning → type the idiom (with pinyin hints)
import { useState, useRef } from 'react';
import LearningNav from '../components/LearningNav.jsx';
import PointsBadge from '../components/PointsBadge.jsx';
import { usePoints } from '../hooks/usePoints.js';

function normalize(s) {
  return s.trim().replace(/\s+/g, '');
}

export default function ChengyuFill({ idioms = [], lang = 'zh', onBack }) {
  const [idx,       setIdx]      = useState(0);
  const [input,     setInput]    = useState('');
  const [answered,  setAnswered] = useState(false);
  const [correct,   setCorrect]  = useState(false);
  const [showHint,  setShowHint] = useState(false);
  const { total: points, earn } = usePoints();
  const inputRef = useRef(null);
  const t = (zh, en, it) => lang==='zh' ? zh : lang==='it' ? it : en;

  if (!idioms.length) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#a07850' }}>
      {t('暂无内容','No content','Nessun contenuto')}
    </div>
  );

  const item = idioms[idx];
  const meaning = lang==='zh' ? item.meaning_zh
    : lang==='it' ? (item.meaning_it || item.meaning_zh)
    : (item.meaning_en || item.meaning_zh);

  async function handleSubmit() {
    if (!input.trim() || answered) return;
    const isCorrect = normalize(input) === normalize(item.idiom);
    setAnswered(true);
    setCorrect(isCorrect);
    if (isCorrect) await earn('chengyu_fill_right', 'chengyu', { idiom: item.idiom });
  }

  function handleNext() {
    setIdx(i => i + 1);
    setInput('');
    setAnswered(false);
    setCorrect(false);
    setShowHint(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  return (
    <div style={{ background: 'var(--bg,#F5F5F5)', minHeight: '100dvh', paddingBottom: 80 }}>
      <div style={{ background: '#F57F17', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none',
          fontSize: 24, color: '#fff', cursor: 'pointer' }}>‹</button>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', flex: 1 }}>
          {t('看义填词','Fill in Blank','Completa')}
        </div>
        <PointsBadge total={points} size="small" color="#fff"/>
      </div>

      <div style={{ padding: '20px 16px 0' }}>

        {/* Meaning card */}
        <div style={{ background: '#fff', borderRadius: 18,
          border: '2px solid #FFE082', padding: '20px',
          textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#F9A825', marginBottom: 8 }}>
            {t('根据意思写出成语','Write the idiom from its meaning','Scrivi il proverbio')}
          </div>
          <div style={{ fontSize: 18, color: '#333', lineHeight: 1.7 }}>
            {meaning}
          </div>
          {item.image_url && (
            <img src={item.image_url} alt={item.idiom}
              style={{ width: 70, height: 70, objectFit: 'contain',
                borderRadius: 10, marginTop: 12 }}/>
          )}
        </div>

        {/* Pinyin hint */}
        {showHint && (
          <div style={{ background: '#FFF8E1', borderRadius: 12,
            border: '1px solid #FFE082', padding: '10px 14px',
            marginBottom: 12, textAlign: 'center',
            fontSize: 15, color: '#F57F17', letterSpacing: 2 }}>
            💡 {item.pinyin}
          </div>
        )}

        {/* Input area */}
        <div style={{ background: '#fff', borderRadius: 16,
          border: `2px solid ${answered ? correct ? '#2E7D32' : '#C62828' : '#FFE082'}`,
          padding: '16px', marginBottom: 12 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder={t('在此输入成语…','Type the idiom here…','Scrivi il proverbio…')}
            disabled={answered}
            style={{
              width: '100%', border: 'none', outline: 'none',
              fontSize: 24, fontFamily: "'STKaiti','KaiTi',serif",
              letterSpacing: 4, color: '#333', background: 'transparent',
              textAlign: 'center',
            }}
          />
        </div>

        {/* Buttons */}
        {!answered ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowHint(h => !h)}
              style={{ flex: 1, padding: '11px', borderRadius: 12,
                border: '1px solid #FFE082', background: '#FFF8E1',
                color: '#F57F17', fontSize: 13, cursor: 'pointer' }}>
              💡 {t(showHint ? '隐藏拼音' : '显示拼音',
                    showHint ? 'Hide pinyin' : 'Show pinyin',
                    showHint ? 'Nascondi' : 'Mostra pinyin')}
            </button>
            <button onClick={handleSubmit}
              style={{ flex: 2, padding: '11px', borderRadius: 12,
                border: 'none', background: '#F57F17',
                color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {t('确认','Confirm','Conferma')} ✓
            </button>
          </div>
        ) : (
          <div style={{ padding: '12px 16px', borderRadius: 14,
            background: correct ? '#E8F5E9' : '#FFEBEE',
            border: `1px solid ${correct ? '#A5D6A7' : '#FFCDD2'}`,
            fontSize: 14, textAlign: 'center',
            color: correct ? '#1B5E20' : '#C62828' }}>
            {correct
              ? `✓ ${t('正确！+10⭐','Correct! +10⭐','Esatto! +10⭐')}`
              : `✗ ${t('正确答案：','Answer:','Risposta:')} `}
            {!correct && (
              <span style={{ fontFamily: "'STKaiti','KaiTi',serif",
                fontSize: 18, letterSpacing: 3, fontWeight: 700 }}>
                {item.idiom}
              </span>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px' }}>
        <LearningNav
          onPrev={idx > 0 ? () => { setIdx(i => i - 1); setInput(''); setAnswered(false); setCorrect(false); setShowHint(false); } : null}
          onRefresh={() => { setInput(''); setAnswered(false); setCorrect(false); setShowHint(false); }}
          onNext={answered && idx < idioms.length - 1 ? handleNext : null}
          label={`${idx + 1} / ${idioms.length}`}
          color="#F57F17"
        />
      </div>
    </div>
  );
}

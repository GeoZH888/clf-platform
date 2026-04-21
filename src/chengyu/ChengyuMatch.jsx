// src/chengyu/ChengyuMatch.jsx
// Tap idiom → tap matching meaning — 6 pairs race
import { useState, useCallback } from 'react';
import PointsBadge from '../components/PointsBadge.jsx';
import { usePoints } from '../hooks/usePoints.js';

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function buildPairs(idioms, lang) {
  const sample = shuffle(idioms).slice(0, 6);
  const meaning = (i) => lang==='zh' ? i.meaning_zh
    : lang==='it' ? (i.meaning_it || i.meaning_zh)
    : (i.meaning_en || i.meaning_zh);
  const lefts  = shuffle(sample.map(i => ({ id: i.id, text: i.idiom,   type:'idiom',   pairId: i.id })));
  const rights = shuffle(sample.map(i => ({ id: i.id+'m', text: meaning(i), type:'meaning', pairId: i.id })));
  return { lefts, rights };
}

export default function ChengyuMatch({ idioms = [], lang = 'zh', onBack }) {
  const { total: points, earn } = usePoints();
  const t = (zh, en, it) => lang==='zh' ? zh : lang==='it' ? it : en;

  const init = useCallback(() => {
    const { lefts, rights } = buildPairs(idioms, lang);
    return { lefts, rights, sel: null, matched: new Set(), errors: 0, done: false };
  }, [idioms, lang]);

  const [state, setState] = useState(init);

  function restart() { setState(init()); }

  async function handleTap(item) {
    if (state.matched.has(item.pairId) || state.done) return;

    if (!state.sel) {
      setState(s => ({ ...s, sel: item }));
      return;
    }

    if (state.sel.id === item.id) { // deselect
      setState(s => ({ ...s, sel: null }));
      return;
    }

    if (state.sel.pairId === item.pairId && state.sel.type !== item.type) {
      // Correct match
      const newMatched = new Set(state.matched);
      newMatched.add(item.pairId);
      const done = newMatched.size === Math.min(6, idioms.length);
      if (done) await earn('chengyu_match_all', 'chengyu', { count: newMatched.size });
      setState(s => ({ ...s, sel: null, matched: newMatched, done }));
    } else {
      // Wrong
      setState(s => ({ ...s, errors: s.errors + 1, sel: null }));
    }
  }

  const tileStyle = (item) => {
    const isMatched = state.matched.has(item.pairId);
    const isSel     = state.sel?.id === item.id;
    return {
      padding: '10px 8px', borderRadius: 12, cursor: 'pointer',
      background: isMatched ? '#E8F5E9' : isSel ? '#E3F2FD' : '#fff',
      border: `2px solid ${isMatched ? '#2E7D32' : isSel ? '#1565C0' : '#E0E0E0'}`,
      fontSize: item.type === 'idiom' ? 16 : 12,
      fontFamily: item.type === 'idiom' ? "'STKaiti','KaiTi',serif" : 'inherit',
      color: isMatched ? '#1B5E20' : isSel ? '#0D47A1' : '#333',
      letterSpacing: item.type === 'idiom' ? 2 : 0,
      opacity: isMatched ? 0.7 : 1,
      transition: 'all 0.15s',
      textAlign: 'center', lineHeight: 1.4,
      minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
      WebkitTapHighlightColor: 'transparent',
    };
  };

  return (
    <div style={{ background: 'var(--bg,#F5F5F5)', minHeight: '100dvh', paddingBottom: 80 }}>
      <div style={{ background: '#C62828', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none',
          fontSize: 24, color: '#fff', cursor: 'pointer' }}>‹</button>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', flex: 1 }}>
          {t('配对游戏','Match Game','Abbinamento')} · ✗{state.errors}
        </div>
        <PointsBadge total={points} size="small" color="#FFD700"/>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 12, color: '#90A4AE', marginBottom: 12, textAlign: 'center' }}>
          {t('点击成语，再点对应意思','Tap idiom, then tap its meaning','Tocca proverbio, poi significato')}
          · {state.matched.size}/{Math.min(6, idioms.length)} {t('对','pairs','coppie')}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {state.lefts.map(item => (
            <button key={item.id} onClick={() => handleTap(item)} style={tileStyle(item)}>
              {item.text}
            </button>
          ))}
          {state.rights.map(item => (
            <button key={item.id} onClick={() => handleTap(item)} style={tileStyle(item)}>
              {item.text}
            </button>
          ))}
        </div>

        {state.done && (
          <div style={{ marginTop: 16, background: '#E8F5E9', borderRadius: 16,
            border: '2px solid #2E7D32', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🏆</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1B5E20', marginBottom: 8 }}>
              {t('全部配对成功！+20⭐','All matched! +20⭐','Tutti abbinati! +20⭐')}
            </div>
            <div style={{ fontSize: 13, color: '#2E7D32', marginBottom: 16 }}>
              {t('错误次数','Errors','Errori')}: {state.errors}
            </div>
            <button onClick={restart} style={{
              padding: '10px 28px', borderRadius: 14, border: 'none',
              background: '#2E7D32', color: '#fff', fontSize: 14,
              fontWeight: 600, cursor: 'pointer',
            }}>
              {t('再玩一次','Play Again','Ancora')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

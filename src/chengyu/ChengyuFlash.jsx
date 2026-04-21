// src/chengyu/ChengyuFlash.jsx
import { useState } from 'react';
import LearningNav from '../components/LearningNav.jsx';
import PointsBadge from '../components/PointsBadge.jsx';
import { usePoints } from '../hooks/usePoints.js';

function FlipCard({ idiom, lang }) {
  const [flipped, setFlipped] = useState(false);
  const meaning = lang==='zh' ? idiom.meaning_zh
    : lang==='it' ? (idiom.meaning_it || idiom.meaning_zh)
    : (idiom.meaning_en || idiom.meaning_zh);
  const story = lang==='zh' ? idiom.story_zh
    : lang==='it' ? (idiom.story_it || idiom.story_en || idiom.story_zh)
    : (idiom.story_en || idiom.story_zh);

  return (
    <div onClick={() => setFlipped(f => !f)}
      style={{
        perspective: 1000,
        cursor: 'pointer',
        minHeight: 280,
        WebkitTapHighlightColor: 'transparent',
      }}>
      <div style={{
        position: 'relative',
        width: '100%',
        minHeight: 280,
        transformStyle: 'preserve-3d',
        transition: 'transform 0.55s cubic-bezier(0.4,0,0.2,1)',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>

        {/* Front — idiom */}
        <div style={{
          position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
          background: 'linear-gradient(135deg, #FFF8E1 0%, #FBE9E7 100%)',
          borderRadius: 20, border: '2px solid #E8D5B0',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          {idiom.image_url && (
            <img src={idiom.image_url} alt={idiom.idiom}
              style={{ width: 90, height: 90, objectFit: 'contain',
                borderRadius: 12, marginBottom: 16,
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))' }}/>
          )}
          <div style={{ fontSize: 44, fontWeight: 700, color: '#5D2E0C',
            fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 4,
            textAlign: 'center', lineHeight: 1.3 }}>
            {idiom.idiom}
          </div>
          <div style={{ fontSize: 16, color: '#8B4513', marginTop: 10,
            letterSpacing: 2 }}>
            {idiom.pinyin}
          </div>
          <div style={{ fontSize: 12, color: '#a07850', marginTop: 20,
            opacity: 0.7 }}>
            {lang==='zh' ? '点击翻面' : lang==='it' ? 'Tocca per girare' : 'Tap to flip'} ↩
          </div>
        </div>

        {/* Back — meaning + story */}
        <div style={{
          position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: 'linear-gradient(135deg, #E3F2FD 0%, #E8F5E9 100%)',
          borderRadius: 20, border: '2px solid #BBDEFB',
          display: 'flex', flexDirection: 'column',
          padding: 20, overflow: 'hidden',
        }}>
          <div style={{ fontSize: 13, color: '#1565C0', fontWeight: 600,
            marginBottom: 4, opacity: 0.7 }}>
            {idiom.idiom}
          </div>
          {/* Meaning */}
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1565C0',
            lineHeight: 1.5, marginBottom: 12 }}>
            {meaning}
          </div>
          {/* Example */}
          {idiom.example_zh && (
            <div style={{ fontSize: 13, color: '#2E7D32', background: '#E8F5E9',
              borderRadius: 10, padding: '8px 12px', marginBottom: 10,
              borderLeft: '3px solid #2E7D32' }}>
              <span style={{ fontWeight: 600, marginRight: 4 }}>例：</span>
              {idiom.example_zh}
            </div>
          )}
          {/* Story snippet */}
          {story && (
            <div style={{ fontSize: 12, color: '#546E7A', lineHeight: 1.6,
              flex: 1, overflow: 'hidden' }}>
              <span style={{ fontWeight: 600 }}>典故：</span>
              {story.length > 80 ? story.slice(0, 80) + '…' : story}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#90A4AE', marginTop: 8, textAlign: 'right' }}>
            {lang==='zh' ? '点击返回' : lang==='it' ? 'Tocca per tornare' : 'Tap to go back'} ↩
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChengyuFlash({ idioms = [], lang = 'zh', onBack }) {
  const [idx, setIdx] = useState(0);
  const { total: points, earn } = usePoints();
  const [earnedDelta, setEarnedDelta] = useState(0);
  const t = (zh, en, it) => lang==='zh' ? zh : lang==='it' ? it : en;

  if (!idioms.length) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#a07850' }}>
      {t('暂无成语', 'No idioms yet', 'Nessun proverbio')}
    </div>
  );

  async function handleNext() {
    if (idx < idioms.length - 1) {
      const pts = await earn('chengyu_flash', 'chengyu', { idiom: idioms[idx].idiom });
      setEarnedDelta(pts);
      setIdx(i => i + 1);
    }
  }
  function handlePrev() { if (idx > 0) setIdx(i => i - 1); }
  function handleReset() { setIdx(0); }

  return (
    <div style={{ background: 'var(--bg,#F5F5F5)', minHeight: '100dvh', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: '#8B4513', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none',
          fontSize: 24, color: '#fff', cursor: 'pointer' }}>‹</button>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', flex: 1 }}>
          {t('成语闪卡','Flashcards','Flashcard')}
        </div>
        <PointsBadge total={points} size="small" color="#FFD700"/>
      </div>

      {/* Progress */}
      <div style={{ padding: '12px 16px 0',
        display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 6, background: '#E8D5B0',
          borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: '#8B4513', borderRadius: 3,
            width: `${((idx + 1) / idioms.length) * 100}%`,
            transition: 'width 0.3s ease' }}/>
        </div>
        <div style={{ fontSize: 12, color: '#a07850', minWidth: 40 }}>
          {idx + 1} / {idioms.length}
        </div>
      </div>

      {/* Card */}
      <div style={{ padding: '14px 16px 0' }}>
        <FlipCard idiom={idioms[idx]} lang={lang}/>
      </div>

      {/* Difficulty badge */}
      <div style={{ textAlign: 'center', marginTop: 10 }}>
        {['⭐','⭐⭐','⭐⭐⭐','⭐⭐⭐⭐'][idioms[idx].difficulty - 1]}
        <span style={{ fontSize: 11, color: '#a07850', marginLeft: 6 }}>
          {t('难度','Difficulty','Difficoltà')}
        </span>
      </div>

      {/* Nav */}
      <div style={{ padding: '10px 16px' }}>
        <LearningNav
          onPrev={idx > 0 ? handlePrev : null}
          onRefresh={handleReset}
          onNext={idx < idioms.length - 1 ? handleNext : null}
          label={`${idx + 1} / ${idioms.length}`}
          color="#8B4513"
        />
      </div>
    </div>
  );
}

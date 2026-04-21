// src/chengyu/ChengyuStory.jsx
import { useState } from 'react';
import LearningNav from '../components/LearningNav.jsx';
import PointsBadge from '../components/PointsBadge.jsx';
import { usePoints } from '../hooks/usePoints.js';

export default function ChengyuStory({ idioms = [], lang = 'zh', onBack }) {
  const [idx, setIdx] = useState(0);
  const { total: points, earn } = usePoints();
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
  const story = lang==='zh' ? (item.story_zh || '')
    : lang==='it' ? (item.story_it || item.story_en || item.story_zh || '')
    : (item.story_en || item.story_zh || '');

  async function handleNext() {
    if (idx < idioms.length - 1) {
      await earn('chengyu_story', 'chengyu', { idiom: item.idiom });
      setIdx(i => i + 1);
    }
  }

  return (
    <div style={{ background: 'var(--bg,#F5F5F5)', minHeight: '100dvh', paddingBottom: 80 }}>
      <div style={{ background: '#6A1B9A', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none',
          fontSize: 24, color: '#fff', cursor: 'pointer' }}>‹</button>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', flex: 1 }}>
          {t('典故阅读','Read Story','Leggi Storia')}
        </div>
        <PointsBadge total={points} size="small" color="#FFD700"/>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Idiom header */}
        <div style={{ background: 'linear-gradient(135deg,#F3E5F5,#EDE7F6)',
          borderRadius: 18, border: '2px solid #CE93D8', padding: '20px',
          textAlign: 'center', marginBottom: 14 }}>
          {item.image_url && (
            <img src={item.image_url} alt={item.idiom}
              style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: 12,
                marginBottom: 12 }}/>
          )}
          <div style={{ fontSize: 36, fontWeight: 700, color: '#4A148C',
            fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 4 }}>
            {item.idiom}
          </div>
          <div style={{ fontSize: 15, color: '#7B1FA2', marginTop: 6, letterSpacing: 1 }}>
            {item.pinyin}
          </div>
          <div style={{ fontSize: 14, color: '#6A1B9A', marginTop: 10,
            background: 'rgba(106,27,154,0.08)', borderRadius: 10,
            padding: '8px 14px', lineHeight: 1.6 }}>
            {meaning}
          </div>
        </div>

        {/* Story */}
        {story ? (
          <div style={{ background: '#fff', borderRadius: 16,
            border: '1px solid #E1BEE7', padding: '18px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6A1B9A',
              marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              📖 {t('典故来源','Historical Origin','Origine Storica')}
            </div>
            <div style={{ fontSize: 14, color: '#333', lineHeight: 1.85 }}>
              {story}
            </div>
          </div>
        ) : (
          <div style={{ background: '#F3E5F5', borderRadius: 14,
            padding: '16px', textAlign: 'center', color: '#6A1B9A', fontSize: 13 }}>
            {t('典故内容待添加','Story coming soon','Storia in arrivo')}
          </div>
        )}

        {/* Example */}
        {item.example_zh && (
          <div style={{ marginTop: 12, background: '#F3E5F5', borderRadius: 14,
            padding: '12px 16px', borderLeft: '3px solid #6A1B9A' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6A1B9A' }}>
              {t('例句 · ','Example · ','Esempio · ')}
            </span>
            <span style={{ fontSize: 13, color: '#333' }}>{item.example_zh}</span>
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px' }}>
        <LearningNav
          onPrev={idx > 0 ? () => setIdx(i => i - 1) : null}
          onRefresh={() => setIdx(0)}
          onNext={idx < idioms.length - 1 ? handleNext : null}
          label={`${idx + 1} / ${idioms.length}`}
          color="#6A1B9A"
        />
      </div>
    </div>
  );
}

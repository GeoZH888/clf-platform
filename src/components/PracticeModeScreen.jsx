// src/components/PracticeModeScreen.jsx
// Mode-picker shown when the user taps 练习 in the bottom nav.
// Three cards: free-browse (default, goes to set list in free mode),
// ⏱ Dictation (enters PracticeScreen with mode=dictation preset),
// ◧ Completion (enters PracticeScreen with mode=completion preset).
//
// After selection, parent routes to 'home' (set list) with `practiceMode`
// stored in App state; PracticeScreen reads it via the `initialMode` prop.

import React from 'react';
import { useLang } from '../context/LanguageContext.jsx';

export default function PracticeModeScreen({ onSelectMode, onBack }) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it || en) : en;

  const modes = [
    {
      id: 'free',
      icon: '📖',
      title: t('字集列表', 'Browse sets', 'Elenco caratteri'),
      desc:  t('浏览字集 · 描红与笔顺', 'Browse & trace · stroke order', 'Sfoglia e traccia'),
      color: '#8B4513',
      bg:    '#fff8e1',
    },
    {
      id: 'dictation',
      icon: '⏱',
      title: t('默写练习', 'Dictation', 'Dettato'),
      desc:  t('看拼音或意思默写 · 计时', 'Write from pinyin/meaning · timed', 'Dal pinyin, a tempo'),
      color: '#8B4513',
      bg:    '#fbe9e7',
    },
    {
      id: 'completion',
      icon: '◧',
      title: t('补笔练习', 'Stroke completion', 'Completa tratti'),
      desc:  t('补齐隐藏的笔画 · 自适应难度', 'Fill hidden strokes · adaptive', 'Riempi tratti · adattivo'),
      color: '#6A1B9A',
      bg:    '#f3e5f5',
    },
  ];

  return (
    <div style={{ padding: '16px', maxWidth: 430, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        {onBack && (
          <button onClick={onBack} style={{
            padding: '6px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 8,
            border: '1px solid #e8d5b0', background: '#fff', color: '#8B4513',
          }}>‹ {t('返回', 'Back', 'Indietro')}</button>
        )}
        <h2 style={{ margin: 0, fontSize: 20, color: '#8B4513' }}>
          {t('选择练习模式', 'Choose practice mode', 'Scegli modalità')}
        </h2>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {modes.map(m => (
          <button key={m.id} onClick={() => onSelectMode?.(m.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 18px', borderRadius: 14,
              border: `1.5px solid ${m.color}22`,
              background: m.bg,
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              width: '100%',
              WebkitTapHighlightColor: 'transparent',
            }}>
            <div style={{ fontSize: 32, width: 48, textAlign: 'center', lineHeight: 1 }}>
              {m.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: m.color, marginBottom: 2 }}>
                {m.title}
              </div>
              <div style={{ fontSize: 12, color: '#5D2E0C', opacity: 0.75 }}>
                {m.desc}
              </div>
            </div>
            <div style={{ fontSize: 22, color: m.color, opacity: 0.6 }}>›</div>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, color: '#a07850', textAlign: 'center', marginTop: 18, lineHeight: 1.5 }}>
        {t(
          '选模式 → 选字集 → 选字 → 开练',
          'Mode → set → character → practice',
          'Modalità → set → carattere → pratica'
        )}
      </div>
    </div>
  );
}

// src/components/HomeScreen.jsx
// Phase 3B: Added PathSelector + filter sets by current path
// Phase 4 (NEW): Adaptive set ordering + "Next Up" card driven by useAdaptiveLearning

import { useState, useEffect, useMemo } from 'react';
import { useLang } from '../context/LanguageContext.jsx';
import ModuleTemplate from './ModuleTemplate.jsx';
import AdaptiveCard from './AdaptiveCard.jsx';
import PathSelector, { matchesPath } from './PathSelector.jsx';
import { useAdaptiveLearning } from '../hooks/useAdaptiveLearning.js';

const PATH_STORAGE_KEY = 'clf_current_path';

export default function HomeScreen({
  sets = [],
  progress = {},
  stats = {},
  onSelectSet,
  onGames,
  onBack,
}) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? it : en;

  // Path selection state
  const [currentPath, setCurrentPath] = useState(() => {
    try { return localStorage.getItem(PATH_STORAGE_KEY) || 'all'; }
    catch { return 'all'; }
  });

  useEffect(() => {
    try { localStorage.setItem(PATH_STORAGE_KEY, currentPath); } catch {}
  }, [currentPath]);

  const streak         = stats?.streak         ?? 0;
  const totalPracticed = stats?.totalPracticed  ?? 0;
  const accuracy       = stats?.accuracy        ?? null;
  const characters     = progress?.characters   ?? {};

  // Filter sets by path
  const filteredSets = sets.filter(s => matchesPath(s.id, currentPath));

  // ── Adaptive learning ─────────────────────────────────────────────────
  // Flatten all characters across visible sets into one list for the hook.
  // Each item needs: id (used as key), difficulty, hsk_level.
  // We use the character text as `id` since that's the natural key for 练字.
  const flatChars = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const s of filteredSets) {
      for (const c of (s.chars || [])) {
        if (!c?.c || seen.has(c.c)) continue;
        seen.add(c.c);
        out.push({
          id:         c.c,                  // character text as id
          character:  c.c,
          hsk_level:  c.hsk_level ?? c.hsk ?? s.level ?? 1,
          difficulty: c.difficulty ?? c.strokes ?? s.level ?? 1,
          set_id:     s.id,                 // remember which set this char is in
        });
      }
    }
    return out;
  }, [filteredSets]);

  const {
    loading: adaptiveLoading,
    stats: adaptiveStats,
    getAdaptiveQueue,
    getNextFocusLabel,
    getItemMastery,
    isDue,
  } = useAdaptiveLearning(flatChars, {
    idField:       'id',
    diffField:     'difficulty',
    hskField:      'hsk_level',
    module:        'lianzi',
    progressTable: 'clf_lianzi_progress',
    itemIdCol:     'character',         // matches our SQL column name
  });

  // Top 5 recommended characters (the "Next Up" queue)
  const adaptiveQueue = useMemo(
    () => adaptiveLoading ? [] : getAdaptiveQueue(5),
    [adaptiveLoading, getAdaptiveQueue, flatChars]
  );

  // ── Set ordering ──────────────────────────────────────────────────────
  // Score each set by how many of its chars are due/new (higher = surface first)
  function setAdaptivePriority(set) {
    if (adaptiveLoading) return 0;
    const chars = set.chars || [];
    let due = 0, fresh = 0;
    for (const c of chars) {
      const m = getItemMastery(c.c);
      if (m === 0) fresh++;
      else if (isDue(c.c)) due++;
    }
    // Sets with due reviews bubble up first; then sets with new content
    return due * 100 + fresh * 1;
  }

  const orderedSets = useMemo(() => {
    if (adaptiveLoading) return filteredSets;
    return [...filteredSets].sort((a, b) =>
      setAdaptivePriority(b) - setAdaptivePriority(a)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSets, adaptiveLoading, adaptiveStats]);

  // Count practiced characters
  const practicedCount = Object.keys(characters).length;
  const totalChars     = filteredSets.reduce((n, s) => n + (s.chars?.length ?? 0), 0);

  // ── Sub-module cards ──────────────────────────────────────────────────
  const modules = orderedSets.map((set, i) => {
    const done    = set.chars?.filter(c => characters[c.c]).length ?? 0;
    const total   = set.chars?.length ?? 0;
    const pct     = total > 0 ? Math.round((done / total) * 100) : 0;
    const setName = lang === 'zh' ? set.name
                  : lang === 'it' ? (set.nameIt || set.name)
                  : (set.nameEn || set.name);
    const preview = set.chars?.slice(0, 8).map(c => c.c).join('') ?? '';

    // Adaptive badge: show if this set has due/new to surface why it's at top
    const priority = setAdaptivePriority(set);
    let adaptiveBadge = null;
    if (!adaptiveLoading && i === 0 && priority > 0) {
      const dueCount = (set.chars || []).filter(c =>
        getItemMastery(c.c) > 0 && isDue(c.c)
      ).length;
      if (dueCount > 0) {
        adaptiveBadge = t(`📚 ${dueCount}个待复习`, `📚 ${dueCount} due`, `📚 ${dueCount} da rivedere`);
      }
    }

    return {
      id:     set.id,
      icon:   set.emoji || '📖',
      title:  setName,
      desc:   `${done}/${total} ${t('字','chars','car.')} · ${preview}${adaptiveBadge ? ' · ' + adaptiveBadge : ''}`,
      tag:    `Lv.${set.level ?? 1}`,
      badge:  set.emoji || (i + 1),
      color:  pct === 100 ? '#E8F5E9' : pct > 0 ? '#FFF8E1' : '#fff',
      accent: pct === 100 ? '#2E7D32' : pct > 0 ? '#F9A825' : '#8B4513',
      onClick: () => onSelectSet?.(set),
    };
  });

  const statsChips = [
    { value: streak,         label: t('连续天数', 'Streak', 'Giorni') },
    { value: totalPracticed, label: t('练习次数', 'Practices', 'Sessioni') },
    ...(accuracy !== null ? [{ value: accuracy + '%', label: t('笔顺准确', 'Accuracy', 'Accuratezza') }] : []),
  ];

  return (
    <ModuleTemplate
      color="#8B4513"
      icon="✍️"
      title={t('练字', 'Character Writing', 'Scrittura')}
      subtitle={t('笔顺 · 临摹 · 声调练习', 'Stroke order · tracing · tones', 'Tratti · tracciamento · toni')}
      onBack={onBack}
      backLabel={t('‹ 返回主页', '‹ Back', '‹ Indietro')}
      stats={statsChips}
      modules={modules}
      lang={lang}
      extra={
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {/* Path selector */}
          <PathSelector
            currentPath={currentPath}
            onSelectPath={setCurrentPath}
            lang={lang}
          />

          {/* Adaptive tier card (existing) */}
          <AdaptiveCard module="lianzi" lang={lang}/>

          {/* NEXT UP card — adaptive recommendations (NEW) */}
          {!adaptiveLoading && adaptiveQueue.length > 0 && (
            <NextUpCard
              queue={adaptiveQueue}
              focusLabel={getNextFocusLabel(lang)}
              stats={adaptiveStats}
              onCharClick={(charText) => {
                // Find the set that contains this character and navigate to it
                const target = filteredSets.find(s =>
                  s.chars?.some(c => c.c === charText)
                );
                if (target) onSelectSet?.(target);
              }}
              t={t}
            />
          )}

          {/* Empty path message */}
          {filteredSets.length === 0 && (
            <div style={{
              background: '#fff8e1', borderRadius: 14, padding: '20px 16px',
              border: '1px dashed #F57F17', textAlign: 'center',
              color: '#a07850', fontSize: 13,
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {t('这条路径还没字符', 'No characters in this path yet', 'Nessun carattere')}
              </div>
              <div style={{ fontSize: 11 }}>
                {currentPath === 'hsk' && t('去 admin 导入 HSK 字', 'Import HSK via admin', 'Importa HSK dall\'admin')}
                {currentPath === 'jinan' && t('去 admin 导入暨南字', 'Import Jinan chars via admin', 'Importa Jinan dall\'admin')}
                {currentPath === 'theme' && t('主题集还没字', 'No theme sets', 'Nessun tema')}
              </div>
            </div>
          )}

          {/* Path progress bar */}
          {totalChars > 0 && (
            <div style={{
              background: '#fff', borderRadius: 14, padding: '12px 16px',
              border: '1px solid #E8D5B0',
              fontSize: 12, color: '#a07850',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span>
                {t('此路径进度', 'Path progress', 'Progresso')}：
                {filteredSets.reduce((n, s) => n + (s.chars?.filter(c => characters[c.c]).length ?? 0), 0)}
                / {totalChars} {t('字', 'chars', 'car.')}
              </span>
              <div style={{
                flex: 1, maxWidth: 160, height: 6, borderRadius: 3,
                background: '#E8D5B0', marginLeft: 12, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 3, background: '#8B4513',
                  width: `${totalChars > 0 ? Math.round((filteredSets.reduce((n, s) => n + (s.chars?.filter(c => characters[c.c]).length ?? 0), 0) / totalChars) * 100) : 0}%`,
                  transition: 'width 0.4s ease',
                }}/>
              </div>
            </div>
          )}
        </div>
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// "Next Up" card — surfaces the top 5 chars to study now
// ─────────────────────────────────────────────────────────────────────────
function NextUpCard({ queue, focusLabel, stats, onCharClick, t }) {
  const dueCount = stats?.due ?? 0;
  const newCount = stats?.new ?? 0;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)',
      border: '1.5px solid #E8D5B0',
      borderRadius: 16, padding: '14px 16px',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 10 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>🎯</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#8B4513' }}>
            {t('接下来练这些字', 'Practice these next', 'Pratica questi')}
          </span>
        </div>
        {focusLabel && (
          <span style={{ fontSize: 11, color: '#8B4513', opacity: 0.85 }}>
            {focusLabel}
          </span>
        )}
      </div>

      {/* Character grid */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {queue.map(item => (
          <button
            key={item.id}
            onClick={() => onCharClick?.(item.character || item.id)}
            style={{
              width: 56, height: 56, borderRadius: 12,
              background: item._due ? '#FFE0B2' : item._isNew ? '#fff' : '#F1F8E9',
              border: `1.5px solid ${item._due ? '#F57F17' : item._isNew ? '#8B4513' : '#A5D6A7'}`,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              fontFamily: "'STKaiti','KaiTi',Georgia,serif",
              padding: 0,
              WebkitTapHighlightColor: 'transparent',
            }}
            title={item._due ? '待复习' : item._isNew ? '新字' : '已掌握'}
          >
            <div style={{
              fontSize: 22, fontWeight: 500,
              color: item._due ? '#E65100' : item._isNew ? '#8B4513' : '#2E7D32',
              lineHeight: 1,
            }}>
              {item.character || item.id}
            </div>
            <div style={{ fontSize: 9, marginTop: 2, opacity: 0.7 }}>
              {item._due ? '复习' : item._isNew ? '新' : '✓'}
            </div>
          </button>
        ))}
      </div>

      {/* Summary line */}
      {(dueCount > 0 || newCount > 0) && (
        <div style={{
          marginTop: 10, fontSize: 11, color: '#8B4513', opacity: 0.8,
          display: 'flex', gap: 12,
        }}>
          {dueCount > 0 && (
            <span>📚 {dueCount} {t('个待复习', 'due', 'da rivedere')}</span>
          )}
          {newCount > 0 && (
            <span>✨ {newCount} {t('个新字', 'new', 'nuovi')}</span>
          )}
        </div>
      )}
    </div>
  );
}

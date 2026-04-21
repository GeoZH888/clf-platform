// src/components/HomeScreen.jsx
// Phase 3B: Added PathSelector + filter sets by current path

import { useState, useEffect } from 'react';
import { useLang } from '../context/LanguageContext.jsx';
import ModuleTemplate from './ModuleTemplate.jsx';
import AdaptiveCard from './AdaptiveCard.jsx';
import PathSelector, { matchesPath } from './PathSelector.jsx';

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

  // Save path changes (local only — DB sync is optional for future)
  useEffect(() => {
    try { localStorage.setItem(PATH_STORAGE_KEY, currentPath); } catch {}
  }, [currentPath]);

  const streak         = stats?.streak         ?? 0;
  const totalPracticed = stats?.totalPracticed  ?? 0;
  const accuracy       = stats?.accuracy        ?? null;
  const characters     = progress?.characters   ?? {};

  // Filter sets by path
  const filteredSets = sets.filter(s => matchesPath(s.id, currentPath));

  // Count practiced characters (across all sets, unfiltered)
  const practicedCount = Object.keys(characters).length;
  const totalChars     = filteredSets.reduce((n, s) => n + (s.chars?.length ?? 0), 0);

  // ── Sub-module cards ──────────────────────────────────────────────────────
  const modules = [
    // One card per character set (filtered)
    ...filteredSets.map((set, i) => {
      const done     = set.chars?.filter(c => characters[c.c]).length ?? 0;
      const total    = set.chars?.length ?? 0;
      const pct      = total > 0 ? Math.round((done / total) * 100) : 0;
      const setName  = lang === 'zh' ? set.name
                     : lang === 'it' ? (set.nameIt || set.name)
                     : (set.nameEn || set.name);
      const preview  = set.chars?.slice(0, 8).map(c => c.c).join('') ?? '';

      return {
        id:     set.id,
        icon:   set.emoji || '📖',
        title:  setName,
        desc:   `${done}/${total} ${t('字','chars','car.')} · ${preview}`,
        tag:    `Lv.${set.level ?? 1}`,
        badge:  set.emoji || (i + 1),
        color:  pct === 100 ? '#E8F5E9' : pct > 0 ? '#FFF8E1' : '#fff',
        accent: pct === 100 ? '#2E7D32' : pct > 0 ? '#F9A825' : '#8B4513',
        onClick: () => onSelectSet?.(set),
      };
    }),

    // Games card at the end (always visible)
    /*
    {
      id:     'games',
      icon:   '🎮',
      title:  t('进阶游戏', 'Practice Games', 'Giochi'),
      desc:   t('Memory · Quiz · 挑战', 'Memory · Quiz · Challenge', 'Memory · Quiz · Sfida'),
      badge:  '★',
      color:  '#EDE7F6',
      accent: '#6A1B9A',
      onClick: onGames,
    },
    */

    
  ];

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
          {/* Path selector at top */}
          <PathSelector
            currentPath={currentPath}
            onSelectPath={setCurrentPath}
            lang={lang}
          />
          
          <AdaptiveCard module="lianzi" lang={lang}/>
          
          {/* Show "no sets in this path" message */}
          {filteredSets.length === 0 && (
            <div style={{
              background: '#fff8e1', borderRadius: 14, padding: '20px 16px',
              border: '1px dashed #F57F17',
              textAlign: 'center',
              color: '#a07850',
              fontSize: 13,
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

// src/components/PathSelector.jsx
//
// 学习路径选择器 — 放在 HomeScreen 顶部
// 用户选: HSK 考试 / 暨南教材 / 主题浏览
//
// Usage:
//   <PathSelector
//     currentPath={currentPath}
//     onSelectPath={(pathId) => setCurrentPath(pathId)}
//     lang={lang}
//   />

import { useState } from 'react';

const PATHS = [
  {
    id: 'hsk',
    label: 'HSK 考试',
    labelEn: 'HSK Exam',
    labelIt: 'HSK',
    icon: '🎯',
    color: '#F57F17',
    bg: '#FFF8E1',
    desc: '考试标准字表',
    descEn: 'Test-standard',
    descIt: 'Esame standard',
    matchPrefix: 'hsk_',
  },
  {
    id: 'jinan',
    label: '暨南中文',
    labelEn: 'Jinan Chinese',
    labelIt: 'Jinan',
    icon: '📚',
    color: '#C62828',
    bg: '#FFEBEE',
    desc: '华侨教材路径',
    descEn: 'Heritage textbook',
    descIt: 'Libri di testo',
    matchPrefix: 'jinan_',
  },
  {
    id: 'theme',
    label: '主题浏览',
    labelEn: 'By Theme',
    labelIt: 'Per Tema',
    icon: '🎨',
    color: '#2E7D32',
    bg: '#E8F5E9',
    desc: '按主题字源',
    descEn: 'Semantic groups',
    descIt: 'Gruppi semantici',
    matchPrefix: null,    // 其他所有 set (nature/animals/body/...)
  },
  {
    id: 'all',
    label: '全部',
    labelEn: 'All',
    labelIt: 'Tutti',
    icon: '📖',
    color: '#6A1B9A',
    bg: '#F3E5F5',
    desc: '所有字',
    descEn: 'Everything',
    descIt: 'Tutto',
    matchPrefix: '__all__',
  },
];

// Helper: 根据 path id 判断一个 set_id 是否属于该 path
export function matchesPath(setId, pathId) {
  if (!pathId || pathId === 'all') return true;
  const path = PATHS.find(p => p.id === pathId);
  if (!path) return true;
  if (path.matchPrefix === null) {
    // theme 路径 = 不是 hsk_ 也不是 jinan_
    return !setId.startsWith('hsk_') && !setId.startsWith('jinan_');
  }
  return setId.startsWith(path.matchPrefix);
}

export default function PathSelector({ currentPath = 'all', onSelectPath, lang = 'zh' }) {
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? it : en;

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      padding: '12px',
      border: '1px solid #E8D5B0',
      marginBottom: 12,
    }}>
      <div style={{
        fontSize: 11,
        color: '#a07850',
        fontWeight: 600,
        marginBottom: 8,
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}>
        {t('学习路径', 'Learning Path', 'Percorso')}
      </div>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 6,
      }}>
        {PATHS.map(p => {
          const isActive = currentPath === p.id;
          const label = lang === 'zh' ? p.label 
                      : lang === 'it' ? p.labelIt 
                      : p.labelEn;
          const desc = lang === 'zh' ? p.desc 
                     : lang === 'it' ? p.descIt 
                     : p.descEn;
          
          return (
            <button
              key={p.id}
              onClick={() => onSelectPath(p.id)}
              style={{
                padding: '10px 6px',
                borderRadius: 10,
                border: `2px solid ${isActive ? p.color : '#E8D5B0'}`,
                background: isActive ? p.bg : '#fff',
                cursor: 'pointer',
                transition: 'all 0.15s',
                textAlign: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}>
              <div style={{ fontSize: 20, marginBottom: 2 }}>{p.icon}</div>
              <div style={{ 
                fontSize: 11, 
                fontWeight: isActive ? 700 : 500, 
                color: isActive ? p.color : '#1a0a05',
                lineHeight: 1.2,
              }}>
                {label}
              </div>
              <div style={{ 
                fontSize: 9, 
                color: '#a07850',
                marginTop: 2,
                lineHeight: 1.1,
              }}>
                {desc}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

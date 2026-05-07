// src/teacher/pages/ToolsPage.jsx
// Tabs: 备课向导 | 课程 | 资料
import React, { useState } from 'react';
import { PageHero } from '../../shared/RolePanelLayout';
import CoursePrepWizard from './CoursePrepWizard';
import CoursesPage from './CoursesPage';
import MaterialsPage from './MaterialsPage';

const TABS = [
  { id: 'prep',      label: '备课向导', Component: CoursePrepWizard },
  { id: 'courses',   label: '课程',     Component: CoursesPage },
  { id: 'materials', label: '资料',     Component: MaterialsPage },
];

export default function ToolsPage() {
  const [tab, setTab] = useState('prep');
  const Active = TABS.find(t => t.id === tab)?.Component || CoursePrepWizard;

  return (
    <div>
      <PageHero icon="🛠️" title="教学工具" subtitle="Teaching Tools" accentColor="#c41e3a"/>
      <div style={{
        display: 'flex', gap: 4, marginBottom: 18, padding: 4,
        background: 'rgba(253,246,227,0.05)', borderRadius: 10,
        border: '1px solid rgba(255,245,230,0.1)', width: 'fit-content',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none',
            background: tab === t.id ? '#c41e3a' : 'transparent',
            color: tab === t.id ? '#fff' : 'rgba(253,246,227,0.7)',
            cursor: 'pointer', fontSize: 13,
            fontWeight: tab === t.id ? 700 : 500,
            transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{
        background: 'rgba(253,246,227,0.04)',
        border: '1px solid rgba(255,245,230,0.1)',
        borderRadius: 14, padding: 20,
      }}>
        <Active />
      </div>
    </div>
  );
}

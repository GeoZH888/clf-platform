// src/teacher/pages/MessagesPage.jsx
import React, { useState } from 'react';
import { PageHero } from '../../shared/RolePanelLayout';
import CommunicationPage from './CommunicationPage';
import NoticesPage from './NoticesPage';

const TABS = [
  { id: 'comm',    label: '沟通', Component: CommunicationPage },
  { id: 'notices', label: '通知', Component: NoticesPage },
];

export default function MessagesPage() {
  const [tab, setTab] = useState('comm');
  const Active = TABS.find(t => t.id === tab)?.Component || CommunicationPage;
  return (
    <div>
      <PageHero icon="💬" title="消息通知" subtitle="Messages" accentColor="#c41e3a"/>
      <TabBar tabs={TABS} active={tab} onChange={setTab}/>
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

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 4, marginBottom: 18, padding: 4,
      background: 'rgba(253,246,227,0.05)', borderRadius: 10,
      border: '1px solid rgba(255,245,230,0.1)', width: 'fit-content',
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none',
          background: active === t.id ? '#c41e3a' : 'transparent',
          color: active === t.id ? '#fff' : 'rgba(253,246,227,0.7)',
          cursor: 'pointer', fontSize: 13,
          fontWeight: active === t.id ? 700 : 500,
        }}>{t.label}</button>
      ))}
    </div>
  );
}

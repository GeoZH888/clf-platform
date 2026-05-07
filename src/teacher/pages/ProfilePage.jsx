// src/teacher/pages/ProfilePage.jsx
import React from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { PageHero } from '../../shared/RolePanelLayout';

export default function ProfilePage() {
  const { user } = useAuth();
  return (
    <div>
      <PageHero icon="👤" title="个人资料" subtitle="Profile" accentColor="#c41e3a"/>
      <div style={{
        background: 'rgba(253,246,227,0.05)',
        border: '1px solid rgba(255,245,230,0.15)',
        borderRadius: 12, padding: 20, color: '#fff5e6',
      }}>
        <Row label="姓名"   value={user?.name}/>
        <Row label="账号"   value={user?.email?.split('@')[0]}/>
        <Row label="邮箱"   value={user?.email}/>
        <Row label="角色"   value="教师"/>
      </div>
    </div>
  );
}
function Row({ label, value }) {
  return (
    <div style={{
      display: 'flex', padding: '10px 0',
      borderBottom: '1px solid rgba(255,245,230,0.08)',
    }}>
      <div style={{ width: 90, fontSize: 12, color: 'rgba(253,246,227,0.6)' }}>{label}</div>
      <div style={{ fontSize: 13 }}>{value || '-'}</div>
    </div>
  );
}

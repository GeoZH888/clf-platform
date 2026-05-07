// src/school/teacher/TeacherDashboard.jsx
// AI-first teacher landing. 4 quick-action cards + live stats + AI panels.
// Built fresh; existing David-Chinese pages (homework / messages / notices)
// are linked via the action cards but not replaced.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, FileCheck, MessageSquare, Bell, LogOut } from 'lucide-react';
import DashboardStats     from './home/DashboardStats';
import ClassAnalyticsCard from './analytics/ClassAnalyticsCard';
import StudentSpotlight   from './analytics/StudentSpotlight';

const T = {
  zh: {
    title: '教师工作台',
    subtitle: '大卫学中文 · 教师端',
    quickActions: '快速访问',
    coursePrep: '备课',
    homework: '作业',
    communication: '家校沟通',
    notices: '通知公告',
    coursePrepDesc: 'AI + RAG 辅助',
    homeworkDesc: '布置 · 批改 · 多模态',
    communicationDesc: '与家长一对一',
    noticesDesc: '班级广播',
  },
  en: {
    title: 'Teacher Workspace',
    subtitle: 'David Chinese · Teacher',
    quickActions: 'Quick actions',
    coursePrep: 'Course prep',
    homework: 'Homework',
    communication: 'Communication',
    notices: 'Notices',
    coursePrepDesc: 'AI + RAG assistant',
    homeworkDesc: 'Assign · grade · multimodal',
    communicationDesc: '1-on-1 with parents',
    noticesDesc: 'Class broadcasts',
  },
  it: {
    title: 'Workspace Insegnante',
    subtitle: 'David Chinese · Insegnante',
    quickActions: 'Azioni rapide',
    coursePrep: 'Preparazione',
    homework: 'Compiti',
    communication: 'Comunicazione',
    notices: 'Avvisi',
    coursePrepDesc: 'Assistente AI + RAG',
    homeworkDesc: 'Assegna · correggi · multimodale',
    communicationDesc: '1 a 1 con i genitori',
    noticesDesc: 'Annunci di classe',
  },
};

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [lang, setLang] = useState('zh');
  const t = T[lang];

  const cards = [
    { icon: BookOpen,      title: t.coursePrep,     desc: t.coursePrepDesc,     to: '/teacher-materials',     color: '#3b82f6' },
    { icon: FileCheck,     title: t.homework,       desc: t.homeworkDesc,       to: '/teacher-homework',      color: '#10b981' },
    { icon: MessageSquare, title: t.communication,  desc: t.communicationDesc,  to: '/teacher-communication', color: '#f59e0b' },
    { icon: Bell,          title: t.notices,        desc: t.noticesDesc,        to: '/notifications',         color: '#8b5cf6' },
  ];

  return (
    <div style={{ minHeight: '100dvh', background: '#fdf6e3' }}>
      <header style={{
        background: '#c41e3a', color: '#fff', padding: '16px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700,
            fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2 }}>
            {t.title}
          </div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
            {t.subtitle} · {user?.name || user?.email}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {['zh','en','it'].map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              background: lang === l ? '#fff' : 'transparent',
              color: lang === l ? '#c41e3a' : '#fff',
              border: '1px solid rgba(255,255,255,0.4)',
            }}>{l.toUpperCase()}</button>
          ))}
          <button onClick={logout} style={{
            marginLeft: 8, padding: '6px 10px', borderRadius: 8,
            background: 'rgba(255,255,255,0.15)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer',
            fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <LogOut size={14}/>
          </button>
        </div>
      </header>

      <div style={{ padding: '24px 16px', maxWidth: 1200, margin: '0 auto' }}>
        <DashboardStats lang={lang}/>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16, marginTop: 24,
        }}>
          <ClassAnalyticsCard lang={lang}/>
          <StudentSpotlight lang={lang}/>
        </div>

        <div style={{ marginTop: 28, fontSize: 13, fontWeight: 600,
          color: '#8B4513', marginBottom: 12 }}>
          {t.quickActions}
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12,
        }}>
          {cards.map((c, i) => {
            const Icon = c.icon;
            return (
              <button key={i} onClick={() => navigate(c.to)} style={{
                background: '#fff', border: `1.5px solid ${c.color}33`,
                borderRadius: 14, padding: 16, textAlign: 'left', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: `0 2px 8px ${c.color}15`, transition: 'transform .15s',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: `${c.color}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={20} color={c.color}/>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a0a05' }}>
                    {c.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#a07850', marginTop: 2 }}>
                    {c.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// src/teacher/TeacherLayout.jsx
// Responsive shell: sidebar on desktop, bottom-nav on mobile.
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../school/contexts/AuthContext';
import { Home, Users, FileCheck, MessageSquare, Bell, BookOpen, Upload, LogOut } from 'lucide-react';

const NAV = [
  { path: '/',              label_zh: '首页',   label_en: 'Home',          icon: Home },
  { path: '/classes',       label_zh: '班级',   label_en: 'Classes',       icon: Users },
  { path: '/homework',      label_zh: '作业',   label_en: 'Homework',      icon: FileCheck },
  { path: '/communication', label_zh: '沟通',   label_en: 'Comm.',         icon: MessageSquare },
  { path: '/notices',       label_zh: '通知',   label_en: 'Notices',       icon: Bell },
  { path: '/courses',       label_zh: '课程',   label_en: 'Courses',       icon: BookOpen },
  { path: '/materials',     label_zh: '资料',   label_en: 'Materials',     icon: Upload },
];

export default function TeacherLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  if (isMobile) {
    return (
      <div style={{ minHeight: '100dvh', background: '#fdf6e3', paddingBottom: 64 }}>
        <header style={{
          background: '#c41e3a', color: '#fff', padding: '12px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700,
            fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2 }}>
            教师工作台
          </div>
          <button onClick={logout} style={{
            background: 'transparent', border: 'none', color: '#fff',
            cursor: 'pointer', padding: 4,
          }}><LogOut size={18}/></button>
        </header>
        <main style={{ padding: '12px 12px 24px' }}>{children}</main>
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #e8d5b0',
          display: 'flex', height: 60, justifyContent: 'space-around',
          alignItems: 'center', overflowX: 'auto',
        }}>
          {NAV.map(n => {
            const Icon = n.icon;
            const active = isActive(n.path);
            return (
              <button key={n.path} onClick={() => navigate(n.path)}
                style={{
                  background: 'transparent', border: 'none',
                  color: active ? '#c41e3a' : '#a07850',
                  cursor: 'pointer', padding: '4px 6px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 2,
                  fontSize: 10, minWidth: 50,
                }}>
                <Icon size={18}/>
                {n.label_zh}
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  // Desktop layout
  return (
    <div style={{ minHeight: '100dvh', background: '#fdf6e3', display: 'flex' }}>
      <aside style={{
        width: 220, background: '#fff', borderRight: '1px solid #e8d5b0',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: 18, borderBottom: '1px solid #e8d5b0' }}>
          <div style={{
            fontSize: 18, fontWeight: 700, color: '#c41e3a',
            fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2,
          }}>教师工作台</div>
          <div style={{ fontSize: 11, color: '#a07850', marginTop: 4 }}>
            {user?.name || user?.email}
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(n => {
            const Icon = n.icon;
            const active = isActive(n.path);
            return (
              <button key={n.path} onClick={() => navigate(n.path)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8,
                background: active ? '#c41e3a15' : 'transparent',
                color: active ? '#c41e3a' : '#5d4630',
                border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: active ? 600 : 400,
                textAlign: 'left',
              }}>
                <Icon size={16}/>
                {n.label_zh} · {n.label_en}
              </button>
            );
          })}
        </div>
        <button onClick={logout} style={{
          margin: 12, padding: '8px 12px', background: '#fdf6e3',
          color: '#c41e3a', border: '1px solid #c41e3a',
          borderRadius: 8, cursor: 'pointer', fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
        }}>
          <LogOut size={14}/> 退出
        </button>
      </aside>
      <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}

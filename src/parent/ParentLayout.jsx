// src/parent/ParentLayout.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../school/contexts/AuthContext';
import { Home, FileCheck, MessageSquare, Bell, LogOut, Globe } from 'lucide-react';

const NAV = [
  { path: '/',          label: '首页',     icon: Home },
  { path: '/homework',  label: '作业进度', icon: FileCheck },
  { path: '/messages',  label: '老师消息', icon: MessageSquare },
  { path: '/notices',   label: '通知',     icon: Bell },
];

export default function ParentLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const r = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);
  const isActive = p => p === '/' ? location.pathname === '/' : location.pathname.startsWith(p);

  if (isMobile) {
    return (
      <div style={{ minHeight: '100dvh', background: '#fdf6e3', paddingBottom: 64 }}>
        <header style={hdr}>
          <div style={{ fontSize: 16, fontWeight: 700,
            fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2 }}>
            家长面板
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => window.location.href = '/community'} style={iconLight}>
              <Globe size={16}/>
            </button>
            <button onClick={logout} style={iconLight}><LogOut size={16}/></button>
          </div>
        </header>
        <main style={{ padding: 12 }}>{children}</main>
        <nav style={mobNav}>
          {NAV.map(n => {
            const Icon = n.icon, active = isActive(n.path);
            return (
              <button key={n.path} onClick={() => navigate(n.path)}
                style={{ ...mobBtn, color: active ? '#c41e3a' : '#a07850' }}>
                <Icon size={18}/>{n.label}
              </button>
            );
          })}
        </nav>
      </div>
    );
  }
  return (
    <div style={{ minHeight: '100dvh', background: '#fdf6e3', display: 'flex' }}>
      <aside style={aside}>
        <div style={{ padding: 18, borderBottom: '1px solid #e8d5b0' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#c41e3a',
            fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2 }}>家长面板</div>
          <div style={{ fontSize: 11, color: '#a07850', marginTop: 4 }}>
            {user?.name || user?.email}
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 8px',
          display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(n => {
            const Icon = n.icon, active = isActive(n.path);
            return (
              <button key={n.path} onClick={() => navigate(n.path)}
                style={{ ...sideBtn,
                  background: active ? '#c41e3a15' : 'transparent',
                  color: active ? '#c41e3a' : '#5d4630',
                  fontWeight: active ? 600 : 400 }}>
                <Icon size={16}/>{n.label}
              </button>
            );
          })}
        </div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={() => window.location.href = '/community'} style={btnSec}>
            <Globe size={14}/> 去社区
          </button>
          <button onClick={logout} style={btnDanger}>
            <LogOut size={14}/> 退出
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>{children}</main>
    </div>
  );
}

const hdr = { background: '#c41e3a', color: '#fff', padding: '12px 16px',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const iconLight = { background: 'transparent', border: 'none', color: '#fff',
  cursor: 'pointer', padding: 4 };
const mobNav = { position: 'fixed', bottom: 0, left: 0, right: 0,
  background: '#fff', borderTop: '1px solid #e8d5b0',
  display: 'flex', height: 60, justifyContent: 'space-around', alignItems: 'center' };
const mobBtn = { background: 'transparent', border: 'none',
  cursor: 'pointer', padding: '4px 6px',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  gap: 2, fontSize: 10, minWidth: 70 };
const aside = { width: 220, background: '#fff', borderRight: '1px solid #e8d5b0',
  display: 'flex', flexDirection: 'column' };
const sideBtn = { display: 'flex', alignItems: 'center', gap: 10,
  padding: '9px 12px', borderRadius: 8, border: 'none',
  cursor: 'pointer', fontSize: 13, textAlign: 'left' };
const btnSec = { padding: '8px 12px', background: '#fdf6e3', color: '#a07850',
  border: '1px solid #e8d5b0', borderRadius: 8, cursor: 'pointer', fontSize: 12,
  display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' };
const btnDanger = { padding: '8px 12px', background: '#fdf6e3', color: '#c41e3a',
  border: '1px solid #c41e3a', borderRadius: 8, cursor: 'pointer', fontSize: 12,
  display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' };

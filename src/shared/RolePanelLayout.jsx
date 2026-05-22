// src/shared/RolePanelLayout.jsx
// LIGHT THEME (Phase E.2): warm beige bg, red gradient sidebar, dark text.
// ─────────────────────────────────────────────────────────────────────────
// Stage A1 fixes:
//   1) Dedup: don't render COMMON_NAV items the role's NAV already provides
//   2) Footer "去社区" → "主页" (navigates to platform root /)
// ─────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../school/contexts/AuthContext';
import { LogOut, Home } from 'lucide-react';

const COMMON_NAV = [
  { path: '/messages', icon: '💬', label: '消息通知' },
  { path: '/profile',  icon: '👤', label: '个人资料' },
];

export default function RolePanelLayout({ title, subtitle, children, nav, accentColor = '#c41e3a' }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const r = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);

  const isActive = (p) => p === '/' ? location.pathname === '/' : location.pathname.startsWith(p);

  // ── Stage A1 fix #1: filter COMMON_NAV by role NAV paths ───────────────
  const rolePaths = new Set(nav.map(n => n.path));
  const filteredCommonNav = COMMON_NAV.filter(c => !rolePaths.has(c.path));

  // For mobile bottom-bar, still concatenate (full nav is needed for nav coverage)
  const fullNav = [...nav, ...filteredCommonNav];

  // ── Stage A1 fix #2: navigate to platform root, not /community ─────────
  const goToHome = () => { window.location.href = '/'; };

  if (isMobile) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: 'linear-gradient(160deg, #fdf6e3 0%, #f5e6c8 100%)',
        color: '#1a0a05', paddingBottom: 70,
      }}>
        <header style={{
          padding: '14px 18px',
          background: 'linear-gradient(90deg, #c41e3a 0%, #8b0000 100%)',
          color: '#fff5e6',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700,
              fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 3 }}>
              {title}
            </div>
            <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>
              {user?.name || user?.email}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={goToHome}
              style={{ background: 'transparent', border: 'none', color: '#fff5e6',
                cursor: 'pointer', padding: 4 }}
              title="主页">
              <Home size={16}/>
            </button>
            <button onClick={logout}
              style={{ background: 'transparent', border: 'none', color: '#fff5e6',
                cursor: 'pointer', padding: 4 }}
              title="退出">
              <LogOut size={16}/>
            </button>
          </div>
        </header>
        <main style={{ padding: 14 }}>{children}</main>
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #e8d5b0',
          display: 'flex', height: 64, alignItems: 'center', justifyContent: 'space-around',
          overflowX: 'auto',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.05)',
        }}>
          {fullNav.map(n => {
            const active = isActive(n.path);
            return (
              <button key={n.path} onClick={() => navigate(n.path)}
                style={{
                  background: 'transparent', border: 'none',
                  color: active ? accentColor : '#a07850',
                  cursor: 'pointer', padding: '6px 4px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 2, fontSize: 9, minWidth: 60,
                  fontWeight: active ? 700 : 400,
                }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>{n.icon}</span>
                {n.label}
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  // Desktop
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #fdf6e3 0%, #f5e6c8 100%)',
      color: '#1a0a05', display: 'flex',
    }}>
      <aside style={{
        width: 240,
        background: 'linear-gradient(180deg, #8b0000 0%, #c41e3a 100%)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', height: '100vh', overflowY: 'auto',
      }}>
        <div style={{
          padding: '24px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 28 }}>🐼</span>
            <div>
              <div style={{
                fontSize: 16, fontWeight: 700, color: '#fff5e6',
                fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 3,
              }}>{title}</div>
              {subtitle && (
                <div style={{ fontSize: 10, color: 'rgba(255,245,230,0.7)' }}>{subtitle}</div>
              )}
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,245,230,0.7)', marginTop: 8 }}>
            {user?.name || user?.email}
          </div>
        </div>

        <div style={{ flex: 1, padding: '14px 10px',
          display: 'flex', flexDirection: 'column', gap: 2 }}>
          {nav.map(n => {
            const active = isActive(n.path);
            return (
              <button key={n.path} onClick={() => navigate(n.path)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10,
                background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
                color: '#fff5e6',
                border: active ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
                cursor: 'pointer', fontSize: 13,
                fontWeight: active ? 700 : 500,
                textAlign: 'left', transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: 16 }}>{n.icon}</span>
                {n.label}
              </button>
            );
          })}

          {/* Stage A1: only render the 通用 section if there's anything to show */}
          {filteredCommonNav.length > 0 && (
            <>
              <div style={{
                margin: '14px 4px 8px', paddingTop: 12,
                borderTop: '1px solid rgba(255,255,255,0.15)',
                fontSize: 10, color: 'rgba(255,245,230,0.5)', letterSpacing: 2,
              }}>
                通用
              </div>

              {filteredCommonNav.map(n => {
                const active = isActive(n.path);
                return (
                  <button key={n.path} onClick={() => navigate(n.path)} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 10,
                    background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
                    color: '#fff5e6',
                    border: active ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
                    cursor: 'pointer', fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    textAlign: 'left', transition: 'all 0.15s',
                  }}>
                    <span style={{ fontSize: 16 }}>{n.icon}</span>
                    {n.label}
                  </button>
                );
              })}
            </>
          )}
        </div>

        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6,
          borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <button onClick={goToHome} style={{
            padding: '8px 12px', background: 'rgba(255,255,255,0.1)', color: '#fff5e6',
            border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8,
            cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
          }}>
            <Home size={14}/> 主页
          </button>
          <button onClick={logout} style={{
            padding: '8px 12px', background: 'rgba(0,0,0,0.2)', color: '#fff5e6',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
            cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
          }}>
            <LogOut size={14}/> 退出
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, marginLeft: 240, padding: 28, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}

// === Reusable page hero ===
export function PageHero({ icon, title, subtitle, accentColor = '#c41e3a', children }) {
  return (
    <div style={{
      background: '#fff',
      border: `1.5px solid ${accentColor}30`,
      borderRadius: 18, padding: '24px 26px', marginBottom: 20,
      position: 'relative', overflow: 'hidden',
      boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        position: 'absolute', top: -10, right: -10, fontSize: 110, opacity: 0.06,
        lineHeight: 1, color: accentColor, pointerEvents: 'none', userSelect: 'none',
        fontFamily: 'serif', fontWeight: 900,
      }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: subtitle ? 6 : 0 }}>
        {icon && (
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: `${accentColor}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, border: `1px solid ${accentColor}30`,
          }}>{icon}</div>
        )}
        <div>
          <div style={{
            fontSize: 24, fontWeight: 800, color: '#1a0a05',
            fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 3,
          }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 12, color: '#8b6f47', marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

export function ComingSoon({ title, accentColor = '#c41e3a' }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px dashed #e8d5b0',
      borderRadius: 14, padding: '40px 24px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🚧</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#1a0a05', marginBottom: 6,
        fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2 }}>
        {title} · 建设中
      </div>
      <div style={{ fontSize: 12, color: '#8b6f47' }}>
        下一期开发，敬请期待
      </div>
    </div>
  );
}

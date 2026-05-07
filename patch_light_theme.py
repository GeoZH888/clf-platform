# patch_light_theme.py
# Three files for light theme:
#   1. src/shared/RolePanelLayout.jsx   — sidebar + main bg + text colors
#   2. src/community/CommunityHome.jsx  — community home with 3 doorcards on light bg
#   3. src/heritage/HeritageApp.jsx     — compact tile grid matching community module style
#
# Inner pages (homework, classroom, etc.) keep dark theme this session.
# Next session: proper CSS-variable theme refactor.

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

files = {}

# ============================================================
# 1. RolePanelLayout — light theme
# ============================================================
files["src/shared/RolePanelLayout.jsx"] = '''// src/shared/RolePanelLayout.jsx
// LIGHT THEME (Phase E.2): warm beige bg, red gradient sidebar, dark text.
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../school/contexts/AuthContext';
import { LogOut, Globe } from 'lucide-react';

const COMMON_NAV = [
  { path: '/messages', icon: '\\ud83d\\udcac', label: '消息通知' },
  { path: '/profile',  icon: '\\ud83d\\udc64', label: '个人资料' },
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
  const fullNav = [...nav, ...COMMON_NAV];

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
              fontFamily: \"'STKaiti','KaiTi',serif\", letterSpacing: 3 }}>
              {title}
            </div>
            <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>
              {user?.name || user?.email}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => window.location.href = '/community'}
              style={{ background: 'transparent', border: 'none', color: '#fff5e6',
                cursor: 'pointer', padding: 4 }}>
              <Globe size={16}/>
            </button>
            <button onClick={logout}
              style={{ background: 'transparent', border: 'none', color: '#fff5e6',
                cursor: 'pointer', padding: 4 }}>
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
            <span style={{ fontSize: 28 }}>\\ud83d\\udc3c</span>
            <div>
              <div style={{
                fontSize: 16, fontWeight: 700, color: '#fff5e6',
                fontFamily: \"'STKaiti','KaiTi',serif\", letterSpacing: 3,
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

          <div style={{
            margin: '14px 4px 8px', paddingTop: 12,
            borderTop: '1px solid rgba(255,255,255,0.15)',
            fontSize: 10, color: 'rgba(255,245,230,0.5)', letterSpacing: 2,
          }}>
            通用
          </div>

          {COMMON_NAV.map(n => {
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
        </div>

        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6,
          borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <button onClick={() => window.location.href = '/community'} style={{
            padding: '8px 12px', background: 'rgba(255,255,255,0.1)', color: '#fff5e6',
            border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8,
            cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
          }}>
            <Globe size={14}/> 去社区
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
            fontFamily: \"'STKaiti','KaiTi',serif\", letterSpacing: 3,
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
      <div style={{ fontSize: 32, marginBottom: 8 }}>\\ud83d\\udea7</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#1a0a05', marginBottom: 6,
        fontFamily: \"'STKaiti','KaiTi',serif\", letterSpacing: 2 }}>
        {title} · 建设中
      </div>
      <div style={{ fontSize: 12, color: '#8b6f47' }}>
        下一期开发，敬请期待
      </div>
    </div>
  );
}
'''

# ============================================================
# 2. CommunityHome — light theme, kept structure
# ============================================================
files["src/community/CommunityHome.jsx"] = '''// src/community/CommunityHome.jsx
// LIGHT THEME version, same 3-card structure + flat module grid.
import React, { useEffect, useState } from 'react';
import { useAuth } from '../school/contexts/AuthContext';
import { supabase } from '../school/services/supabase';
import { MODULES, ALWAYS_ON } from '../config/modules';

const ROLE_HOME = {
  super_admin:   '/admin',
  school_master: '/school-master',
  teacher:       '/teacher',
  student:       '/student',
  parent:        '/parent',
};
const ROLE_LABEL = {
  super_admin:   '管理后台',
  school_master: '校长面板',
  teacher:       '教师工作台',
  student:       '学生面板',
  parent:        '家长面板',
};
const ROUTES = {
  home:'/', profile:'/profile', progress:'/progress',
  lianzi:'/characters', words:'/words', pinyin:'/pinyin',
  chengyu:'/chengyu', poetry:'/poetry', grammar:'/grammar', hsk:'/hsk',
  riddles:'/riddles', scenario:'/scenario', story:'/story', lessons:'/lessons',
  chat:'/chat', voice:'/voice', homework:'/homework', shop:'/shop', parents:'/parents',
};

function DoorCard({ emoji, title, subtitle, desc, features, color, bgGrad, textColor, accentColor, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => { setPressed(false); onClick(); }}
      style={{
        background: bgGrad, border: `2.5px solid ${color}`, borderRadius: 24,
        padding: '28px 24px 24px', cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        transform: pressed ? 'scale(0.97)' : hovered ? 'translateY(-4px) scale(1.01)' : 'none',
        boxShadow: hovered
          ? `0 16px 40px ${color}30, 0 4px 12px ${color}20`
          : `0 4px 16px ${color}15`,
        position: 'relative', overflow: 'hidden',
      }}>
      <div style={{ position: 'absolute', top: -10, right: -10, fontSize: 120, opacity: 0.06,
        lineHeight: 1, color, pointerEvents: 'none', userSelect: 'none', fontFamily: 'serif' }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
          border: `1.5px solid ${color}30`, flexShrink: 0 }}>{emoji}</div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, color: textColor, lineHeight: 1.1,
            fontFamily: \"'STKaiti','KaiTi','FangSong',serif\" }}>{title}</div>
          <div style={{ fontSize: 13, color: accentColor, marginTop: 2, fontWeight: 600 }}>
            {subtitle}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: textColor, lineHeight: 1.7, marginBottom: 14,
        opacity: 0.8, borderLeft: `3px solid ${color}40`, paddingLeft: 10 }}>{desc}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {features.map((f, i) => (
          <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20,
            background: `${color}12`, color: textColor, border: `1px solid ${color}25`,
            fontWeight: 500 }}>{f}</span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: accentColor, opacity: 0.7 }}>点击进入 →</span>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 18, fontWeight: 700,
          transition: 'transform 0.2s', transform: hovered ? 'scale(1.15)' : 'none',
          boxShadow: `0 4px 12px ${color}50` }}>›</div>
      </div>
    </button>
  );
}

export default function CommunityHome() {
  const { user, logout } = useAuth();
  const [allowedIds, setAllowedIds] = useState(null);
  const [showModules, setShowModules] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      if (user.role === 'super_admin') {
        setAllowedIds(MODULES.map(m => m.id));
        return;
      }
      try {
        const { data } = await supabase
          .from('clf_user_modules')
          .select('module_id, enabled')
          .eq('user_id', user.id);
        const overrides = {};
        (data || []).forEach(r => { overrides[r.module_id] = r.enabled; });
        const allowed = MODULES.filter(m => {
          if (!m.gateable) return true;
          if (m.id in overrides) return overrides[m.id];
          return m.defaultEnabled;
        }).map(m => m.id);
        setAllowedIds(allowed);
      } catch (e) {
        console.warn('[CommunityHome]', e);
        setAllowedIds(ALWAYS_ON);
      }
    })();
  }, [user?.id, user?.role]);

  const myRole = user?.role;
  const schoolUrl = ROLE_HOME[myRole];
  const schoolLabel = ROLE_LABEL[myRole];
  const visibleModules = allowedIds
    ? MODULES.filter(m => allowedIds.includes(m.id) && m.category !== 'future')
    : [];

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #fdf6e3 0%, #f5e6c8 50%, #f0d9b5 100%)',
      color: '#1a0a05',
    }}>
      <header style={{
        padding: '18px 24px',
        background: 'linear-gradient(90deg, #c41e3a 0%, #8b0000 100%)',
        color: '#fff5e6',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700,
            fontFamily: \"'STKaiti','KaiTi',serif\", letterSpacing: 4 }}>大卫学中文</div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
            {user?.name || user?.email} · {myRole || 'visitor'}
          </div>
        </div>
        <button onClick={logout} style={{
          background: 'rgba(255,255,255,0.15)', color: '#fff5e6',
          border: '1px solid rgba(255,255,255,0.3)',
          padding: '8px 14px', borderRadius: 20,
          cursor: 'pointer', fontSize: 12, fontWeight: 600,
        }}>退出</button>
      </header>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '24px 24px 0', maxWidth: 1100, margin: '0 auto',
      }}>
        <div style={{ flex: 1, height: 1,
          background: 'linear-gradient(to right, transparent, rgba(196,30,58,0.4))' }}/>
        <div style={{ fontSize: 13, color: '#c41e3a', fontWeight: 700, letterSpacing: 4 }}>
          选择入口
        </div>
        <div style={{ flex: 1, height: 1,
          background: 'linear-gradient(to left, transparent, rgba(196,30,58,0.4))' }}/>
      </div>

      <main style={{ padding: '20px 24px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gap: 18, marginTop: 20,
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {schoolUrl && (
            <DoorCard
              emoji="🏫"
              title="教学"
              subtitle={schoolLabel}
              desc={"进入你的专属面板。根据你的角色，查看班级、布置作业、查看成绩、联系老师。"}
              features={['班级', '作业', '课程', '沟通']}
              color="#c41e3a"
              bgGrad="linear-gradient(135deg, #fff5f0 0%, #ffe8e0 50%, #fff0eb 100%)"
              textColor="#1a0a05" accentColor="#8b0a18"
              onClick={() => window.location.href = schoolUrl}
            />
          )}
          <DoorCard
            emoji="🌐"
            title="社区"
            subtitle="Community"
            desc={"中文学习社区。自由探索汉字描红、拼音发音、词汇闪卡、成语故事…按自己节奏学习。"}
            features={visibleModules.length > 0
              ? visibleModules.slice(0, 4).map(m => m.label)
              : ['快看看']}
            color="#3b82f6"
            bgGrad="linear-gradient(135deg, #f0f6ff 0%, #e3f0ff 50%, #f0f8ff 100%)"
            textColor="#1a0a05" accentColor="#1d4ed8"
            onClick={() => setShowModules(s => !s)}
          />
          <DoorCard
            emoji="🏮"
            title="非遗"
            subtitle="Heritage"
            desc={"中华非物质文化遗产。探索传统戏曲、民俗故事、亲手工艺、节庆文化—中国传统之美。"}
            features={['戏曲', '民俗', '工艺', '节庆']}
            color="#d97706"
            bgGrad="linear-gradient(135deg, #fff8ed 0%, #fdebc7 50%, #fff5e0 100%)"
            textColor="#1a0a05" accentColor="#92400e"
            onClick={() => window.location.href = '/feiyi'}
          />
        </div>

        {showModules && (
          <section style={{ marginTop: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <div style={{ flex: 1, height: 1,
                background: 'linear-gradient(to right, transparent, rgba(59,130,246,0.4))' }}/>
              <div style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600, letterSpacing: 3 }}>
                可用模块
              </div>
              <div style={{ flex: 1, height: 1,
                background: 'linear-gradient(to left, transparent, rgba(59,130,246,0.4))' }}/>
            </div>
            {allowedIds === null ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#a07850', opacity: 0.6 }}>···</div>
            ) : visibleModules.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: 30,
                background: '#fff',
                border: '1px dashed #e8d5b0',
                borderRadius: 12, color: '#a07850', fontSize: 13,
              }}>
                还没有开启任何模块。请联系管理员分配。
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: 12,
              }}>
                {visibleModules.map(m => <ModuleTile key={m.id} mod={m}/>)}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function ModuleTile({ mod }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => window.location.href = ROUTES[mod.id] || '/'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        border: `1.5px solid ${hovered ? '#c41e3a' : '#e8d5b0'}`,
        borderRadius: 14, padding: '16px 10px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered
          ? '0 10px 24px rgba(196,30,58,0.2)'
          : '0 2px 6px rgba(0,0,0,0.04)',
        textAlign: 'center',
        color: '#1a0a05',
      }}>
      <div style={{ fontSize: 32, marginBottom: 6, lineHeight: 1 }}>{mod.icon}</div>
      <div style={{ fontSize: 13, fontWeight: 700,
        fontFamily: \"'STKaiti','KaiTi',serif\", letterSpacing: 2 }}>
        {mod.label}
      </div>
    </button>
  );
}
'''

# ============================================================
# 3. HeritageApp — compact tile grid like community modules
# ============================================================
files["src/heritage/HeritageApp.jsx"] = '''// src/heritage/HeritageApp.jsx
// 非遗 home: compact tile grid matching community module style.
// Public — no login required.
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';

const CATEGORIES = [
  { slug:'folklore',  label_zh:'民俗故事', label_en:'Folklore',  label_it:'Folclore',    icon:'俗', color:'#a0522d',
    desc_zh: '传统民间传说', desc_en: 'Traditional folk tales',  desc_it: 'Racconti popolari' },
  { slug:'opera',     label_zh:'传统戏曲', label_en:'Opera',     label_it:'Opera',       icon:'戏', color:'#c41e3a',
    desc_zh: '昆曲、京剧、各地戏种', desc_en: 'Kunqu, Beijing opera, regional styles', desc_it: 'Kunqu, opera di Pechino' },
  { slug:'crafts',    label_zh:'民间工艺', label_en:'Crafts',    label_it:'Artigianato', icon:'工', color:'#8b4513',
    desc_zh: '剪纸、刺绣、陶瓷', desc_en: 'Paper-cutting, embroidery, ceramics', desc_it: 'Carta tagliata, ricamo, ceramica' },
  { slug:'festivals', label_zh:'节庆文化', label_en:'Festivals', label_it:'Feste',       icon:'庆', color:'#d4a017',
    desc_zh: '传统节日与仪式', desc_en: 'Traditional festivals & rituals', desc_it: 'Feste e rituali' },
];

export default function HeritageApp() {
  return (
    <BrowserRouter basename="/feiyi">
      <Routes>
        <Route path="/" element={<HeritageHome />} />
        <Route path="*" element={<HeritageHome />} />
      </Routes>
    </BrowserRouter>
  );
}

function HeritageHome() {
  const [lang, setLang] = useState('zh');
  const navigate = useNavigate();
  const t = (cat, kind = 'label') => cat[`${kind}_${lang}`];

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #fdf6e3 0%, #f5e6c8 50%, #f0d9b5 100%)',
      color: '#1a0a05',
    }}>
      <header style={{
        padding: '20px 24px',
        background: 'linear-gradient(90deg, #a0522d 0%, #8b4513 100%)',
        color: '#fff5e6',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700,
            fontFamily: \"'STKaiti','KaiTi',serif\", letterSpacing: 6 }}>
            {lang === 'zh' ? '非遗' : lang === 'en' ? 'Heritage' : 'Patrimonio'}
          </div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
            {lang === 'zh' ? '中华非物质文化遗产'
              : lang === 'en' ? 'Chinese Intangible Cultural Heritage'
              : 'Patrimonio culturale immateriale cinese'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['zh', 'en', 'it'].map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding: '5px 11px', borderRadius: 14,
              background: lang === l ? '#fff5e6' : 'rgba(255,255,255,0.15)',
              color: lang === l ? '#a0522d' : '#fff5e6',
              border: '1px solid rgba(255,255,255,0.3)',
              cursor: 'pointer', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase',
            }}>{l}</button>
          ))}
          <button onClick={() => window.location.href = '/'} style={{
            padding: '5px 11px', borderRadius: 14,
            background: 'rgba(255,255,255,0.15)', color: '#fff5e6',
            border: '1px solid rgba(255,255,255,0.3)',
            cursor: 'pointer', fontSize: 11, fontWeight: 600, marginLeft: 4,
          }}>
            {lang === 'zh' ? '首页' : lang === 'en' ? 'Home' : 'Home'}
          </button>
        </div>
      </header>

      <main style={{ padding: '24px 20px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          background: '#fff',
          border: '1px solid #e8d5b0',
          borderRadius: 14, padding: 16, marginBottom: 20,
          fontSize: 13, color: '#5d4630', lineHeight: 1.7,
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
        }}>
          {lang === 'zh' && '非物质文化遗产是人类口口相传、代代相承的生活智慧与艺术形式。这里收集中华传统文化中的多个主题，供所有人自由浏览学习。'}
          {lang === 'en' && 'Intangible cultural heritage represents living traditions transmitted through generations. This collection introduces themes from Chinese tradition, freely available to all.'}
          {lang === 'it' && 'Il patrimonio culturale immateriale rappresenta tradizioni viventi tramandate per generazioni. Questa raccolta presenta temi della tradizione cinese, gratuita per tutti.'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 1,
            background: 'linear-gradient(to right, transparent, rgba(160,82,45,0.4))' }}/>
          <div style={{ fontSize: 12, color: '#a0522d', fontWeight: 700, letterSpacing: 4 }}>
            {lang === 'zh' ? '主题' : lang === 'en' ? 'Themes' : 'Temi'}
          </div>
          <div style={{ flex: 1, height: 1,
            background: 'linear-gradient(to left, transparent, rgba(160,82,45,0.4))' }}/>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
        }}>
          {CATEGORIES.map(c => <CategoryTile key={c.slug} cat={c} t={t} navigate={navigate}/>)}
        </div>

        <div style={{
          textAlign: 'center', marginTop: 40, fontSize: 11, color: '#a07850',
        }}>
          {lang === 'zh' && '公益资源 · 免费开放 · 无需注册'}
          {lang === 'en' && 'Public resource · Free · No registration'}
          {lang === 'it' && 'Risorsa pubblica · Gratuita · Nessuna registrazione'}
        </div>
      </main>
    </div>
  );
}

function CategoryTile({ cat, t, navigate }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => alert(t(cat) + ' · 内容建设中…')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        border: `1.5px solid ${hovered ? cat.color : '#e8d5b0'}`,
        borderRadius: 14, padding: '18px 12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered
          ? `0 10px 24px ${cat.color}30`
          : '0 2px 6px rgba(0,0,0,0.04)',
        textAlign: 'center',
        color: '#1a0a05',
      }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: `${cat.color}15`,
        border: `1.5px solid ${cat.color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 800, color: cat.color,
        fontFamily: \"'STKaiti','KaiTi',serif\",
        margin: '0 auto 10px',
      }}>
        {cat.icon}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4,
        fontFamily: \"'STKaiti','KaiTi',serif\", letterSpacing: 1 }}>
        {t(cat)}
      </div>
      <div style={{ fontSize: 10, color: '#8b6f47', lineHeight: 1.4 }}>
        {t(cat, 'desc')}
      </div>
    </button>
  );
}
'''

# ============================================================
# Write
# ============================================================
print(f"=== Writing {len(files)} files ===")
for rel, content in files.items():
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    data = content.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
    p.write_bytes(data)
    print(f"  wrote  {rel}  ({len(data)} bytes)")

# ============================================================
# Verify
# ============================================================
print("\n=== Verification ===")
import re
checks = [
    ('src/shared/RolePanelLayout.jsx', '#fdf6e3'),
    ('src/shared/RolePanelLayout.jsx', '#8b0000'),
    ('src/community/CommunityHome.jsx', '#fdf6e3'),
    ('src/heritage/HeritageApp.jsx', 'minmax(140px'),
    ('src/heritage/HeritageApp.jsx', '民俗故事'),
]
all_ok = True
for rel, marker in checks:
    p = ROOT / rel
    if not p.exists():
        print(f"  [MISSING] {rel}")
        all_ok = False
        continue
    if marker in p.read_text(encoding='utf-8'):
        print(f"  [OK] {rel} :: '{marker}'")
    else:
        print(f"  [FAIL] {rel} :: missing '{marker}'")
        all_ok = False

# Escape sequence sanity
total = 0
for rel in files.keys():
    p = ROOT / rel
    if p.exists():
        n = len(re.findall(r'\\u[0-9a-fA-F]{4}', p.read_text(encoding='utf-8')))
        total += n
print(f"  Raw \\\\uXXXX escapes total: {total}")

print("\n" + ("=== ALL OK ===" if all_ok and total == 0 else "=== SOME FAIL ==="))
print()
print("NEXT:")
print("  npm run build")
print("  netlify deploy --prod --dir dist --no-build")
print()
print("AFTER DEPLOY (hard-reload Ctrl+Shift+R):")
print("  /community     -> warm beige bg, red gradient header, 3 doorcards")
print("  /teacher etc   -> warm beige main, red gradient sidebar, white cards")
print("  /feiyi         -> compact 4-tile grid, tan header, language switcher")
print()
print("KNOWN: inner pages (homework workflow, classroom tabs) still dark this session.")
print("Phase E.3 will do CSS-variable theme refactor for full consistency.")

# install_phase_c.py
# Phase C: full role panels + 社区 (community) home + new flow
#
# - /community  -> 社区 home (modules + 学校 button), all roles land here after login
# - /student    -> StudentApp (homework, grades, profile, notices)
# - /parent     -> ParentApp (child overview, homework progress, messages, notices)
# - /school-master -> SchoolMasterApp (overview, teachers, classes, students, notices)
# - /teacher    -> TeacherApp (already exists from Phase B, unchanged)
#
# + RoleRedirect updated: all roles -> /community
# + SQL migration: parent-child links via clf_class_members.parent_user_id (already exists)
#
# Run from clf-platform root:
#   python install_phase_c.py

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

# Make sure all dirs exist
for sub in ["", "pages"]:
    for role in ["student", "parent", "school-master", "community"]:
        (ROOT / "src" / role / sub).mkdir(parents=True, exist_ok=True)

# ============================================================
# Code files
# ============================================================
files = {}

# ============================================================
# /community  -> CommunityHome (社区 home)
# ============================================================
files["src/community/CommunityApp.jsx"] = '''// src/community/CommunityApp.jsx
// 社区 home: module grid + 学校 button, all roles land here after login.
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import RequireRole from '../auth/RequireRole';
import CommunityHome from './CommunityHome';

export default function CommunityApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/community">
          <RequireRole allow={['super_admin', 'school_master', 'teacher', 'student', 'parent']}>
            <Routes>
              <Route path="/" element={<CommunityHome />} />
              <Route path="*" element={<CommunityHome />} />
            </Routes>
          </RequireRole>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
'''

files["src/community/CommunityHome.jsx"] = '''// src/community/CommunityHome.jsx
// Module grid using clf_user_modules gating + 学校 button to role panel.
import React, { useEffect, useState } from 'react';
import { useAuth } from '../school/contexts/AuthContext';
import { supabase } from '../school/services/supabase';
import { LogOut, School, Lock } from 'lucide-react';

// Role -> school panel URL
const ROLE_HOME = {
  super_admin:   '/admin',
  school_master: '/school-master',
  teacher:       '/teacher',
  student:       '/student',
  parent:        '/parent',
};

// Modules catalog -- mirrors src/config/modules.js
const MODULES = [
  { id: 'home',          icon: '🏠', name: '主页',     cat: 'core',     route: '/' },
  { id: 'me',            icon: '👤', name: '我的',     cat: 'core',     route: '/' },
  { id: 'progress',      icon: '📊', name: '学习进度', cat: 'core',     route: '/progress' },
  { id: 'characters',    icon: '✍️', name: '练字',     cat: 'learn',    route: '/characters' },
  { id: 'words',         icon: '📚', name: '词语',     cat: 'learn',    route: '/words' },
  { id: 'pinyin',        icon: '🔤', name: '拼音',     cat: 'learn',    route: '/pinyin' },
  { id: 'grammar',       icon: '📐', name: '语法',     cat: 'learn',    route: '/grammar' },
  { id: 'hsk',           icon: '🎯', name: 'HSK',      cat: 'learn',    route: '/hsk' },
  { id: 'courses',       icon: '📖', name: '课程',     cat: 'learn',    route: '/courses' },
  { id: 'chengyu',       icon: '🌸', name: '成语',     cat: 'culture',  route: '/chengyu' },
  { id: 'poetry',        icon: '🍃', name: '诗歌',     cat: 'culture',  route: '/poetry' },
  { id: 'riddles',       icon: '🏮', name: '猜灯谜',   cat: 'culture',  route: '/riddles' },
  { id: 'feiyi',         icon: '🎭', name: '非遗',     cat: 'culture',  route: '/feiyi' },
];

const CATEGORIES = [
  { id: 'core',    label: '核心',     color: '#10b981' },
  { id: 'learn',   label: '学习',     color: '#3b82f6' },
  { id: 'culture', label: '文化',     color: '#f59e0b' },
];

export default function CommunityHome() {
  const { user, logout } = useAuth();
  const [allowedIds, setAllowedIds] = useState(null); // null while loading

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      // super_admin sees all
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
        // No row = use defaults (core always on; others off unless override)
        const allowed = MODULES.filter(m => {
          if (m.cat === 'core') return true;
          if (m.id in overrides) return overrides[m.id];
          return false;
        }).map(m => m.id);
        setAllowedIds(allowed);
      } catch (e) {
        console.warn('[CommunityHome] modules fetch:', e);
        setAllowedIds(MODULES.filter(m => m.cat === 'core').map(m => m.id));
      }
    })();
  }, [user?.id, user?.role]);

  const myRole = user?.role;
  const schoolUrl = ROLE_HOME[myRole] || null;
  const schoolLabel = {
    super_admin:   '管理后台',
    school_master: '校长面板',
    teacher:       '教师工作台',
    student:       '学生面板',
    parent:        '家长面板',
  }[myRole] || '学校';

  return (
    <div style={{ minHeight: '100dvh', background: '#fdf6e3' }}>
      <header style={{
        background: '#c41e3a', color: '#fff',
        padding: '14px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontSize: 20, fontWeight: 700,
            fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 4,
          }}>大卫学中文 · 社区</div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
            {user?.name || user?.email} · {myRole || 'visitor'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {schoolUrl && (
            <button onClick={() => window.location.href = schoolUrl} style={{
              padding: '8px 14px', background: '#fff', color: '#c41e3a',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
              fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <School size={14}/> {schoolLabel}
            </button>
          )}
          <button onClick={logout} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.5)',
            color: '#fff', padding: '8px 12px', borderRadius: 8,
            cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <LogOut size={12}/> 退出
          </button>
        </div>
      </header>

      <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        {allowedIds === null ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#a07850' }}>
            ···
          </div>
        ) : (
          CATEGORIES.map(cat => {
            const mods = MODULES.filter(m => m.cat === cat.id);
            return (
              <section key={cat.id} style={{ marginBottom: 28 }}>
                <h2 style={{
                  fontSize: 14, fontWeight: 600, color: cat.color,
                  margin: '0 0 12px',
                  textTransform: 'uppercase', letterSpacing: 2,
                }}>
                  {cat.label}
                </h2>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 12,
                }}>
                  {mods.map(m => {
                    const allowed = allowedIds.includes(m.id);
                    return (
                      <ModuleTile key={m.id} mod={m} allowed={allowed} cat={cat}/>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}

function ModuleTile({ mod, allowed, cat }) {
  const handleClick = () => {
    if (!allowed) return;
    // Route to the david-chinese student app for now
    window.location.href = mod.route;
  };
  return (
    <button onClick={handleClick} disabled={!allowed} style={{
      background: allowed ? '#fff' : '#f5f0e0',
      border: `1px solid ${allowed ? cat.color + '33' : '#e8d5b0'}`,
      borderRadius: 12, padding: '18px 14px',
      cursor: allowed ? 'pointer' : 'not-allowed',
      opacity: allowed ? 1 : 0.5,
      textAlign: 'center',
      position: 'relative',
    }}>
      <div style={{ fontSize: 32, marginBottom: 6 }}>{mod.icon}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a0a05' }}>{mod.name}</div>
      {!allowed && (
        <div style={{
          position: 'absolute', top: 6, right: 6,
          color: '#a07850',
        }}>
          <Lock size={12}/>
        </div>
      )}
    </button>
  );
}
'''

# ============================================================
# /student
# ============================================================
files["src/student/StudentApp.jsx"] = '''// src/student/StudentApp.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import RequireRole from '../auth/RequireRole';
import StudentLayout from './StudentLayout';
import StudentHome from './pages/StudentHome';
import HomeworkPage from './pages/HomeworkPage';
import GradesPage from './pages/GradesPage';
import NoticesPage from './pages/NoticesPage';
import ProfilePage from './pages/ProfilePage';

export default function StudentApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/student">
          <RequireRole allow={['super_admin', 'student']}>
            <StudentLayout>
              <Routes>
                <Route path="/"        element={<StudentHome />} />
                <Route path="/homework" element={<HomeworkPage />} />
                <Route path="/grades"   element={<GradesPage />} />
                <Route path="/notices"  element={<NoticesPage />} />
                <Route path="/profile"  element={<ProfilePage />} />
              </Routes>
            </StudentLayout>
          </RequireRole>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
'''

files["src/student/StudentLayout.jsx"] = '''// src/student/StudentLayout.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../school/contexts/AuthContext';
import { Home, FileCheck, Award, Bell, User, LogOut, Globe } from 'lucide-react';

const NAV = [
  { path: '/',         label: '首页',     icon: Home },
  { path: '/homework', label: '作业',     icon: FileCheck },
  { path: '/grades',   label: '成绩',     icon: Award },
  { path: '/notices',  label: '通知',     icon: Bell },
  { path: '/profile',  label: '我的',     icon: User },
];

export default function StudentLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isActive = p => p === '/' ? location.pathname === '/' : location.pathname.startsWith(p);

  if (isMobile) {
    return (
      <div style={{ minHeight: '100dvh', background: '#fdf6e3', paddingBottom: 64 }}>
        <header style={{
          background: '#c41e3a', color: '#fff',
          padding: '12px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700,
            fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2 }}>
            学生面板
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => window.location.href = '/community'} style={iconBtnLight}>
              <Globe size={16}/>
            </button>
            <button onClick={logout} style={iconBtnLight}><LogOut size={16}/></button>
          </div>
        </header>
        <main style={{ padding: '12px 12px 24px' }}>{children}</main>
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #e8d5b0',
          display: 'flex', height: 60, justifyContent: 'space-around',
          alignItems: 'center',
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
                  alignItems: 'center', gap: 2, fontSize: 10, minWidth: 60,
                }}>
                <Icon size={18}/>
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
    <div style={{ minHeight: '100dvh', background: '#fdf6e3', display: 'flex' }}>
      <aside style={{
        width: 220, background: '#fff', borderRight: '1px solid #e8d5b0',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: 18, borderBottom: '1px solid #e8d5b0' }}>
          <div style={{
            fontSize: 18, fontWeight: 700, color: '#c41e3a',
            fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2,
          }}>学生面板</div>
          <div style={{ fontSize: 11, color: '#a07850', marginTop: 4 }}>
            {user?.name || user?.email}
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 8px',
          display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                {n.label}
              </button>
            );
          })}
        </div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={() => window.location.href = '/community'} style={btnSecondary}>
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

const iconBtnLight = {
  background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4,
};
const btnSecondary = {
  padding: '8px 12px', background: '#fdf6e3', color: '#a07850',
  border: '1px solid #e8d5b0', borderRadius: 8, cursor: 'pointer', fontSize: 12,
  display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
};
const btnDanger = {
  padding: '8px 12px', background: '#fdf6e3', color: '#c41e3a',
  border: '1px solid #c41e3a', borderRadius: 8, cursor: 'pointer', fontSize: 12,
  display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
};
'''

files["src/student/pages/StudentHome.jsx"] = '''// src/student/pages/StudentHome.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { FileCheck, Award, Bell } from 'lucide-react';

export default function StudentHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ pending: 0, graded: 0, notices: 0 });

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        // Pending homework: assigned to my classes, not yet submitted
        const { data: classes } = await supabase
          .from('clf_class_members').select('class_id').eq('user_id', user.id);
        const ids = (classes || []).map(c => c.class_id);
        if (ids.length === 0) { setStats({ pending: 0, graded: 0, notices: 0 }); return; }

        const { count: hwCount } = await supabase
          .from('clf_homework').select('id', { count: 'exact', head: true }).in('class_id', ids);
        const { count: subCount } = await supabase
          .from('clf_homework_submissions').select('id', { count: 'exact', head: true })
          .eq('student_id', user.id).not('graded_at', 'is', null);
        const { count: noticeCount } = await supabase
          .from('clf_notices').select('id', { count: 'exact', head: true }).in('class_id', ids);

        setStats({
          pending: (hwCount || 0) - (subCount || 0),
          graded:  subCount || 0,
          notices: noticeCount || 0,
        });
      } catch (e) { console.warn('[StudentHome]', e); }
    })();
  }, [user?.id]);

  const tiles = [
    { label: '待完成作业', value: stats.pending, icon: FileCheck, color: '#f59e0b' },
    { label: '已批改作业', value: stats.graded,  icon: Award,     color: '#10b981' },
    { label: '通知',       value: stats.notices, icon: Bell,      color: '#8b5cf6' },
  ];

  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>
        概览 · Overview
      </h1>
      <div style={{ display: 'grid', gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {tiles.map((t, i) => {
          const Icon = t.icon;
          return (
            <div key={i} style={{
              background: '#fff', border: `1px solid ${t.color}22`,
              borderRadius: 12, padding: 16,
            }}>
              <Icon size={20} color={t.color}/>
              <div style={{ fontSize: 28, fontWeight: 700, color: t.color, marginTop: 8 }}>
                {t.value}
              </div>
              <div style={{ fontSize: 12, color: '#a07850', marginTop: 4 }}>{t.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
'''

files["src/student/pages/HomeworkPage.jsx"] = '''// src/student/pages/HomeworkPage.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { FileCheck, Clock, CheckCircle } from 'lucide-react';

export default function HomeworkPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: classes } = await supabase
        .from('clf_class_members').select('class_id').eq('user_id', user.id);
      const ids = (classes || []).map(c => c.class_id);
      if (ids.length === 0) { setItems([]); return; }

      const { data: hw } = await supabase
        .from('clf_homework')
        .select('*, clf_classes(name)')
        .in('class_id', ids)
        .order('created_at', { ascending: false });

      const { data: subs } = await supabase
        .from('clf_homework_submissions')
        .select('homework_id, score, feedback, graded_at')
        .eq('student_id', user.id);
      const subMap = {};
      (subs || []).forEach(s => { subMap[s.homework_id] = s; });

      setItems((hw || []).map(h => ({ ...h, submission: subMap[h.id] || null })));
    })();
  }, [user?.id]);

  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>我的作业</h1>
      {items.length === 0 ? (
        <Empty>暂无作业</Empty>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map(h => (
            <div key={h.id} style={{
              background: '#fff', padding: 14, borderRadius: 10,
              border: '1px solid #e8d5b0',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <FileCheck size={14} color="#10b981"/>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{h.title}</div>
                {h.submission?.graded_at ? (
                  <span style={tagOk}>已批改 · {h.submission.score ?? '-'}</span>
                ) : h.submission ? (
                  <span style={tagPending}>已提交</span>
                ) : (
                  <span style={tagWait}>待提交</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#a07850', marginBottom: 6 }}>
                {h.clf_classes?.name} {h.due_at ? '· 截止 ' + new Date(h.due_at).toLocaleString() : ''}
              </div>
              {h.description && (
                <div style={{ fontSize: 12, color: '#5d4630' }}>{h.description}</div>
              )}
              {h.submission?.feedback && (
                <div style={{
                  marginTop: 8, padding: 8, background: '#fef3e2',
                  borderRadius: 6, fontSize: 12, color: '#5d4630',
                }}>
                  老师批语：{h.submission.feedback}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const tagOk = { fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#10b98115', color: '#10b981', marginLeft: 'auto' };
const tagPending = { fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#f59e0b15', color: '#f59e0b', marginLeft: 'auto' };
const tagWait = { fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#a0785015', color: '#a07850', marginLeft: 'auto' };

function Empty({ children }) {
  return (
    <div style={{
      background: '#fff', padding: 30, borderRadius: 12,
      border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850',
    }}>{children}</div>
  );
}
'''

files["src/student/pages/GradesPage.jsx"] = '''// src/student/pages/GradesPage.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Award } from 'lucide-react';

export default function GradesPage() {
  const { user } = useAuth();
  const [grades, setGrades] = useState([]);
  const [avg, setAvg] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('clf_homework_submissions')
        .select('id, score, feedback, graded_at, clf_homework(title, clf_classes(name))')
        .eq('student_id', user.id)
        .not('graded_at', 'is', null)
        .order('graded_at', { ascending: false });
      setGrades(data || []);
      const scored = (data || []).filter(g => g.score != null);
      if (scored.length > 0) {
        setAvg(scored.reduce((s, g) => s + Number(g.score), 0) / scored.length);
      }
    })();
  }, [user?.id]);

  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>我的成绩</h1>
      {avg != null && (
        <div style={{
          background: '#fff', padding: 16, borderRadius: 12,
          border: '1px solid #10b98133', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <Award size={28} color="#10b981"/>
          <div>
            <div style={{ fontSize: 12, color: '#a07850' }}>平均分</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981' }}>
              {avg.toFixed(1)}
            </div>
          </div>
        </div>
      )}
      {grades.length === 0 ? (
        <div style={{ background: '#fff', padding: 30, borderRadius: 12,
          border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
          暂无成绩
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {grades.map(g => (
            <div key={g.id} style={{
              background: '#fff', padding: 12, borderRadius: 10,
              border: '1px solid #e8d5b0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {g.clf_homework?.title}
                </div>
                <div style={{ fontSize: 11, color: '#a07850', marginTop: 2 }}>
                  {g.clf_homework?.clf_classes?.name} · {new Date(g.graded_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{
                fontSize: 22, fontWeight: 700,
                color: g.score >= 80 ? '#10b981' : g.score >= 60 ? '#f59e0b' : '#c41e3a',
              }}>
                {g.score ?? '-'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
'''

files["src/student/pages/NoticesPage.jsx"] = '''// src/student/pages/NoticesPage.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Bell, Pin } from 'lucide-react';

export default function NoticesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: classes } = await supabase
        .from('clf_class_members').select('class_id').eq('user_id', user.id);
      const ids = (classes || []).map(c => c.class_id);
      if (ids.length === 0) { setItems([]); return; }
      const { data } = await supabase.from('clf_notices')
        .select('*, clf_classes(name)')
        .in('class_id', ids)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });
      setItems(data || []);
    })();
  }, [user?.id]);

  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>通知公告</h1>
      {items.length === 0 ? (
        <div style={{ background: '#fff', padding: 30, borderRadius: 12,
          border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
          暂无通知
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map(n => (
            <div key={n.id} style={{
              background: n.pinned ? '#fef3e2' : '#fff', padding: 14, borderRadius: 10,
              border: `1px solid ${n.pinned ? '#c41e3a' : '#e8d5b0'}`,
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                {n.pinned && <Pin size={12} color="#c41e3a"/>}
                <Bell size={14} color="#8b5cf6"/>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{n.title}</div>
              </div>
              <div style={{ fontSize: 11, color: '#a07850', marginBottom: 6 }}>
                {n.clf_classes?.name} · {new Date(n.created_at).toLocaleString()}
              </div>
              <div style={{ fontSize: 13, color: '#5d4630', whiteSpace: 'pre-wrap' }}>
                {n.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
'''

files["src/student/pages/ProfilePage.jsx"] = '''// src/student/pages/ProfilePage.jsx
import React from 'react';
import { useAuth } from '../../school/contexts/AuthContext';

export default function ProfilePage() {
  const { user } = useAuth();
  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>我的资料</h1>
      <div style={{ background: '#fff', padding: 20, borderRadius: 12,
        border: '1px solid #e8d5b0' }}>
        <Row label="姓名"  value={user?.name}/>
        <Row label="邮箱"  value={user?.email}/>
        <Row label="角色"  value={user?.role}/>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{
      display: 'flex', padding: '10px 0', borderBottom: '1px solid #fdf6e3',
    }}>
      <div style={{ width: 80, fontSize: 12, color: '#a07850' }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1a0a05' }}>{value || '-'}</div>
    </div>
  );
}
'''

# ============================================================
# /parent
# ============================================================
files["src/parent/ParentApp.jsx"] = '''// src/parent/ParentApp.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import RequireRole from '../auth/RequireRole';
import ParentLayout from './ParentLayout';
import ParentHome from './pages/ParentHome';
import ChildHomeworkPage from './pages/ChildHomeworkPage';
import MessagesPage from './pages/MessagesPage';
import NoticesPage from './pages/NoticesPage';

export default function ParentApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/parent">
          <RequireRole allow={['super_admin', 'parent']}>
            <ParentLayout>
              <Routes>
                <Route path="/"          element={<ParentHome />} />
                <Route path="/homework"  element={<ChildHomeworkPage />} />
                <Route path="/messages"  element={<MessagesPage />} />
                <Route path="/notices"   element={<NoticesPage />} />
              </Routes>
            </ParentLayout>
          </RequireRole>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
'''

files["src/parent/ParentLayout.jsx"] = '''// src/parent/ParentLayout.jsx
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
'''

files["src/parent/pages/ParentHome.jsx"] = '''// src/parent/pages/ParentHome.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Users } from 'lucide-react';

export default function ParentHome() {
  const { user } = useAuth();
  const [children, setChildren] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      // Children = clf_class_members rows where parent_user_id = me
      const { data } = await supabase
        .from('clf_class_members')
        .select('id, student_name, user_id, class_id, clf_classes(name, grade_level)')
        .eq('parent_user_id', user.id);
      setChildren(data || []);
    })();
  }, [user?.id]);

  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>我的孩子</h1>
      {children.length === 0 ? (
        <div style={{ background: '#fff', padding: 30, borderRadius: 12,
          border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
          还没有关联的孩子。请联系老师或学校管理员。
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {children.map(c => (
            <div key={c.id} style={{
              background: '#fff', borderRadius: 12, padding: 16,
              border: '1px solid #e8d5b0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Users size={18} color="#3b82f6"/>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{c.student_name}</div>
              </div>
              <div style={{ fontSize: 12, color: '#a07850' }}>
                班级：{c.clf_classes?.name || '-'}
                {c.clf_classes?.grade_level ? ' · ' + c.clf_classes.grade_level : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
'''

files["src/parent/pages/ChildHomeworkPage.jsx"] = '''// src/parent/pages/ChildHomeworkPage.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { FileCheck } from 'lucide-react';

export default function ChildHomeworkPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: kids } = await supabase
        .from('clf_class_members')
        .select('class_id, user_id, student_name')
        .eq('parent_user_id', user.id);
      const classIds = [...new Set((kids || []).map(k => k.class_id))];
      if (classIds.length === 0) { setItems([]); return; }

      const { data: hw } = await supabase
        .from('clf_homework')
        .select('*, clf_classes(name)')
        .in('class_id', classIds)
        .order('created_at', { ascending: false });

      setItems(hw || []);
    })();
  }, [user?.id]);

  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>作业进度</h1>
      {items.length === 0 ? (
        <div style={{ background: '#fff', padding: 30, borderRadius: 12,
          border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
          暂无作业
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map(h => (
            <div key={h.id} style={{
              background: '#fff', padding: 14, borderRadius: 10,
              border: '1px solid #e8d5b0',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <FileCheck size={14} color="#10b981"/>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{h.title}</div>
              </div>
              <div style={{ fontSize: 11, color: '#a07850' }}>
                {h.clf_classes?.name} {h.due_at ? '· 截止 ' + new Date(h.due_at).toLocaleString() : ''}
              </div>
              {h.description && (
                <div style={{ fontSize: 12, color: '#5d4630', marginTop: 6 }}>{h.description}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
'''

files["src/parent/pages/MessagesPage.jsx"] = '''// src/parent/pages/MessagesPage.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { MessageSquare, Send } from 'lucide-react';

export default function MessagesPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');

  const loadThreads = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('clf_pt_threads')
      .select('*').eq('parent_id', user.id).order('last_msg_at', { ascending: false });
    setThreads(data || []);
  };
  useEffect(() => { loadThreads(); }, [user?.id]);

  const open = async (t) => {
    setActive(t);
    const { data } = await supabase.from('clf_pt_messages')
      .select('*').eq('thread_id', t.id).order('created_at');
    setMessages(data || []);
  };

  const send = async () => {
    if (!draft.trim() || !active) return;
    await supabase.from('clf_pt_messages').insert({
      thread_id: active.id, sender_id: user.id, body: draft.trim(),
    });
    await supabase.from('clf_pt_threads').update({ last_msg_at: new Date().toISOString() })
      .eq('id', active.id);
    setDraft('');
    open(active);
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>老师消息</h1>
      <div style={{ display: 'grid', gap: 16,
        gridTemplateColumns: active ? '1fr 1.5fr' : '1fr' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {threads.length === 0 ? (
            <div style={{ background: '#fff', padding: 24, borderRadius: 12,
              border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
              暂无消息
            </div>
          ) : threads.map(t => (
            <button key={t.id} onClick={() => open(t)} style={{
              background: active?.id === t.id ? '#fef3e2' : '#fff',
              padding: 12, borderRadius: 10, textAlign: 'left',
              border: `1px solid ${active?.id === t.id ? '#c41e3a' : '#e8d5b0'}`,
              cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={14} color="#8b5cf6"/>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t.subject}</div>
              </div>
              <div style={{ fontSize: 10, color: '#a07850', marginTop: 4 }}>
                {new Date(t.last_msg_at).toLocaleString()}
              </div>
            </button>
          ))}
        </div>
        {active && (
          <div style={{ background: '#fff', borderRadius: 12,
            border: '1px solid #e8d5b0', display: 'flex', flexDirection: 'column',
            minHeight: 400 }}>
            <div style={{ padding: 12, borderBottom: '1px solid #e8d5b0', fontSize: 14, fontWeight: 600 }}>
              {active.subject}
            </div>
            <div style={{ flex: 1, padding: 12, overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400 }}>
              {messages.map(m => {
                const me = m.sender_id === user?.id;
                return (
                  <div key={m.id} style={{
                    alignSelf: me ? 'flex-end' : 'flex-start',
                    background: me ? '#c41e3a' : '#fdf6e3',
                    color: me ? '#fff' : '#1a0a05',
                    padding: '8px 12px', borderRadius: 12,
                    maxWidth: '75%', fontSize: 13,
                  }}>{m.body}</div>
                );
              })}
            </div>
            <div style={{ padding: 12, borderTop: '1px solid #e8d5b0',
              display: 'flex', gap: 8 }}>
              <input value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="输入消息"
                style={{ flex: 1, padding: '8px 10px', fontSize: 13,
                  border: '1px solid #e8d5b0', borderRadius: 6 }}/>
              <button onClick={send} style={{
                padding: '8px 14px', background: '#c41e3a', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer',
              }}><Send size={14}/></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
'''

files["src/parent/pages/NoticesPage.jsx"] = '''// src/parent/pages/NoticesPage.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Bell, Pin } from 'lucide-react';

export default function NoticesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: kids } = await supabase
        .from('clf_class_members').select('class_id').eq('parent_user_id', user.id);
      const ids = [...new Set((kids || []).map(k => k.class_id))];
      if (ids.length === 0) { setItems([]); return; }
      const { data } = await supabase.from('clf_notices')
        .select('*, clf_classes(name)')
        .in('class_id', ids)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });
      setItems(data || []);
    })();
  }, [user?.id]);

  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>学校通知</h1>
      {items.length === 0 ? (
        <div style={{ background: '#fff', padding: 30, borderRadius: 12,
          border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
          暂无通知
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map(n => (
            <div key={n.id} style={{
              background: n.pinned ? '#fef3e2' : '#fff', padding: 14, borderRadius: 10,
              border: `1px solid ${n.pinned ? '#c41e3a' : '#e8d5b0'}`,
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                {n.pinned && <Pin size={12} color="#c41e3a"/>}
                <Bell size={14} color="#8b5cf6"/>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{n.title}</div>
              </div>
              <div style={{ fontSize: 11, color: '#a07850', marginBottom: 6 }}>
                {n.clf_classes?.name} · {new Date(n.created_at).toLocaleString()}
              </div>
              <div style={{ fontSize: 13, color: '#5d4630', whiteSpace: 'pre-wrap' }}>{n.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
'''

# ============================================================
# /school-master
# ============================================================
files["src/school-master/SchoolMasterApp.jsx"] = '''// src/school-master/SchoolMasterApp.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import RequireRole from '../auth/RequireRole';
import SchoolMasterLayout from './SchoolMasterLayout';
import Overview from './pages/Overview';
import TeachersPage from './pages/TeachersPage';
import ClassesPage from './pages/ClassesPage';
import StudentsPage from './pages/StudentsPage';
import NoticesPage from './pages/NoticesPage';

export default function SchoolMasterApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/school-master">
          <RequireRole allow={['super_admin', 'school_master']}>
            <SchoolMasterLayout>
              <Routes>
                <Route path="/"          element={<Overview />} />
                <Route path="/teachers"  element={<TeachersPage />} />
                <Route path="/classes"   element={<ClassesPage />} />
                <Route path="/students"  element={<StudentsPage />} />
                <Route path="/notices"   element={<NoticesPage />} />
              </Routes>
            </SchoolMasterLayout>
          </RequireRole>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
'''

files["src/school-master/SchoolMasterLayout.jsx"] = '''// src/school-master/SchoolMasterLayout.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../school/contexts/AuthContext';
import { Home, Users, GraduationCap, BookOpen, Bell, LogOut, Globe } from 'lucide-react';

const NAV = [
  { path: '/',          label: '概览',   icon: Home },
  { path: '/teachers',  label: '教师',   icon: Users },
  { path: '/classes',   label: '班级',   icon: BookOpen },
  { path: '/students',  label: '学生',   icon: GraduationCap },
  { path: '/notices',   label: '通知',   icon: Bell },
];

export default function SchoolMasterLayout({ children }) {
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
        <header style={{
          background: '#c41e3a', color: '#fff', padding: '12px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700,
            fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2 }}>校长面板</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => window.location.href = '/community'}
              style={{ background: 'transparent', border: 'none', color: '#fff', padding: 4, cursor: 'pointer' }}>
              <Globe size={16}/>
            </button>
            <button onClick={logout}
              style={{ background: 'transparent', border: 'none', color: '#fff', padding: 4, cursor: 'pointer' }}>
              <LogOut size={16}/>
            </button>
          </div>
        </header>
        <main style={{ padding: 12 }}>{children}</main>
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #e8d5b0',
          display: 'flex', height: 60, justifyContent: 'space-around', alignItems: 'center' }}>
          {NAV.map(n => {
            const Icon = n.icon, active = isActive(n.path);
            return (
              <button key={n.path} onClick={() => navigate(n.path)} style={{
                background: 'transparent', border: 'none',
                color: active ? '#c41e3a' : '#a07850', cursor: 'pointer', padding: '4px 6px',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, fontSize: 10, minWidth: 60,
              }}>
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
      <aside style={{ width: 220, background: '#fff', borderRight: '1px solid #e8d5b0',
        display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 18, borderBottom: '1px solid #e8d5b0' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#c41e3a',
            fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2 }}>校长面板</div>
          <div style={{ fontSize: 11, color: '#a07850', marginTop: 4 }}>
            {user?.name || user?.email}
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 8px',
          display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(n => {
            const Icon = n.icon, active = isActive(n.path);
            return (
              <button key={n.path} onClick={() => navigate(n.path)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8,
                background: active ? '#c41e3a15' : 'transparent',
                color: active ? '#c41e3a' : '#5d4630',
                border: 'none', cursor: 'pointer', fontSize: 13,
                fontWeight: active ? 600 : 400, textAlign: 'left',
              }}>
                <Icon size={16}/>{n.label}
              </button>
            );
          })}
        </div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={() => window.location.href = '/community'} style={{
            padding: '8px 12px', background: '#fdf6e3', color: '#a07850',
            border: '1px solid #e8d5b0', borderRadius: 8, cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <Globe size={14}/> 去社区
          </button>
          <button onClick={logout} style={{
            padding: '8px 12px', background: '#fdf6e3', color: '#c41e3a',
            border: '1px solid #c41e3a', borderRadius: 8, cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <LogOut size={14}/> 退出
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>{children}</main>
    </div>
  );
}
'''

files["src/school-master/pages/Overview.jsx"] = '''// src/school-master/pages/Overview.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../school/services/supabase';
import { Users, GraduationCap, BookOpen, FileCheck } from 'lucide-react';

export default function Overview() {
  const [stats, setStats] = useState({ teachers: 0, classes: 0, students: 0, homework: 0 });
  useEffect(() => {
    (async () => {
      try {
        const [t, c, s, h] = await Promise.all([
          supabase.from('clf_user_profiles').select('user_id', { count: 'exact', head: true }).eq('role', 'teacher'),
          supabase.from('clf_classes').select('id', { count: 'exact', head: true }),
          supabase.from('clf_class_members').select('id', { count: 'exact', head: true }),
          supabase.from('clf_homework').select('id', { count: 'exact', head: true }),
        ]);
        setStats({ teachers: t.count || 0, classes: c.count || 0,
                   students: s.count || 0, homework: h.count || 0 });
      } catch (e) { console.warn('[Overview]', e); }
    })();
  }, []);

  const tiles = [
    { label: '教师', value: stats.teachers, icon: Users,         color: '#3b82f6' },
    { label: '班级', value: stats.classes,  icon: BookOpen,      color: '#8b5cf6' },
    { label: '学生', value: stats.students, icon: GraduationCap, color: '#10b981' },
    { label: '作业', value: stats.homework, icon: FileCheck,     color: '#f59e0b' },
  ];
  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>学校概览</h1>
      <div style={{ display: 'grid', gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {tiles.map((t, i) => {
          const Icon = t.icon;
          return (
            <div key={i} style={{
              background: '#fff', border: `1px solid ${t.color}22`,
              borderRadius: 12, padding: 16,
            }}>
              <Icon size={20} color={t.color}/>
              <div style={{ fontSize: 28, fontWeight: 700, color: t.color, marginTop: 8 }}>
                {t.value}
              </div>
              <div style={{ fontSize: 12, color: '#a07850', marginTop: 4 }}>{t.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
'''

files["src/school-master/pages/TeachersPage.jsx"] = '''// src/school-master/pages/TeachersPage.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../school/services/supabase';
import { Users } from 'lucide-react';

export default function TeachersPage() {
  const [teachers, setTeachers] = useState([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('clf_user_profiles')
        .select('user_id, email, display_name, role')
        .eq('role', 'teacher')
        .order('display_name');
      setTeachers(data || []);
    })();
  }, []);
  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>教师管理</h1>
      {teachers.length === 0 ? (
        <Empty>暂无教师</Empty>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8d5b0',
          overflow: 'hidden' }}>
          {teachers.map((t, i) => (
            <div key={t.user_id} style={{
              padding: 14, display: 'flex', gap: 10, alignItems: 'center',
              borderBottom: i < teachers.length - 1 ? '1px solid #fdf6e3' : 'none',
            }}>
              <Users size={16} color="#3b82f6"/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t.display_name || '-'}</div>
                <div style={{ fontSize: 11, color: '#a07850' }}>{t.email}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
const Empty = ({ children }) => (
  <div style={{ background: '#fff', padding: 30, borderRadius: 12,
    border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
    {children}
  </div>
);
'''

files["src/school-master/pages/ClassesPage.jsx"] = '''// src/school-master/pages/ClassesPage.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../school/services/supabase';
import { BookOpen } from 'lucide-react';

export default function ClassesPage() {
  const [classes, setClasses] = useState([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('clf_classes')
        .select('*')
        .order('created_at', { ascending: false });
      setClasses(data || []);
    })();
  }, []);
  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>班级管理</h1>
      {classes.length === 0 ? (
        <Empty>暂无班级</Empty>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {classes.map(c => (
            <div key={c.id} style={{
              background: '#fff', padding: 14, borderRadius: 10,
              border: '1px solid #e8d5b0',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <BookOpen size={14} color="#8b5cf6"/>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
              </div>
              <div style={{ fontSize: 11, color: '#a07850', marginTop: 4 }}>
                {c.grade_level || '-'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
const Empty = ({ children }) => (
  <div style={{ background: '#fff', padding: 30, borderRadius: 12,
    border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
    {children}
  </div>
);
'''

files["src/school-master/pages/StudentsPage.jsx"] = '''// src/school-master/pages/StudentsPage.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../school/services/supabase';
import { GraduationCap } from 'lucide-react';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('clf_class_members')
        .select('id, student_name, clf_classes(name)')
        .order('student_name');
      setStudents(data || []);
    })();
  }, []);
  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>学生管理</h1>
      {students.length === 0 ? (
        <div style={{ background: '#fff', padding: 30, borderRadius: 12,
          border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
          暂无学生
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8d5b0',
          overflow: 'hidden' }}>
          {students.map((s, i) => (
            <div key={s.id} style={{
              padding: 12, display: 'flex', gap: 10, alignItems: 'center',
              borderBottom: i < students.length - 1 ? '1px solid #fdf6e3' : 'none',
            }}>
              <GraduationCap size={16} color="#10b981"/>
              <div style={{ flex: 1, fontSize: 13 }}>{s.student_name}</div>
              <div style={{ fontSize: 11, color: '#a07850' }}>{s.clf_classes?.name || '-'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
'''

files["src/school-master/pages/NoticesPage.jsx"] = '''// src/school-master/pages/NoticesPage.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../school/services/supabase';
import { Bell } from 'lucide-react';

export default function NoticesPage() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('clf_notices')
        .select('*, clf_classes(name)')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });
      setItems(data || []);
    })();
  }, []);
  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>全校通知</h1>
      {items.length === 0 ? (
        <div style={{ background: '#fff', padding: 30, borderRadius: 12,
          border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
          暂无通知
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map(n => (
            <div key={n.id} style={{
              background: '#fff', padding: 14, borderRadius: 10,
              border: '1px solid #e8d5b0',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <Bell size={14} color="#8b5cf6"/>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{n.title}</div>
              </div>
              <div style={{ fontSize: 11, color: '#a07850', marginBottom: 6 }}>
                {n.clf_classes?.name || '全体'} · {new Date(n.created_at).toLocaleString()}
              </div>
              <div style={{ fontSize: 13, color: '#5d4630', whiteSpace: 'pre-wrap' }}>{n.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
'''

# ============================================================
# Write all files
# ============================================================
print(f"=== Writing {len(files)} code files ===")
for rel, content in files.items():
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    print(f"  wrote  {rel}")

# ============================================================
# Patch App.jsx: route /community + /school-master + IS_COMMUNITY
# ============================================================
print("\n=== Patching src/App.jsx ===")
app = ROOT / "src" / "App.jsx"
src = app.read_text(encoding="utf-8")

# Add CommunityApp import (we deleted it earlier, now bring back)
if "import CommunityApp" not in src:
    # Find first import line after last existing one
    import_pos = src.rfind("import ")
    line_end = src.find("\n", import_pos)
    src = src[:line_end+1] + "import CommunityApp from './community/CommunityApp.jsx';\n" + src[line_end+1:]
    print("  added CommunityApp import")

# Add IS_COMMUNITY flag
if "IS_COMMUNITY" not in src:
    # Find an existing IS_* declaration to anchor near
    anchor = "const IS_LOGIN"
    if anchor in src:
        line_end = src.find(";", src.index(anchor)) + 1
        src = src[:line_end+1] + "  const IS_COMMUNITY      = window.location.pathname.startsWith('/community');\n" + src[line_end+1:]
        print("  added IS_COMMUNITY flag")

# Add the routing branch — put it BEFORE the final fallback
fallback = ":              <LoginGate/>}"
if "IS_COMMUNITY ? <CommunityApp/>" not in src and fallback in src:
    src = src.replace(
        fallback,
        ": IS_COMMUNITY      ? <CommunityApp/>\n        " + fallback
    )
    print("  added IS_COMMUNITY routing branch")

app.write_text(src, encoding="utf-8")

# ============================================================
# Patch RoleRedirect.jsx: all roles -> /community
# ============================================================
print("\n=== Patching src/auth/RoleRedirect.jsx ===")
rr = ROOT / "src" / "auth" / "RoleRedirect.jsx"
if rr.exists():
    rr_src = rr.read_text(encoding="utf-8")
    # Replace ROLE_HOME map: every role lands on /community
    new_role_home = """const ROLE_HOME = {
  super_admin:   '/community',
  school_master: '/community',
  teacher:       '/community',
  student:       '/community',
  parent:        '/community',
};"""
    import re
    pattern = re.compile(r"const ROLE_HOME\s*=\s*\{[^}]+\};", re.DOTALL)
    if pattern.search(rr_src):
        rr_src = pattern.sub(new_role_home, rr_src, count=1)
        rr.write_text(rr_src, encoding="utf-8")
        print("  ROLE_HOME -> all roles to /community")
    else:
        print("  WARN: ROLE_HOME pattern not found")

# ============================================================
# Verify
# ============================================================
print("\n=== Verification ===")
checks = [
    (ROOT / "src/community/CommunityHome.jsx", "MODULES"),
    (ROOT / "src/student/StudentApp.jsx", "BrowserRouter basename=\"/student\""),
    (ROOT / "src/parent/ParentApp.jsx", "BrowserRouter basename=\"/parent\""),
    (ROOT / "src/school-master/SchoolMasterApp.jsx", "BrowserRouter basename=\"/school-master\""),
    (ROOT / "src/App.jsx", "IS_COMMUNITY"),
    (ROOT / "src/App.jsx", "import CommunityApp"),
    (ROOT / "src/auth/RoleRedirect.jsx", "'/community'"),
]
all_ok = True
for path, marker in checks:
    if not path.exists():
        print(f"  [MISSING FILE] {path.name}")
        all_ok = False
        continue
    if marker in path.read_text(encoding="utf-8"):
        print(f"  [OK] {path.name}: '{marker[:30]}...'")
    else:
        print(f"  [MISSING] {path.name}: '{marker[:30]}...'")
        all_ok = False

print("\n" + ("=== ALL CHECKS PASSED ===" if all_ok else "=== SOME CHECKS FAILED ==="))

print()
print("NEXT STEPS:")
print("  1. Build: npm run build")
print("  2. Deploy: netlify deploy --prod --dir dist --no-build")
print()
print("AFTER DEPLOY:")
print("  Login as super_admin -> lands on /community (modules home)")
print("  /community has '管理后台' button -> /admin")
print("  Create teacher/student/parent accounts via /admin")
print("  Each role lands on /community after login, with their role's button")
print()
print("KNOWN LIMITATIONS (Phase D will fix):")
print("  - Module routes are placeholders (clicking 汉字 just navigates to /characters which 404s)")
print("  - Parent-child links must be set manually via Supabase or /admin (no UI yet)")
print("  - School master can VIEW but not EDIT teachers/classes/students")

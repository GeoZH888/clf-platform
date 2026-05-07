# install_phase_d.py
# Phase D: restructure all 4 role panels with new nav matching old version
# Plus shared common items (消息, 个人资料) added to all roles
# Fresh dark UI consistent with /community
#
# Layout:
#   - Dark gradient background (matches /community)
#   - Sidebar (desktop) / bottom-nav (mobile)
#   - DoorCard-style page hero on each landing
#
# Role nav (matches old lingua-school):
#   Teacher: 班级管理, 作业管理, 作业批改, 教学工具, 教学进度
#   Student: 学习中心, 我的作业, 积分商城
#   Parent:  作业情况, 出勤记录, 学业分析, 家校沟通
#   Master:  学校总览, 出勤管理, 作业管理, 教学情况, AI分析, 发送通知, 教师管理, 统计报告
#   Common:  消息通知, 个人资料, 去社区, 退出

import pathlib, sys, re

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

# Make sure dirs exist
for role in ['teacher', 'student', 'parent', 'school-master']:
    (ROOT / 'src' / role / 'pages').mkdir(parents=True, exist_ok=True)
(ROOT / 'src' / 'shared').mkdir(parents=True, exist_ok=True)

# ============================================================
# Shared layout component (used by all 4 panels)
# ============================================================
SHARED_LAYOUT = '''// src/shared/RolePanelLayout.jsx
// Unified dark-themed layout used by Teacher / Student / Parent / SchoolMaster panels.
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../school/contexts/AuthContext';
import { LogOut, Globe, Bell, User } from 'lucide-react';

const COMMON_NAV = [
  { path: '/messages', icon: '\\ud83d\\udcac', label: '\\u6d88\\u606f\\u901a\\u77e5' },
  { path: '/profile',  icon: '\\ud83d\\udc64', label: '\\u4e2a\\u4eba\\u8d44\\u6599' },
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
        background: 'linear-gradient(160deg, #1a0505 0%, #2d0808 35%, #1a0505 70%, #0f0202 100%)',
        color: '#fdf6e3', paddingBottom: 70,
      }}>
        <header style={{
          padding: '14px 18px',
          borderBottom: `1px solid rgba(255,255,255,0.1)`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700,
              fontFamily: \"'STKaiti','KaiTi',serif\", letterSpacing: 3, color: '#fff5e6' }}>
              {title}
            </div>
            <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>
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
          background: 'rgba(15,2,2,0.95)', backdropFilter: 'blur(8px)',
          borderTop: `1px solid rgba(255,255,255,0.1)`,
          display: 'flex', height: 64, alignItems: 'center', justifyContent: 'space-around',
          overflowX: 'auto',
        }}>
          {fullNav.map(n => {
            const active = isActive(n.path);
            return (
              <button key={n.path} onClick={() => navigate(n.path)}
                style={{
                  background: 'transparent', border: 'none',
                  color: active ? accentColor : 'rgba(253,246,227,0.6)',
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
      background: 'linear-gradient(160deg, #1a0505 0%, #2d0808 35%, #1a0505 70%, #0f0202 100%)',
      color: '#fdf6e3', display: 'flex',
    }}>
      <aside style={{
        width: 240,
        background: 'linear-gradient(180deg, #2d0808 0%, #1a0505 100%)',
        borderRight: `1px solid rgba(255,255,255,0.08)`,
        display: 'flex', flexDirection: 'column',
        position: 'fixed', height: '100vh', overflowY: 'auto',
      }}>
        <div style={{
          padding: '24px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 28 }}>\\ud83d\\udc3c</span>
            <div>
              <div style={{
                fontSize: 16, fontWeight: 700, color: '#fff5e6',
                fontFamily: \"'STKaiti','KaiTi',serif\", letterSpacing: 3,
              }}>{title}</div>
              {subtitle && (
                <div style={{ fontSize: 10, color: '#a07850' }}>{subtitle}</div>
              )}
            </div>
          </div>
          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 8 }}>
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
                background: active ? `${accentColor}25` : 'transparent',
                color: active ? '#fff5e6' : 'rgba(253,246,227,0.7)',
                border: active ? `1px solid ${accentColor}55` : '1px solid transparent',
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
            borderTop: '1px solid rgba(255,255,255,0.08)',
            fontSize: 10, color: 'rgba(253,246,227,0.4)', letterSpacing: 2,
          }}>
            \\u901a\\u7528
          </div>

          {COMMON_NAV.map(n => {
            const active = isActive(n.path);
            return (
              <button key={n.path} onClick={() => navigate(n.path)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10,
                background: active ? `${accentColor}25` : 'transparent',
                color: active ? '#fff5e6' : 'rgba(253,246,227,0.7)',
                border: active ? `1px solid ${accentColor}55` : '1px solid transparent',
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
          borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => window.location.href = '/community'} style={{
            padding: '8px 12px', background: 'rgba(253,246,227,0.05)', color: '#fff5e6',
            border: '1px solid rgba(255,245,230,0.2)', borderRadius: 8,
            cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
          }}>
            <Globe size={14}/> \\u53bb\\u793e\\u533a
          </button>
          <button onClick={logout} style={{
            padding: '8px 12px', background: 'transparent', color: '#fda4af',
            border: '1px solid rgba(253,164,175,0.4)', borderRadius: 8,
            cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
          }}>
            <LogOut size={14}/> \\u9000\\u51fa
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, marginLeft: 240, padding: 28, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}

// === Reusable page hero (DoorCard-style) ===
export function PageHero({ icon, title, subtitle, accentColor = '#c41e3a', children }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${accentColor}12 0%, ${accentColor}05 100%)`,
      border: `1.5px solid ${accentColor}30`,
      borderRadius: 18, padding: '24px 26px', marginBottom: 20,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -10, right: -10, fontSize: 110, opacity: 0.05,
        lineHeight: 1, color: accentColor, pointerEvents: 'none', userSelect: 'none',
        fontFamily: 'serif',
      }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: subtitle ? 6 : 0 }}>
        {icon && (
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: `${accentColor}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, border: `1px solid ${accentColor}40`,
          }}>{icon}</div>
        )}
        <div>
          <div style={{
            fontSize: 24, fontWeight: 800, color: '#fff5e6',
            fontFamily: \"'STKaiti','KaiTi',serif\", letterSpacing: 3,
          }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 12, color: 'rgba(253,246,227,0.7)', marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

// === Placeholder for unbuilt pages ===
export function ComingSoon({ title, accentColor = '#c41e3a' }) {
  return (
    <div style={{
      background: 'rgba(253,246,227,0.04)',
      border: '1px dashed rgba(255,245,230,0.2)',
      borderRadius: 14, padding: '40px 24px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>\\ud83d\\udea7</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff5e6', marginBottom: 6,
        fontFamily: \"'STKaiti','KaiTi',serif\", letterSpacing: 2 }}>
        {title} \\u00b7 \\u5efa\\u8bbe\\u4e2d
      </div>
      <div style={{ fontSize: 12, color: 'rgba(253,246,227,0.6)' }}>
        \\u4e0b\\u4e00\\u671f\\u5f00\\u53d1\\uff0c\\u6562\\u8bf7\\u671f\\u5f85
      </div>
    </div>
  );
}
'''

# ============================================================
# Helper to build a placeholder page
# ============================================================
def placeholder_page(name_zh, accent='#c41e3a'):
    return f'''import React from 'react';
import {{ PageHero, ComingSoon }} from '../../shared/RolePanelLayout';

export default function Page() {{
  return (
    <div>
      <PageHero title=\"{name_zh}\" accentColor=\"{accent}\"/>
      <ComingSoon title=\"{name_zh}\" accentColor=\"{accent}\"/>
    </div>
  );
}}
'''

# ============================================================
# Teacher app
# ============================================================
TEACHER_NAV = '''const NAV = [
  { path: '/',           icon: '\\ud83c\\udfeb', label: '\\u73ed\\u7ea7\\u7ba1\\u7406' },
  { path: '/homework',   icon: '\\ud83d\\udcdd', label: '\\u4f5c\\u4e1a\\u7ba1\\u7406' },
  { path: '/grading',    icon: '\\u2705', label: '\\u4f5c\\u4e1a\\u6279\\u6539' },
  { path: '/tools',      icon: '\\ud83d\\udee0\\ufe0f', label: '\\u6559\\u5b66\\u5de5\\u5177' },
  { path: '/progress',   icon: '\\ud83d\\udcc8', label: '\\u6559\\u5b66\\u8fdb\\u5ea6' },
];'''

TEACHER_APP = '''// src/teacher/TeacherApp.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import RequireRole from '../auth/RequireRole';
import RolePanelLayout from '../shared/RolePanelLayout';
import ClassesPage from './pages/ClassesPage';
import HomeworkPage from './pages/HomeworkPage';
import GradingPage from './pages/GradingPage';
import ToolsPage from './pages/ToolsPage';
import ProgressPage from './pages/ProgressPage';
import MessagesPage from './pages/MessagesPage';
import ProfilePage from './pages/ProfilePage';

''' + TEACHER_NAV + '''

export default function TeacherApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/teacher">
          <RequireRole allow={['super_admin', 'teacher']}>
            <RolePanelLayout title="\\u6559\\u5e08\\u5de5\\u4f5c\\u53f0" subtitle="Teacher" nav={NAV} accentColor="#c41e3a">
              <Routes>
                <Route path="/"         element={<ClassesPage />} />
                <Route path="/homework" element={<HomeworkPage />} />
                <Route path="/grading"  element={<GradingPage />} />
                <Route path="/tools"    element={<ToolsPage />} />
                <Route path="/progress" element={<ProgressPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/profile"  element={<ProfilePage />} />
              </Routes>
            </RolePanelLayout>
          </RequireRole>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
'''

# ============================================================
# Student app
# ============================================================
STUDENT_NAV = '''const NAV = [
  { path: '/',          icon: '\\ud83c\\udfe0', label: '\\u5b66\\u4e60\\u4e2d\\u5fc3' },
  { path: '/homework',  icon: '\\ud83d\\udcdd', label: '\\u6211\\u7684\\u4f5c\\u4e1a' },
  { path: '/points',    icon: '\\ud83c\\udf81', label: '\\u79ef\\u5206\\u5546\\u57ce' },
];'''

STUDENT_APP = '''// src/student/StudentApp.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import RequireRole from '../auth/RequireRole';
import RolePanelLayout from '../shared/RolePanelLayout';
import LearningCenter from './pages/LearningCenter';
import HomeworkPage from './pages/HomeworkPage';
import PointsShopPage from './pages/PointsShopPage';
import MessagesPage from './pages/MessagesPage';
import ProfilePage from './pages/ProfilePage';

''' + STUDENT_NAV + '''

export default function StudentApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/student">
          <RequireRole allow={['super_admin', 'student']}>
            <RolePanelLayout title="\\u5b66\\u751f\\u9762\\u677f" subtitle="Student" nav={NAV} accentColor="#10b981">
              <Routes>
                <Route path="/"          element={<LearningCenter />} />
                <Route path="/homework"  element={<HomeworkPage />} />
                <Route path="/points"    element={<PointsShopPage />} />
                <Route path="/messages"  element={<MessagesPage />} />
                <Route path="/profile"   element={<ProfilePage />} />
              </Routes>
            </RolePanelLayout>
          </RequireRole>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
'''

# ============================================================
# Parent app
# ============================================================
PARENT_NAV = '''const NAV = [
  { path: '/',           icon: '\\ud83d\\udcdd', label: '\\u4f5c\\u4e1a\\u60c5\\u51b5' },
  { path: '/attendance', icon: '\\u2705', label: '\\u51fa\\u52e4\\u8bb0\\u5f55' },
  { path: '/analysis',   icon: '\\ud83e\\udde0', label: '\\u5b66\\u4e1a\\u5206\\u6790' },
  { path: '/comm',       icon: '\\ud83d\\udcac', label: '\\u5bb6\\u6821\\u6c9f\\u901a' },
];'''

PARENT_APP = '''// src/parent/ParentApp.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import RequireRole from '../auth/RequireRole';
import RolePanelLayout from '../shared/RolePanelLayout';
import HomeworkStatusPage from './pages/HomeworkStatusPage';
import AttendancePage from './pages/AttendancePage';
import AnalysisPage from './pages/AnalysisPage';
import CommPage from './pages/CommPage';
import MessagesPage from './pages/MessagesPage';
import ProfilePage from './pages/ProfilePage';

''' + PARENT_NAV + '''

export default function ParentApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/parent">
          <RequireRole allow={['super_admin', 'parent']}>
            <RolePanelLayout title="\\u5bb6\\u957f\\u9762\\u677f" subtitle="Parent" nav={NAV} accentColor="#8b5cf6">
              <Routes>
                <Route path="/"           element={<HomeworkStatusPage />} />
                <Route path="/attendance" element={<AttendancePage />} />
                <Route path="/analysis"   element={<AnalysisPage />} />
                <Route path="/comm"       element={<CommPage />} />
                <Route path="/messages"   element={<MessagesPage />} />
                <Route path="/profile"    element={<ProfilePage />} />
              </Routes>
            </RolePanelLayout>
          </RequireRole>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
'''

# ============================================================
# School Master app
# ============================================================
MASTER_NAV = '''const NAV = [
  { path: '/',           icon: '\\ud83d\\udcca', label: '\\u5b66\\u6821\\u603b\\u89c8' },
  { path: '/attendance', icon: '\\u2705', label: '\\u51fa\\u52e4\\u7ba1\\u7406' },
  { path: '/homework',   icon: '\\ud83d\\udcdd', label: '\\u4f5c\\u4e1a\\u7ba1\\u7406' },
  { path: '/teaching',   icon: '\\ud83d\\udcc8', label: '\\u6559\\u5b66\\u60c5\\u51b5' },
  { path: '/ai',         icon: '\\ud83e\\udde0', label: 'AI\\u5206\\u6790' },
  { path: '/notify',     icon: '\\ud83d\\udce2', label: '\\u53d1\\u9001\\u901a\\u77e5' },
  { path: '/teachers',   icon: '\\ud83d\\udc68\\u200d\\ud83c\\udfeb', label: '\\u6559\\u5e08\\u7ba1\\u7406' },
  { path: '/reports',    icon: '\\ud83d\\udcc4', label: '\\u7edf\\u8ba1\\u62a5\\u544a' },
];'''

MASTER_APP = '''// src/school-master/SchoolMasterApp.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import RequireRole from '../auth/RequireRole';
import RolePanelLayout from '../shared/RolePanelLayout';
import OverviewPage from './pages/OverviewPage';
import AttendancePage from './pages/AttendancePage';
import HomeworkPage from './pages/HomeworkPage';
import TeachingPage from './pages/TeachingPage';
import AIPage from './pages/AIPage';
import NotifyPage from './pages/NotifyPage';
import TeachersPage from './pages/TeachersPage';
import ReportsPage from './pages/ReportsPage';
import MessagesPage from './pages/MessagesPage';
import ProfilePage from './pages/ProfilePage';

''' + MASTER_NAV + '''

export default function SchoolMasterApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/school-master">
          <RequireRole allow={['super_admin', 'school_master']}>
            <RolePanelLayout title="\\u6821\\u957f\\u9762\\u677f" subtitle="School Master" nav={NAV} accentColor="#a07850">
              <Routes>
                <Route path="/"           element={<OverviewPage />} />
                <Route path="/attendance" element={<AttendancePage />} />
                <Route path="/homework"   element={<HomeworkPage />} />
                <Route path="/teaching"   element={<TeachingPage />} />
                <Route path="/ai"         element={<AIPage />} />
                <Route path="/notify"     element={<NotifyPage />} />
                <Route path="/teachers"   element={<TeachersPage />} />
                <Route path="/reports"    element={<ReportsPage />} />
                <Route path="/messages"   element={<MessagesPage />} />
                <Route path="/profile"    element={<ProfilePage />} />
              </Routes>
            </RolePanelLayout>
          </RequireRole>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
'''

# ============================================================
# Files dictionary
# ============================================================
files = {}
files['src/shared/RolePanelLayout.jsx'] = SHARED_LAYOUT

files['src/teacher/TeacherApp.jsx']                = TEACHER_APP
files['src/teacher/pages/ClassesPage.jsx']         = placeholder_page('\u73ed\u7ea7\u7ba1\u7406', '#c41e3a')
files['src/teacher/pages/HomeworkPage.jsx']        = placeholder_page('\u4f5c\u4e1a\u7ba1\u7406', '#c41e3a')
files['src/teacher/pages/GradingPage.jsx']         = placeholder_page('\u4f5c\u4e1a\u6279\u6539', '#c41e3a')
files['src/teacher/pages/ToolsPage.jsx']           = placeholder_page('\u6559\u5b66\u5de5\u5177', '#c41e3a')
files['src/teacher/pages/ProgressPage.jsx']        = placeholder_page('\u6559\u5b66\u8fdb\u5ea6', '#c41e3a')
files['src/teacher/pages/MessagesPage.jsx']        = placeholder_page('\u6d88\u606f\u901a\u77e5', '#c41e3a')
files['src/teacher/pages/ProfilePage.jsx']         = placeholder_page('\u4e2a\u4eba\u8d44\u6599', '#c41e3a')

files['src/student/StudentApp.jsx']                = STUDENT_APP
files['src/student/pages/LearningCenter.jsx']      = placeholder_page('\u5b66\u4e60\u4e2d\u5fc3', '#10b981')
files['src/student/pages/HomeworkPage.jsx']        = placeholder_page('\u6211\u7684\u4f5c\u4e1a', '#10b981')
files['src/student/pages/PointsShopPage.jsx']      = placeholder_page('\u79ef\u5206\u5546\u57ce', '#10b981')
files['src/student/pages/MessagesPage.jsx']        = placeholder_page('\u6d88\u606f\u901a\u77e5', '#10b981')
files['src/student/pages/ProfilePage.jsx']         = placeholder_page('\u4e2a\u4eba\u8d44\u6599', '#10b981')

files['src/parent/ParentApp.jsx']                  = PARENT_APP
files['src/parent/pages/HomeworkStatusPage.jsx']   = placeholder_page('\u4f5c\u4e1a\u60c5\u51b5', '#8b5cf6')
files['src/parent/pages/AttendancePage.jsx']       = placeholder_page('\u51fa\u52e4\u8bb0\u5f55', '#8b5cf6')
files['src/parent/pages/AnalysisPage.jsx']         = placeholder_page('\u5b66\u4e1a\u5206\u6790', '#8b5cf6')
files['src/parent/pages/CommPage.jsx']             = placeholder_page('\u5bb6\u6821\u6c9f\u901a', '#8b5cf6')
files['src/parent/pages/MessagesPage.jsx']         = placeholder_page('\u6d88\u606f\u901a\u77e5', '#8b5cf6')
files['src/parent/pages/ProfilePage.jsx']          = placeholder_page('\u4e2a\u4eba\u8d44\u6599', '#8b5cf6')

files['src/school-master/SchoolMasterApp.jsx']     = MASTER_APP
files['src/school-master/pages/OverviewPage.jsx']  = placeholder_page('\u5b66\u6821\u603b\u89c8', '#a07850')
files['src/school-master/pages/AttendancePage.jsx']= placeholder_page('\u51fa\u52e4\u7ba1\u7406', '#a07850')
files['src/school-master/pages/HomeworkPage.jsx']  = placeholder_page('\u4f5c\u4e1a\u7ba1\u7406', '#a07850')
files['src/school-master/pages/TeachingPage.jsx']  = placeholder_page('\u6559\u5b66\u60c5\u51b5', '#a07850')
files['src/school-master/pages/AIPage.jsx']        = placeholder_page('AI\u5206\u6790', '#a07850')
files['src/school-master/pages/NotifyPage.jsx']    = placeholder_page('\u53d1\u9001\u901a\u77e5', '#a07850')
files['src/school-master/pages/TeachersPage.jsx']  = placeholder_page('\u6559\u5e08\u7ba1\u7406', '#a07850')
files['src/school-master/pages/ReportsPage.jsx']   = placeholder_page('\u7edf\u8ba1\u62a5\u544a', '#a07850')
files['src/school-master/pages/MessagesPage.jsx']  = placeholder_page('\u6d88\u606f\u901a\u77e5', '#a07850')
files['src/school-master/pages/ProfilePage.jsx']   = placeholder_page('\u4e2a\u4eba\u8d44\u6599', '#a07850')

# ============================================================
# Write all files (binary mode for surrogate safety in py3.14)
# ============================================================
print(f"=== Writing {len(files)} files ===")
for rel, content in files.items():
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    # Encode through utf-16 surrogatepass cycle to handle any emoji
    data = content.encode("utf-16", "surrogatepass").decode("utf-16").encode("utf-8")
    p.write_bytes(data)
    print(f"  wrote  {rel}")

# ============================================================
# Verify
# ============================================================
print("\n=== Verification ===")
checks = [
    ('src/shared/RolePanelLayout.jsx', 'RolePanelLayout'),
    ('src/teacher/TeacherApp.jsx', "basename=\"/teacher\""),
    ('src/student/StudentApp.jsx', "basename=\"/student\""),
    ('src/parent/ParentApp.jsx', "basename=\"/parent\""),
    ('src/school-master/SchoolMasterApp.jsx', "basename=\"/school-master\""),
    ('src/teacher/pages/GradingPage.jsx', '\u4f5c\u4e1a\u6279\u6539'),
    ('src/student/pages/LearningCenter.jsx', '\u5b66\u4e60\u4e2d\u5fc3'),
    ('src/parent/pages/AttendancePage.jsx', '\u51fa\u52e4\u8bb0\u5f55'),
    ('src/school-master/pages/AIPage.jsx', 'AI\u5206\u6790'),
]
all_ok = True
for rel, marker in checks:
    p = ROOT / rel
    if not p.exists():
        print(f"  [MISSING] {rel}")
        all_ok = False
        continue
    txt = p.read_text(encoding='utf-8')
    if marker in txt:
        print(f"  [OK] {rel}")
    else:
        print(f"  [MISSING marker] {rel} -- {marker[:30]}")
        all_ok = False

print("\n=== " + ("ALL OK" if all_ok else "SOME FAIL") + " ===")
print()
print("NEXT:")
print("  npm run build")
print("  netlify deploy --prod --dir dist --no-build")
print()
print("AFTER DEPLOY:")
print("  https://david-zhongwen.net/community  -> 3 cards")
print("  Click \u6559\u5b66 (with teacher account) -> /teacher panel with new nav:")
print("    \u73ed\u7ea7\u7ba1\u7406 / \u4f5c\u4e1a\u7ba1\u7406 / \u4f5c\u4e1a\u6279\u6539 / \u6559\u5b66\u5de5\u5177 / \u6559\u5b66\u8fdb\u5ea6 + common (\u6d88\u606f / \u4e2a\u4eba\u8d44\u6599)")
print("  Same for /student, /parent, /school-master with their nav structure")
print("  All pages = clean placeholders with hero + 'building' message")
print()
print("Existing Phase B pages (rich Classes/Homework/Communication etc) are PRESERVED on disk")
print("but no longer reachable through nav. To restore them, edit the routes in TeacherApp.jsx.")

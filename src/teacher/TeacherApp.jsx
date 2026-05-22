// src/teacher/TeacherApp.jsx
// ════════════════════════════════════════════════════════════════════════════
// Stage A1 — Merge 备课 into 课堂教学.
// Changes from T1:
//   - Removed 备课 from sidebar (10 items → 9)
//   - Removed CoursePrepWizard import + route
//   - Added /prep redirect → /classroom for backward compat
//   - 课堂教学 label now "课堂教学 · 备课 ⭐" (one entry, both purposes)
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import RequireRole from '../auth/RequireRole';
import RolePanelLayout from '../shared/RolePanelLayout';

// Live page imports (備课 removed; CoursePrepWizard kept on disk for harvesting later)
import TeacherHome    from './pages/TeacherHome';
import CoursesPage    from './pages/CoursesPage';
import ClassroomPage  from './pages/ClassroomPage';
import HomeworkPage   from './pages/HomeworkPage';
import GradingPage    from './pages/GradingPage';
import MaterialsPage  from './pages/MaterialsPage';
import NoticesPage    from './pages/NoticesPage';
import MessagesPage   from './pages/MessagesPage';
import ProfilePage    from './pages/ProfilePage';

// Sidebar — 9 items (was 10 in T1; 备课 merged into 课堂教学)
const NAV = [
  { path: '/',           icon: '🏠', label: '工作台' },
  { path: '/courses',    icon: '📚', label: '我的班级' },
  { path: '/classroom',  icon: '🎯', label: '课堂教学 ⭐' },
  { path: '/homework',   icon: '📝', label: '作业' },
  { path: '/grading',    icon: '✅', label: '批改' },
  { path: '/materials',  icon: '📖', label: '教材' },
  { path: '/notices',    icon: '📣', label: '通知' },
  { path: '/messages',   icon: '💬', label: '消息' },
  { path: '/profile',    icon: '👤', label: '个人资料' },
];

export default function TeacherApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/teacher">
          <RequireRole allow={['super_admin', 'teacher']}>
            <RolePanelLayout
              title="教师工作台"
              subtitle="Teacher"
              nav={NAV}
              accentColor="#c41e3a"
            >
              <Routes>
                <Route path="/"                         element={<TeacherHome />} />
                <Route path="/courses"                  element={<CoursesPage />} />

                {/* Co-teacher (Stage b1) — handles both prep + teach */}
                <Route path="/classroom"                element={<ClassroomPage />} />
                <Route path="/classroom/:classId"       element={<ClassroomPage />} />

                {/* Stage A1: /prep redirects into co-teacher (备课 merged) */}
                <Route path="/prep"                     element={<Navigate to="/classroom" replace />} />
                <Route path="/prep/:classId"            element={<Navigate to="/classroom/:classId" replace />} />

                <Route path="/homework"                 element={<HomeworkPage />} />
                <Route path="/grading"                  element={<GradingPage />} />
                <Route path="/materials"                element={<MaterialsPage />} />
                <Route path="/notices"                  element={<NoticesPage />} />
                <Route path="/messages"                 element={<MessagesPage />} />
                <Route path="/profile"                  element={<ProfilePage />} />
              </Routes>
            </RolePanelLayout>
          </RequireRole>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

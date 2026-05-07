// src/teacher/TeacherApp.jsx
// ════════════════════════════════════════════════════════════════════════════
// Stage T1 — Wire up all 10 live teacher pages into the sidebar + router.
// Co-teacher (课堂教学) is the ⭐ feature. Other 9 are existing pages we built
// before but never connected. No new code; just connections.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import RequireRole from '../auth/RequireRole';
import RolePanelLayout from '../shared/RolePanelLayout';

// Live page imports (all already exist in src/teacher/pages/)
import TeacherHome       from './pages/TeacherHome';
import CoursesPage       from './pages/CoursesPage';
import ClassroomPage     from './pages/ClassroomPage';
import CoursePrepWizard  from './pages/CoursePrepWizard';
import HomeworkPage      from './pages/HomeworkPage';
import GradingPage       from './pages/GradingPage';
import MaterialsPage     from './pages/MaterialsPage';
import NoticesPage       from './pages/NoticesPage';
import MessagesPage      from './pages/MessagesPage';
import ProfilePage       from './pages/ProfilePage';

// Sidebar navigation — 10 items.
// ⭐ = the new co-teacher feature; everything else is existing functionality
// being wired in for the first time.
const NAV = [
  { path: '/',           icon: '🏠', label: '工作台' },
  { path: '/courses',    icon: '📚', label: '我的班级' },
  { path: '/classroom',  icon: '🎯', label: '课堂教学 ⭐' },
  { path: '/prep',       icon: '✏️', label: '备课' },
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
                {/* Landing */}
                <Route path="/"                element={<TeacherHome />} />

                {/* Class management */}
                <Route path="/courses"         element={<CoursesPage />} />

                {/* Co-teacher (Stage b1) — supports both /classroom and /classroom/:classId */}
                <Route path="/classroom"             element={<ClassroomPage />} />
                <Route path="/classroom/:classId"    element={<ClassroomPage />} />

                {/* Lesson prep wizard */}
                <Route path="/prep"            element={<CoursePrepWizard />} />

                {/* Homework + grading */}
                <Route path="/homework"        element={<HomeworkPage />} />
                <Route path="/grading"         element={<GradingPage />} />

                {/* Resources */}
                <Route path="/materials"       element={<MaterialsPage />} />

                {/* Communication */}
                <Route path="/notices"         element={<NoticesPage />} />
                <Route path="/messages"        element={<MessagesPage />} />

                {/* Account */}
                <Route path="/profile"         element={<ProfilePage />} />
              </Routes>
            </RolePanelLayout>
          </RequireRole>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

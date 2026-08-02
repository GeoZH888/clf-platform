// src/school-master/SchoolMasterApp.jsx
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
import PlacementReviewPage from '../placement/PlacementReviewPage';
import TeacherAssessmentPage from '../assessment/TeacherAssessmentPage';

const NAV = [
  { path: '/',           icon: '📊', label: '学校总览' },
  { path: '/attendance', icon: '✅', label: '出勤管理' },
  { path: '/homework',   icon: '📝', label: '作业管理' },
  { path: '/teaching',   icon: '📈', label: '课程安排' },
  { path: '/placement',  icon: '🎓', label: '分班测试' },
  { path: '/assessment', icon: '🎯', label: '学生测评' },
  { path: '/ai',         icon: '🧠', label: '教学分析' },
  { path: '/notify',     icon: '📢', label: '发送通知' },
  { path: '/teachers',   icon: '👨‍🏫', label: '教师管理' },
  { path: '/reports',    icon: '📄', label: '统计报告' },
];

export default function SchoolMasterApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/school-master">
          <RequireRole allow={['super_admin', 'school_master']}>
            <RolePanelLayout title="校长面板" subtitle="School Master" nav={NAV} accentColor="#a07850">
              <Routes>
                <Route path="/"           element={<OverviewPage />} />
                <Route path="/attendance" element={<AttendancePage />} />
                <Route path="/homework"   element={<HomeworkPage />} />
                <Route path="/teaching"   element={<TeachingPage />} />
                <Route path="/placement"  element={<PlacementReviewPage />} />
                <Route path="/assessment" element={<TeacherAssessmentPage />} />
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

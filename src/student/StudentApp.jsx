// src/student/StudentApp.jsx
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

const NAV = [
  { path: '/',          icon: '🏠', label: '学习中心' },
  { path: '/homework',  icon: '📝', label: '我的作业' },
  { path: '/points',    icon: '🎁', label: '积分商城' },
];

export default function StudentApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/student">
          <RequireRole allow={['super_admin', 'student']}>
            <RolePanelLayout title="学生面板" subtitle="Student" nav={NAV} accentColor="#10b981">
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

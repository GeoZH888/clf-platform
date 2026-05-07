// src/parent/ParentApp.jsx
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

const NAV = [
  { path: '/',           icon: '📝', label: '作业情况' },
  { path: '/attendance', icon: '✅', label: '出勤记录' },
  { path: '/analysis',   icon: '🧠', label: '学业分析' },
  { path: '/comm',       icon: '💬', label: '家校沟通' },
];

export default function ParentApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/parent">
          <RequireRole allow={['super_admin', 'parent']}>
            <RolePanelLayout title="家长面板" subtitle="Parent" nav={NAV} accentColor="#8b5cf6">
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

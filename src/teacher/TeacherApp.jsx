// src/teacher/TeacherApp.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import RequireRole from '../auth/RequireRole';
import RolePanelLayout from '../shared/RolePanelLayout';
import ClassesPage from './pages/ClassesPage';
import HomeworkPage from './pages/HomeworkPage';
import ClassroomPage from './pages/ClassroomPage';
import MessagesPage from './pages/MessagesPage';
import ProfilePage from './pages/ProfilePage';

const NAV = [
  { path: '/',          icon: '🏫', label: '班级管理' },
  { path: '/homework',  icon: '📝', label: '作业' },
  { path: '/classroom', icon: '🛠️', label: '课堂教学' },
  { path: '/messages',  icon: '💬', label: '消息通知' },
  { path: '/profile',   icon: '👤', label: '个人资料' },
];

export default function TeacherApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/teacher">
          <RequireRole allow={['super_admin', 'teacher']}>
            <RolePanelLayout title="教师工作台" subtitle="Teacher" nav={NAV} accentColor="#c41e3a">
              <Routes>
                <Route path="/"           element={<ClassesPage />} />
                <Route path="/homework"   element={<HomeworkPage />} />
                <Route path="/classroom"  element={<ClassroomPage />} />
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

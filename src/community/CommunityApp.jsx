// src/community/CommunityApp.jsx
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

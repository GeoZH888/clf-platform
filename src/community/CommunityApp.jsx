// src/community/CommunityApp.jsx
// 社区 home: public landing for everyone. Anonymous visitors see the default
// module bundle; signed-in users see their personal modules + 我的 dashboard.
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import CommunityHome from './CommunityHome';

export default function CommunityApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/community">
          <Routes>
            <Route path="/" element={<CommunityHome />} />
            <Route path="*" element={<CommunityHome />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

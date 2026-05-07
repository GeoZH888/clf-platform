// src/auth/LoginGate.jsx
// Mounts the David-Chinese login form at / and /login.
// If already authenticated, immediately redirects to /role-redirect.
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import LoginPage from '../school/pages/LoginPage';

function LoginShell() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      // Logged in -> bounce to role redirect (which dispatches to role panel)
      window.location.replace('/role-redirect');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#fdf6e3', color: '#a07850', fontSize: 14,
      }}>...</div>
    );
  }
  if (user) return null; // useEffect will navigate, render nothing meanwhile

  return <LoginPage />;
}

export default function LoginGate() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginShell />} />
            <Route path="/login" element={<LoginShell />} />
            <Route path="*" element={<LoginShell />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

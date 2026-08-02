// src/assessment/TestPortalApp.jsx
//
// The standalone test portal at /test — david-zhongwen.net/test.
//
// Same tests as /student → 我的测评, but with its own login and nothing else
// on screen: a kid opens one URL, types the username and password their
// teacher gave them, and lands directly on their tests. No role redirect, no
// panel chrome, no other modules to wander into.
//
// Authorisation is unchanged — this is the same Supabase session the student
// panel uses, and every RLS policy and RPC from 013 applies identically.
// A kid who signs in here can also sign in at /login; this is a convenience
// door, not a second security model.

import React, { useState } from 'react';
import { AuthProvider, useAuth } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import StudentAssessmentPage from './StudentAssessmentPage.jsx';
import { LogOut, GraduationCap } from 'lucide-react';

const BG     = '#fdf6e3';
const ACCENT = '#10b981';
const INK    = '#1a0a05';
const MUTED  = '#a07850';
const KAI    = "'STKaiti','KaiTi',serif";

export default function TestPortalApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <TestPortal/>
      </AuthProvider>
    </LanguageProvider>
  );
}

function TestPortal() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: BG, display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: MUTED }}>···</div>
    );
  }

  if (!user) return <TestLogin/>;

  // Staff who land here by accident get pointed at their own panel rather
  // than an empty list they can't explain.
  const staff = ['teacher', 'school_master', 'super_admin'].includes(user.role);

  return (
    <div style={{ minHeight: '100dvh', background: BG }}>
      <header style={{
        background: ACCENT, color: '#fff', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <GraduationCap size={18}/>
        <div style={{ flex: 1, fontFamily: KAI, fontSize: 17, letterSpacing: 1 }}>
          中文测评
        </div>
        <div style={{ fontSize: 12, opacity: .9 }}>{user.name || user.username}</div>
        <button onClick={logout} title="退出"
          style={{ background: 'transparent', border: 'none', color: '#fff',
            padding: 4, cursor: 'pointer', display: 'flex' }}>
          <LogOut size={16}/>
        </button>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
        {staff && (
          <div style={{ background: '#fff8ec', border: '1px solid #e8d5b0',
            borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: MUTED }}>
            你以老师身份登录，这里只显示布置给你自己的测评。
            要查看学生成绩请前往{' '}
            <a href="/teacher/assessment" style={{ color: ACCENT }}>教师工作台 · 学生测评</a>。
          </div>
        )}
        <StudentAssessmentPage/>
      </main>
    </div>
  );
}

// ── Login ────────────────────────────────────────────────────────────
// Deliberately minimal: username + password, big touch targets, no signup
// link and no password reset — accounts here are created by the school.

function TestLogin() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState('');

  const submit = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password) { setErr('请输入用户名和密码'); return; }
    setBusy(true); setErr('');
    const res = await login(username.trim(), password);
    setBusy(false);
    if (!res?.success) setErr(res?.message || '用户名或密码不正确');
    // On success the AuthProvider sets `user` and this component unmounts.
  };

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form onSubmit={submit} style={{
        background: '#fff', border: '1px solid #e8d5b0', borderRadius: 16,
        padding: 26, width: '100%', maxWidth: 380,
        boxShadow: '0 2px 12px rgba(160,120,80,.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 34, marginBottom: 6 }}>📝</div>
          <h1 style={{ fontFamily: KAI, fontSize: 24, color: INK, margin: 0 }}>中文测评</h1>
          <p style={{ fontSize: 12, color: MUTED, margin: '6px 0 0' }}>
            用老师给你的账号登录 · Sign in with the account your teacher gave you
          </p>
        </div>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>用户名 · Username</div>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            style={field}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>密码 · Password</div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={field}
          />
        </label>

        {err && (
          <div style={{ color: '#c41e3a', fontSize: 12, marginBottom: 12,
            textAlign: 'center' }}>{err}</div>
        )}

        <button type="submit" disabled={busy} style={{
          width: '100%', padding: '13px 16px', fontSize: 16, borderRadius: 10,
          background: ACCENT, color: '#fff', border: 'none',
          cursor: busy ? 'default' : 'pointer', opacity: busy ? .7 : 1,
        }}>{busy ? '登录中…' : '开始 · Start'}</button>

        <div style={{ fontSize: 11, color: MUTED, textAlign: 'center', marginTop: 14 }}>
          忘记密码请联系老师
        </div>
      </form>
    </div>
  );
}

const field = {
  width: '100%', padding: '12px 14px', fontSize: 16,
  border: '1px solid #e8d5b0', borderRadius: 10, background: '#fff',
  color: INK, boxSizing: 'border-box',
};

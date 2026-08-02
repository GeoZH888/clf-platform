// src/assessment/ResultsPortalApp.jsx
//
// The standalone results portal at /testresults — david-zhongwen.net/testresults.
//
// Teacher-facing twin of /test: its own login, then the full 学生测评 page —
// results plus the ability to create and assign tests. A teacher who only
// ever needs to check scores can bookmark one URL and never touch the rest
// of the teacher panel.
//
// Same session and the same RLS as /teacher → 学生测评. The role check below
// is a signpost, not a security boundary: every staff-only table is already
// gated by clf_is_teaching_staff() in the database (013), so a student who
// signs in here sees nothing regardless of what this component renders.

import React, { useState } from 'react';
import { AuthProvider, useAuth } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import TeacherAssessmentPage from './TeacherAssessmentPage.jsx';
import { LogOut, BarChart3 } from 'lucide-react';

const BG     = '#fdf6e3';
const ACCENT = '#c41e3a';
const INK    = '#1a0a05';
const MUTED  = '#a07850';
const KAI    = "'STKaiti','KaiTi',serif";

const STAFF = ['teacher', 'school_master', 'super_admin'];

export default function ResultsPortalApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ResultsPortal/>
      </AuthProvider>
    </LanguageProvider>
  );
}

function ResultsPortal() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: BG, display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: MUTED }}>···</div>
    );
  }

  if (!user) return <StaffLogin/>;

  if (!STAFF.includes(user.role)) {
    return (
      <div style={{ minHeight: '100dvh', background: BG, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🚫</div>
          <div style={{ fontSize: 16, color: INK, marginBottom: 6 }}>
            这个页面只给老师使用
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>
            要做测评请前往 <a href="/test" style={{ color: ACCENT }}>中文测评</a>。
          </div>
          <button onClick={logout} style={{
            padding: '8px 16px', fontSize: 13, background: '#fff', color: MUTED,
            border: '1px solid #e8d5b0', borderRadius: 8, cursor: 'pointer' }}>
            换个账号登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: BG }}>
      <header style={{
        background: ACCENT, color: '#fff', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <BarChart3 size={18}/>
        <div style={{ flex: 1, fontFamily: KAI, fontSize: 17, letterSpacing: 1 }}>
          测评成绩
        </div>
        <div style={{ fontSize: 12, opacity: .9 }}>{user.name || user.username}</div>
        <button onClick={logout} title="退出"
          style={{ background: 'transparent', border: 'none', color: '#fff',
            padding: 4, cursor: 'pointer', display: 'flex' }}>
          <LogOut size={16}/>
        </button>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
        <TeacherAssessmentPage/>
      </main>
    </div>
  );
}

// ── Login ────────────────────────────────────────────────────────────

function StaffLogin() {
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
          <div style={{ fontSize: 34, marginBottom: 6 }}>📊</div>
          <h1 style={{ fontFamily: KAI, fontSize: 24, color: INK, margin: 0 }}>测评成绩</h1>
          <p style={{ fontSize: 12, color: MUTED, margin: '6px 0 0' }}>
            教师登录 · Teacher sign-in
          </p>
        </div>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>用户名 · Username</div>
          <input value={username} onChange={e => setUsername(e.target.value)}
            autoCapitalize="none" autoCorrect="off" style={field}/>
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>密码 · Password</div>
          <input type="password" value={password}
            onChange={e => setPassword(e.target.value)} style={field}/>
        </label>

        {err && (
          <div style={{ color: ACCENT, fontSize: 12, marginBottom: 12,
            textAlign: 'center' }}>{err}</div>
        )}

        <button type="submit" disabled={busy} style={{
          width: '100%', padding: '13px 16px', fontSize: 16, borderRadius: 10,
          background: ACCENT, color: '#fff', border: 'none',
          cursor: busy ? 'default' : 'pointer', opacity: busy ? .7 : 1,
        }}>{busy ? '登录中…' : '登录 · Sign in'}</button>
      </form>
    </div>
  );
}

const field = {
  width: '100%', padding: '12px 14px', fontSize: 16,
  border: '1px solid #e8d5b0', borderRadius: 10, background: '#fff',
  color: INK, boxSizing: 'border-box',
};

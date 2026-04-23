// src/components/QuickLoginScreen.jsx
// Handles QR-scan auto-login. User lands here from /quick-login?t=XXXXX.
// The page generates a stable device_id, exchanges token for session, and logs in.

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

// Stable per-browser device ID. Stored in localStorage so returning users
// on the same device don't consume another device slot.
function getDeviceId() {
  try {
    let id = localStorage.getItem('clf_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 10)
         + Date.now().toString(36);
      localStorage.setItem('clf_device_id', id);
    }
    return id;
  } catch {
    return 'dev_anon_' + Math.random().toString(36).slice(2, 14);
  }
}

export default function QuickLoginScreen({ onSuccess, onFail }) {
  const [status, setStatus] = useState('checking');  // checking | success | error
  const [error, setError] = useState('');
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    (async () => {
      const token = new URLSearchParams(window.location.search).get('t');
      if (!token) {
        setStatus('error');
        setError('缺少登录令牌');
        return;
      }

      try {
        // 1. Exchange token for session credentials
        const res = await fetch('/.netlify/functions/quick-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            device_id: getDeviceId(),
            user_agent: navigator.userAgent,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        // 2. Verify the magic link token to create a session
        const { data: sessionData, error: verifyErr } = await supabase.auth.verifyOtp({
          email: data.email,
          token: data.hashed_token,
          type: 'email',
        });
        if (verifyErr) throw verifyErr;
        if (!sessionData?.session) throw new Error('会话创建失败');

        setDisplayName(data.display_name || data.username);
        setStatus('success');

        // 3. Redirect to main app after brief success message
        setTimeout(() => {
          if (onSuccess) onSuccess();
          else window.location.href = '/';
        }, 1500);
      } catch (e) {
        setStatus('error');
        setError(e.message || '登录失败');
      }
    })();
  }, []);

  return (
    <div style={S.page}>
      <div style={S.card}>
        {status === 'checking' && (
          <>
            <div style={S.emoji}>⏳</div>
            <h2 style={S.title}>正在登录…</h2>
            <p style={S.subtitle}>请稍候</p>
            <div style={S.spinner}/>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={S.emoji}>🎉</div>
            <h2 style={{ ...S.title, color: '#2E7D32' }}>登录成功</h2>
            <p style={S.subtitle}>
              欢迎 <b>{displayName}</b>
              <br/>
              <span style={{ fontSize: 11, color: '#999' }}>正在进入平台…</span>
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={S.emoji}>⚠️</div>
            <h2 style={{ ...S.title, color: '#c62828' }}>无法登录</h2>
            <p style={S.subtitle}>{error}</p>
            <button onClick={() => window.location.href = '/'}
              style={S.btn}>
              返回首页
            </button>
            {onFail && (
              <button onClick={onFail}
                style={{ ...S.btn, background: 'transparent', color: '#8B4513', marginTop: 8 }}>
                其他登录方式
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100dvh', background: '#fdf6e3',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20, fontFamily: 'system-ui, sans-serif' },
  card: { background: '#fff', border: '1px solid #e8d5b0',
    borderRadius: 16, padding: 36, maxWidth: 400, width: '100%',
    textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' },
  emoji: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 20, color: '#8B4513', margin: '0 0 8px',
    fontFamily: "'STKaiti','KaiTi',serif" },
  subtitle: { fontSize: 13, color: '#6b4c2a', margin: '0 0 20px', lineHeight: 1.5 },
  spinner: { width: 28, height: 28, margin: '0 auto',
    border: '3px solid #f5ede0', borderTop: '3px solid #8B4513',
    borderRadius: '50%', animation: 'clfspin 0.8s linear infinite' },
  btn: { padding: '10px 24px', background: '#8B4513', color: '#fff',
    border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500,
    cursor: 'pointer', width: '100%' },
};

// Inject spinner keyframes (once)
if (typeof document !== 'undefined' && !document.getElementById('clf-spinner-kf')) {
  const style = document.createElement('style');
  style.id = 'clf-spinner-kf';
  style.textContent = `@keyframes clfspin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

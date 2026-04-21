// src/components/QRGate.jsx
// Login screen: username + password (replaces QR scan)
// Still shows paused / expired / device-limit states

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const V = {
  bg:'#fdf6e3', card:'#fff', border:'#e8d5b0',
  text:'#1a0a05', text2:'#6b4c2a', text3:'#a07850', verm:'#8B4513',
};

export default function QRGate({ status, error, loginWithPassword }) {
  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [busy,      setBusy]      = useState(false);
  const [localErr,  setLocalErr]  = useState('');
  const [pandaUrl,  setPandaUrl]  = useState(null);
  const [showPw,    setShowPw]    = useState(false);

  useEffect(() => {
    supabase.from('jgw_panda_assets').select('emotion, image_url')
      .then(({ data }) => {
        if (!data?.length) return;
        const normal = data.find(d => d.emotion === 'normal');
        const pick   = normal || data[Math.floor(Math.random() * data.length)];
        if (pick?.image_url) setPandaUrl(pick.image_url);
      }).catch(() => {});
  }, []);

  async function handleLogin(e) {
    e?.preventDefault();
    if (!username.trim() || !password.trim()) {
      setLocalErr('请填写用户名和密码 · Please enter username and password');
      return;
    }
    setBusy(true);
    setLocalErr('');
    const result = await loginWithPassword?.(username, password);
    // loginWithPassword returns true on success, or error string on failure
    if (result !== true) {
      setLocalErr(typeof result === 'string' ? result : '用户名或密码错误 · Username or password incorrect');
    }
    setBusy(false);
  }

  // ── Paused ────────────────────────────────────────────────────────
  if (status === 'paused') return (
    <div style={{ minHeight:'100dvh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', background:V.bg, padding:'2rem', gap:'1.5rem' }}>
      <div style={{ fontSize:52 }}>📵</div>
      <div style={{ background:V.card, borderRadius:16, padding:'1.8rem 2rem',
        border:`1px solid ${V.border}`, maxWidth:320, width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:18, fontWeight:500, color:'#8B1A1A', lineHeight:1.6,
          fontFamily:"'STKaiti','KaiTi',Georgia,serif", marginBottom:12 }}>
          此设备已暂停使用<br/>请重新登录
        </div>
        <div style={{ fontSize:13, color:V.text2, lineHeight:1.6 }}>
          Your account is active on another device.<br/>Log in again to switch to this device.
        </div>
        <button onClick={() => window.location.reload()}
          style={{ marginTop:16, padding:'10px 24px', borderRadius:10, border:'none',
            background:V.verm, color:'#fdf6e3', fontSize:13, cursor:'pointer' }}>
          重新登录 · Login again
        </button>
      </div>
    </div>
  );

  // ── Expired ───────────────────────────────────────────────────────
  if (status === 'expired') return (
    <div style={{ minHeight:'100dvh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', background:V.bg, padding:'2rem', gap:'1.5rem' }}>
      <div style={{ fontSize:52 }}>⏰</div>
      <div style={{ background:V.card, borderRadius:16, padding:'1.8rem 2rem',
        border:`1px solid ${V.border}`, maxWidth:320, width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:18, fontWeight:500, color:'#8B1A1A',
          fontFamily:"'STKaiti','KaiTi',Georgia,serif", marginBottom:10 }}>
          账号已过期<br/>请联系老师续期
        </div>
        <div style={{ fontSize:13, color:V.text2, lineHeight:1.6 }}>
          Your access has expired.<br/>Please contact your teacher.
        </div>
      </div>
    </div>
  );

  // ── Login form (guest / default) ──────────────────────────────────
  return (
    <div style={{ minHeight:'100dvh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      background:V.bg, padding:'2rem', gap:'1.5rem' }}>

      {/* Panda + title */}
      <div style={{ textAlign:'center' }}>
        {pandaUrl
          ? <img src={pandaUrl} alt="panda"
              style={{ width:96, height:96, objectFit:'contain', marginBottom:8,
                filter:'drop-shadow(0 4px 12px rgba(139,69,19,0.15))' }}/>
          : <div style={{ fontSize:64, marginBottom:8 }}>🐼</div>}
        <div style={{ fontSize:24, fontWeight:500, color:V.text,
          fontFamily:"'STKaiti','KaiTi',Georgia,serif", letterSpacing:2 }}>
          大卫学中文
        </div>
        <div style={{ fontSize:12, color:V.text3, marginTop:4 }}>
          David Learns Chinese · David Studia Cinese
        </div>
      </div>

      {/* Login card */}
      <div style={{ background:V.card, borderRadius:20, padding:'1.8rem 2rem',
        border:`2px solid ${V.border}`, maxWidth:320, width:'100%',
        boxShadow:'0 4px 24px rgba(139,69,19,0.1)' }}>

        <div style={{ fontSize:15, fontWeight:600, color:V.text, marginBottom:18, textAlign:'center' }}>
          登录 · Login
        </div>

        {/* Username */}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:4 }}>
            用户名 Username
          </label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key==='Enter' && handleLogin()}
            placeholder="e.g. marco.rossi"
            autoComplete="username"
            disabled={busy}
            style={{ width:'100%', padding:'10px 12px', fontSize:14, borderRadius:10,
              border:`1.5px solid ${V.border}`, background:V.card, color:V.text,
              boxSizing:'border-box', outline:'none', fontFamily:'monospace' }}/>
        </div>

        {/* Password */}
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:4 }}>
            密码 Password
          </label>
          <div style={{ position:'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key==='Enter' && handleLogin()}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={busy}
              style={{ width:'100%', padding:'10px 36px 10px 12px', fontSize:14, borderRadius:10,
                border:`1.5px solid ${V.border}`, background:V.card, color:V.text,
                boxSizing:'border-box', outline:'none', fontFamily:'monospace' }}/>
            <button type="button" onClick={() => setShowPw(p => !p)}
              style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
                border:'none', background:'none', cursor:'pointer', fontSize:16, color:V.text3 }}>
              {showPw ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        {/* Error */}
        {(localErr || error) && (
          <div style={{ padding:'8px 12px', borderRadius:10, marginBottom:12,
            background:'#FFEBEE', color:'#c0392b', fontSize:12, lineHeight:1.5 }}>
            {localErr || error}
          </div>
        )}

        {/* Submit */}
        <button onClick={handleLogin} disabled={busy}
          style={{ width:'100%', padding:'12px', fontSize:14, fontWeight:600,
            cursor: busy ? 'default' : 'pointer', borderRadius:12, border:'none',
            background: busy ? '#E0E0E0' : V.verm,
            color: busy ? '#999' : '#fdf6e3',
            transition:'all 0.15s' }}>
          {busy ? '登录中… · Logging in…' : '登录 · Login'}
        </button>
      </div>

      <div style={{ fontSize:11, color:V.text3, textAlign:'center', maxWidth:280, lineHeight:1.6 }}>
        用老师给的用户名和密码登录<br/>
        Use the username and password provided by your teacher
      </div>
    </div>
  );
}

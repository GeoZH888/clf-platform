// src/pages/ChangePasswordPage.jsx
// 修改密码 — 首次登录强制修改 + 普通修改

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function ChangePasswordPage() {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isFirst = params.get('first') === '1';
  const lbl = (zh, en) => language === 'zh' ? zh : en;

  const [oldPw,  setOldPw]  = useState('');
  const [newPw,  setNewPw]  = useState('');
  const [confPw, setConfPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [done,   setDone]   = useState(false);

  const strength = newPw.length >= 8 ? (
    /[A-Z]/.test(newPw) && /[0-9]/.test(newPw) ? 'strong' :
    newPw.length >= 6 ? 'medium' : 'weak'
  ) : newPw.length > 0 ? 'weak' : '';

  const strengthColor = { strong:'#16a34a', medium:'#d97706', weak:'#dc2626' };
  const strengthLabel = { strong: lbl('强','Strong'), medium: lbl('中','Medium'), weak: lbl('弱','Weak') };

  async function save(e) {
    e.preventDefault();
    setError('');
    if (newPw.length < 6) { setError(lbl('密码至少6位','Password must be at least 6 characters')); return; }
    if (newPw !== confPw) { setError(lbl('两次密码不一致','Passwords do not match')); return; }

    setSaving(true);
    try {
      if (!supabase) throw new Error('No database connection');

      // For real Supabase auth, use updateUser
      // For custom auth, update the users table
      await supabase.from('dwxz_users_view').update({
        password:          newPw,  // In production: hash this server-side
        password_changed:  true,
        temp_password:     null,
        updated_at:        new Date().toISOString(),
      }).eq('id', user?.id);

      // Update localStorage user object
      const saved = JSON.parse(localStorage.getItem('user') || '{}');
      saved.password_changed = true;
      saved.temp_password = null;
      localStorage.setItem('user', JSON.stringify(saved));

      // Clear saved password from remember-me
      localStorage.removeItem('dwxz_saved_pw');

      setDone(true);
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch(e) { setError(e.message); }
    setSaving(false);
  }

  const S = {
    inp: { width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)',
      fontSize:14, background:'var(--background)', boxSizing:'border-box', marginTop:6 },
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'linear-gradient(135deg,#c41e3a,#8B1A1A)', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'2rem', width:400, maxWidth:'95vw' }}>
        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
          <div style={{ fontSize:48, marginBottom:8 }}>🔐</div>
          <h2 style={{ margin:'0 0 6px', color:'#1f2937', fontSize:22 }}>
            {isFirst ? lbl('欢迎！请设置您的密码','Welcome! Set Your Password') : lbl('修改密码','Change Password')}
          </h2>
          {isFirst && (
            <p style={{ margin:0, fontSize:13, color:'#6b7280' }}>
              {lbl('首次登录需要设置新密码，临时密码将失效','First login requires setting a new password')}
            </p>
          )}
        </div>

        {done ? (
          <div style={{ textAlign:'center', padding:'1.5rem' }}>
            <div style={{ fontSize:56, marginBottom:12 }}>✅</div>
            <h3 style={{ color:'#16a34a' }}>{lbl('密码设置成功！','Password set successfully!')}</h3>
            <p style={{ color:'#6b7280', fontSize:13 }}>{lbl('正在跳转...','Redirecting...')}</p>
          </div>
        ) : (
          <form onSubmit={save}>
            {error && (
              <div style={{ padding:'10px 14px', borderRadius:8, background:'#fee2e2',
                color:'#991b1b', fontSize:13, marginBottom:'1rem' }}>❌ {error}</div>
            )}

            {/* Show user info */}
            <div style={{ padding:'10px 14px', borderRadius:8, background:'#f9fafb',
              fontSize:13, color:'#374151', marginBottom:'1rem' }}>
              👤 {lbl('账号','Account')}: <strong>{user?.name || user?.username}</strong>
              {isFirst && (
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:3 }}>
                  {lbl('登录名已锁定，不可更改','Login name is fixed and cannot be changed')}
                </div>
              )}
            </div>

            {!isFirst && (
              <>
                <label style={{ fontSize:12, color:'#6b7280', display:'block' }}>{lbl('当前密码 *','Current Password *')}</label>
                <input type="password" style={S.inp} value={oldPw} onChange={e=>setOldPw(e.target.value)}
                  placeholder={lbl('输入当前密码','Enter current password')} required/>
              </>
            )}

            <label style={{ fontSize:12, color:'#6b7280', display:'block', marginTop:14 }}>
              {lbl('新密码 *','New Password *')}
            </label>
            <input type="password" style={S.inp} value={newPw} onChange={e=>setNewPw(e.target.value)}
              placeholder={lbl('至少6位，建议包含数字和大写字母','At least 6 chars, include numbers & uppercase')} required/>
            {strength && (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:5 }}>
                <div style={{ height:4, flex:1, borderRadius:2, background:'#e5e7eb', overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:2, transition:'width .3s',
                    width:strength==='strong'?'100%':strength==='medium'?'60%':'30%',
                    background:strengthColor[strength] }}/>
                </div>
                <span style={{ fontSize:11, color:strengthColor[strength], fontWeight:600 }}>
                  {strengthLabel[strength]}
                </span>
              </div>
            )}

            <label style={{ fontSize:12, color:'#6b7280', display:'block', marginTop:14 }}>
              {lbl('确认新密码 *','Confirm New Password *')}
            </label>
            <input type="password" style={S.inp} value={confPw} onChange={e=>setConfPw(e.target.value)}
              placeholder={lbl('再次输入新密码','Enter new password again')} required/>
            {confPw && newPw !== confPw && (
              <div style={{ fontSize:11, color:'#dc2626', marginTop:4 }}>
                {lbl('两次密码不一致','Passwords do not match')}
              </div>
            )}

            <button type="submit" disabled={saving||!newPw||!confPw||(newPw!==confPw)}
              style={{ width:'100%', marginTop:20, padding:'13px', borderRadius:10, border:'none',
                cursor:saving?'not-allowed':'pointer', fontSize:14, fontWeight:700,
                background: saving||!newPw||!confPw||newPw!==confPw ? '#9ca3af' : '#c41e3a',
                color:'#fff', transition:'background .2s' }}>
              {saving ? lbl('保存中...','Saving...') : `🔐 ${lbl('确认修改密码','Confirm Change Password')}`}
            </button>

            {!isFirst && (
              <button type="button" onClick={()=>navigate(-1)}
                style={{ width:'100%', marginTop:8, padding:'10px', borderRadius:10,
                  border:'1px solid #e5e7eb', background:'none', cursor:'pointer', fontSize:13, color:'#6b7280' }}>
                {lbl('取消','Cancel')}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

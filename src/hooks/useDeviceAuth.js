// src/hooks/useDeviceAuth.js
// Device authentication via username + password
// Calls server-side Netlify function to bypass Supabase RLS

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const TOKEN_KEY       = 'jgw_device_token';
const FINGERPRINT_KEY = 'jgw_device_fp';

function getFingerprint() {
  let fp = localStorage.getItem(FINGERPRINT_KEY);
  if (!fp) {
    fp = (crypto.randomUUID?.()) || Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem(FINGERPRINT_KEY, fp);
  }
  return fp;
}

function daysUntil(d) {
  return d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;
}

export function useDeviceAuth() {
  const [state, setState] = useState({
    status: 'checking',
    label: '', expiresAt: null, daysLeft: null,
    expiring: false, modules: [], error: '',
  });

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setState(s => ({ ...s, status: 'guest' })); return; }
    checkToken(token);
  }, []);

  async function checkToken(token) {
    try {
      const { data } = await supabase
        .from('jgw_device_sessions')
        .select('id, expires_at, is_active, jgw_invites(label, modules)')
        .eq('device_token', token)
        .maybeSingle();

      if (!data) { localStorage.removeItem(TOKEN_KEY); setState(s=>({...s,status:'guest'})); return; }
      if (new Date(data.expires_at) < new Date()) { localStorage.removeItem(TOKEN_KEY); setState(s=>({...s,status:'expired'})); return; }
      if (!data.is_active) { setState(s=>({...s,status:'paused'})); return; }

      supabase.from('jgw_device_sessions').update({last_seen:new Date().toISOString()}).eq('id',data.id).then(()=>{});
      const days = daysUntil(data.expires_at);
      setState({status:'authed',label:data.jgw_invites?.label||'',
        modules:data.jgw_invites?.modules||['lianzi','pinyin','words'],
        expiresAt:data.expires_at,daysLeft:days,expiring:days!==null&&days<=7,error:''});
    } catch { setState(s=>({...s,status:'guest'})); }
  }

  async function loginWithPassword(username, password) {
    setState(s => ({ ...s, status: 'checking', error: '' }));
    try {
      const res = await fetch('/.netlify/functions/student-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username:    username.trim().toLowerCase(),
          password:    password.trim(),
          fingerprint: getFingerprint(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = data.error || '登录失败 · Login failed';
        setState(s => ({ ...s, status: 'guest', error: err }));
        return err;
      }
      localStorage.setItem(TOKEN_KEY, data.device_token);
      const days = daysUntil(data.expires_at);
      setState({ status:'authed', label:data.label||'',
        modules:data.modules||['lianzi','pinyin','words'],
        expiresAt:data.expires_at, daysLeft:days,
        expiring:days!==null&&days<=7, error:'' });
      return true;
    } catch(e) {
      const err = '连接错误: ' + e.message;
      setState(s => ({ ...s, status: 'guest', error: err }));
      return err;
    }
  }

  async function redeemToken(token) {
    try {
      const { data: inv } = await supabase.from('jgw_invites').select('*').eq('token', token).maybeSingle();
      if (!inv) { setState(s=>({...s,status:'guest',error:'Invalid QR code.'})); return; }
      if (new Date(inv.expires_at) < new Date()) { setState(s=>({...s,status:'expired'})); return; }
      await createOrReuseSession(inv);
    } catch(e) { setState(s=>({...s,status:'guest',error:'Error: '+e.message})); }
  }

  async function createOrReuseSession(inv) {
    const fp = getFingerprint();
    const { data: existing } = await supabase.from('jgw_device_sessions')
      .select('*').eq('invite_id',inv.id).eq('device_fingerprint',fp).maybeSingle();
    if (existing) {
      await supabase.from('jgw_device_sessions').update({is_active:true,last_seen:new Date().toISOString()}).eq('id',existing.id);
      localStorage.setItem(TOKEN_KEY, existing.device_token);
    } else {
      const { data: active } = await supabase.from('jgw_device_sessions').select('id,last_seen').eq('invite_id',inv.id).eq('is_active',true);
      if ((active?.length||0) >= (inv.max_devices||1)) {
        const oldest = active.sort((a,b)=>new Date(a.last_seen||0)-new Date(b.last_seen||0))[0];
        if (oldest) await supabase.from('jgw_device_sessions').update({is_active:false}).eq('id',oldest.id);
      }
      const { data: sess } = await supabase.from('jgw_device_sessions')
        .insert({invite_id:inv.id,expires_at:inv.expires_at,device_fingerprint:fp,is_active:true})
        .select().maybeSingle();
      if (sess) localStorage.setItem(TOKEN_KEY, sess.device_token);
    }
    if (!inv.used_at) await supabase.from('jgw_invites').update({used_at:new Date().toISOString()}).eq('id',inv.id);
    const days = daysUntil(inv.expires_at);
    setState({status:'authed',label:inv.label||'',modules:inv.modules||['lianzi','pinyin','words'],
      expiresAt:inv.expires_at,daysLeft:days,expiring:days!==null&&days<=7,error:''});
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setState({status:'guest',label:'',expiresAt:null,daysLeft:null,expiring:false,modules:[],error:''});
  }

  return { ...state, loginWithPassword, redeemToken, logout };
}

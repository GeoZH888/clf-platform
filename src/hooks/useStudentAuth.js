// src/hooks/useStudentAuth.js
// Student authentication via Supabase Auth.
// Replaces the old useDeviceAuth (which used device_token + jgw_invites).
//
// Sessions are managed by @supabase/supabase-js — JWT in localStorage,
// auto-refresh handled by the SDK. No custom token, no device_sessions.

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function daysUntil(d) {
  return d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;
}

// Module fallback (in case the server didn't return modules)
const ALWAYS_ON = ['home', 'profile', 'progress'];
const STANDARD_BUNDLE = ['lianzi','words','pinyin','chengyu','poetry','grammar','hsk','riddles'];

export function useStudentAuth() {
  const [state, setState] = useState({
    status:    'checking',
    label:     '',
    role:      null,
    expiresAt: null,
    daysLeft:  null,
    expiring:  false,
    modules:   [],
    error:     '',
    userId:    null,
    username:  null,
  });

  // ── On mount: check existing Supabase session ──
  useEffect(() => {
    let unsub = null;

    (async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        setState(s => ({ ...s, status: 'guest' }));
        return;
      }
      await loadProfile(session);
    })();

    // Listen to auth state changes (signOut from another tab, etc.)
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setState({
          status: 'guest', label: '', role: null,
          expiresAt: null, daysLeft: null, expiring: false,
          modules: [], error: '', userId: null, username: null,
        });
      }
      // SIGNED_IN handled by loginWithPassword directly (we get richer data there)
    });
    unsub = data.subscription;

    return () => unsub?.unsubscribe();
  }, []);

  async function loadProfile(session) {
    try {
      const userId = session.user.id;
      const { data: profile, error } = await supabase
        .from('clf_user_profiles')
        .select('display_name, display_name_zh, role, is_active')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !profile) {
        // No profile = stale auth user. Sign out.
        await supabase.auth.signOut();
        setState(s => ({ ...s, status: 'guest', error: 'No profile' }));
        return;
      }
      if (profile.is_active === false) {
        setState(s => ({ ...s, status: 'paused' }));
        return;
      }

      // Resolve modules
      const modules = await resolveModules(userId);

      const expiresAt = session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null;
      const days = daysUntil(expiresAt);

      setState({
        status:   'authed',
        label:    profile.display_name_zh || profile.display_name || session.user.email || '',
        role:     profile.role || null,
        expiresAt,
        daysLeft: days,
        expiring: days !== null && days <= 7,
        modules,
        error:    '',
        userId,
        username: session.user.email?.split('@')[0] || null,
      });
    } catch (e) {
      setState(s => ({ ...s, status: 'guest', error: e.message }));
    }
  }

  async function loginWithPassword(username, password) {
    setState(s => ({ ...s, status: 'checking', error: '' }));
    try {
      const res = await fetch('/.netlify/functions/student-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          password: password.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = data.error || '登录失败 · Login failed';
        setState(s => ({ ...s, status: 'guest', error: err }));
        return err;
      }

      // Hand the tokens to the Supabase SDK so it manages the session.
      const { error: setErr } = await supabase.auth.setSession({
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
      });
      if (setErr) {
        setState(s => ({ ...s, status: 'guest', error: setErr.message }));
        return setErr.message;
      }

      const expiresAt = data.expires_at ? new Date(data.expires_at * 1000).toISOString() : null;
      const days = daysUntil(expiresAt);
      setState({
        status: 'authed',
        label: data.display_name || username,
        role: data.role || null,
        expiresAt,
        daysLeft: days,
        expiring: days !== null && days <= 7,
        modules: data.modules || [...ALWAYS_ON, ...STANDARD_BUNDLE],
        error: '',
        userId: data.user_id,
        username: data.username,
      });
      return true;
    } catch (e) {
      const err = '连接错误: ' + e.message;
      setState(s => ({ ...s, status: 'guest', error: err }));
      return err;
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setState({
      status: 'guest', label: '', role: null,
      expiresAt: null, daysLeft: null, expiring: false,
      modules: [], error: '', userId: null, username: null,
    });
  }

  return { ...state, loginWithPassword, logout };
}

// ─────────────────────────────────────────────────────────────────
// Module resolution (client-side; mirrors server logic).
// ─────────────────────────────────────────────────────────────────
const MODULE_DEFAULTS = {
  lianzi:true, words:true, pinyin:true, chengyu:true, poetry:true,
  grammar:true, hsk:true, riddles:true,
  kechuang:false, lessons:false, chat:false, voice:false,
  homework:false, shop:false, parents:false,
};

async function resolveModules(userId) {
  const standard = Object.entries(MODULE_DEFAULTS)
    .filter(([_, v]) => v).map(([k]) => k);
  if (!userId) return [...ALWAYS_ON, ...standard];

  try {
    const { data, error } = await supabase
      .from('clf_user_modules')
      .select('module_id, available, selected')
      .eq('user_id', userId);
    if (error) return [...ALWAYS_ON, ...standard];

    const overrides = {};
    (data || []).forEach(r => {
      overrides[r.module_id] = r.available === true && r.selected === true;
    });

    const enabled = [...ALWAYS_ON];
    for (const [id, def] of Object.entries(MODULE_DEFAULTS)) {
      const final = id in overrides ? overrides[id] : def;
      if (final) enabled.push(id);
    }
    return enabled;
  } catch {
    return [...ALWAYS_ON, ...standard];
  }
}

// ─────────────────────────────────────────────────────────────────
// Backwards-compat alias — old code imports `useDeviceAuth`.
// Exporting both names lets us migrate call sites incrementally.
// ─────────────────────────────────────────────────────────────────
export const useDeviceAuth = useStudentAuth;

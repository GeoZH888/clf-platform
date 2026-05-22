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
      console.log('[useStudentAuth] mount: checking session…');
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('[useStudentAuth] supabase session:', { has: !!session, error });
      if (session && !error) {
        console.log('[useStudentAuth] using supabase session');
        await loadProfile(session);
        return;
      }

      // Bridge: the community login (school/contexts/AuthContext) stores user
      // info under custom 'user'/'token' keys after a successful Supabase
      // signin. If those exist but supabase.auth has no session (separate
      // client instance, storage quirk), trust the saved profile so the user
      // doesn't have to log in twice.
      try {
        const savedUser    = localStorage.getItem('user');
        const savedToken   = localStorage.getItem('token');
        const savedRefresh = localStorage.getItem('refresh_token');
        console.log('[useStudentAuth] bridge check:', {
          hasUser: !!savedUser, hasToken: !!savedToken, hasRefresh: !!savedRefresh,
        });
        if (savedUser && savedToken) {
          const u = JSON.parse(savedUser);
          console.log('[useStudentAuth] parsed user:', {
            id: u?.id, role: u?.role, hasName: !!(u?.display_name || u?.name),
          });
          if (u?.id) {
            // CRITICAL: hand the tokens to THIS supabase client so RLS-protected
            // queries (e.g. clf_chengyu) see auth.uid() and pass. Without this,
            // the bridge gives UI-auth but no data-auth — every protected
            // SELECT silently returns []. Requires refresh_token to be saved.
            if (savedRefresh) {
              const { error: setErr } = await supabase.auth.setSession({
                access_token:  savedToken,
                refresh_token: savedRefresh,
              });
              if (setErr) {
                console.warn('[useStudentAuth] setSession failed:', setErr.message);
              } else {
                console.log('[useStudentAuth] supabase session hydrated from bridge');
              }
            } else {
              console.warn('[useStudentAuth] no refresh_token in localStorage — ' +
                'RLS queries may return empty. Log out + back in to populate it.');
            }
            await loadProfileFromBridge(u, savedToken);
            return;
          } else {
            console.warn('[useStudentAuth] bridge: u.id missing, falling to guest');
          }
        } else {
          console.warn('[useStudentAuth] bridge: no saved user/token, falling to guest');
        }
      } catch (e) {
        console.error('[useStudentAuth] bridge parse error:', e);
      }

      console.log('[useStudentAuth] → status: guest');
      setState(s => ({ ...s, status: 'guest' }));
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

  // Bridge helper: adapt the community-AuthContext user shape into our state.
  async function loadProfileFromBridge(u, _token) {
    try {
      console.log('[useStudentAuth] loadProfileFromBridge: start', u.id);
      const userId      = u.id;
      const role        = u.role || null;
      const displayName = u.display_name_zh || u.display_name || u.name
                        || u.email || u.username || '';

      const modules = ['super_admin', 'school_master'].includes(role)
        ? buildFullModuleList()
        : await resolveModules(userId);
      console.log('[useStudentAuth] loadProfileFromBridge: modules resolved', modules.length);

      setState({
        status:   'authed',
        label:    displayName,
        role,
        expiresAt: null,   // not tracked via the bridge
        daysLeft:  null,
        expiring:  false,
        modules,
        error:    '',
        userId,
        username: u.username || u.email?.split('@')[0] || null,
      });
      console.log('[useStudentAuth] → status: authed via bridge');
    } catch (e) {
      console.error('[useStudentAuth] bridge fatal error:', e);
      setState(s => ({ ...s, status: 'guest', error: e.message }));
    }
  }

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

      // Resolve modules — admin roles see everything (bypass gating)
      const modules = ['super_admin', 'school_master'].includes(profile.role)
        ? buildFullModuleList()
        : await resolveModules(userId);

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
        modules: ['super_admin', 'school_master'].includes(data.role)
          ? buildFullModuleList()
          : (data.modules || [...ALWAYS_ON, ...STANDARD_BUNDLE]),
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
  grammar:true, hsk:true, riddles:true, scenario:true, story:true,
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

// Build full module list for admins — every gateable module + practice modules.
// New modules added later (defaultEnabled: false) won't appear automatically;
// add them to EXTRA_FOR_ADMIN if you want admins to see them.
const EXTRA_FOR_ADMIN = ['scenario', 'story', 'feiyi'];

function buildFullModuleList() {
  return [
    ...ALWAYS_ON,
    ...Object.keys(MODULE_DEFAULTS),
    ...EXTRA_FOR_ADMIN,
  ];
}



// ─────────────────────────────────────────────────────────────────
// Backwards-compat alias — old code imports `useDeviceAuth`.
// Exporting both names lets us migrate call sites incrementally.
// ─────────────────────────────────────────────────────────────────
export const useDeviceAuth = useStudentAuth;

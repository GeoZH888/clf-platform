// src/kechuang/contexts/AuthContext.jsx
// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED AUTH CONTEXT (drop-in replacement)
// ───────────────────────────────────────────────────────────────────────────
// Backed by Supabase Auth + clf_user_profiles. Keeps the SAME public API
// as the old kechuang AuthContext so consumer components continue working
// without modification:
//
//   const {
//     user, token, loading, error,
//     login, register, logout, updateProfile,
//     supabase,
//     isAuthenticated,
//     isTeacher, isStudent, isParent,
//     isAdmin, isSuperAdmin, isSchoolMaster, isContentEditor,
//   } = useAuth();
//
// Differences from the old context (intentional):
//   • Hardcoded keys are GONE — uses src/lib/supabase.js (env-var based).
//   • Plaintext password comparison is GONE — Supabase Auth handles bcrypt.
//   • Custom btoa() tokens are GONE — Supabase issues real signed JWTs.
//   • localStorage hand-management is GONE — Supabase manages session.
//   • login(email, password) — kechuang form already collects email; we
//     use it directly. (Old code accepted "username" but actually queried
//     by username string against dwxz_users_view; same field, new backing.)
// ═══════════════════════════════════════════════════════════════════════════

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [authUser,  setAuthUser] = useState(null);   // raw auth.users row
  const [profile,   setProfile]  = useState(null);   // clf_user_profiles row
  const [token,     setToken]    = useState(null);   // access_token (JWT)
  const [loading,   setLoading]  = useState(true);
  const [error,     setError]    = useState(null);

  // ─────────────────────────────────────────────────────────
  // Profile fetcher
  // ─────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async (userId) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('clf_user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.warn('[AuthContext] profile fetch failed:', error.message);
      return null;
    }
    return data;
  }, []);

  // ─────────────────────────────────────────────────────────
  // Boot: pick up existing session, subscribe to changes
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;

      if (session?.user) {
        setAuthUser(session.user);
        setToken(session.access_token);
        const prof = await fetchProfile(session.user.id);
        if (active) setProfile(prof);
      }
      setLoading(false);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!active) return;
        setAuthUser(session?.user ?? null);
        setToken(session?.access_token ?? null);
        if (session?.user) {
          const prof = await fetchProfile(session.user.id);
          if (active) setProfile(prof);
        } else {
          setProfile(null);
        }
      }
    );

    return () => { active = false; subscription?.unsubscribe(); };
  }, [fetchProfile]);

  // ─────────────────────────────────────────────────────────
  // login(emailOrUsername, password)
  // ─────────────────────────────────────────────────────────
  // Kechuang's old form passed `username`. The new system uses email.
  // To stay backward-compatible, we treat the input as email if it
  // contains '@', otherwise we synthesize the local-domain form
  // (matches the migration we did for jgw_invites students).
  const login = async (emailOrUsername, password) => {
    setError(null);
    const email = emailOrUsername.includes('@')
      ? emailOrUsername.trim().toLowerCase()
      : `${emailOrUsername.trim().toLowerCase()}@local.david-zhongwen.net`;

    const { data, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authErr) {
      setError(authErr.message);
      return { success: false, message: authErr.message };
    }

    setAuthUser(data.user);
    setToken(data.session?.access_token ?? null);

    const prof = await fetchProfile(data.user.id);
    setProfile(prof);

    if (!prof) {
      // Auth succeeded but no CLF profile — caller should redirect them.
      const msg = 'Account exists but has no CLF profile. Contact an administrator.';
      setError(msg);
      return { success: false, message: msg };
    }

    if (prof.is_active === false) {
      await supabase.auth.signOut();
      const msg = 'Your account has been deactivated.';
      setError(msg);
      return { success: false, message: msg };
    }

    return { success: true };
  };

  // ─────────────────────────────────────────────────────────
  // register(userData)
  // ─────────────────────────────────────────────────────────
  // userData: { email, password, name, name_zh?, role?, hsk_level?, ... }
  // We treat email as the canonical identifier (per chosen mapping).
  const register = async (userData) => {
    setError(null);

    if (!userData?.email || !userData?.password) {
      const msg = 'Email and password are required';
      setError(msg);
      return { success: false, message: msg };
    }

    const email = userData.email.trim().toLowerCase();

    // The on_auth_user_created trigger in clf_user_profiles auto-creates
    // a profile from raw_user_meta_data. We pass display_name + role hints.
    const { data, error: signUpErr } = await supabase.auth.signUp({
      email,
      password: userData.password,
      options: {
        data: {
          display_name:    userData.name    || email.split('@')[0],
          display_name_zh: userData.name_zh || null,
          role:            userData.role    || 'student',
        },
      },
    });

    if (signUpErr) {
      setError(signUpErr.message);
      return { success: false, message: signUpErr.message };
    }

    // Some Supabase configurations require email confirmation before session.
    // If session is null we still treat sign-up as success but tell the caller.
    if (!data.session) {
      return {
        success: true,
        message: 'Check your email to confirm your account.',
        requiresConfirmation: true,
      };
    }

    setAuthUser(data.user);
    setToken(data.session.access_token);
    const prof = await fetchProfile(data.user.id);
    setProfile(prof);

    return { success: true };
  };

  // ─────────────────────────────────────────────────────────
  // logout()
  // ─────────────────────────────────────────────────────────
  const logout = async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
    setProfile(null);
    setToken(null);
  };

  // ─────────────────────────────────────────────────────────
  // updateProfile(profileData)
  // Updates clf_user_profiles for the current user.
  // ─────────────────────────────────────────────────────────
  const updateProfile = async (profileData) => {
    if (!authUser) return { success: false, message: 'Not authenticated' };

    // Only allow updating safe fields here; role/is_active flips via admin panel.
    const allowed = ['display_name', 'display_name_zh'];
    const patch = {};
    for (const k of allowed) if (k in profileData) patch[k] = profileData[k];

    if (Object.keys(patch).length === 0) return { success: true };

    const { data, error: updateErr } = await supabase
      .from('clf_user_profiles')
      .update(patch)
      .eq('user_id', authUser.id)
      .select()
      .single();

    if (updateErr) {
      return { success: false, message: updateErr.message };
    }
    setProfile(data);
    return { success: true };
  };

  // ─────────────────────────────────────────────────────────
  // Derive a `user` object that mirrors the OLD shape so kechuang
  // components reading user.role / user.username / user.name continue
  // to work without modification.
  // ─────────────────────────────────────────────────────────
  const user = (authUser && profile) ? {
    id:          profile.user_id,
    user_id:     profile.user_id,
    email:       profile.email || authUser.email,
    username:    profile.email || authUser.email,             // legacy alias
    name:        profile.display_name,
    name_zh:     profile.display_name_zh,
    role:        profile.role,
    is_active:   profile.is_active,
    school_id:   profile.school_id,
    created_at:  profile.created_at,
  } : null;

  // ─────────────────────────────────────────────────────────
  // Public context value (preserves OLD API)
  // ─────────────────────────────────────────────────────────
  const value = {
    user,
    token,
    loading,
    error,

    // actions
    login,
    register,
    logout,
    updateProfile,

    // shared client (for direct queries from kechuang components)
    supabase,

    // role flags — match the old context exactly
    isAuthenticated:  !!user,
    isTeacher:        user?.role === 'teacher',
    isStudent:        user?.role === 'student',
    isParent:         user?.role === 'parent',
    isAdmin:          user?.role === 'super_admin'
                       || user?.role === 'school_master',
    isSuperAdmin:     user?.role === 'super_admin',
    isSchoolMaster:   user?.role === 'school_master',
    isContentEditor:  false, // role not present in clf_user_role enum;
                              // add if needed
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

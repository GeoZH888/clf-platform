// =====================================================================
// src/hooks/useUserProfile.js
// =====================================================================
// Single source of truth for: who is logged in, what role do they have,
// is the session still valid. Subscribes to auth state changes so the
// app reacts instantly to login/logout/token-refresh events.
//
// Usage:
//   const { user, profile, loading, error, signOut, refresh } = useUserProfile();
//   if (loading) return <Spinner/>;
//   if (!profile) return <Navigate to="/login"/>;
//   if (profile.role !== 'super_admin') return <AccessDenied/>;
// =====================================================================

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase'; // ← adjust path if your client lives elsewhere

export function useUserProfile() {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from('clf_user_profiles')
      .select('*')
      .eq('user_id', authUser.id)
      .single();

    if (error) {
      // No profile row → user has auth but no CLF access.
      // Common case: user belongs to another platform (jiaguwen, miaohong)
      // and was not given a CLF profile.
      if (error.code === 'PGRST116') {
        setProfile(null);
        setError(null);
      } else {
        setError(error);
      }
    } else {
      setProfile(data);
      setError(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    await fetchProfile(session?.user ?? null);
  }, [fetchProfile]);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      setUser(session?.user ?? null);
      await fetchProfile(session?.user ?? null);
      setLoading(false);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!active) return;
        setUser(session?.user ?? null);
        await fetchProfile(session?.user ?? null);
      }
    );

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  return { user, profile, loading, error, signOut, refresh };
}

// src/hooks/useUserModules.js
//
// Resolves which modules a given user has access to.
//
// Resolution: for each module M,
//   if (user, M) row exists in clf_user_modules → use that enabled value
//   else → fall back to M.defaultEnabled from the JS config
//
// Always-on modules (gateable: false) skip lookup and are always enabled.
//
// Usage:
//   const { isEnabled, enabledModules, loading } = useUserModules(userId);
//   if (isEnabled('riddles')) <RiddleGame />

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { MODULES, MODULE_BY_ID } from '../config/modules';

export function useUserModules(userId) {
  const [flags, setFlags]     = useState({});   // { module_id: enabled } from DB
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!userId) {
      setFlags({});
      setLoading(false);
      return;
    }
    const { data, error: err } = await supabase
      .from('clf_user_modules')
      .select('module_id, enabled')
      .eq('user_id', userId);
    if (err) {
      console.error('[useUserModules]', err);
      setError(err.message);
    } else {
      const map = {};
      (data || []).forEach(row => { map[row.module_id] = row.enabled; });
      setFlags(map);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  const isEnabled = useCallback((moduleId) => {
    const m = MODULE_BY_ID[moduleId];
    if (!m) return false;            // unknown module
    if (!m.gateable) return true;    // always-on
    if (moduleId in flags) return flags[moduleId];
    return m.defaultEnabled;
  }, [flags]);

  // Resolved list of module objects the user can access
  const enabledModules = MODULES.filter(m => isEnabled(m.id));

  return { isEnabled, enabledModules, flags, loading, error, reload };
}

// Lightweight wrapper for hiding UI when a module is disabled.
// Usage: <ModuleGate moduleId="riddles" userId={user?.id}><RiddleGame/></ModuleGate>
export function ModuleGate({ moduleId, userId, fallback = null, children }) {
  const { isEnabled, loading } = useUserModules(userId);
  if (loading) return null;
  return isEnabled(moduleId) ? children : fallback;
}

// src/hooks/usePoints.js
// Cross-module points system — earn, fetch, and display points
// Works with jgw_points table in Supabase

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

// ── Point rules (mirrors DB seed, used as fallback) ──────────────────────────
const DEFAULT_RULES = {
  chengyu_flash:       1,   chengyu_quiz_right:   5,
  chengyu_fill_right:  10,  chengyu_match_all:    20,
  chengyu_chain:       15,  chengyu_story:        5,
  chengyu_theme_done:  50,
  pinyin_listen_right: 5,   pinyin_type_right:    8,   pinyin_table_tap: 1,
  lianzi_practiced:    3,   lianzi_quiz_done:     10,  lianzi_perfect:   20,
  words_flash:         1,   words_listen_right:   5,   words_fill_right: 8,
  daily_login:         10,  streak_7:             50,  streak_30:        200,
};

// ── Token helper ──────────────────────────────────────────────────────────────
function getToken() {
  let t = localStorage.getItem('jgw_device_token');
  if (!t) {
    t = crypto.randomUUID();
    localStorage.setItem('jgw_device_token', t);
  }
  return t;
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function usePoints() {
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [rules,   setRules]   = useState(DEFAULT_RULES);
  const token = getToken();

  // Load rules from DB
  useEffect(() => {
    supabase.from('jgw_point_rules').select('action, points').eq('active', true)
      .then(({ data }) => {
        if (data?.length) {
          const map = {};
          data.forEach(r => { map[r.action] = r.points; });
          setRules(prev => ({ ...prev, ...map }));
        }
      }).catch(() => {});
  }, []);

  // Load total points for this device
  useEffect(() => {
    supabase.from('jgw_points')
      .select('points')
      .eq('device_token', token)
      .then(({ data }) => {
        if (data) setTotal(data.reduce((s, r) => s + (r.points || 0), 0));
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [token]);

  // Earn points
  const earn = useCallback(async (action, module, meta = {}) => {
    const pts = rules[action] ?? DEFAULT_RULES[action] ?? 0;
    if (pts <= 0) return 0;

    setTotal(prev => prev + pts);  // optimistic update

    try {
      await supabase.from('jgw_points').insert({
        device_token: token,
        module,
        action,
        points: pts,
        meta,
      });
    } catch {}

    return pts;
  }, [token, rules]);

  // Per-module breakdown
  const getModulePoints = useCallback(async (module) => {
    const { data } = await supabase.from('jgw_points')
      .select('points')
      .eq('device_token', token)
      .eq('module', module);
    return data?.reduce((s, r) => s + r.points, 0) ?? 0;
  }, [token]);

  // Recent history
  const getHistory = useCallback(async (limit = 20) => {
    const { data } = await supabase.from('jgw_points')
      .select('*')
      .eq('device_token', token)
      .order('earned_at', { ascending: false })
      .limit(limit);
    return data ?? [];
  }, [token]);

  // Leaderboard (top 10)
  const getLeaderboard = useCallback(async () => {
    const { data } = await supabase.from('jgw_points_summary')
      .select('device_token, total_points, last_active')
      .limit(10);
    return data ?? [];
  }, []);

  return { total, loading, earn, getModulePoints, getHistory, getLeaderboard, rules };
}

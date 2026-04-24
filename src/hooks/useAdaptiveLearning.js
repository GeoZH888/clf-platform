// src/hooks/useAdaptiveLearning.js
// Self-adaptive learning: reads user's history to recommend next content.
// Used by all modules to show personalised "what to learn next".
//
// Auth: dual-path. Prefers Supabase JWT user_id (CLF new users); falls back
// to localStorage 'jgw_device_token' for legacy users.

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const TOKEN_KEY = 'jgw_device_token';

// ── Spaced repetition intervals (in hours) ──────────────────────────────────
// Based on simplified SM-2: 0 → 4h → 1d → 3d → 7d → 14d → 30d
const INTERVALS = [4, 24, 72, 168, 336, 720];

function getDeviceToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// Resolve current user identity for progress queries / writes.
// Returns { mode: 'user_id', user_id } or { mode: 'device_token', device_token }
// or null if neither is available.
async function resolveIdentity() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      return { mode: 'user_id', user_id: session.user.id };
    }
  } catch (_) { /* ignore, fall through */ }
  const dt = getDeviceToken();
  if (dt) return { mode: 'device_token', device_token: dt };
  return null;
}

function hoursAgo(dateStr) {
  return (Date.now() - new Date(dateStr)) / 3600000;
}

// ── Mastery score: 0 (not seen) → 1 (mastered) ──────────────────────────────
function masteryScore(practices) {
  if (!practices?.length) return 0;
  const n       = practices.length;
  const correct = practices.filter(p => p.correct !== false).length;
  const acc     = correct / n;
  const recency = Math.max(0, 1 - hoursAgo(practices[practices.length-1].practiced_at) / 720);
  return Math.min(1, (Math.sqrt(n) * acc * 0.7) + (recency * 0.3));
}

// ── Is item due for review? ──────────────────────────────────────────────────
function isDue(practices) {
  if (!practices?.length) return true; // never seen → due
  const n        = Math.min(practices.length - 1, INTERVALS.length - 1);
  const interval = INTERVALS[n];
  const lastSeen = hoursAgo(practices[practices.length-1].practiced_at);
  return lastSeen >= interval;
}

export function useAdaptiveLearning(items = [], options = {}) {
  const {
    idField       = 'id',          // field name for item ID
    diffField     = 'difficulty',  // field for difficulty 1-4
    hskField      = 'hsk_level',   // field for HSK level
    module        = 'chengyu',
    progressTable = 'clf_chengyu_progress',  // Supabase table with progress
    itemIdCol     = 'idiom_id',              // FK column in progress table
  } = options;

  const [progress,    setProgress]    = useState({});  // itemId → [{correct, practiced_at}]
  const [loading,     setLoading]     = useState(true);
  const [userLevel,   setUserLevel]   = useState(1);   // 1-4 estimated level
  const [stats,       setStats]       = useState({ mastered:0, due:0, new:0, total:0 });
  const [identity,    setIdentity]    = useState(null);

  useEffect(() => {
    if (!items.length) { setLoading(false); return; }
    (async () => {
      const id = await resolveIdentity();
      setIdentity(id);
      if (!id) { setLoading(false); return; }
      await loadProgress(id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  async function loadProgress(id = identity) {
    if (!id) return;
    setLoading(true);
    try {
      const ids = items.map(i => i[idField]);
      let q = supabase
        .from(progressTable)
        .select(`${itemIdCol}, correct, practiced_at`)
        .in(itemIdCol, ids)
        .order('practiced_at', { ascending: true });

      // Filter by identity
      q = id.mode === 'user_id'
        ? q.eq('user_id', id.user_id)
        : q.eq('device_token', id.device_token);

      const { data } = await q;

      // Group by item ID
      const map = {};
      (data || []).forEach(r => {
        const k = r[itemIdCol];
        if (!map[k]) map[k] = [];
        map[k].push(r);
      });
      setProgress(map);

      // Estimate user level
      const practiced = items.filter(i => (map[i[idField]]?.length || 0) > 0);
      const goodItems = practiced.filter(i => masteryScore(map[i[idField]]) > 0.6);
      const avgDiff   = goodItems.length
        ? goodItems.reduce((s,i) => s + (i[diffField]||1), 0) / goodItems.length
        : 1;
      setUserLevel(Math.max(1, Math.round(avgDiff)));

      // Stats
      const mastered = items.filter(i => masteryScore(map[i[idField]]) >= 0.8).length;
      const due      = items.filter(i => isDue(map[i[idField]]) && (map[i[idField]]?.length||0) > 0).length;
      const newItems = items.filter(i => !(map[i[idField]]?.length)).length;
      setStats({ mastered, due, new:newItems, total:items.length });

    } catch(e) { console.error('adaptive load:', e); }
    setLoading(false);
  }

  // Insert a practice record (called by sub-modules after each answer)
  async function recordPractice({ itemId, correct, score, mode }) {
    if (!identity || !itemId) return;
    const row = {
      [itemIdCol]: itemId,
      correct: correct ?? null,
      score:   score ?? null,
      mode:    mode ?? null,
      practiced_at: new Date().toISOString(),
    };
    if (identity.mode === 'user_id') row.user_id = identity.user_id;
    else                              row.device_token = identity.device_token;
    try {
      await supabase.from(progressTable).insert(row);
      // Optimistic update
      setProgress(p => {
        const next = { ...p };
        if (!next[itemId]) next[itemId] = [];
        next[itemId] = [...next[itemId], row];
        return next;
      });
    } catch(e) { console.error('adaptive record:', e); }
  }

  // ── Sort items by adaptive priority ─────────────────────────────────────
  // Priority: 1) due for review, 2) new at appropriate level, 3) mastered (refresh)
  function getAdaptiveQueue(limit = 20) {
    const withPriority = items.map(item => {
      const id        = item[idField];
      const practices = progress[id] || [];
      const mastery   = masteryScore(practices);
      const due       = isDue(practices);
      const isNew     = practices.length === 0;
      const diff      = item[diffField] || 1;

      // Level appropriateness (items slightly above current level get boost)
      const levelFit  = diff <= userLevel + 1 ? 1 : 0.3;

      let priority = 0;
      if (due && !isNew) priority = 100 - mastery * 50;     // review due
      else if (isNew && levelFit) priority = 80 - diff * 5; // new, appropriate level
      else if (isNew) priority = 40 - diff * 5;             // new, harder
      else priority = 10;                                    // mastered, low priority

      return { ...item, _mastery:mastery, _due:due, _isNew:isNew, _priority:priority };
    });

    return withPriority
      .sort((a,b) => b._priority - a._priority)
      .slice(0, limit);
  }

  // ── Get items by difficulty stage (for level-up progression) ────────────
  function getByLevel() {
    const grouped = { 1:[], 2:[], 3:[], 4:[] };
    items.forEach(i => {
      const d = i[diffField] || 1;
      grouped[Math.min(4, Math.max(1, d))].push(i);
    });
    return grouped;
  }

  // ── What the user should focus on next (summary string) ─────────────────
  function getNextFocusLabel(lang = 'zh') {
    const { due, new: newCount, mastered, total } = stats;
    if (loading) return '';
    if (due > 0)      return lang==='zh' ? `📚 ${due} 个待复习` : `${due} to review`;
    if (newCount > 0) return lang==='zh' ? `✨ ${newCount} 个新内容` : `${newCount} new`;
    if (mastered === total && total > 0)
      return lang==='zh' ? '🏆 全部掌握！' : '🏆 All mastered!';
    return lang==='zh' ? '继续练习' : 'Keep practicing';
  }

  // ── Mastery for a specific item ──────────────────────────────────────────
  function getItemMastery(itemId) {
    return masteryScore(progress[itemId] || []);
  }

  return {
    loading,
    progress,
    userLevel,
    stats,
    identity,
    getAdaptiveQueue,
    getByLevel,
    getNextFocusLabel,
    getItemMastery,
    isDue: (id) => isDue(progress[id] || []),
    recordPractice,
    reload: () => identity && loadProgress(identity),
  };
}

// src/hooks/useAdaptiveLearning.js
// Self-adaptive learning: reads user's history to recommend next content
// Used by all modules to show personalised "what to learn next"

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const TOKEN_KEY = 'jgw_device_token';

// ── Spaced repetition intervals (in hours) ──────────────────────────────────
// Based on simplified SM-2: 0 → 4h → 1d → 3d → 7d → 14d → 30d
const INTERVALS = [4, 24, 72, 168, 336, 720];

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
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
    idField       = 'id',       // field name for item ID
    diffField     = 'difficulty', // field for difficulty 1-4
    hskField      = 'hsk_level',  // field for HSK level
    module        = 'chengyu',
    progressTable = 'jgw_chengyu_progress', // Supabase table with progress
    itemIdCol     = 'idiom_id',             // FK column in progress table
  } = options;

  const [progress,    setProgress]    = useState({});  // itemId → [{correct, practiced_at}]
  const [loading,     setLoading]     = useState(true);
  const [userLevel,   setUserLevel]   = useState(1);   // 1-4 estimated level
  const [stats,       setStats]       = useState({ mastered:0, due:0, new:0, total:0 });

  const token = getToken();

  useEffect(() => {
    if (!token || !items.length) { setLoading(false); return; }
    loadProgress();
  }, [token, items.length]);

  async function loadProgress() {
    setLoading(true);
    try {
      const ids = items.map(i => i[idField]);
      const { data } = await supabase
        .from(progressTable)
        .select(`${itemIdCol}, correct, practiced_at`)
        .eq('device_token', token)
        .in(itemIdCol, ids)
        .order('practiced_at', { ascending: true });

      // Group by item ID
      const map = {};
      (data || []).forEach(r => {
        const id = r[itemIdCol];
        if (!map[id]) map[id] = [];
        map[id].push(r);
      });
      setProgress(map);

      // Estimate user level from what they've practiced accurately
      const practiced = items.filter(i => (map[i[idField]]?.length || 0) > 0);
      const goodItems = practiced.filter(i => masteryScore(map[i[idField]]) > 0.6);
      const avgDiff   = goodItems.length
        ? goodItems.reduce((s,i) => s + (i[diffField]||1), 0) / goodItems.length
        : 1;
      setUserLevel(Math.max(1, Math.round(avgDiff)));

      // Compute stats
      const mastered = items.filter(i => masteryScore(map[i[idField]]) >= 0.8).length;
      const due      = items.filter(i => isDue(map[i[idField]]) && (map[i[idField]]?.length||0) > 0).length;
      const newItems = items.filter(i => !(map[i[idField]]?.length)).length;
      setStats({ mastered, due, new:newItems, total:items.length });

    } catch(e) { console.error('adaptive load:', e); }
    setLoading(false);
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
      const hsk       = item[hskField]  || 4;

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
    getAdaptiveQueue,
    getByLevel,
    getNextFocusLabel,
    getItemMastery,
    isDue: (id) => isDue(progress[id] || []),
    reload: loadProgress,
  };
}

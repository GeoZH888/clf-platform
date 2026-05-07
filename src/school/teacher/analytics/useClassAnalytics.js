// src/school/teacher/analytics/useClassAnalytics.js
// Fetches AI weekly summary, caches in clf_class_ai_summaries (24-hr TTL).

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../services/supabase';

export function useClassAnalytics(teacherId, opts = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const refresh = useCallback(async (force = false) => {
    if (!teacherId) return;
    setLoading(true); setErr(null);
    try {
      if (!force) {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: cache } = await supabase
          .from('clf_class_ai_summaries')
          .select('summary, created_at, provider')
          .eq('teacher_id', teacherId)
          .eq('task', 'analyze_class')
          .gte('created_at', yesterday)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cache) {
          setData({ text: cache.summary, cached: true,
            generated_at: cache.created_at, provider: cache.provider });
          setLoading(false);
          return;
        }
      }

      const res = await fetch('/.netlify/functions/clf-teacher-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'analyze_class',
          teacher_id: teacherId,
          provider: opts.provider || 'claude',
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`AI gateway ${res.status}: ${txt.slice(0,200)}`);
      }
      const json = await res.json();
      setData({ text: json.summary, cached: false,
        generated_at: new Date().toISOString(), provider: json.provider });
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [teacherId, opts.provider]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, err, refresh: () => refresh(true) };
}

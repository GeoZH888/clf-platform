// src/school/teacher/home/useTeacherRealtime.js
// Subscribes to Supabase Realtime channels for the teacher's class data.
// Returns live counters: today's submissions, attendance %, students, pending grades.

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../services/supabase';

export function useTeacherRealtime(teacherId) {
  const [stats, setStats] = useState({
    submissionsToday: 0,
    attendanceRate: 0,
    activeStudents: 0,
    pendingHomework: 0,
  });
  const [loading, setLoading] = useState(true);
  const fetchTimer = useRef(null);

  const fetchStats = async () => {
    if (!teacherId) return;
    try {
      const today = new Date().toISOString().slice(0, 10);

      // Teacher's classes
      const { data: classes } = await supabase
        .from('clf_classes')
        .select('id')
        .eq('teacher_id', teacherId);
      const classIds = (classes || []).map(c => c.id);

      if (classIds.length === 0) {
        setStats({ submissionsToday: 0, attendanceRate: 0, activeStudents: 0, pendingHomework: 0 });
        setLoading(false);
        return;
      }

      const queries = await Promise.all([
        supabase.from('clf_homework_submissions')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', today + 'T00:00:00Z')
          .in('class_id', classIds),
        supabase.from('clf_class_attendance')
          .select('present')
          .eq('date', today)
          .in('class_id', classIds),
        supabase.from('clf_class_members')
          .select('*', { count: 'exact', head: true })
          .in('class_id', classIds),
        supabase.from('clf_homework_submissions')
          .select('*', { count: 'exact', head: true })
          .is('graded_at', null)
          .in('class_id', classIds),
      ]);

      const submissionsToday = queries[0].count || 0;
      const attRows = queries[1].data || [];
      const attendanceRate = attRows.length > 0
        ? Math.round((attRows.filter(a => a.present).length / attRows.length) * 100)
        : 0;
      const activeStudents = queries[2].count || 0;
      const pendingHomework = queries[3].count || 0;

      setStats({ submissionsToday, attendanceRate, activeStudents, pendingHomework });
    } catch (e) {
      console.warn('[useTeacherRealtime]', e);
    } finally {
      setLoading(false);
    }
  };

  // Debounced re-fetch on realtime events
  const scheduleRefetch = () => {
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(fetchStats, 500);
  };

  useEffect(() => {
    if (!teacherId) return;
    fetchStats();

    const channel = supabase
      .channel(`teacher-stats-${teacherId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'clf_homework_submissions' },
        scheduleRefetch
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'clf_class_attendance' },
        scheduleRefetch
      )
      .subscribe();

    return () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  return { stats, loading, refresh: fetchStats };
}

// src/student/pages/StudentHome.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { FileCheck, Award, Bell } from 'lucide-react';

export default function StudentHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ pending: 0, graded: 0, notices: 0 });

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        // Pending homework: assigned to my classes, not yet submitted
        const { data: classes } = await supabase
          .from('clf_class_members').select('class_id').eq('user_id', user.id);
        const ids = (classes || []).map(c => c.class_id);
        if (ids.length === 0) { setStats({ pending: 0, graded: 0, notices: 0 }); return; }

        const { count: hwCount } = await supabase
          .from('clf_homework').select('id', { count: 'exact', head: true }).in('class_id', ids);
        const { count: subCount } = await supabase
          .from('clf_homework_submissions').select('id', { count: 'exact', head: true })
          .eq('student_id', user.id).not('graded_at', 'is', null);
        const { count: noticeCount } = await supabase
          .from('clf_notices').select('id', { count: 'exact', head: true }).in('class_id', ids);

        setStats({
          pending: (hwCount || 0) - (subCount || 0),
          graded:  subCount || 0,
          notices: noticeCount || 0,
        });
      } catch (e) { console.warn('[StudentHome]', e); }
    })();
  }, [user?.id]);

  const tiles = [
    { label: '待完成作业', value: stats.pending, icon: FileCheck, color: '#f59e0b' },
    { label: '已批改作业', value: stats.graded,  icon: Award,     color: '#10b981' },
    { label: '通知',       value: stats.notices, icon: Bell,      color: '#8b5cf6' },
  ];

  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>
        概览 · Overview
      </h1>
      <div style={{ display: 'grid', gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {tiles.map((t, i) => {
          const Icon = t.icon;
          return (
            <div key={i} style={{
              background: '#fff', border: `1px solid ${t.color}22`,
              borderRadius: 12, padding: 16,
            }}>
              <Icon size={20} color={t.color}/>
              <div style={{ fontSize: 28, fontWeight: 700, color: t.color, marginTop: 8 }}>
                {t.value}
              </div>
              <div style={{ fontSize: 12, color: '#a07850', marginTop: 4 }}>{t.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

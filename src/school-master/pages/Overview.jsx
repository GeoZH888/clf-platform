// src/school-master/pages/Overview.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../school/services/supabase';
import { Users, GraduationCap, BookOpen, FileCheck } from 'lucide-react';

export default function Overview() {
  const [stats, setStats] = useState({ teachers: 0, classes: 0, students: 0, homework: 0 });
  useEffect(() => {
    (async () => {
      try {
        const [t, c, s, h] = await Promise.all([
          supabase.from('clf_user_profiles').select('user_id', { count: 'exact', head: true }).eq('role', 'teacher'),
          supabase.from('clf_classes').select('id', { count: 'exact', head: true }),
          supabase.from('clf_class_members').select('id', { count: 'exact', head: true }),
          supabase.from('clf_homework').select('id', { count: 'exact', head: true }),
        ]);
        setStats({ teachers: t.count || 0, classes: c.count || 0,
                   students: s.count || 0, homework: h.count || 0 });
      } catch (e) { console.warn('[Overview]', e); }
    })();
  }, []);

  const tiles = [
    { label: '教师', value: stats.teachers, icon: Users,         color: '#3b82f6' },
    { label: '班级', value: stats.classes,  icon: BookOpen,      color: '#8b5cf6' },
    { label: '学生', value: stats.students, icon: GraduationCap, color: '#10b981' },
    { label: '作业', value: stats.homework, icon: FileCheck,     color: '#f59e0b' },
  ];
  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>学校概览</h1>
      <div style={{ display: 'grid', gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
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

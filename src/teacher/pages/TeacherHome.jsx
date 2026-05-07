// src/teacher/pages/TeacherHome.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Users, FileCheck, MessageSquare, BookOpen } from 'lucide-react';

export default function TeacherHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ classes: 0, students: 0, homework: 0, threads: 0 });

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const [c, h, t] = await Promise.all([
          supabase.from('clf_classes').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id),
          supabase.from('clf_homework').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id),
          supabase.from('clf_pt_threads').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id),
        ]);
        const { data: classes } = await supabase.from('clf_classes').select('id').eq('teacher_id', user.id);
        const classIds = (classes || []).map(c => c.id);
        const { count: studentCount } = classIds.length
          ? await supabase.from('clf_class_members')
              .select('id', { count: 'exact', head: true }).in('class_id', classIds)
          : { count: 0 };
        setStats({
          classes: c.count || 0,
          students: studentCount || 0,
          homework: h.count || 0,
          threads: t.count || 0,
        });
      } catch (e) { console.warn('[TeacherHome stats]', e); }
    })();
  }, [user?.id]);

  const tiles = [
    { label: '班级', value: stats.classes,  icon: Users,         color: '#3b82f6', to: '/classes' },
    { label: '学生', value: stats.students, icon: Users,         color: '#10b981', to: '/classes' },
    { label: '作业', value: stats.homework, icon: FileCheck,     color: '#f59e0b', to: '/homework' },
    { label: '对话', value: stats.threads,  icon: MessageSquare, color: '#8b5cf6', to: '/communication' },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 22, color: '#1a0a05', margin: '0 0 18px',
        fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 1 }}>
        概览 · Overview
      </h1>

      <div style={{
        display: 'grid', gap: 12, marginBottom: 24,
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      }}>
        {tiles.map((t, i) => {
          const Icon = t.icon;
          return (
            <button key={i} onClick={() => navigate(t.to)} style={{
              background: '#fff', border: `1px solid ${t.color}22`,
              borderRadius: 12, padding: 14, cursor: 'pointer',
              textAlign: 'left',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `${t.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 8,
              }}>
                <Icon size={16} color={t.color}/>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: t.color, lineHeight: 1 }}>
                {t.value}
              </div>
              <div style={{ fontSize: 12, color: '#a07850', marginTop: 4 }}>
                {t.label}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{
        background: '#fff', borderRadius: 12, padding: 16,
        border: '1px solid #e8d5b0',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a0a05', marginBottom: 6 }}>
          👋 欢迎回来
        </div>
        <div style={{ fontSize: 13, color: '#5d4630', lineHeight: 1.6 }}>
          从左侧菜单开始：创建班级 → 布置作业 → AI 备课。
        </div>
      </div>
    </div>
  );
}

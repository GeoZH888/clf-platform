// src/school/teacher/home/DashboardStats.jsx
// 4 live tiles: today's submissions, attendance %, students, pending grades.
// All update via Supabase Realtime channels (see useTeacherRealtime).

import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { FileCheck, Users, Clock, TrendingUp } from 'lucide-react';
import { useTeacherRealtime } from './useTeacherRealtime';

const T = {
  zh: {
    submissionsToday: '今日提交',
    attendance: '出勤率',
    students: '学生总数',
    pending: '待批改',
  },
  en: {
    submissionsToday: 'Submitted today',
    attendance: 'Attendance',
    students: 'Students',
    pending: 'To grade',
  },
  it: {
    submissionsToday: 'Compiti di oggi',
    attendance: 'Presenza',
    students: 'Studenti',
    pending: 'Da correggere',
  },
};

export default function DashboardStats({ lang = 'zh' }) {
  const { user } = useAuth();
  const { stats, loading } = useTeacherRealtime(user?.id);
  const t = T[lang];

  const tiles = [
    { icon: FileCheck,  label: t.submissionsToday, value: stats.submissionsToday, color: '#10b981', suffix: '' },
    { icon: TrendingUp, label: t.attendance,       value: stats.attendanceRate,   color: '#3b82f6', suffix: '%' },
    { icon: Users,      label: t.students,         value: stats.activeStudents,   color: '#f59e0b', suffix: '' },
    { icon: Clock,      label: t.pending,          value: stats.pendingHomework,  color: '#c41e3a', suffix: '' },
  ];

  return (
    <div style={{ display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
      {tiles.map((tile, i) => {
        const Icon = tile.icon;
        return (
          <div key={i} style={{
            background: '#fff', borderRadius: 12, padding: 16,
            border: `1px solid ${tile.color}22`,
            boxShadow: `0 1px 3px ${tile.color}10`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', gap: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10,
                background: `${tile.color}15`, display: 'flex',
                alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color={tile.color}/>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700,
                color: tile.color, lineHeight: 1 }}>
                {loading ? '—' : `${tile.value}${tile.suffix}`}
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#a07850', marginTop: 6 }}>
              {tile.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

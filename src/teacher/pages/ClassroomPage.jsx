// src/teacher/pages/ClassroomPage.jsx
// 课堂教学: tabs 备课 | 课程 | 资料 | 进度
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { PageHero } from '../../shared/RolePanelLayout';
import CoursePrepWizard from './CoursePrepWizard';
import CoursesPage from './CoursesPage';
import MaterialsPage from './MaterialsPage';

const TABS = [
  { id: 'prep',      label: '备课' },
  { id: 'courses',   label: '课程' },
  { id: 'materials', label: '资料' },
  { id: 'progress',  label: '进度' },
];

export default function ClassroomPage() {
  const [tab, setTab] = useState('prep');
  return (
    <div>
      <PageHero icon="🛠️" title="课堂教学" subtitle="Classroom" accentColor="#c41e3a"/>
      <div style={{
        display: 'flex', gap: 4, marginBottom: 18, padding: 4,
        background: 'rgba(253,246,227,0.05)', borderRadius: 10,
        border: '1px solid rgba(255,245,230,0.1)', width: 'fit-content',
        flexWrap: 'wrap',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none',
            background: tab === t.id ? '#c41e3a' : 'transparent',
            color: tab === t.id ? '#fff' : 'rgba(253,246,227,0.7)',
            cursor: 'pointer', fontSize: 13,
            fontWeight: tab === t.id ? 700 : 500,
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{
        background: 'rgba(253,246,227,0.04)',
        border: '1px solid rgba(255,245,230,0.1)',
        borderRadius: 14, padding: 20,
      }}>
        {tab === 'prep'      && <CoursePrepWizard />}
        {tab === 'courses'   && <CoursesPage />}
        {tab === 'materials' && <MaterialsPage />}
        {tab === 'progress'  && <ProgressView />}
      </div>
    </div>
  );
}

function ProgressView() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: cls } = await supabase
        .from('clf_classes')
        .select('id, name, grade_level')
        .eq('teacher_id', user.id);
      const out = [];
      for (const c of cls || []) {
        const [{ count: studentCount }, { count: hwCount }, { count: gradedCount }] = await Promise.all([
          supabase.from('clf_class_members').select('id', { count: 'exact', head: true })
            .eq('class_id', c.id),
          supabase.from('clf_homework').select('id', { count: 'exact', head: true })
            .eq('class_id', c.id),
          supabase.from('clf_homework_submissions').select('id', { count: 'exact', head: true })
            .in('homework_id',
              (await supabase.from('clf_homework').select('id').eq('class_id', c.id)).data?.map(h => h.id) || ['__none__'])
            .not('graded_at', 'is', null),
        ]);
        out.push({ ...c,
          studentCount: studentCount || 0,
          hwCount: hwCount || 0,
          gradedCount: gradedCount || 0,
        });
      }
      setClasses(out);
    })();
  }, [user?.id]);

  if (classes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 30, color: 'rgba(253,246,227,0.5)' }}>
        还没有班级
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12,
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
      {classes.map(c => (
        <div key={c.id} style={{
          background: 'rgba(196,30,58,0.08)',
          border: '1px solid rgba(196,30,58,0.3)',
          borderRadius: 12, padding: 14,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff5e6', marginBottom: 8,
            fontFamily: "'STKaiti','KaiTi',serif" }}>
            {c.name}
          </div>
          <Stat label="学生" value={c.studentCount}/>
          <Stat label="作业" value={c.hwCount}/>
          <Stat label="已批" value={c.gradedCount}/>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between',
      padding: '4px 0', fontSize: 12 }}>
      <span style={{ color: 'rgba(253,246,227,0.6)' }}>{label}</span>
      <span style={{ color: '#fff5e6', fontWeight: 700 }}>{value}</span>
    </div>
  );
}

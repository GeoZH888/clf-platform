// src/school-master/pages/StudentsPage.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../school/services/supabase';
import { GraduationCap } from 'lucide-react';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('clf_class_members')
        .select('id, student_name, clf_classes(name)')
        .order('student_name');
      setStudents(data || []);
    })();
  }, []);
  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>学生管理</h1>
      {students.length === 0 ? (
        <div style={{ background: '#fff', padding: 30, borderRadius: 12,
          border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
          暂无学生
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8d5b0',
          overflow: 'hidden' }}>
          {students.map((s, i) => (
            <div key={s.id} style={{
              padding: 12, display: 'flex', gap: 10, alignItems: 'center',
              borderBottom: i < students.length - 1 ? '1px solid #fdf6e3' : 'none',
            }}>
              <GraduationCap size={16} color="#10b981"/>
              <div style={{ flex: 1, fontSize: 13 }}>{s.student_name}</div>
              <div style={{ fontSize: 11, color: '#a07850' }}>{s.clf_classes?.name || '-'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

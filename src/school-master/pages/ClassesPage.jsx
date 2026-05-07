// src/school-master/pages/ClassesPage.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../school/services/supabase';
import { BookOpen } from 'lucide-react';

export default function ClassesPage() {
  const [classes, setClasses] = useState([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('clf_classes')
        .select('*')
        .order('created_at', { ascending: false });
      setClasses(data || []);
    })();
  }, []);
  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>班级管理</h1>
      {classes.length === 0 ? (
        <Empty>暂无班级</Empty>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {classes.map(c => (
            <div key={c.id} style={{
              background: '#fff', padding: 14, borderRadius: 10,
              border: '1px solid #e8d5b0',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <BookOpen size={14} color="#8b5cf6"/>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
              </div>
              <div style={{ fontSize: 11, color: '#a07850', marginTop: 4 }}>
                {c.grade_level || '-'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
const Empty = ({ children }) => (
  <div style={{ background: '#fff', padding: 30, borderRadius: 12,
    border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
    {children}
  </div>
);

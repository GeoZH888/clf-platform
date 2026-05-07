// src/parent/pages/ParentHome.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Users } from 'lucide-react';

export default function ParentHome() {
  const { user } = useAuth();
  const [children, setChildren] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      // Children = clf_class_members rows where parent_user_id = me
      const { data } = await supabase
        .from('clf_class_members')
        .select('id, student_name, user_id, class_id, clf_classes(name, grade_level)')
        .eq('parent_user_id', user.id);
      setChildren(data || []);
    })();
  }, [user?.id]);

  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>我的孩子</h1>
      {children.length === 0 ? (
        <div style={{ background: '#fff', padding: 30, borderRadius: 12,
          border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
          还没有关联的孩子。请联系老师或学校管理员。
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {children.map(c => (
            <div key={c.id} style={{
              background: '#fff', borderRadius: 12, padding: 16,
              border: '1px solid #e8d5b0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Users size={18} color="#3b82f6"/>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{c.student_name}</div>
              </div>
              <div style={{ fontSize: 12, color: '#a07850' }}>
                班级：{c.clf_classes?.name || '-'}
                {c.clf_classes?.grade_level ? ' · ' + c.clf_classes.grade_level : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

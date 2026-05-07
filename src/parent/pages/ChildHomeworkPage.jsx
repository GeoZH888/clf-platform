// src/parent/pages/ChildHomeworkPage.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { FileCheck } from 'lucide-react';

export default function ChildHomeworkPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: kids } = await supabase
        .from('clf_class_members')
        .select('class_id, user_id, student_name')
        .eq('parent_user_id', user.id);
      const classIds = [...new Set((kids || []).map(k => k.class_id))];
      if (classIds.length === 0) { setItems([]); return; }

      const { data: hw } = await supabase
        .from('clf_homework')
        .select('*, clf_classes(name)')
        .in('class_id', classIds)
        .order('created_at', { ascending: false });

      setItems(hw || []);
    })();
  }, [user?.id]);

  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>作业进度</h1>
      {items.length === 0 ? (
        <div style={{ background: '#fff', padding: 30, borderRadius: 12,
          border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
          暂无作业
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map(h => (
            <div key={h.id} style={{
              background: '#fff', padding: 14, borderRadius: 10,
              border: '1px solid #e8d5b0',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <FileCheck size={14} color="#10b981"/>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{h.title}</div>
              </div>
              <div style={{ fontSize: 11, color: '#a07850' }}>
                {h.clf_classes?.name} {h.due_at ? '· 截止 ' + new Date(h.due_at).toLocaleString() : ''}
              </div>
              {h.description && (
                <div style={{ fontSize: 12, color: '#5d4630', marginTop: 6 }}>{h.description}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

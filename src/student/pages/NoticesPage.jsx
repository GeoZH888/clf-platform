// src/student/pages/NoticesPage.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Bell, Pin } from 'lucide-react';

export default function NoticesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: classes } = await supabase
        .from('clf_class_members').select('class_id').eq('user_id', user.id);
      const ids = (classes || []).map(c => c.class_id);
      if (ids.length === 0) { setItems([]); return; }
      const { data } = await supabase.from('clf_notices')
        .select('*, clf_classes(name)')
        .in('class_id', ids)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });
      setItems(data || []);
    })();
  }, [user?.id]);

  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>通知公告</h1>
      {items.length === 0 ? (
        <div style={{ background: '#fff', padding: 30, borderRadius: 12,
          border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
          暂无通知
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map(n => (
            <div key={n.id} style={{
              background: n.pinned ? '#fef3e2' : '#fff', padding: 14, borderRadius: 10,
              border: `1px solid ${n.pinned ? '#c41e3a' : '#e8d5b0'}`,
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                {n.pinned && <Pin size={12} color="#c41e3a"/>}
                <Bell size={14} color="#8b5cf6"/>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{n.title}</div>
              </div>
              <div style={{ fontSize: 11, color: '#a07850', marginBottom: 6 }}>
                {n.clf_classes?.name} · {new Date(n.created_at).toLocaleString()}
              </div>
              <div style={{ fontSize: 13, color: '#5d4630', whiteSpace: 'pre-wrap' }}>
                {n.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// src/school-master/pages/NoticesPage.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../school/services/supabase';
import { Bell } from 'lucide-react';

export default function NoticesPage() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('clf_notices')
        .select('*, clf_classes(name)')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });
      setItems(data || []);
    })();
  }, []);
  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>全校通知</h1>
      {items.length === 0 ? (
        <div style={{ background: '#fff', padding: 30, borderRadius: 12,
          border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
          暂无通知
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map(n => (
            <div key={n.id} style={{
              background: '#fff', padding: 14, borderRadius: 10,
              border: '1px solid #e8d5b0',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <Bell size={14} color="#8b5cf6"/>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{n.title}</div>
              </div>
              <div style={{ fontSize: 11, color: '#a07850', marginBottom: 6 }}>
                {n.clf_classes?.name || '全体'} · {new Date(n.created_at).toLocaleString()}
              </div>
              <div style={{ fontSize: 13, color: '#5d4630', whiteSpace: 'pre-wrap' }}>{n.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

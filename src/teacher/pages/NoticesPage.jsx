// src/teacher/pages/NoticesPage.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Plus, Bell, Trash2, Pin } from 'lucide-react';

export default function NoticesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [notices, setNotices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ class_id: '', title: '', body: '', pinned: false });

  const load = async () => {
    if (!user?.id) return;
    const [c, n] = await Promise.all([
      supabase.from('clf_classes').select('*').eq('teacher_id', user.id),
      supabase.from('clf_notices').select('*, clf_classes(name)')
        .eq('teacher_id', user.id).order('pinned', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);
    setClasses(c.data || []);
    setNotices(n.data || []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const create = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    await supabase.from('clf_notices').insert({ ...form, teacher_id: user.id });
    setForm({ class_id: '', title: '', body: '', pinned: false });
    setShowForm(false);
    load();
  };

  const togglePin = async (n) => {
    await supabase.from('clf_notices').update({ pinned: !n.pinned }).eq('id', n.id);
    load();
  };

  const remove = async (id) => {
    if (!confirm('删除?')) return;
    await supabase.from('clf_notices').delete().eq('id', id);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: '#1a0a05',
          fontFamily: "'STKaiti','KaiTi',serif" }}>通知公告</h1>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: '8px 14px', background: '#c41e3a', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 6,
        }}><Plus size={14}/> 新通知</button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', padding: 16, borderRadius: 12,
          border: '1px solid #e8d5b0', marginBottom: 16 }}>
          <select value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })}
            style={inputStyle}>
            <option value="">全体 (全部班级)</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input placeholder="标题" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle}/>
          <textarea placeholder="正文" value={form.body}
            onChange={e => setForm({ ...form, body: e.target.value })}
            style={{ ...inputStyle, minHeight: 100 }}/>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <input type="checkbox" checked={form.pinned}
              onChange={e => setForm({ ...form, pinned: e.target.checked })}/>
            置顶
          </label>
          <button onClick={create} style={{
            padding: '8px 16px', background: '#c41e3a', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          }}>发布</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {notices.length === 0 ? (
          <div style={{ background: '#fff', padding: 24, borderRadius: 12,
            border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
            还没有通知
          </div>
        ) : notices.map(n => (
          <div key={n.id} style={{
            background: n.pinned ? '#fef3e2' : '#fff',
            padding: 14, borderRadius: 10,
            border: `1px solid ${n.pinned ? '#c41e3a' : '#e8d5b0'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  {n.pinned && <Pin size={12} color="#c41e3a"/>}
                  <Bell size={14} color="#8b5cf6"/>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{n.title}</div>
                </div>
                <div style={{ fontSize: 11, color: '#a07850', marginBottom: 6 }}>
                  {n.clf_classes?.name || '全体'} · {new Date(n.created_at).toLocaleString()}
                </div>
                <div style={{ fontSize: 13, color: '#5d4630', whiteSpace: 'pre-wrap' }}>{n.body}</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => togglePin(n)} style={iconBtn}><Pin size={14}/></button>
                <button onClick={() => remove(n.id)} style={iconBtn}><Trash2 size={14}/></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #e8d5b0', borderRadius: 6,
  marginBottom: 8, boxSizing: 'border-box', fontFamily: 'inherit',
};
const iconBtn = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: '#a07850', padding: 4,
};

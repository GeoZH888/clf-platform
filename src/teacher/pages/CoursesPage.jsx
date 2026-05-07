// src/teacher/pages/CoursesPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Plus, BookOpen, Sparkles, Trash2 } from 'lucide-react';

export default function CoursesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', topic: '', level: 'HSK1', class_id: '' });

  const load = async () => {
    if (!user?.id) return;
    const [c, k] = await Promise.all([
      supabase.from('clf_classes').select('*').eq('teacher_id', user.id),
      supabase.from('clf_courses').select('*').eq('teacher_id', user.id)
        .order('created_at', { ascending: false }),
    ]);
    setClasses(c.data || []);
    setCourses(k.data || []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const create = async () => {
    if (!form.title.trim()) return;
    const { data } = await supabase.from('clf_courses').insert({
      ...form, teacher_id: user.id, class_id: form.class_id || null,
    }).select().single();
    setForm({ title: '', topic: '', level: 'HSK1', class_id: '' });
    setShowForm(false);
    if (data) navigate(`/courses/${data.id}/prepare`);
    else load();
  };

  const remove = async (id) => {
    if (!confirm('删除?')) return;
    await supabase.from('clf_courses').delete().eq('id', id);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: '#1a0a05',
          fontFamily: "'STKaiti','KaiTi',serif" }}>课程管理</h1>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: '8px 14px', background: '#c41e3a', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 6,
        }}><Plus size={14}/> 新课程</button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', padding: 16, borderRadius: 12,
          border: '1px solid #e8d5b0', marginBottom: 16 }}>
          <input placeholder="课程名" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle}/>
          <input placeholder="主题 (例: 家庭成员)" value={form.topic}
            onChange={e => setForm({ ...form, topic: e.target.value })} style={inputStyle}/>
          <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}
            style={inputStyle}>
            <option>HSK1</option><option>HSK2</option><option>HSK3</option>
            <option>HSK4</option><option>HSK5</option><option>HSK6</option>
          </select>
          <select value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })}
            style={inputStyle}>
            <option value="">(不关联班级)</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={create} style={{
            padding: '8px 16px', background: '#c41e3a', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6,
          }}><Sparkles size={14}/> 创建并 AI 备课</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {courses.length === 0 ? (
          <div style={{ background: '#fff', padding: 24, borderRadius: 12,
            border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
            还没有课程
          </div>
        ) : courses.map(c => (
          <div key={c.id} style={{
            background: '#fff', padding: 14, borderRadius: 10,
            border: '1px solid #e8d5b0',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <BookOpen size={14} color="#3b82f6"/>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{c.title}</div>
                  <span style={{ fontSize: 10, padding: '2px 6px',
                    borderRadius: 4, background: '#3b82f615', color: '#3b82f6' }}>
                    {c.level}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#a07850' }}>
                  {c.topic} · {c.status}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => navigate(`/courses/${c.id}/prepare`)} style={{
                  padding: '4px 10px', background: '#fdf6e3', color: '#c41e3a',
                  border: '1px solid #c41e3a', borderRadius: 6,
                  cursor: 'pointer', fontSize: 11,
                }}>备课</button>
                <button onClick={() => remove(c.id)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#a07850',
                }}><Trash2 size={14}/></button>
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

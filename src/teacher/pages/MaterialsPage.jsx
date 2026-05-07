// src/teacher/pages/MaterialsPage.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Upload, FileText, Trash2 } from 'lucide-react';

const DESTS = [
  { id: 'students',     label: '学生可下载', color: '#10b981' },
  { id: 'rag-pending',  label: '提交到 RAG (等待审核)', color: '#f59e0b' },
  { id: 'private',      label: '仅自己可见', color: '#8b5cf6' },
];

export default function MaterialsPage() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [filter, setFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: '', destination: 'students', file: null });

  const load = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('clf_materials')
      .select('*').eq('uploader_id', user.id)
      .order('created_at', { ascending: false });
    setMaterials(data || []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const upload = async () => {
    if (!form.file || !form.title.trim()) return;
    setUploading(true);
    try {
      const path = `${form.destination}/${user.id}/${Date.now()}-${form.file.name}`;
      const { error: upErr } = await supabase.storage
        .from('teacher-materials').upload(path, form.file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage
        .from('teacher-materials').getPublicUrl(path);
      await supabase.from('clf_materials').insert({
        uploader_id: user.id,
        title: form.title.trim(),
        file_url: urlData.publicUrl,
        file_size: form.file.size,
        mime_type: form.file.type,
        destination: form.destination,
      });
      setForm({ title: '', destination: 'students', file: null });
      load();
    } catch (e) {
      alert('上传失败: ' + e.message);
    } finally { setUploading(false); }
  };

  const remove = async (m) => {
    if (!confirm('删除?')) return;
    await supabase.from('clf_materials').delete().eq('id', m.id);
    load();
  };

  const filtered = filter === 'all' ? materials : materials.filter(m => m.destination === filter);

  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>教学资料</h1>

      <div style={{ background: '#fff', padding: 16, borderRadius: 12,
        border: '1px solid #e8d5b0', marginBottom: 16 }}>
        <input placeholder="资料名称" value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle}/>
        <select value={form.destination}
          onChange={e => setForm({ ...form, destination: e.target.value })}
          style={inputStyle}>
          {DESTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        <input type="file" onChange={e => setForm({ ...form, file: e.target.files[0] })}
          style={{ ...inputStyle, padding: 6 }}/>
        <button onClick={upload} disabled={uploading} style={{
          padding: '8px 16px', background: uploading ? '#ccc' : '#c41e3a',
          color: '#fff', border: 'none', borderRadius: 8,
          cursor: uploading ? 'wait' : 'pointer', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Upload size={14}/> {uploading ? '上传中···' : '上传'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>全部</FilterBtn>
        {DESTS.map(d => (
          <FilterBtn key={d.id} active={filter === d.id} onClick={() => setFilter(d.id)}>
            {d.label}
          </FilterBtn>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ background: '#fff', padding: 24, borderRadius: 12,
            border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
            还没有资料
          </div>
        ) : filtered.map(m => {
          const dest = DESTS.find(d => d.id === m.destination);
          return (
            <div key={m.id} style={{
              background: '#fff', padding: 12, borderRadius: 10,
              border: '1px solid #e8d5b0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1 }}>
                <FileText size={16} color={dest?.color || '#a07850'}/>
                <div>
                  <a href={m.file_url} target="_blank" rel="noreferrer" style={{
                    fontSize: 13, fontWeight: 600, color: '#1a0a05',
                    textDecoration: 'none',
                  }}>{m.title}</a>
                  <div style={{ fontSize: 10, color: '#a07850', marginTop: 2 }}>
                    {dest?.label} · {(m.file_size / 1024).toFixed(0)} KB
                  </div>
                </div>
              </div>
              <button onClick={() => remove(m)} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#a07850',
              }}><Trash2 size={14}/></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilterBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 6, fontSize: 12,
      cursor: 'pointer',
      background: active ? '#c41e3a' : '#fff',
      color: active ? '#fff' : '#5d4630',
      border: `1px solid ${active ? '#c41e3a' : '#e8d5b0'}`,
    }}>{children}</button>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #e8d5b0', borderRadius: 6,
  marginBottom: 8, boxSizing: 'border-box', fontFamily: 'inherit',
};

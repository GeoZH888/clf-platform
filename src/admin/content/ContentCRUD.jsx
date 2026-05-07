// src/admin/content/ContentCRUD.jsx
// Generic CRUD shell — pass a table name + columns + and you get list/create/edit/delete.
//
// Example usage:
//   <ContentCRUD
//     table="clf_chengyu"
//     title="成语管理"
//     columns={[
//       { key: 'idiom', label: '成语', type: 'text', required: true },
//       { key: 'pinyin', label: '拼音', type: 'text' },
//       { key: 'meaning', label: '释义', type: 'textarea' },
//     ]}
//   />
import React, { useEffect, useState } from 'react';
import { supabase } from '../../school/services/supabase';
import { Plus, Trash2, Edit, Save, X } from 'lucide-react';

export default function ContentCRUD({ table, title, columns, idColumn = 'id', orderBy = 'created_at', orderDir = 'desc' }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // null | {} (new) | row (edit)
  const [form, setForm] = useState({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from(table).select('*')
        .order(orderBy, { ascending: orderDir === 'asc' })
        .limit(200);
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [table]);

  const startEdit = (row) => { setEditing(row); setForm({...row}); };
  const startNew = () => { setEditing({}); setForm({}); };
  const cancel = () => { setEditing(null); setForm({}); };

  const save = async () => {
    try {
      if (editing[idColumn]) {
        await supabase.from(table).update(form).eq(idColumn, editing[idColumn]);
      } else {
        await supabase.from(table).insert(form);
      }
      cancel(); load();
    } catch (e) {
      alert('保存失败：' + e.message);
    }
  };

  const remove = async (row) => {
    if (!confirm(`确定删除？此操作不可撤销。`)) return;
    try {
      await supabase.from(table).delete().eq(idColumn, row[idColumn]);
      load();
    } catch (e) {
      alert('删除失败：' + e.message);
    }
  };

  if (loading) return <div style={{ padding: 24, color: '#a07850' }}>加载中…</div>;
  if (error) return (
    <div style={{
      padding: 16, background: '#fef2f2', border: '1px solid #fecaca',
      borderRadius: 8, color: '#991b1b', fontSize: 13,
    }}>
      <strong>错误：</strong> {error}
      <div style={{ marginTop: 6, fontSize: 11, color: '#7f1d1d' }}>
        表 <code>{table}</code> 可能不存在，或当前用户没有权限访问。
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#1a0a05' }}>
          {title} · <span style={{ color: '#a07850', fontWeight: 400 }}>{rows.length} 条</span>
        </h3>
        {!editing && (
          <button onClick={startNew} style={{
            marginLeft: 'auto', padding: '8px 14px', background: '#c41e3a',
            color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
            fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Plus size={12}/> 新建
          </button>
        )}
      </div>

      {editing && (
        <EditForm columns={columns} form={form} setForm={setForm}
          onSave={save} onCancel={cancel}/>
      )}

      <div style={{ display: 'grid', gap: 6 }}>
        {rows.length === 0 ? (
          <div style={{
            padding: 24, textAlign: 'center', color: '#a07850',
            background: '#fff', border: '1px dashed #e8d5b0', borderRadius: 10,
          }}>暂无数据</div>
        ) : rows.map(row => (
          <div key={row[idColumn]} style={{
            background: '#fff', padding: 12, borderRadius: 8,
            border: '1px solid #e8d5b0',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              {columns.slice(0, 3).map(col => (
                <div key={col.key} style={{ marginBottom: 2 }}>
                  <span style={{ fontSize: 10, color: '#a07850', marginRight: 6 }}>{col.label}:</span>
                  <span style={{ fontSize: 13, color: '#1a0a05' }}>
                    {String(row[col.key] ?? '').slice(0, 80)}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => startEdit(row)} style={iconBtn('#3b82f6')}>
                <Edit size={12}/>
              </button>
              <button onClick={() => remove(row)} style={iconBtn('#c41e3a')}>
                <Trash2 size={12}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditForm({ columns, form, setForm, onSave, onCancel }) {
  return (
    <div style={{
      background: '#fff', padding: 16, borderRadius: 12,
      border: '2px solid #c41e3a', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {columns.map(col => (
          <div key={col.key}>
            <label style={{ fontSize: 11, color: '#a07850', display: 'block', marginBottom: 2 }}>
              {col.label} {col.required && <span style={{ color: '#c41e3a' }}>*</span>}
            </label>
            {col.type === 'textarea' ? (
              <textarea value={form[col.key] || ''}
                onChange={e => setForm(f => ({...f, [col.key]: e.target.value}))}
                rows={3} style={input}/>
            ) : col.type === 'number' ? (
              <input type="number" value={form[col.key] ?? ''}
                onChange={e => setForm(f => ({...f, [col.key]: e.target.value === '' ? null : Number(e.target.value)}))}
                style={input}/>
            ) : col.type === 'boolean' ? (
              <input type="checkbox" checked={!!form[col.key]}
                onChange={e => setForm(f => ({...f, [col.key]: e.target.checked}))}/>
            ) : (
              <input type="text" value={form[col.key] || ''}
                onChange={e => setForm(f => ({...f, [col.key]: e.target.value}))}
                style={input}/>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
        <button onClick={onSave} style={{
          padding: '8px 14px', background: '#10b981', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <Save size={12}/> 保存
        </button>
        <button onClick={onCancel} style={{
          padding: '8px 14px', background: '#fff', color: '#5d4630',
          border: '1px solid #e8d5b0', borderRadius: 8, cursor: 'pointer', fontSize: 12,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <X size={12}/> 取消
        </button>
      </div>
    </div>
  );
}

const input = {
  width: '100%', boxSizing: 'border-box',
  padding: '8px 10px', fontSize: 13,
  border: '1px solid #e8d5b0', borderRadius: 6,
  fontFamily: 'inherit',
};
const iconBtn = (color) => ({
  width: 28, height: 28, background: `${color}15`, color: color,
  border: `1px solid ${color}40`, borderRadius: 6, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});

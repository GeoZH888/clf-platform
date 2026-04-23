// src/admin/DirectCreateUserPanel.jsx
// Admin panel section for directly creating user accounts without QR/invite.
// Two modes: single entry form, or batch from name list.
// Supports copy/CSV export of generated credentials.

import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

const V = {
  bg: '#fdf6e3', card: '#fff', border: '#e8d5b0',
  text: '#1a0a05', text2: '#6b4c2a', text3: '#a07850',
  accent: '#8B4513', green: '#2E7D32', red: '#c62828',
};

export default function DirectCreateUserPanel() {
  const [mode, setMode] = useState('single');   // 'single' | 'batch'
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState([]);
  const [creating, setCreating] = useState(false);

  async function call(body) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('未登录');
    const res = await fetch('/.netlify/functions/admin-create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  return (
    <div style={{
      background: V.card, border: `1px solid ${V.border}`,
      borderRadius: 12, padding: 16, marginBottom: 16,
    }}>
      <h3 style={{ margin: 0, fontSize: 15, color: V.accent, marginBottom: 4 }}>
        ⚡ 直接创建账号
      </h3>
      <p style={{ fontSize: 11, color: V.text3, margin: '0 0 14px', lineHeight: 1.4 }}>
        无需扫码或审核，账号立即可用。生成的用户名和密码请自行发给学生。
      </p>

      {/* Mode switch */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <ModeBtn active={mode==='single'} onClick={() => { setMode('single'); setResults([]); setErrors([]); }}>
          单次创建
        </ModeBtn>
        <ModeBtn active={mode==='batch'} onClick={() => { setMode('batch'); setResults([]); setErrors([]); }}>
          批量创建
        </ModeBtn>
      </div>

      {mode === 'single'
        ? <SingleForm call={call} creating={creating} setCreating={setCreating}
            onResult={r => setResults(prev => [r, ...prev])}/>
        : <BatchForm call={call} creating={creating} setCreating={setCreating}
            onResults={(rs, es) => { setResults(rs); setErrors(es); }}/>}

      {/* Results */}
      {results.length > 0 && <ResultsDisplay results={results}/>}
      {errors.length > 0 && (
        <div style={{ marginTop: 10, padding: 10, background: '#FFEBEE',
          borderRadius: 8, border: '1px solid #FFCDD2', fontSize: 12, color: V.red }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠ 部分失败：</div>
          {errors.map((e, i) => (
            <div key={i}>• {e.name}: {e.error}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Single-user form ─────────────────────────────────────────────
function SingleForm({ call, creating, setCreating, onResult }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    if (!name.trim()) { setErr('姓名必填'); return; }
    setCreating(true);
    try {
      const { result } = await call({
        mode: 'single',
        name, username: username || undefined,
        password: password || undefined, email: email || undefined,
      });
      onResult(result);
      setName(''); setUsername(''); setPassword(''); setEmail('');
    } catch (e) {
      setErr(e.message);
    } finally { setCreating(false); }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <LabeledInput label="姓名 *" value={name} onChange={setName}
          placeholder="张三 / Marco Rossi" maxLength={80}/>
        <LabeledInput label="用户名（留空自动生成）" value={username} onChange={setUsername}
          placeholder="zhang_san_ab12" mono maxLength={30}/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <LabeledInput label="密码（留空自动生成）" value={password} onChange={setPassword}
          placeholder="8 位随机" mono maxLength={100}/>
        <LabeledInput label="邮箱（可选）" value={email} onChange={setEmail}
          placeholder="name@example.com" maxLength={120}/>
      </div>
      {err && <div style={{ color: V.red, fontSize: 12 }}>⚠ {err}</div>}
      <button onClick={submit} disabled={creating} style={{
        padding: '9px 14px', background: creating ? '#ccc' : V.accent,
        color: '#fff', border: 'none', borderRadius: 8, fontSize: 13,
        cursor: creating ? 'not-allowed' : 'pointer', alignSelf: 'flex-start',
        marginTop: 4, fontWeight: 500,
      }}>
        {creating ? '创建中…' : '✨ 创建账号'}
      </button>
    </div>
  );
}

// ── Batch form ──────────────────────────────────────────────────
function BatchForm({ call, creating, setCreating, onResults }) {
  const [names, setNames] = useState('');
  const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    const list = names.split('\n').map(n => n.trim()).filter(Boolean);
    if (list.length === 0) { setErr('请粘贴姓名（每行一个）'); return; }
    if (list.length > 100) { setErr('批量最多 100 个'); return; }
    setCreating(true);
    try {
      const data = await call({ mode: 'batch', names: list });
      onResults(data.results || [], data.errors || []);
      if (data.results?.length > 0) setNames('');
    } catch (e) {
      setErr(e.message);
    } finally { setCreating(false); }
  }

  const count = names.split('\n').filter(n => n.trim()).length;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div>
        <label style={{ fontSize: 12, color: V.text3, display: 'block', marginBottom: 4 }}>
          姓名列表（每行一个）
        </label>
        <textarea rows={6} value={names} onChange={e => setNames(e.target.value)}
          placeholder={'张三\n李四\nMarco Rossi\nGiulia Bianchi'}
          style={{
            width: '100%', padding: '8px 10px', fontSize: 13,
            border: `1px solid ${V.border}`, borderRadius: 8,
            boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical',
          }}/>
      </div>
      {err && <div style={{ color: V.red, fontSize: 12 }}>⚠ {err}</div>}
      <button onClick={submit} disabled={creating || count === 0} style={{
        padding: '9px 14px', background: (creating || count===0) ? '#ccc' : V.accent,
        color: '#fff', border: 'none', borderRadius: 8, fontSize: 13,
        cursor: (creating || count===0) ? 'not-allowed' : 'pointer',
        alignSelf: 'flex-start', fontWeight: 500,
      }}>
        {creating ? '创建中…' : `✨ 批量创建 ${count} 个账号`}
      </button>
      <div style={{ fontSize: 10, color: V.text3 }}>
        用户名和密码会自动生成。创建完成后可导出 CSV。
      </div>
    </div>
  );
}

// ── Results ──────────────────────────────────────────────────────
function ResultsDisplay({ results }) {
  function copyRow(r) {
    const text = `${r.name}\n用户名: ${r.username}\n密码: ${r.password}`;
    navigator.clipboard?.writeText(text).then(() => alert('已复制'));
  }
  function copyAll() {
    const text = results.map(r =>
      `${r.name} | ${r.username} | ${r.password}`
    ).join('\n');
    navigator.clipboard?.writeText(text).then(() => alert(`已复制 ${results.length} 条`));
  }
  function exportCSV() {
    const csv = 'name,username,password\n' +
      results.map(r => `"${r.name}","${r.username}","${r.password}"`).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `accounts_${Date.now()}.csv`;
    a.click();
  }

  return (
    <div style={{
      marginTop: 14, padding: 12, background: '#F1F8F4',
      border: '1px solid #A5D6A7', borderRadius: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: V.green }}>
          ✓ 成功创建 {results.length} 个账号
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={copyAll} style={miniBtn}>📋 全部复制</button>
          <button onClick={exportCSV} style={miniBtn}>⬇ CSV</button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
        {results.map((r, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto',
            gap: 8, alignItems: 'center', padding: '6px 8px',
            background: V.card, borderRadius: 6, fontSize: 12,
          }}>
            <div style={{ color: V.text2 }}>{r.name}</div>
            <code style={{ color: V.accent, fontWeight: 600 }}>{r.username}</code>
            <code style={{ color: V.text, background: V.bg,
              padding: '2px 6px', borderRadius: 4 }}>{r.password}</code>
            <button onClick={() => copyRow(r)} style={miniBtn}>📋</button>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, color: V.text3, marginTop: 10, lineHeight: 1.4 }}>
        ⚠ 密码仅在此刻显示，刷新后无法再次查看。请立即复制并妥善保管。
      </div>
    </div>
  );
}

// ── UI atoms ────────────────────────────────────────────────────
function ModeBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 14px', fontSize: 12,
      background: active ? V.accent : V.card,
      color: active ? '#fff' : V.text2,
      border: `1px solid ${active ? V.accent : V.border}`,
      borderRadius: 6, cursor: 'pointer',
      fontWeight: active ? 500 : 400,
    }}>{children}</button>
  );
}

function LabeledInput({ label, value, onChange, placeholder, mono, maxLength }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: V.text3, display: 'block', marginBottom: 3 }}>
        {label}
      </label>
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} maxLength={maxLength}
        style={{
          width: '100%', padding: '7px 10px', fontSize: 13,
          border: `1px solid ${V.border}`, borderRadius: 6, boxSizing: 'border-box',
          fontFamily: mono ? 'ui-monospace,Menlo,monospace' : 'inherit',
          background: '#fffdf9',
        }}/>
    </div>
  );
}

const miniBtn = {
  padding: '4px 10px', fontSize: 11, background: V.card, color: V.accent,
  border: `1px solid ${V.accent}`, borderRadius: 5, cursor: 'pointer',
};

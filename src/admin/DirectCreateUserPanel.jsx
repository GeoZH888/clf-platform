// src/admin/DirectCreateUserPanel.jsx
// Admin panel section for directly creating user accounts.
// Now supports:
//   - Single/batch modes
//   - Optional QR-code quick-login token with expiry + max-device cap
//   - QR visualization, credentials copy, CSV export

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import QRCode from 'qrcode';

const V = {
  bg: '#fdf6e3', card: '#fff', border: '#e8d5b0',
  text: '#1a0a05', text2: '#6b4c2a', text3: '#a07850',
  accent: '#8B4513', green: '#2E7D32', red: '#c62828',
};

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';
const buildQrUrl = (token) => `${BASE_URL}/quick-login?t=${token}`;

export default function DirectCreateUserPanel() {
  const [mode, setMode] = useState('single');
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState([]);
  const [creating, setCreating] = useState(false);

  // Shared QR options
  const [generateQr, setGenerateQr] = useState(true);
  const [maxDevices, setMaxDevices] = useState(2);
  const [expiryDays, setExpiryDays] = useState(30);
  const [label, setLabel] = useState('');

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

  const qrOptions = {
    generateQrToken: generateQr,
    maxDevices,
    expiresAt: expiryDays > 0
      ? new Date(Date.now() + expiryDays * 864e5).toISOString()
      : null,
  };

  return (
    <div style={{
      background: V.card, border: `1px solid ${V.border}`,
      borderRadius: 12, padding: 16, marginBottom: 16,
    }}>
      <h3 style={{ margin: 0, fontSize: 15, color: V.accent, marginBottom: 4 }}>
        ⚡ 直接创建账号
      </h3>
      <p style={{ fontSize: 11, color: V.text3, margin: '0 0 14px', lineHeight: 1.4 }}>
        无需扫码邀请或审核，账号立即可用。可同时生成扫码登录 QR 码。
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <ModeBtn active={mode==='single'} onClick={() => { setMode('single'); setResults([]); setErrors([]); }}>
          单次创建
        </ModeBtn>
        <ModeBtn active={mode==='batch'} onClick={() => { setMode('batch'); setResults([]); setErrors([]); }}>
          批量创建
        </ModeBtn>
      </div>

      <QrOptionsPanel
        generateQr={generateQr} setGenerateQr={setGenerateQr}
        maxDevices={maxDevices} setMaxDevices={setMaxDevices}
        expiryDays={expiryDays} setExpiryDays={setExpiryDays}
        label={label} setLabel={setLabel}
        showLabelField={mode === 'single'}/>

      {mode === 'single'
        ? <SingleForm call={call} creating={creating} setCreating={setCreating}
            qrOptions={qrOptions} label={label}
            onResult={r => setResults(prev => [r, ...prev])}/>
        : <BatchForm call={call} creating={creating} setCreating={setCreating}
            qrOptions={qrOptions} labelPrefix={label}
            onResults={(rs, es) => { setResults(rs); setErrors(es); }}/>}

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

function QrOptionsPanel({ generateQr, setGenerateQr, maxDevices, setMaxDevices,
                         expiryDays, setExpiryDays, label, setLabel, showLabelField }) {
  return (
    <div style={{ background: '#FFFBF3', border: `1px solid ${V.border}`,
      borderRadius: 8, padding: 10, marginBottom: 14 }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center',
        fontSize: 13, color: V.text2, marginBottom: generateQr ? 10 : 0 }}>
        <input type="checkbox" checked={generateQr}
          onChange={e => setGenerateQr(e.target.checked)}/>
        <b>生成扫码登录 QR 码</b>
        <span style={{ fontSize: 11, color: V.text3 }}>
          （用户扫码后自动登录，无需输入密码）
        </span>
      </label>

      {generateQr && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: V.text3, marginBottom: 4 }}>最多可登录设备数</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[1, 2, 3, 5, 10].map(n => (
                <PillBtn key={n} active={maxDevices===n} onClick={() => setMaxDevices(n)}>
                  {n}
                </PillBtn>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: V.text3, marginBottom: 4 }}>QR 有效期</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[7, 30, 90, 365, 0].map(d => (
                <PillBtn key={d} active={expiryDays===d} onClick={() => setExpiryDays(d)}>
                  {d === 0 ? '永不过期' : `${d} 天`}
                </PillBtn>
              ))}
            </div>
            <div style={{ fontSize: 10, color: V.text3, marginTop: 3 }}>
              过期后 QR 失效（但账号仍可用密码登录）
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: V.text3, marginBottom: 4 }}>
              {showLabelField ? '标签（可选）' : '标签前缀（批量自动加序号 #1、#2...）'}
            </div>
            <input value={label} onChange={e => setLabel(e.target.value)}
              placeholder={showLabelField ? '例: 李老师试用账号' : '例: 意大利侨民 2026 春'}
              maxLength={50}
              style={{ width: '100%', padding: '6px 10px', fontSize: 12,
                border: `1px solid ${V.border}`, borderRadius: 6, boxSizing: 'border-box' }}/>
          </div>
        </div>
      )}
    </div>
  );
}

function SingleForm({ call, creating, setCreating, qrOptions, label, onResult }) {
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
        ...qrOptions, label: label || null,
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

function BatchForm({ call, creating, setCreating, qrOptions, labelPrefix, onResults }) {
  const [names, setNames] = useState('');
  const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    const list = names.split('\n').map(n => n.trim()).filter(Boolean);
    if (list.length === 0) { setErr('请粘贴姓名（每行一个）'); return; }
    if (list.length > 100) { setErr('批量最多 100 个'); return; }
    setCreating(true);
    try {
      const data = await call({ mode: 'batch', names: list,
        ...qrOptions, labelPrefix: labelPrefix || null });
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
        用户名和密码会自动生成。{qrOptions.generateQrToken && '每个账号会生成独立 QR 码。'}
      </div>
    </div>
  );
}

function ResultsDisplay({ results }) {
  const [showQR, setShowQR] = useState(null);

  function copyRow(r) {
    let text = `${r.name}\n用户名: ${r.username}\n密码: ${r.password}`;
    if (r.qr_token) text += `\n扫码登录: ${buildQrUrl(r.qr_token)}`;
    navigator.clipboard?.writeText(text).then(() => alert('已复制'));
  }
  function copyAll() {
    const text = results.map(r => {
      let line = `${r.name} | ${r.username} | ${r.password}`;
      if (r.qr_token) line += ` | ${buildQrUrl(r.qr_token)}`;
      return line;
    }).join('\n');
    navigator.clipboard?.writeText(text).then(() => alert(`已复制 ${results.length} 条`));
  }
  function exportCSV() {
    const hasQR = results.some(r => r.qr_token);
    const header = hasQR ? 'name,username,password,qr_url' : 'name,username,password';
    const rows = results.map(r => {
      const base = `"${r.name}","${r.username}","${r.password}"`;
      return hasQR ? `${base},"${r.qr_token ? buildQrUrl(r.qr_token) : ''}"` : base;
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `accounts_${Date.now()}.csv`;
    a.click();
  }

  async function exportPDF() {
    const withQR = results.filter(r => r.qr_token);
    if (withQR.length === 0) { alert('没有可打印的 QR 码'); return; }
    const cards = await Promise.all(withQR.map(async r => {
      const url = buildQrUrl(r.qr_token);
      const dataUrl = await QRCode.toDataURL(url, { width: 200, margin: 1 });
      return { name: r.name, username: r.username, password: r.password,
               url, dataUrl };
    }));
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) { alert('请允许弹出窗口'); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>账号 QR 批量打印</title>
<style>
  body { font-family: sans-serif; padding: 20px; margin: 0; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 14px;
          text-align: center; page-break-inside: avoid; }
  .card img { width: 180px; height: 180px; }
  .name { font-size: 14px; font-weight: bold; margin: 6px 0 2px; }
  .creds { font-family: monospace; font-size: 11px; color: #555;
           background: #f5f5f5; padding: 4px 8px; border-radius: 4px;
           display: inline-block; margin: 4px 0; }
  .url { font-size: 8px; color: #999; word-break: break-all; margin-top: 4px; }
  h1 { font-size: 16px; color: #8B4513; margin: 0 0 16px; }
  @media print { .no-print { display: none; } }
  button { padding: 8px 16px; font-size: 13px; cursor: pointer; }
</style></head><body>
<div class="no-print" style="margin-bottom:14px;">
  <h1>账号 QR 码 · ${cards.length} 个</h1>
  <button onclick="window.print()">🖨 打印 / 另存为 PDF</button>
</div>
<div class="grid">
${cards.map(c => `
  <div class="card">
    <img src="${c.dataUrl}" alt="${c.username}"/>
    <div class="name">${c.name}</div>
    <div class="creds">${c.username} / ${c.password}</div>
    <div class="url">${c.url}</div>
  </div>
`).join('')}
</div>
</body></html>`);
    win.document.close();
  }

  return (
    <div style={{
      marginTop: 14, padding: 12, background: '#F1F8F4',
      border: '1px solid #A5D6A7', borderRadius: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: V.green }}>
          ✓ 成功创建 {results.length} 个账号
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={copyAll} style={miniBtn}>📋 复制全部</button>
          <button onClick={exportCSV} style={miniBtn}>⬇ CSV</button>
          {results.some(r => r.qr_token) &&
            <button onClick={exportPDF} style={miniBtn}>🖨 打印 QR</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
        {results.map((r, i) => (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr auto auto',
            gap: 8, alignItems: 'center', padding: '6px 8px',
            background: V.card, borderRadius: 6, fontSize: 12,
          }}>
            <div style={{ color: V.text2 }}>{r.name}</div>
            <code style={{ color: V.accent, fontWeight: 600 }}>{r.username}</code>
            <code style={{ color: V.text, background: V.bg,
              padding: '2px 6px', borderRadius: 4 }}>{r.password}</code>
            {r.qr_token
              ? <button onClick={() => setShowQR(r)} style={{ ...miniBtn, padding: '3px 8px' }}>
                  📱
                </button>
              : <span/>}
            <button onClick={() => copyRow(r)} style={{ ...miniBtn, padding: '3px 8px' }}>📋</button>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, color: V.text3, marginTop: 10, lineHeight: 1.4 }}>
        ⚠ 密码仅在此刻显示，刷新后无法再次查看。请立即复制并妥善保管。
      </div>

      {showQR && <QRModal result={showQR} onClose={() => setShowQR(null)}/>}
    </div>
  );
}

function QRModal({ result, onClose }) {
  const canvasRef = useRef(null);
  const url = buildQrUrl(result.qr_token);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, { width: 240, margin: 2 });
  }, [url]);

  function downloadPNG() {
    if (!canvasRef.current) return;
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL('image/png');
    a.download = `qr_${result.username}.png`;
    a.click();
  }

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 9999, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 20 }}>
      <div style={{ background: V.card, borderRadius: 12, padding: 24,
        textAlign: 'center', maxWidth: 340 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 15, color: V.accent }}>
          📱 {result.name}
        </h3>
        <div style={{ fontSize: 12, color: V.text2, marginBottom: 14 }}>
          扫码即可登录
        </div>
        <canvas ref={canvasRef} width={240} height={240}
          style={{ border: `1px solid ${V.border}`, borderRadius: 6 }}/>
        <div style={{ fontSize: 11, color: V.text3, marginTop: 10,
          wordBreak: 'break-all', lineHeight: 1.4 }}>
          {url}
        </div>
        <div style={{ marginTop: 8, padding: 8, background: V.bg, borderRadius: 6,
          fontFamily: 'monospace', fontSize: 12 }}>
          <div>用户名: <b>{result.username}</b></div>
          <div>密码: <b>{result.password}</b></div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
          <button onClick={downloadPNG} style={miniBtn}>⬇ PNG</button>
          <button onClick={() => navigator.clipboard?.writeText(url).then(() => alert('已复制'))}
            style={miniBtn}>🔗 复制链接</button>
          <button onClick={onClose} style={miniBtn}>关闭</button>
        </div>
      </div>
    </div>
  );
}

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

function PillBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', fontSize: 12,
      border: `1px solid ${active ? V.accent : V.border}`,
      background: active ? '#FFF8F0' : V.card,
      color: active ? V.accent : V.text, borderRadius: 5,
      cursor: 'pointer', fontWeight: active ? 500 : 400,
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

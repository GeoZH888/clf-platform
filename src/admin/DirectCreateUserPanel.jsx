// src/admin/DirectCreateUserPanel.jsx
// Admin panel section for directly creating user accounts.
// Now supports:
//   - Single/batch modes
//   - Optional QR-code quick-login token with expiry + max-device cap
//   - QR visualization, credentials copy, CSV export

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import QRCode from 'qrcode';
import InvitationCardModal from './InvitationCardModal.jsx';

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
      const dataUrl = await QRCode.toDataURL(url, {
        width: 280, margin: 1,
        color: { dark: '#2b1810', light: '#fdf6e3' },
      });
      return { name: r.name, username: r.username, password: r.password,
               url, dataUrl };
    }));
    const win = window.open('', '_blank', 'width=900,height=1000');
    if (!win) { alert('请允许弹出窗口'); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>邀请函 · 大卫学中文</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Songti SC','Source Han Serif SC','Noto Serif SC',serif;
         padding: 20px; margin: 0; background: #f0e4c4; }
  .no-print { margin-bottom: 20px; text-align: center; }
  .no-print h1 { color: #8B1A1A; margin: 0 0 10px; font-size: 18px; }
  .no-print button { padding: 10px 20px; font-size: 14px; cursor: pointer;
    background: #8B1A1A; color: #fdf6e3; border: none; border-radius: 6px;
    font-family: inherit; }

  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
  .card {
    background: linear-gradient(135deg, #fdf6e3 0%, #f5ecd4 100%);
    border: 2px solid #8B1A1A;
    padding: 28px 24px 22px;
    text-align: center;
    page-break-inside: avoid;
    position: relative;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  }
  /* Inner border frame */
  .card::before {
    content: '';
    position: absolute;
    inset: 6px;
    border: 1px solid rgba(139, 26, 26, 0.3);
    pointer-events: none;
  }
  /* Corner ornaments */
  .corner-tl, .corner-tr, .corner-bl, .corner-br {
    position: absolute;
    font-size: 14px;
    color: #8B1A1A;
    opacity: 0.7;
  }
  .corner-tl { top: 10px; left: 12px; }
  .corner-tr { top: 10px; right: 12px; }
  .corner-bl { bottom: 10px; left: 12px; }
  .corner-br { bottom: 10px; right: 12px; }

  .logo-cn { font-size: 22px; color: #8B1A1A; letter-spacing: 8px;
    font-weight: 600; margin-bottom: 2px;
    font-family: 'STKaiti','KaiTi','Kaiti SC',serif; }
  .logo-en { font-size: 9px; color: #6b4c2a; letter-spacing: 2px;
    text-transform: uppercase; margin-bottom: 14px; }

  .divider { width: 60%; margin: 0 auto; height: 1px;
    background: linear-gradient(to right, transparent, #8B1A1A, transparent);
    opacity: 0.4; margin-bottom: 14px; }

  .invitation-poem {
    font-family: 'STKaiti','KaiTi','Kaiti SC',serif;
    font-size: 13px; color: #2b1810; line-height: 1.8;
    margin: 10px 0 14px; letter-spacing: 2px;
  }
  .invitation-poem .line { display: block; }

  .qr-wrap { display: inline-block; padding: 8px;
    background: #fdf6e3; border: 1px solid #8B1A1A; margin: 6px 0; }
  .qr-wrap img { width: 160px; height: 160px; display: block; }
  .qr-hint { font-size: 10px; color: #6b4c2a; margin-top: 4px;
    letter-spacing: 4px; font-family: 'STKaiti','KaiTi',serif; }

  .name-banner {
    display: inline-block;
    padding: 4px 20px; margin: 10px 0 2px;
    border-top: 1px solid #8B1A1A; border-bottom: 1px solid #8B1A1A;
    font-size: 16px; color: #2b1810;
    font-family: 'STKaiti','KaiTi',serif;
    letter-spacing: 4px;
  }

  .creds {
    font-family: ui-monospace, 'Courier New', monospace;
    font-size: 10px; color: #3b2820;
    background: rgba(139, 26, 26, 0.05);
    padding: 6px 10px; border-radius: 3px;
    display: inline-block; margin: 8px 0 6px;
    border: 1px dashed rgba(139, 26, 26, 0.3);
  }
  .creds-row { margin: 1px 0; }
  .creds .label { color: #8B1A1A; font-family: 'STKaiti','KaiTi',serif;
    letter-spacing: 2px; margin-right: 4px; }

  .footer-divider { width: 40%; margin: 10px auto 6px; height: 1px;
    background: linear-gradient(to right, transparent, #8B1A1A, transparent);
    opacity: 0.3; }
  .footer { font-size: 9px; color: #6b4c2a; letter-spacing: 1px; }
  .footer .seal {
    display: inline-block; margin-top: 4px;
    width: 28px; height: 28px; border: 1.5px solid #8B1A1A;
    color: #8B1A1A; line-height: 24px; font-size: 11px;
    font-family: 'STKaiti','KaiTi',serif;
    border-radius: 2px;
  }

  @media print {
    body { padding: 10px; background: #fff; }
    .no-print { display: none; }
    .card { box-shadow: none; }
    .grid { gap: 14px; }
  }
</style></head><body>
<div class="no-print">
  <h1>邀请函 · ${cards.length} 份</h1>
  <button onclick="window.print()">🖨 打印 / 另存为 PDF</button>
</div>
<div class="grid">
${cards.map(c => `
  <div class="card">
    <span class="corner-tl">❦</span>
    <span class="corner-tr">❦</span>
    <span class="corner-bl">❦</span>
    <span class="corner-br">❦</span>

    <div class="logo-cn">大 卫 学 中 文</div>
    <div class="logo-en">David Learns Chinese</div>
    <div class="divider"></div>

    <div class="invitation-poem">
      <span class="line">敬邀君子</span>
      <span class="line">共 游 中 文 之 境</span>
    </div>

    <div class="qr-wrap">
      <img src="${c.dataUrl}" alt="${c.username}"/>
    </div>
    <div class="qr-hint">扫 码 启 程</div>

    <div class="name-banner">${c.name}</div>

    <div class="creds">
      <div class="creds-row"><span class="label">账户</span>${c.username}</div>
      <div class="creds-row"><span class="label">密钥</span>${c.password}</div>
    </div>

    <div class="footer-divider"></div>
    <div class="footer">
      佛罗伦萨 · Firenze · MMXXVI<br/>
      <span class="seal">印</span>
    </div>
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
            <button onClick={exportPDF} style={miniBtn}>🖨 打印邀请函</button>}
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

      {showQR && <InvitationCardModal result={showQR} onClose={() => setShowQR(null)}/>}
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

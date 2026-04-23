// src/admin/RegistrationInviteAdminTab.jsx
// Admin tab for creating and managing registration invite codes.
// Each code gets a QR encoding: https://<site>/register?invite=<code>
//
// Features:
//   - Batch generation (1-100 codes in one action)
//   - Per-batch config: max_uses per code, expiry, auto_approve, label prefix
//   - QR rendering (via qrcodejs loaded from CDN like your InviteManager does)
//   - Download individual QR as PNG
//   - Export all batch QRs as a printable PDF
//   - History list with used/remaining, delete

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

const V = {
  bg: '#fdf6e3', card: '#fff', border: '#e8d5b0',
  text: '#1a0a05', text2: '#6b4c2a', text3: '#a07850',
  accent: '#8B4513',
};

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

// Generate a random code — base32-alphabet (no 0/O/1/I for readability)
function generateCode(length = 8) {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default function RegistrationInviteAdminTab() {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBatch, setShowBatch] = useState(false);
  const [batchResults, setBatchResults] = useState([]);
  const [qrLibReady, setQrLibReady] = useState(!!window.QRCode);

  // Load QRCode.js library once
  useEffect(() => {
    if (window.QRCode) { setQrLibReady(true); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
    script.onload  = () => setQrLibReady(true);
    script.onerror = () => console.warn('QRCode library failed to load');
    document.head.appendChild(script);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('jgw_registration_invites')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) console.warn('[invites] load:', error.message);
    setInvites(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteInvite(code) {
    if (!confirm(`确定删除邀请码 "${code}"?`)) return;
    const { error } = await supabase
      .from('jgw_registration_invites').delete().eq('code', code);
    if (error) return alert('删除失败: ' + error.message);
    load();
  }

  return (
    <div style={{ padding: 0 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 16, color: V.accent, flex: 1 }}>
          📬 注册邀请码
        </h3>
        <button onClick={() => { setBatchResults([]); setShowBatch(true); }}
          style={btnPrimary}>
          ➕ 批量生成二维码
        </button>
      </div>

      <div style={{ fontSize: 11, color: V.text3, marginBottom: 14 }}>
        生成后的二维码可分享或打印。扫码用户将进入注册页面，邀请码自动填入。
      </div>

      {/* Invite list */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: V.text3 }}>加载中…</div>
      ) : invites.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: V.text3,
          background: V.card, borderRadius: 12, border: `1px dashed ${V.border}` }}>
          还没有邀请码 — 点击「批量生成」创建第一批
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {invites.map(inv => (
            <InviteRow key={inv.code} invite={inv}
              qrLibReady={qrLibReady}
              onDelete={() => deleteInvite(inv.code)}
              onRefresh={load}/>
          ))}
        </div>
      )}

      {/* Batch modal */}
      {showBatch && (
        <BatchGenerateModal
          onClose={() => { setShowBatch(false); setBatchResults([]); load(); }}
          onGenerated={(results) => setBatchResults(results)}
          qrLibReady={qrLibReady}
          results={batchResults}/>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Individual invite row
// ═══════════════════════════════════════════════════════════════════
function InviteRow({ invite, qrLibReady, onDelete, onRefresh }) {
  const [showQR, setShowQR] = useState(false);
  const url = `${BASE_URL}/register?invite=${invite.code}`;
  const isExhausted = invite.used_count >= invite.max_uses;
  const isExpired   = invite.expires_at && new Date(invite.expires_at) < new Date();

  return (
    <>
      <div style={{
        background: V.card, border: `1px solid ${V.border}`,
        borderRadius: 10, padding: '10px 12px',
        display: 'flex', gap: 10, alignItems: 'center',
        opacity: (isExhausted || isExpired) ? 0.6 : 1,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <code style={{ fontSize: 14, fontWeight: 600, color: V.accent }}>
              {invite.code}
            </code>
            {invite.auto_approve && (
              <span style={{ fontSize: 9, background: '#E8F5E9', color: '#2E7D32',
                padding: '1px 6px', borderRadius: 6 }}>
                ⚡ 直接开通
              </span>
            )}
            {!invite.auto_approve && (
              <span style={{ fontSize: 9, background: '#FFF8E1', color: '#E65100',
                padding: '1px 6px', borderRadius: 6 }}>
                需审核
              </span>
            )}
            {isExhausted && <span style={{ fontSize: 9, color: '#c62828' }}>已用完</span>}
            {isExpired && !isExhausted && <span style={{ fontSize: 9, color: '#c62828' }}>已过期</span>}
          </div>
          <div style={{ fontSize: 11, color: V.text3, marginTop: 2 }}>
            {invite.label && `${invite.label} · `}
            {invite.used_count}/{invite.max_uses} 已用
            {invite.expires_at && ` · 过期 ${new Date(invite.expires_at).toLocaleDateString()}`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowQR(true)} style={btnIcon} title="显示二维码">
            📱
          </button>
          <button onClick={() => navigator.clipboard?.writeText(url).then(() =>
            alert('已复制邀请链接'))} style={btnIcon} title="复制链接">
            🔗
          </button>
          <button onClick={onDelete} style={{ ...btnIcon, color: '#c62828' }} title="删除">
            ✕
          </button>
        </div>
      </div>

      {showQR && (
        <div style={modalOverlay} onClick={e => {
          if (e.target === e.currentTarget) setShowQR(false);
        }}>
          <div style={{ ...modalCard, maxWidth: 360 }}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0, fontSize: 15, color: V.accent }}>
                📱 {invite.code}
              </h3>
              <button onClick={() => setShowQR(false)} style={closeBtn}>✕</button>
            </div>
            <div style={{ padding: 20, textAlign: 'center' }}>
              <QRCanvas url={url} qrLibReady={qrLibReady} size={240}/>
              <div style={{ fontSize: 10, color: V.text3, marginTop: 8, wordBreak: 'break-all' }}>
                {url}
              </div>
              {invite.label && (
                <div style={{ fontSize: 12, color: V.text2, marginTop: 8,
                  fontWeight: 500 }}>{invite.label}</div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
                <button onClick={() => downloadQRCanvas(invite.code)}
                  style={btnSecondary}>⬇ 下载 PNG</button>
                <button onClick={() => navigator.clipboard?.writeText(url).then(() =>
                  alert('已复制'))} style={btnSecondary}>复制链接</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Batch generation modal
// ═══════════════════════════════════════════════════════════════════
function BatchGenerateModal({ onClose, onGenerated, qrLibReady, results }) {
  const [count, setCount] = useState(10);
  const [maxUses, setMaxUses] = useState(1);
  const [expiryDays, setExpiryDays] = useState(30);
  const [autoApprove, setAutoApprove] = useState(true);
  const [labelPrefix, setLabelPrefix] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  async function generate() {
    setGenerating(true);
    setError(null);

    try {
      // Build N rows
      const rows = [];
      for (let i = 0; i < count; i++) {
        rows.push({
          code: generateCode(8),
          max_uses: maxUses,
          auto_approve: autoApprove,
          label: labelPrefix ? `${labelPrefix} #${i + 1}` : null,
          expires_at: expiryDays > 0
            ? new Date(Date.now() + expiryDays * 864e5).toISOString()
            : null,
        });
      }

      const { data, error: err } = await supabase
        .from('jgw_registration_invites')
        .insert(rows)
        .select();
      if (err) throw err;

      onGenerated(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function exportPDF() {
    // Use browser print: open a new window with all QRs laid out, then print
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) { alert('请允许弹出窗口以导出 PDF'); return; }
    const html = `<!DOCTYPE html>
<html>
<head>
<title>邀请二维码批量打印</title>
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
<style>
  body { font-family: sans-serif; padding: 20px; margin: 0; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px;
          text-align: center; page-break-inside: avoid; }
  .code { font-family: monospace; font-weight: bold; font-size: 12px;
          color: #8B4513; margin-top: 4px; }
  .url { font-size: 9px; color: #999; word-break: break-all; margin-top: 4px; }
  .label { font-size: 11px; color: #555; margin-top: 2px; }
  h1 { font-size: 16px; color: #8B4513; margin: 0 0 16px; }
  @media print { .no-print { display: none; } }
  button { padding: 8px 16px; font-size: 13px; cursor: pointer; }
</style>
</head>
<body>
<div class="no-print" style="margin-bottom:14px;">
  <h1>邀请二维码 · ${results.length} 个</h1>
  <button onclick="window.print()">🖨 打印 / 另存为 PDF</button>
</div>
<div class="grid">
${results.map(r => `
  <div class="card">
    <canvas data-url="${BASE_URL}/register?invite=${r.code}" width="180" height="180"></canvas>
    <div class="code">${r.code}</div>
    ${r.label ? `<div class="label">${r.label}</div>` : ''}
    <div class="url">${BASE_URL}/register?invite=${r.code}</div>
  </div>
`).join('')}
</div>
<script>
window.addEventListener('load', () => {
  document.querySelectorAll('canvas[data-url]').forEach(c => {
    QRCode.toCanvas(c, c.dataset.url, { width: 180, margin: 1 });
  });
});
</script>
</body>
</html>`;
    win.document.write(html);
    win.document.close();
  }

  return (
    <div style={modalOverlay} onClick={e => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div style={{ ...modalCard, maxWidth: 600 }}>
        <div style={modalHeader}>
          <h3 style={{ margin: 0, fontSize: 16, color: V.accent }}>
            ➕ 批量生成邀请二维码
          </h3>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Generation form */}
          {results.length === 0 ? (
            <>
              <div style={{ display: 'grid', gap: 14 }}>
                <Row label="生成数量">
                  <input type="number" min={1} max={100}
                    value={count} onChange={e => setCount(+e.target.value)}
                    style={inputStyle}/>
                  <div style={{ fontSize: 10, color: V.text3, marginTop: 2 }}>
                    1-100 个（每个二维码独立）
                  </div>
                </Row>

                <Row label="每个二维码可用次数">
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[1, 5, 10, 30, 100].map(n => (
                      <Btn key={n} selected={maxUses === n}
                        onClick={() => setMaxUses(n)}>{n}</Btn>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: V.text3, marginTop: 4 }}>
                    1 = 每个 QR 只能用一次 · 30 = 一个 QR 可供全班使用
                  </div>
                </Row>

                <Row label="有效期（天）">
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[7, 30, 90, 365, 0].map(d => (
                      <Btn key={d} selected={expiryDays === d}
                        onClick={() => setExpiryDays(d)}>
                        {d === 0 ? '永不过期' : `${d} 天`}
                      </Btn>
                    ))}
                  </div>
                </Row>

                <Row label="标签前缀（可选）">
                  <input type="text" value={labelPrefix}
                    onChange={e => setLabelPrefix(e.target.value)}
                    placeholder="例: 孔子学院 · 2026春"
                    maxLength={50} style={inputStyle}/>
                  <div style={{ fontSize: 10, color: V.text3, marginTop: 2 }}>
                    自动追加 #1、#2...
                  </div>
                </Row>

                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start',
                  fontSize: 13, color: V.text2, padding: 10, background: '#E8F5E9',
                  borderRadius: 8, border: '1px solid #A5D6A7' }}>
                  <input type="checkbox" checked={autoApprove}
                    onChange={e => setAutoApprove(e.target.checked)}/>
                  <span>
                    <b>自动开通账号</b>（推荐）<br/>
                    <span style={{ fontSize: 11, color: V.text3 }}>
                      勾选后，扫码注册的用户立即可用。未勾选则需要管理员审核。
                    </span>
                  </span>
                </label>
              </div>

              {error && (
                <div style={{ marginTop: 12, padding: 10, background: '#FFEBEE',
                  color: '#c62828', borderRadius: 8, fontSize: 13 }}>
                  ⚠ {error}
                </div>
              )}

              <button onClick={generate} disabled={generating}
                style={{ ...btnPrimary, width: '100%', marginTop: 16 }}>
                {generating ? '生成中…' : `✨ 生成 ${count} 个二维码`}
              </button>
            </>
          ) : (
            /* ── Results: show all QRs ── */
            <>
              <div style={{ padding: 10, background: '#E8F5E9', borderRadius: 8,
                marginBottom: 14, fontSize: 13, color: '#2E7D32' }}>
                ✓ 成功生成 {results.length} 个邀请二维码
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <button onClick={exportPDF} style={btnSecondary}>
                  🖨 导出 PDF 打印
                </button>
                <button onClick={() => {
                  const csv = ['code,url,label,max_uses,expires_at',
                    ...results.map(r =>
                      `${r.code},${BASE_URL}/register?invite=${r.code},${r.label || ''},${r.max_uses},${r.expires_at || ''}`
                    )].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `invites_${Date.now()}.csv`;
                  a.click();
                }} style={btnSecondary}>
                  ⬇ CSV
                </button>
              </div>

              <div style={{ display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 10, maxHeight: 500, overflowY: 'auto' }}>
                {results.map(r => (
                  <div key={r.code} style={{
                    padding: 10, background: '#fdf6e3',
                    borderRadius: 8, border: `1px solid ${V.border}`,
                    textAlign: 'center',
                  }}>
                    <QRCanvas
                      url={`${BASE_URL}/register?invite=${r.code}`}
                      qrLibReady={qrLibReady} size={120}
                      canvasId={`batch_${r.code}`}/>
                    <div style={{ fontSize: 11, fontFamily: 'monospace',
                      fontWeight: 600, color: V.accent, marginTop: 4 }}>
                      {r.code}
                    </div>
                    {r.label && (
                      <div style={{ fontSize: 10, color: V.text3 }}>{r.label}</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  QR canvas with on-mount rendering
// ═══════════════════════════════════════════════════════════════════
function QRCanvas({ url, qrLibReady, size = 200, canvasId }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!qrLibReady || !window.QRCode || !canvasRef.current) return;
    window.QRCode.toCanvas(canvasRef.current, url, {
      width: size, margin: 1,
      color: { dark: '#1a0a05', light: '#fdf6e3' },
    }, (err) => { if (err) console.warn('QR render:', err); });
  }, [url, size, qrLibReady]);

  return (
    <canvas ref={canvasRef}
      id={canvasId}
      width={size} height={size}
      style={{ display: qrLibReady ? 'block' : 'none',
        margin: '0 auto', borderRadius: 6 }}/>
  );
}

// Download the QR image currently rendered on screen for a given code
function downloadQRCanvas(code) {
  // Try to find a canvas — in detail modal it's the only one, in batch it's id-tagged
  const canvas = document.querySelector(`canvas#batch_${code}`)
              || document.querySelector('canvas');
  if (!canvas) { alert('未找到二维码'); return; }
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `invite_${code}.png`;
  link.click();
}

// ── UI atoms ─────────────────────────────────────────────────────
function Row({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: V.text3, marginBottom: 5, fontWeight: 500 }}>{label}</div>
      {children}
    </div>
  );
}
function Btn({ selected, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', fontSize: 13,
      border: `2px solid ${selected ? V.accent : V.border}`,
      background: selected ? '#FFF8F0' : '#fff',
      color: selected ? V.accent : V.text,
      borderRadius: 6, cursor: 'pointer',
      fontWeight: selected ? 500 : 400,
    }}>{children}</button>
  );
}

const inputStyle = { width: '100%', padding: '8px 12px', fontSize: 13,
  border: `1px solid ${V.border}`, borderRadius: 8, boxSizing: 'border-box' };
const btnPrimary = { padding: '8px 16px', background: V.accent, color: '#fff',
  border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 };
const btnSecondary = { padding: '8px 16px', background: '#fff', color: V.accent,
  border: `1px solid ${V.accent}`, borderRadius: 8, cursor: 'pointer', fontSize: 13 };
const btnIcon = { padding: '4px 8px', background: V.bg, border: `1px solid ${V.border}`,
  borderRadius: 6, cursor: 'pointer', fontSize: 12 };
const closeBtn = { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' };
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };
const modalCard = { width: '100%', maxHeight: '90vh', overflow: 'auto',
  background: V.card, borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' };
const modalHeader = { padding: '12px 20px', borderBottom: `1px solid ${V.border}`,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center' };

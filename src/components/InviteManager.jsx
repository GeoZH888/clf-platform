// src/admin/InviteManager.jsx
// Admin panel tab for creating and managing QR invite codes

import { useState, useEffect, useRef } from 'react';import { supabase } from '../lib/supabase';

const BASE_URL = 'https://miaohong.netlify.app';

const V = {
  bg: '#fdf6e3', card: '#fff', border: '#e8d5b0',
  text: '#1a0a05', text2: '#6b4c2a', text3: '#a07850',
  verm: '#8B4513',
};

function QRCodeDisplay({ url }) {
  const canvasRef = useRef(null);
  const [qrReady, setQrReady] = useState(!!window.QRCode);

  useEffect(() => {
    if (window.QRCode) { setQrReady(true); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
    script.onload  = () => setQrReady(true);
    script.onerror = () => console.error('QRCode library failed to load');
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!qrReady || !url || !canvasRef.current) return;
    window.QRCode.toCanvas(canvasRef.current, url, {
      width: 200, margin: 2,
      color: { dark: '#1a0a05', light: '#fdf6e3' },
    }, (err) => { if (err) console.error('QR render error:', err); });
  }, [qrReady, url]);

  return (
    <div style={{ textAlign: 'center', padding: '1rem' }}>
      {!qrReady && (
        <div style={{ width: 200, height: 200, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: V.text3, fontSize: 12, margin: '0 auto',
          border: `1px solid ${V.border}`, borderRadius: 8 }}>
          Loading QR…
        </div>
      )}
      <canvas ref={canvasRef}
        style={{ borderRadius: 8, border: `1px solid ${V.border}`, display: qrReady ? 'block' : 'none', margin: '0 auto' }}/>
      <div style={{ fontSize: 11, color: V.text3, marginTop: 8, wordBreak: 'break-all', maxWidth: 220, margin: '8px auto 0' }}>
        {url}
      </div>
    </div>
  );
}

// ── Invitation Card ────────────────────────────────────────────────
function InvitationCard({ invite, url, onClose }) {
  const cardRef = useRef(null);
  const qrRef   = useRef(null);
  const [qrReady, setQrReady] = useState(false);
  const [qrError, setQrError] = useState(false);

  const expireDate   = new Date(invite.expires_at).toLocaleDateString('zh-CN',
    { year:'numeric', month:'long', day:'numeric' });
  const expireDateEn = new Date(invite.expires_at).toLocaleDateString('en-GB',
    { year:'numeric', month:'long', day:'numeric' });

  // Load QRCode lib and render
  useEffect(() => {
    function renderQR() {
      if (!qrRef.current || !window.QRCode) return;
      // Small delay ensures canvas is painted in DOM before render
      setTimeout(() => {
        if (!qrRef.current) return;
        window.QRCode.toCanvas(qrRef.current, url, {
          width: 200, margin: 2,
          color: { dark: '#1a0a05', light: '#fdf6e3' },
        }, (err) => { if (err) { console.error(err); setQrError(true); } else { setQrReady(true); } });
      }, 80);
    }
    if (window.QRCode) { renderQR(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
    s.onload  = renderQR;
    s.onerror = () => setQrError(true);
    document.head.appendChild(s);
  }, [url]);

  const handleDownload = () => {
    if (!cardRef.current) return;
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    s.onload = () => {
      window.html2canvas(cardRef.current, { scale: 3, useCORS: true, allowTaint: true })
        .then(canvas => {
          const a = document.createElement('a');
          a.download = `invite-${invite.label || 'card'}.png`;
          a.href = canvas.toDataURL('image/png');
          a.click();
        });
    };
    document.head.appendChild(s);
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Invite · ${invite.label}</title>
      <style>body{margin:0;display:flex;justify-content:center;align-items:center;
      min-height:100vh;background:#f0e8d8}@media print{body{background:white}}</style></head>
      <body>${cardRef.current.outerHTML}
      <script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`);
    w.document.close();
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.72)',
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', zIndex:300, padding:'1rem', gap:14, overflowY:'auto' }}
      onClick={onClose}>

      {/* Card — mobile-friendly max width */}
      <div ref={cardRef} onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 320, background: '#fdf6e3',
          borderRadius: 18, overflow: 'hidden',
          border: '2px solid #C8A050',
          fontFamily: "'STKaiti','KaiTi',Georgia,serif",
        }}>

        {/* Top decorative band */}
        <div style={{ background:'#8B1A1A', padding:'16px 18px 12px', textAlign:'center' }}>
          <div style={{ fontSize:26, color:'#fdf6e3', letterSpacing:2, lineHeight:1.3 }}>
            欢迎进入神奇的汉字世界
          </div>
          <div style={{ fontSize:11, color:'#F5C4B3', marginTop:6, letterSpacing:.5 }}>
            Welcome to the magical world of Chinese characters
          </div>
          <div style={{ fontSize:10, color:'#F5C4B3', marginTop:2, fontFamily:'Georgia,serif' }}>
            Benvenuto nel magico mondo dei caratteri cinesi
          </div>
        </div>

        {/* Decorative divider */}
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 24px' }}>
          <div style={{ flex:1, height:1, background:'#C8A050', opacity:0.5 }}/>
          <div style={{ fontSize:18, color:'#C8A050' }}>𝌆</div>
          <div style={{ flex:1, height:1, background:'#C8A050', opacity:0.5 }}/>
        </div>

        {/* Student name */}
        <div style={{ textAlign:'center', padding:'0 20px 8px' }}>
          <div style={{ fontSize:11, color:'#a07850', letterSpacing:2, marginBottom:4 }}>
            专属邀请 · PERSONAL INVITE
          </div>
          <div style={{ fontSize:22, color:'#1a0a05', fontWeight:500, letterSpacing:1 }}>
            {invite.label || 'Guest'}
          </div>
        </div>

        {/* QR code */}
        <div style={{ display:'flex', justifyContent:'center', padding:'8px 20px 10px' }}>
          <div style={{ background:'#fdf6e3', padding:8, borderRadius:12,
            border:'1.5px solid #C8A050', width:216, height:216,
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            {qrError ? (
              <div style={{ fontSize:12, color:'#a07850', textAlign:'center' }}>
                ⚠️ QR unavailable<br/>
                <span style={{ fontSize:10, color:'#c0392b' }}>Try refreshing</span>
              </div>
            ) : (
              <>
                {!qrReady && (
                  <div style={{ fontSize:11, color:'#a07850' }}>Loading…</div>
                )}
                <canvas ref={qrRef} style={{ display: qrReady ? 'block' : 'none', borderRadius:4 }}/>
              </>
            )}
          </div>
        </div>

        {/* Scan instruction */}
        <div style={{ textAlign:'center', fontSize:11, color:'#a07850', padding:'0 20px 8px', lineHeight:1.7 }}>
          扫码即可开始学习 · Scan to start learning<br/>
          <span style={{ fontFamily:'Georgia,serif' }}>Scansiona per iniziare</span>
        </div>

        {/* Bottom band */}
        <div style={{ background:'#f0e0c0', borderTop:'1px solid #C8A050',
          padding:'10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:11, color:'#6b4c2a' }}>
            <div style={{ letterSpacing:1, marginBottom:2 }}>有效期至 · Valid until</div>
            <div style={{ fontSize:12, fontWeight:500, color:'#8B1A1A' }}>{expireDate}</div>
          </div>
          <div style={{ fontSize:22, color:'#C8A050', opacity:0.6 }}>🐢</div>
          <div style={{ fontSize:10, color:'#a07850', textAlign:'right', fontFamily:'Georgia,serif' }}>
            <div>Expires</div>
            <div style={{ fontSize:11, fontWeight:500, color:'#8B1A1A' }}>{expireDateEn}</div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display:'flex', gap:10 }} onClick={e => e.stopPropagation()}>
        <button onClick={handlePrint}
          style={{ padding:'9px 20px', fontSize:13, cursor:'pointer', borderRadius:10,
            border:'1px solid #fdf6e3', background:'transparent', color:'#fdf6e3' }}>
          🖨 Print
        </button>
        <button onClick={handleDownload}
          style={{ padding:'9px 20px', fontSize:13, cursor:'pointer', borderRadius:10,
            border:'none', background:'#C8A050', color:'#1a0a05', fontWeight:500 }}>
          ↓ Save image
        </button>
        <button onClick={() => navigator.clipboard?.writeText(url).then(() => alert('Link copied!'))}
          style={{ padding:'9px 20px', fontSize:13, cursor:'pointer', borderRadius:10,
            border:'1px solid #fdf6e3', background:'transparent', color:'#fdf6e3' }}>
          Copy link
        </button>
        <button onClick={onClose}
          style={{ padding:'9px 20px', fontSize:13, cursor:'pointer', borderRadius:10,
            border:'none', background:'#8B1A1A', color:'#fdf6e3' }}>
          Close
        </button>
      </div>
    </div>
  );
}


export default function InviteManager() {
  const [invites,    setInvites]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [label,      setLabel]      = useState('');
  const [days,       setDays]       = useState(30);
  const [creating,   setCreating]   = useState(false);
  const [showQR,     setShowQR]     = useState(null);
  const [batchMode,  setBatchMode]  = useState(false);
  const [batchNames, setBatchNames] = useState('');
  const [batchLog,   setBatchLog]   = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('jgw_invites')
      .select('*, jgw_device_sessions(id, last_seen)')
      .order('created_at', { ascending: false })
      .limit(50);
    setInvites(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!label.trim()) return;
    setCreating(true);
    const expires = new Date();
    expires.setDate(expires.getDate() + days);
    const { error } = await supabase.from('jgw_invites').insert({
      label: label.trim(), expires_at: expires.toISOString(),
    });
    if (!error) { setLabel(''); await load(); }
    else alert('Error: ' + error.message);
    setCreating(false);
  };

  const createBatch = async () => {
    const names = batchNames.split('\n').map(n => n.trim()).filter(Boolean);
    if (!names.length) return;
    setCreating(true);
    setBatchLog('');
    const expires = new Date();
    expires.setDate(expires.getDate() + days);
    const rows = names.map(name => ({ label: name, expires_at: expires.toISOString() }));
    const { data, error } = await supabase.from('jgw_invites').insert(rows).select('label, token');
    if (error) { alert('Batch error: ' + error.message); }
    else {
      setBatchLog(data.map(r =>
        `${r.label}: ${BASE_URL}/?invite=${r.token}`
      ).join('\n'));
      setBatchNames('');
      await load();
    }
    setCreating(false);
  };

  const revoke = async (id) => {
    if (!confirm('Revoke this invite? The user will lose access.')) return;
    await supabase.from('jgw_device_sessions').delete().eq('invite_id', id);
    await supabase.from('jgw_invites').delete().eq('id', id);
    load();
  };

  const getInviteUrl = (token) => `${BASE_URL}/?invite=${token}`;

  const statusOf = (inv) => {
    const d = Math.ceil((new Date(inv.expires_at) - new Date()) / 86400000);
    if (d <= 0)  return { label: 'Expired',              color: '#c0392b', bg: '#FFEBEE' };
    if (d <= 7)  return { label: `⏳ ${d}d left`,        color: '#E65100', bg: '#FFF3E0' };
    if (inv.used_at) return { label: `Active · ${d}d`,   color: '#2E7D32', bg: '#e8f5e9' };
    return             { label: `Unused · ${d}d`,        color: '#1565C0', bg: '#E3F2FD' };
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: V.text }}>
        🔑 Invite Manager
      </div>

      {/* Create form */}
      <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 12, padding: '1rem', marginBottom: 20 }}>

        {/* Mode toggle */}
        <div style={{ display:'flex', gap:6, marginBottom:12 }}>
          {[['single','Single invite'],['batch','Batch (class list)']].map(([m, lbl]) => (
            <button key={m} type="button" onClick={() => setBatchMode(m === 'batch')}
              style={{ padding:'5px 14px', fontSize:12, cursor:'pointer', borderRadius:20,
                border:`1px solid ${batchMode===(m==='batch') ? V.verm : V.border}`,
                background: batchMode===(m==='batch') ? V.verm : V.bg,
                color: batchMode===(m==='batch') ? '#fdf6e3' : V.text2 }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* Expires in — shared */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:4 }}>Expires in (days)</label>
          <input type="number" value={days} min={1} max={365}
            onChange={e => setDays(Number(e.target.value))}
            style={{ width:100, padding:'7px 10px', fontSize:13, borderRadius:8,
              border:`1px solid ${V.border}`, boxSizing:'border-box' }}/>
        </div>

        {!batchMode ? (
          /* Single */
          <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:160 }}>
              <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:4 }}>Student name</label>
              <input value={label} onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Marco Rossi"
                onKeyDown={e => e.key === 'Enter' && create()}
                style={{ width:'100%', padding:'8px 10px', fontSize:13, borderRadius:8,
                  border:`1px solid ${V.border}`, boxSizing:'border-box' }}/>
            </div>
            <button onClick={create} disabled={creating || !label.trim()}
              style={{ padding:'8px 18px', fontSize:13, cursor:'pointer', borderRadius:8,
                border:'none', background:V.verm, color:'#fdf6e3', fontWeight:500 }}>
              {creating ? 'Creating…' : '+ Generate QR'}
            </button>
          </div>
        ) : (
          /* Batch */
          <div>
            <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:4 }}>
              One name per line — generates one QR per student
            </label>
            <textarea value={batchNames} onChange={e => setBatchNames(e.target.value)}
              rows={6} placeholder={"Marco Rossi\nLei Zhang\nSofia Bianchi\n…"}
              style={{ width:'100%', padding:'8px 10px', fontSize:13, borderRadius:8,
                border:`1px solid ${V.border}`, boxSizing:'border-box', resize:'vertical', fontFamily:'monospace' }}/>
            <div style={{ display:'flex', gap:8, marginTop:8, alignItems:'center' }}>
              <button onClick={createBatch} disabled={creating || !batchNames.trim()}
                style={{ padding:'8px 18px', fontSize:13, cursor:'pointer', borderRadius:8,
                  border:'none', background:V.verm, color:'#fdf6e3', fontWeight:500 }}>
                {creating ? 'Creating…' : `+ Create ${batchNames.split('\n').filter(n=>n.trim()).length} invites`}
              </button>
              {batchLog && (
                <button onClick={() => navigator.clipboard?.writeText(batchLog)}
                  style={{ padding:'8px 14px', fontSize:12, cursor:'pointer', borderRadius:8,
                    border:`1px solid ${V.border}`, background:V.bg, color:V.text2 }}>
                  Copy all links
                </button>
              )}
            </div>
            {batchLog && (
              <textarea readOnly value={batchLog} rows={5}
                style={{ width:'100%', marginTop:10, padding:'8px', fontSize:11, borderRadius:8,
                  border:`1px solid ${V.border}`, boxSizing:'border-box', fontFamily:'monospace',
                  background:'#f5f5f5', resize:'none', color:'#333' }}/>
            )}
          </div>
        )}
      </div>

      {/* ── Invitation Card Modal ── */}
      {showQR && (
        <InvitationCard
          invite={showQR}
          url={getInviteUrl(showQR.token)}
          onClose={() => setShowQR(null)}
        />
      )}

      {/* Invites list */}
      {loading ? <div style={{ color: V.text3 }}>Loading…</div> : (
        <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {invites.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: V.text3, fontSize: 13 }}>
              No invites yet. Create one above.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5ede0' }}>
                  {['Label', 'Status', 'Expires', 'Last seen', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: V.text3, fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invites.map(inv => {
                  const st = statusOf(inv);
                  const session = inv.jgw_device_sessions?.[0];
                  return (
                    <tr key={inv.id} style={{ borderBottom: `1px solid ${V.border}` }}>
                      <td style={{ padding: '10px', fontWeight: 500, color: V.text }}>{inv.label || '—'}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
                          background: st.bg, color: st.color, fontWeight: 500 }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px', color: V.text2, fontSize: 12 }}>
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '10px', color: V.text3, fontSize: 11 }}>
                        {session?.last_seen
                          ? new Date(session.last_seen).toLocaleDateString()
                          : inv.used_at ? 'Registered' : '—'}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setShowQR(inv)}
                            style={{ padding: '4px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 6,
                              border: `1px solid ${V.border}`, background: V.bg, color: V.text2 }}>
                            QR
                          </button>
                          <button onClick={() => navigator.clipboard?.writeText(getInviteUrl(inv.token))}
                            style={{ padding: '4px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 6,
                              border: `1px solid ${V.border}`, background: V.bg, color: V.text2 }}>
                            Copy
                          </button>
                          <button onClick={() => revoke(inv.id)}
                            style={{ padding: '4px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 6,
                              border: '1px solid #ffcccc', background: '#fff', color: '#c0392b' }}>
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

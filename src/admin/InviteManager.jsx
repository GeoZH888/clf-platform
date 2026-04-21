// src/admin/InviteManager.jsx
// Admin panel tab for creating and managing QR invite codes

import { useState, useEffect, useRef } from 'react';import { supabase } from '../lib/supabase';

const BASE_URL = 'https://miaohong.netlify.app';

const V = {
  bg: '#fdf6e3', card: '#fff', border: '#e8d5b0',
  text: '#1a0a05', text2: '#6b4c2a', text3: '#a07850',
  verm: '#8B4513', green: '#2E7D32',
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
function InvitationCard({ invite, url, onClose, showName: initialShowName = true }) {
  const cardRef = useRef(null);
  const [showName, setShowName] = useState(initialShowName);
  const [pandaUrl, setPandaUrl] = useState(null);

  useEffect(() => {
    supabase.from('jgw_panda_assets').select('image_url')
      .then(({ data }) => {
        if (data?.length) {
          const pick = data[Math.floor(Math.random() * data.length)];
          if (pick?.image_url) setPandaUrl(pick.image_url);
        }
      });
  }, []);

  const expireDate   = new Date(invite.expires_at).toLocaleDateString('zh-CN',
    { year:'numeric', month:'long', day:'numeric' });
  const expireDateEn = new Date(invite.expires_at).toLocaleDateString('en-GB',
    { year:'numeric', month:'long', day:'numeric' });

  // QR code via image API — no library, no canvas, no timing issues
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=200x200&bgcolor=fdf6e3&color=1a0a05&margin=10&qzone=1`;

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

      <div ref={cardRef} onClick={e => e.stopPropagation()}
        style={{ width:'100%', maxWidth:320, background:'#fdf6e3',
          borderRadius:18, overflow:'hidden', border:'2px solid #C8A050',
          fontFamily:"'STKaiti','KaiTi',Georgia,serif" }}>

        {/* Header */}
        <div style={{ background:'#8B1A1A', padding:'14px 16px 10px', textAlign:'center' }}>
          <div style={{ fontSize:20, color:'#fdf6e3', letterSpacing:1,
            fontFamily:"'STKaiti','KaiTi',Georgia,serif" }}>
            大卫学中文
          </div>
          <div style={{ fontSize:10, color:'#F5C4B3', marginTop:5, letterSpacing:.3 }}>
            David Learns Chinese · Imparare il Cinese
          </div>
          <div style={{ fontSize:10, color:'#F5C4B3', marginTop:2, fontFamily:'Georgia,serif' }}>
            Benvenuto nel magico mondo dei caratteri cinesi
          </div>
        </div>

        {/* Divider */}
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 24px' }}>
          <div style={{ flex:1, height:1, background:'#C8A050', opacity:.5 }}/>
          <div style={{ fontSize:16, color:'#C8A050' }}>龜</div>
          <div style={{ flex:1, height:1, background:'#C8A050', opacity:.5 }}/>
        </div>

        {/* Name — optional */}
        {showName && (
          <div style={{ textAlign:'center', padding:'0 20px 6px' }}>
            <div style={{ fontSize:11, color:'#a07850', letterSpacing:2, marginBottom:4 }}>
              专属邀请 · PERSONAL INVITE
            </div>
            <div style={{ fontSize:20, color:'#1a0a05', fontWeight:500, letterSpacing:1 }}>
              {invite.label || 'Guest'}
            </div>
          </div>
        )}

        {/* QR code — simple img tag */}
        <div style={{ display:'flex', justifyContent:'center', padding:'8px 20px 8px' }}>
          <div style={{ background:'#fdf6e3', padding:8, borderRadius:12, border:'1.5px solid #C8A050' }}>
            <img src={qrSrc} alt="QR code" width={200} height={200}
              style={{ display:'block', borderRadius:4 }}
              crossOrigin="anonymous"/>
          </div>
        </div>

        {/* Scan hint */}
        <div style={{ textAlign:'center', fontSize:11, color:'#a07850', padding:'0 20px 8px', lineHeight:1.8 }}>
          扫码即可开始学习 · Scan to start learning<br/>
          <span style={{ fontFamily:'Georgia,serif' }}>Scansiona per iniziare</span>
        </div>

        {/* Footer */}
        <div style={{ background:'#f0e0c0', borderTop:'1px solid #C8A050',
          padding:'10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:11, color:'#6b4c2a' }}>
            <div style={{ letterSpacing:1, marginBottom:2 }}>有效期至 · Valid until</div>
            <div style={{ fontSize:12, fontWeight:500, color:'#8B1A1A' }}>{expireDate}</div>
          </div>
          <div style={{ width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {pandaUrl
              ? <img src={pandaUrl} alt="panda" style={{ width:34, height:34, objectFit:'contain' }}/>
              : <span style={{ fontSize:22, color:'#C8A050', opacity:.7 }}>🐼</span>}
          </div>
          <div style={{ fontSize:10, color:'#a07850', textAlign:'right', fontFamily:'Georgia,serif' }}>
            <div>Expires</div>
            <div style={{ fontSize:11, fontWeight:500, color:'#8B1A1A' }}>{expireDateEn}</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center' }}
        onClick={e => e.stopPropagation()}>
        <button onClick={() => setShowName(n => !n)}
          style={{ padding:'9px 18px', fontSize:13, cursor:'pointer', borderRadius:10,
            border:'1px solid #fdf6e3', background: showName ? 'rgba(255,255,255,0.2)' : 'transparent',
            color:'#fdf6e3' }}>
          {showName ? '👤 Hide name' : '👤 Show name'}
        </button>
        <button onClick={handlePrint}
          style={{ padding:'9px 18px', fontSize:13, cursor:'pointer', borderRadius:10,
            border:'1px solid #fdf6e3', background:'transparent', color:'#fdf6e3' }}>
          🖨 Print
        </button>
        <button onClick={handleDownload}
          style={{ padding:'9px 18px', fontSize:13, cursor:'pointer', borderRadius:10,
            border:'none', background:'#C8A050', color:'#1a0a05', fontWeight:500 }}>
          ↓ Save image
        </button>
        <button onClick={() => navigator.clipboard?.writeText(url).then(() => alert('Link copied!'))}
          style={{ padding:'9px 18px', fontSize:13, cursor:'pointer', borderRadius:10,
            border:'1px solid #fdf6e3', background:'transparent', color:'#fdf6e3' }}>
          Copy link
        </button>
        <button onClick={onClose}
          style={{ padding:'9px 18px', fontSize:13, cursor:'pointer', borderRadius:10,
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
  const [username,   setUsername]   = useState('');
  const [password,   setPassword]   = useState('');
  const [email,      setEmail]      = useState('');
  const [phone,      setPhone]      = useState('');
  const [days,       setDays]       = useState(30);
  const [maxDevices, setMaxDevices] = useState(2);
  const [selModules, setSelModules] = useState(['lianzi','pinyin']);
  const [creating,   setCreating]   = useState(false);
  const [pandaMap,   setPandaMap]   = useState({});
  const [allPandas,  setAllPandas]  = useState([]); // all panda assets for random pick
  const [copiedId,   setCopiedId]   = useState(null);

  const ALL_MODULES = [
    { id:'lianzi',  emotion:'writing', fallback:'✍️', label:'练字' },
    { id:'pinyin',  emotion:'pinyin',  fallback:'🔤', label:'拼音' },
    { id:'words',   emotion:'words',   fallback:'📝', label:'词组' },
    // 成语: try 'chengyu' emotion first, fall back to 'reading', then random
    { id:'chengyu', emotion:'chengyu', fallback:'📜', label:'成语' },
    { id:'grammar', emotion:'grammar', fallback:'📐', label:'语法' },
    { id:'hsk',     emotion:'hsk',     fallback:'🎓', label:'HSK' },
    { id:'poetry',  emotion:'poetry',  fallback:'📜', label:'诗歌' },
    { id:'games',   emotion:'games',   fallback:'🎮', label:'游戏' },
  ];

  // Load panda icons from Panda Studio
  useEffect(() => {
    supabase.from('jgw_panda_assets').select('emotion, image_url')
      .then(({ data }) => {
        if (data) {
          const map = {};
          data.forEach(r => { map[r.emotion] = r.image_url; });
          setPandaMap(map);
          setAllPandas(data.map(r => r.image_url).filter(Boolean));
        }
      }).catch(() => {});
  }, []);

  // Get panda icon for a module — tries emotion, then 'reading', then random
  function getPandaIcon(mod) {
    return pandaMap[mod.emotion]
      || pandaMap['reading']
      || allPandas[ALL_MODULES.findIndex(m=>m.id===mod.id) % Math.max(allPandas.length,1)]
      || null;
  }

  // Auto-generate username from label
  useEffect(() => {
    if (label.trim()) {
      setUsername(label.trim().toLowerCase()
        .replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '').slice(0, 20));
    }
  }, [label]);

  function genPassword() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({length: 8}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  useEffect(() => { setPassword(genPassword()); }, []);

  function toggleModule(id) {
    setSelModules(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  }
  const [showQR,     setShowQR]     = useState(null);
  const [showName,   setShowName]   = useState(true);
  const [batchMode,  setBatchMode]  = useState(false);
  const [editInvite, setEditInvite] = useState(null); // invite being edited
  const [editForm,   setEditForm]   = useState({});

  function startEdit(inv) {
    setEditInvite(inv.id);
    setEditForm({
      label:       inv.label || '',
      max_devices: inv.max_devices || 1,
      modules:     inv.modules || ['lianzi','pinyin'],
      expires_at:  inv.expires_at?.slice(0,10) || '',
    });
  }

  async function saveEdit(invId) {
    await supabase.from('jgw_invites').update({
      label:       editForm.label,
      max_devices: editForm.max_devices,
      modules:     editForm.modules,
      expires_at:  new Date(editForm.expires_at).toISOString(),
    }).eq('id', invId);
    setEditInvite(null);
    load();
  }

  function toggleEditModule(id) {
    setEditForm(f => ({
      ...f,
      modules: f.modules.includes(id)
        ? f.modules.filter(m => m !== id)
        : [...f.modules, id],
    }));
  }
  const [batchNames,   setBatchNames]   = useState('');
  const [batchResults, setBatchResults] = useState([]); // [{label,username,password}]
  const [copiedBatch,  setCopiedBatch]  = useState(false);

  const createBatch = async () => {
    const names = batchNames.split('\n').map(n => n.trim()).filter(Boolean);
    if (!names.length) return;
    setCreating(true);
    setBatchResults([]);
    const expires = new Date();
    expires.setDate(expires.getDate() + days);

    // Generate username + password for each student
    const rows = names.map(name => {
      const uname = name.toLowerCase()
        .replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '').slice(0, 20);
      const pw = genPassword();
      return {
        label:       name,
        username:    uname,
        password:    pw,
        expires_at:  expires.toISOString(),
        max_devices: maxDevices,
        modules:     selModules,
      };
    });

    const { data, error } = await supabase.from('jgw_invites').insert(rows).select();
    if (error) {
      alert('Batch error: ' + error.message);
    } else {
      setBatchResults(data.map(r => ({
        label:    r.label,
        username: r.username,
        password: r.password,
        token:    r.token,
      })));
      setBatchNames('');
      await load();
    }
    setCreating(false);
  };

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
    const { error, data: newInvite } = await supabase.from('jgw_invites').insert({
      label: label.trim(),
      username: username.trim() || label.trim().toLowerCase().replace(/\s+/g,'.'),
      password: password.trim() || genPassword(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      expires_at: expires.toISOString(),
      max_devices: maxDevices,
      modules: selModules,
    }).select().maybeSingle();
    if (!error) {
      setLabel(''); setEmail(''); setPhone('');
      setPassword(genPassword());
      await load();
    } else { alert('Error: ' + error.message); }
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

        {/* Show name on card toggle */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
          <input type="checkbox" id="showName" checked={showName}
            onChange={e => setShowName(e.target.checked)}
            style={{ cursor:'pointer' }}/>
          <label htmlFor="showName" style={{ fontSize:12, color:V.text2, cursor:'pointer' }}>
            Show student name on invitation card
            <span style={{ color:V.text3, marginLeft:6 }}>
              (uncheck for anonymous batch cards)
            </span>
          </label>
        </div>

          {/* Module access */}
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:6 }}>
              Modules access
            </label>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {ALL_MODULES.map(m => {
                const active = selModules.includes(m.id);
                const icon = getPandaIcon(m);
                return (
                  <button key={m.id} type="button" onClick={() => toggleModule(m.id)}
                    style={{ padding:'6px 14px', borderRadius:20, cursor:'pointer',
                      border:`1.5px solid ${active ? V.verm : V.border}`,
                      background: active ? V.verm : V.bg,
                      color: active ? '#fdf6e3' : V.text2,
                      fontSize:13, fontWeight:500,
                      display:'flex', gap:6, alignItems:'center' }}>
                    {icon
                      ? <img src={icon} alt={m.label} style={{ width:20, height:20, objectFit:'contain', borderRadius:4 }}/>
                      : <span>{m.fallback}</span>}
                    {m.label}{active ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>

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

        {/* Expires + max devices row */}
        <div style={{ display:'flex', gap:12, marginBottom:10, flexWrap:'wrap' }}>
          <div>
            <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:4 }}>
              Expires in (days)
            </label>
            <input type="number" value={days} min={1} max={365}
              onChange={e => setDays(Number(e.target.value))}
              style={{ width:100, padding:'7px 10px', fontSize:13, borderRadius:8,
                border:`1px solid ${V.border}`, boxSizing:'border-box' }}/>
          </div>
          <div>
            <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:4 }}>
              Max devices 📱💻
            </label>
            <div style={{ display:'flex', gap:6 }}>
              {[1,2,3,5].map(n => (
                <button key={n} type="button" onClick={() => setMaxDevices(n)}
                  style={{ width:36, height:34, borderRadius:8, cursor:'pointer',
                    border:`1.5px solid ${maxDevices===n ? V.verm : V.border}`,
                    background: maxDevices===n ? V.verm : V.bg,
                    color: maxDevices===n ? '#fdf6e3' : V.text2,
                    fontSize:13, fontWeight:500 }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!batchMode ? (
          /* Single */
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {/* Row 1: name + username + password */}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <div style={{ flex:2, minWidth:160 }}>
                <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:4 }}>学生姓名 Student name</label>
                <input value={label} onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Marco Rossi"
                  onKeyDown={e => e.key === 'Enter' && create()}
                  style={{ width:'100%', padding:'8px 10px', fontSize:13, borderRadius:8,
                    border:`1px solid ${V.border}`, boxSizing:'border-box' }}/>
              </div>
              <div style={{ flex:1, minWidth:120 }}>
                <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:4 }}>用户名 Username</label>
                <input value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="marco.rossi"
                  style={{ width:'100%', padding:'8px 10px', fontSize:13, borderRadius:8,
                    border:`1px solid ${V.border}`, boxSizing:'border-box', fontFamily:'monospace' }}/>
              </div>
              <div style={{ flex:1, minWidth:120 }}>
                <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:4 }}>
                  密码 Password
                  <button type="button" onClick={() => setPassword(genPassword())}
                    style={{ marginLeft:6, fontSize:10, color:V.verm, border:'none',
                      background:'none', cursor:'pointer', padding:0 }}>↺</button>
                </label>
                <input value={password} onChange={e => setPassword(e.target.value)}
                  style={{ width:'100%', padding:'8px 10px', fontSize:13, borderRadius:8,
                    border:`1px solid ${V.border}`, boxSizing:'border-box',
                    fontFamily:'monospace', background:'#fffde7' }}/>
              </div>
            </div>

            {/* Row 2: email + phone */}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <div style={{ flex:2, minWidth:180 }}>
                <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:4 }}>
                  📧 邮箱 Email <span style={{ opacity:0.6, fontSize:10 }}>(可选 optional)</span>
                </label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="student@example.com"
                  style={{ width:'100%', padding:'8px 10px', fontSize:13, borderRadius:8,
                    border:`1px solid ${V.border}`, boxSizing:'border-box' }}/>
              </div>
              <div style={{ flex:1, minWidth:140 }}>
                <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:4 }}>
                  📱 手机 Phone <span style={{ opacity:0.6, fontSize:10 }}>(可选)</span>
                </label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+39 333 123 4567"
                  style={{ width:'100%', padding:'8px 10px', fontSize:13, borderRadius:8,
                    border:`1px solid ${V.border}`, boxSizing:'border-box' }}/>
              </div>
            </div>

            {/* Row 3: action buttons */}
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <button onClick={create} disabled={creating || !label.trim()}
                style={{ padding:'9px 20px', fontSize:13, cursor:'pointer', borderRadius:8,
                  border:'none', background:V.verm, color:'#fdf6e3', fontWeight:500 }}>
                {creating ? 'Creating…' : '+ Create Account'}
              </button>

              {label && username && password && (<>
                {/* Copy credentials */}
                <button onClick={() => {
                  const msg = `大卫学中文 · David Learns Chinese\n\n学生 Student: ${label}\n\n🔗 \n👤 用户名: ${username}\n🔑 密码:   ${password}\n\n用以上账号登录，开始学习中文！`;
                  navigator.clipboard?.writeText(msg);
                  setCopiedId('new'); setTimeout(()=>setCopiedId(null),2000);
                }} style={{ padding:'8px 14px', fontSize:12, cursor:'pointer', borderRadius:8,
                  border:`1px solid ${V.border}`, background:V.bg,
                  color:copiedId==='new'?V.green:V.text2 }}>
                  {copiedId==='new'?'✓ Copied!':'📋 Copy msg'}
                </button>

                {/* Send email (mailto link) */}
                {email && (
                  <a href={`mailto:${email}?subject=${encodeURIComponent('大卫学中文 登录信息')}&body=${encodeURIComponent(
                    `亲爱的 ${label}，\n\n您的大卫学中文账号已创建：\n\nApp: \n用户名 Username: ${username}\n密码 Password: ${password}\n\n请妥善保管登录信息。祝学习顺利！\n\nCaro/a ${label},\nIl tuo account è stato creato.\n\nApp: \nUsername: ${username}\nPassword: ${password}`
                  )}`}
                    style={{ padding:'8px 14px', fontSize:12, borderRadius:8,
                      border:'1px solid #BBDEFB', background:'#E3F2FD',
                      color:'#1565C0', textDecoration:'none', display:'inline-block' }}>
                    📧 Send email
                  </a>
                )}

                {/* WhatsApp link */}
                {phone && (
                  <a href={`https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(
                    `大卫学中文 登录信息\n\nApp: \n用户名: ${username}\n密码: ${password}`
                  )}`} target="_blank" rel="noreferrer"
                    style={{ padding:'8px 14px', fontSize:12, borderRadius:8,
                      border:'1px solid #A5D6A7', background:'#E8F5E9',
                      color:'#2E7D32', textDecoration:'none', display:'inline-block' }}>
                    💬 WhatsApp
                  </a>
                )}
              </>)}
            </div>
          </div>
        ) : (
          /* Batch */
          <div>
            <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:4 }}>
              One name per line — generates one QR per student
            </label>
            <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:4 }}>
              每行一个学生姓名 · One name per line
            </label>
            <textarea value={batchNames} onChange={e => setBatchNames(e.target.value)}
              rows={6} placeholder={"Marco Rossi\nLei Zhang\nSofia Bianchi\n…"}
              style={{ width:'100%', padding:'8px 10px', fontSize:13, borderRadius:8,
                border:`1px solid ${V.border}`, boxSizing:'border-box', resize:'vertical', fontFamily:'monospace' }}/>

            <div style={{ display:'flex', gap:8, marginTop:8, alignItems:'center', flexWrap:'wrap' }}>
              <button onClick={createBatch} disabled={creating || !batchNames.trim()}
                style={{ padding:'8px 18px', fontSize:13, cursor:'pointer', borderRadius:8,
                  border:'none', background:V.verm, color:'#fdf6e3', fontWeight:500 }}>
                {creating ? 'Creating…'
                  : `+ 批量创建 ${batchNames.split('\n').filter(n=>n.trim()).length} 个账号`}
              </button>
              <div style={{ fontSize:11, color:V.text3 }}>
                自动生成用户名和密码
              </div>
            </div>

            {/* Results table */}
            {batchResults.length > 0 && (
              <div style={{ marginTop:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:V.text }}>
                    ✅ 已创建 {batchResults.length} 个账号
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => {
                      const txt = batchResults.map(r =>
                        `${r.label}\t${r.username}\t${r.password}`
                      ).join('\n');
                      navigator.clipboard?.writeText(txt);
                      setCopiedBatch(true); setTimeout(()=>setCopiedBatch(false),2000);
                    }} style={{ padding:'5px 12px', fontSize:11, cursor:'pointer', borderRadius:8,
                      border:`1px solid ${V.border}`, background:V.bg,
                      color:copiedBatch?V.green:V.text2 }}>
                      {copiedBatch ? '✓ Copied!' : '📋 复制全部'}
                    </button>
                    <button onClick={() => {
                      const csv = '姓名,用户名,密码\n' + batchResults.map(r =>
                        `${r.label},${r.username},${r.password}`
                      ).join('\n');
                      const a = document.createElement('a');
                      a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
                      a.download = `accounts_${new Date().toISOString().slice(0,10)}.csv`;
                      a.click();
                    }} style={{ padding:'5px 12px', fontSize:11, cursor:'pointer', borderRadius:8,
                      border:`1px solid ${V.border}`, background:V.bg, color:V.text2 }}>
                      ⬇ CSV
                    </button>
                    <button onClick={() => setBatchResults([])}
                      style={{ padding:'5px 10px', fontSize:11, cursor:'pointer', borderRadius:8,
                        border:`1px solid ${V.border}`, background:V.bg, color:'#c0392b' }}>
                      ✕
                    </button>
                  </div>
                </div>
                <div style={{ background:'#1a0a05', borderRadius:10, padding:'10px 14px', overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr>
                        {['姓名 Name','用户名 Username','密码 Password','操作'].map(h => (
                          <th key={h} style={{ padding:'4px 10px', fontSize:10,
                            color:'#a07850', textAlign:'left', fontWeight:500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {batchResults.map((r, i) => (
                        <tr key={i}>
                          <td style={{ padding:'5px 10px', fontSize:12, color:'#fdf6e3', fontWeight:500 }}>
                            {r.label}
                          </td>
                          <td style={{ padding:'5px 10px', fontSize:12, color:'#C8A050', fontFamily:'monospace' }}>
                            {r.username}
                          </td>
                          <td style={{ padding:'5px 10px', fontSize:12, color:'#69F0AE', fontFamily:'monospace' }}>
                            {r.password}
                          </td>
                          <td style={{ padding:'5px 10px' }}>
                            <button onClick={() => {
                              navigator.clipboard?.writeText(
                                `App: \n用户名: ${r.username}\n密码: ${r.password}`
                              );
                            }} style={{ fontSize:10, padding:'2px 8px', borderRadius:6,
                              border:'1px solid #555', background:'transparent',
                              color:'#aaa', cursor:'pointer' }}>
                              📋
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize:10, color:V.text3, marginTop:6 }}>
                  💡 请保存好以上信息。系统不会再次显示密码明文。
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Invitation Card Modal ── */}
      {showQR && (
        <InvitationCard
          invite={showQR}
          url={getInviteUrl(showQR.token)}
          showName={showName}
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
                  {['学生', '账号', 'Status', '设备', 'Expires', 'Last seen', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: V.text3, fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invites.map(inv => {
                  const st = statusOf(inv);
                  const session = inv.jgw_device_sessions?.[0];
                  const isEditing = editInvite === inv.id;

                  if (isEditing) return (
                    <tr key={inv.id} style={{ borderBottom:`1px solid ${V.border}`, background:'#f9f3e8' }}>
                      <td colSpan={6} style={{ padding:'12px 14px' }}>
                        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>

                          {/* Label */}
                          <div>
                            <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>Name</label>
                            <input value={editForm.label}
                              onChange={e => setEditForm(f=>({...f, label:e.target.value}))}
                              style={{ padding:'6px 8px', borderRadius:8, border:`1px solid ${V.border}`,
                                fontSize:13, width:120 }}/>
                          </div>

                          {/* Max devices */}
                          <div>
                            <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>Devices</label>
                            <select value={editForm.max_devices}
                              onChange={e => setEditForm(f=>({...f, max_devices:Number(e.target.value)}))}
                              style={{ padding:'6px 8px', borderRadius:8, border:`1px solid ${V.border}`, fontSize:13 }}>
                              {[1,2,3,5].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>

                          {/* Expiry */}
                          <div>
                            <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>Expires</label>
                            <input type="date" value={editForm.expires_at}
                              onChange={e => setEditForm(f=>({...f, expires_at:e.target.value}))}
                              style={{ padding:'6px 8px', borderRadius:8, border:`1px solid ${V.border}`, fontSize:13 }}/>
                          </div>

                          {/* Modules */}
                          <div>
                            <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>Modules</label>
                            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                              {ALL_MODULES.map(m => {
                                const icon = pandaMap[m.emotion];
                                return (
                                  <button key={m.id} type="button" onClick={() => toggleEditModule(m.id)}
                                    style={{ padding:'5px 10px', borderRadius:20, cursor:'pointer', fontSize:12,
                                      border:`1.5px solid ${editForm.modules?.includes(m.id) ? V.verm : V.border}`,
                                      background: editForm.modules?.includes(m.id) ? V.verm : V.bg,
                                      color: editForm.modules?.includes(m.id) ? '#fdf6e3' : V.text2,
                                      display:'flex', alignItems:'center', gap:4 }}>
                                    {icon
                                      ? <img src={icon} style={{ width:14, height:14, objectFit:'contain' }} alt=""/>
                                      : m.fallback}
                                    {m.label}{editForm.modules?.includes(m.id) ? ' ✓' : ''}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Save / Cancel */}
                          <div style={{ display:'flex', gap:6, marginTop:2 }}>
                            <button onClick={() => saveEdit(inv.id)}
                              style={{ padding:'6px 16px', borderRadius:8, border:'none',
                                background:V.green, color:'#fff', fontSize:13, cursor:'pointer', fontWeight:500 }}>
                              💾 Save
                            </button>
                            <button onClick={() => setEditInvite(null)}
                              style={{ padding:'6px 12px', borderRadius:8,
                                border:`1px solid ${V.border}`, background:V.bg,
                                color:V.text2, fontSize:13, cursor:'pointer' }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );

                  return (
                    <tr key={inv.id} style={{ borderBottom: `1px solid ${V.border}` }}>
                      <td style={{ padding: '10px', fontWeight: 500, color: V.text }}>
                        {inv.label || '—'}
                        <div style={{ display:'flex', gap:3, marginTop:3, flexWrap:'wrap' }}>
                          {(inv.modules || ['lianzi']).map(m => {
                            const mod = ALL_MODULES.find(a => a.id === m);
                            const icon = mod ? pandaMap[mod.emotion] : null;
                            return mod ? (
                              <span key={m} style={{ fontSize:9, padding:'1px 5px',
                                borderRadius:8, background:'#f0e8d8', color:V.text3,
                                display:'flex', alignItems:'center', gap:2 }}>
                                {icon
                                  ? <img src={icon} style={{ width:12, height:12, objectFit:'contain' }} alt=""/>
                                  : mod.fallback}
                                {mod.label}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </td>
                      {/* Username + password */}
                      <td style={{ padding:'10px', fontSize:11, color:V.text2 }}>
                        {inv.username ? (
                          <div style={{ fontFamily:'monospace' }}>
                            <div style={{ fontWeight:600, color:V.verm }}>{inv.username}</div>
                            <div style={{ color:V.text3, fontSize:10 }}>{inv.password || '—'}</div>
                          </div>
                        ) : <span style={{ color:V.text3 }}>QR only</span>}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
                          background: st.bg, color: st.color, fontWeight: 500 }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={{ padding:'10px', textAlign:'center', fontSize:12, color:V.text2 }}>
                        {inv.jgw_device_sessions?.length || 0}
                        <span style={{ color:V.text3 }}>/{inv.max_devices||1}</span>
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
                          <button onClick={() => startEdit(inv)}
                            style={{ padding: '4px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 6,
                              border: `1px solid ${V.border}`, background: V.bg, color: V.text2 }}>
                            ✏️
                          </button>
                          <button onClick={() => setShowQR(inv)}
                            style={{ padding: '4px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 6,
                              border: `1px solid ${V.border}`, background: V.bg, color: V.text2 }}>
                            QR
                          </button>
                          <button onClick={() => navigator.clipboard?.writeText(getInviteUrl(inv.token)).then(()=>alert('Copied!'))}
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
